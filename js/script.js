// SafeHer AI - Application Bootstrap

document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ SafeHer AI Loaded");
    let events = [];
    try {
        const parsed = JSON.parse(localStorage.getItem("safeher_incident_log") || "[]");
        if (Array.isArray(parsed)) events = parsed;
    } catch (error) {
        console.warn("Incident history could not be read.", error);
    }
    const incidentCount = document.getElementById("incidentCount");
    if (incidentCount) incidentCount.textContent = String(events.length);

});

// SafeHer AI - Dashboard presentation layer
function refreshSafetyDashboard() {
    const journey = typeof getActiveJourney === "function" ? getActiveJourney() : null;
    const guardian = !!window.SafeHer?.guardianActive;
    const state = document.getElementById("dashboardState");
    const live = document.getElementById("journeyLiveBadge");
    const destination = document.getElementById("dashDestination");
    const journeyDetails = document.getElementById("dashJourneyDetails");
    const eta = document.getElementById("dashEta");
    const distance = document.getElementById("dashDistance");
    const vehicle = document.getElementById("dashVehicle");
    const guardianBadge = document.getElementById("guardianBadge");
    const guardianSummary = document.getElementById("guardianSummary");
    const gpsHealth = document.getElementById("gpsHealth");
    const routeHealth = document.getElementById("routeHealth");

    if (journey) {
        state?.classList.add("status-active");
        if (state) state.innerHTML = journey.simulationMode
            ? '<span class="status-dot"></span>Simulation Active'
            : guardian
                ? '<span class="status-dot"></span>Journey Active'
                : '<span class="status-dot"></span>Monitoring Paused';
        if (live) live.textContent = journey.simulationMode ? "SIMULATION" : "Live journey";
        if (destination) destination.textContent = journey.destination || "Active journey";
        if (journeyDetails) journeyDetails.textContent = `From: ${journey.startPoint || "Current GPS location"} · User: ${journey.userName || "Not provided"} · Driver: ${journey.driverName || "Not provided"} (${journey.driverPhone || "No number"})`;
        if (vehicle) vehicle.textContent = journey.vehicleNumber || "--";
        if (distance) distance.textContent = typeof formatDistance === "function" ? formatDistance(journey.plannedDistanceMeters) : "--";
        if (eta) {
            const mins = Math.max(0, Math.ceil((journey.expectedEndTime - Date.now()) / 60000));
            eta.textContent = mins > 0 ? `${mins} min` : "Due";
        }
        if (gpsHealth) gpsHealth.textContent = journey.simulationMode
            ? "Simulated position (not GPS)"
            : guardian && window.SafeHer?.gps?.lastUpdated
                ? `Updated ${Math.max(0, Math.round((Date.now() - window.SafeHer.gps.lastUpdated) / 1000))}s ago`
                : "Monitoring paused / reconnect GPS";
        if (routeHealth) routeHealth.textContent = journey.simulationMode
            ? "Route playback simulation"
            : !guardian
                ? "Monitoring paused"
                : (journey.lastDeviationMeters || 0) > 0
                    ? `⚠️ ${journey.lastDeviationMeters} m off route`
                    : "🟢 On planned route";
    } else {
        state?.classList.remove("status-active");
        if (state) state.innerHTML = '<span class="status-dot"></span>Ready';
        if (live) live.textContent = "No active journey";
        if (destination) destination.textContent = "No journey started";
        if (journeyDetails) journeyDetails.textContent = "Journey details will appear here.";
        if (eta) eta.textContent = "--";
        if (distance) distance.textContent = "--";
        if (vehicle) vehicle.textContent = "--";
        if (gpsHealth) gpsHealth.textContent = "Waiting";
        if (routeHealth) routeHealth.textContent = "Not monitoring";
    }

    if (guardianBadge) guardianBadge.textContent = journey?.simulationMode ? "Simulation" : (guardian ? "Active" : (journey ? "Paused" : "Standby"));
    if (guardianSummary) guardianSummary.textContent = journey?.simulationMode
        ? "A simulated vehicle is moving along the calculated route. This is not live GPS tracking."
        : guardian
            ? "GPS monitoring is active while this page remains able to run."
            : (journey ? "A journey exists, but monitoring is not running. Resume GPS monitoring." : "Starts when you begin a protected journey.");
    const speed = document.getElementById("speedHealth");
    if (speed) speed.textContent = guardian ? `${(window.SafeHer?.gps?.speedKmh || 0).toFixed(1)} km/h` : "--";
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("completeJourneyBtn")?.addEventListener("click", () => {
        if (typeof getActiveJourney === "function" && getActiveJourney()) {
            if (confirm("Mark this journey as completed safely?")) completeJourney();
        } else {
            alert("No active journey to complete.");
        }
        refreshSafetyDashboard();
    });
    refreshSafetyDashboard();
    setInterval(refreshSafetyDashboard, 5000);
});

window.SafeHer = window.SafeHer || {};
window.SafeHer.updateDashboard = refreshSafetyDashboard;
