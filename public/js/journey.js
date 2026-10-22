// SafeHer AI - Real Journey Engine
// Uses the browser GPS + OpenStreetMap Nominatim + OSRM routing.

let activeJourney = getJourney() || null;
let routeData = null;
let journeyPanel = null;
let etaTimer = null;

function getJourneyValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function setJourneyStatus(message) {
    const el = document.getElementById("journeyStatus");
    if (el) el.textContent = message;
    if (typeof updateAssistantStatus === "function") updateAssistantStatus(message);
}

async function openJourneyPanel() {
    if (activeJourney?.status === "ACTIVE") {
        if (window.SafeHer.guardianActive) {
            alert("A journey is already active. Use the dashboard to monitor it, or complete/cancel it before starting another.");
            return;
        }
        const resume = confirm("A saved journey was found. GPS monitoring does not continue while this page is closed or suspended. Resume monitoring now?");
        if (!resume) return;
        setJourneyStatus("Requesting GPS permission to resume monitoring…");
        const gpsReady = await window.SafeHer.ensureGPSPermission?.();
        if (!gpsReady) {
            setJourneyStatus("Monitoring is paused because GPS permission is unavailable.");
            return;
        }
        activeJourney.safetyCheckActive = false;
        activeJourney.monitoringResumedAt = Date.now();
        saveJourney(activeJourney);
        window.SafeHer.journeyActive = true;
        startGuardian();
        monitorJourney();
        startEtaTimer();
        setJourneyStatus("Monitoring resumed. The period while the app was closed was not monitored.");
        const button = document.getElementById("journeyBtn");
        if (button) button.textContent = "Journey Active";
        return;
    }

    const panel = document.getElementById("journeyPanel");
    if (panel) panel.classList.remove("hidden");
    renderContacts();
}

function closeJourneyPanel() {
    const panel = document.getElementById("journeyPanel");
    if (panel) panel.classList.add("hidden");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function geocodeDestination(query) {
    const cleanedQuery = String(query || "").trim();
    if (!cleanedQuery) throw new Error("Enter a starting location and destination.");

    const mapboxToken = window.SAFEHER_CONFIG?.mapboxPublicToken?.trim();
    if (mapboxToken) {
        const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
        url.searchParams.set("q", cleanedQuery);
        url.searchParams.set("country", "IN");
        url.searchParams.set("language", "en");
        url.searchParams.set("limit", "5");
        url.searchParams.set("autocomplete", "false");
        url.searchParams.set("access_token", mapboxToken);
        const response = await fetchWithTimeout(url.toString());
        if (!response.ok) throw new Error(`Mapbox location search failed (${response.status}). Check the public token, URL restrictions, and enabled account services.`);
        const data = await response.json();
        const features = (data.features || []).filter(feature => {
            const coords = feature.geometry?.coordinates;
            return Array.isArray(coords) && coords.length >= 2 &&
                Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]));
        });
        if (!features.length) throw new Error(`Could not find “${cleanedQuery}” in India. Add a city, state, or PIN code to make the search more precise.`);
        // Prefer the best provider-ranked result, but expose the resolved label in the UI/status.
        const best = features[0];
        const props = best.properties || {};
        return {
            lat: Number(best.geometry.coordinates[1]),
            lon: Number(best.geometry.coordinates[0]),
            label: props.full_address || props.place_formatted || props.name || cleanedQuery,
            provider: "Mapbox"
        };
    }

    // Open data fallback. Country restriction helps avoid similarly named places abroad.
    const searchUrl = window.SAFEHER_CONFIG?.geocodingSearchUrl;
    if (!searchUrl) throw new Error("Geocoding service is not configured.");
    const url = `${searchUrl}?format=jsonv2&limit=5&addressdetails=1&countrycodes=in&q=${encodeURIComponent(cleanedQuery)}`;
    const response = await fetchWithTimeout(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Destination search failed. Try adding the city, state, or PIN code.");
    const results = await response.json();
    if (!results.length) throw new Error(`Could not find “${cleanedQuery}” in India. Add a city, state, or PIN code to make the search more precise.`);
    const result = results[0];
    return { lat: Number(result.lat), lon: Number(result.lon), label: result.display_name, provider: "OpenStreetMap" };
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        });
    });
}

async function buildRoute(startLat, startLon, endLat, endLon) {
    const mapboxToken = window.SAFEHER_CONFIG?.mapboxPublicToken?.trim();
    if (mapboxToken) {
        const coordinates = `${startLon},${startLat};${endLon},${endLat}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?overview=full&geometries=geojson&steps=false&access_token=${encodeURIComponent(mapboxToken)}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`Mapbox driving route failed (${response.status}). Check the token and Directions API access.`);
        const data = await response.json();
        if (data.code !== "Ok" || !data.routes?.length) throw new Error("No driving route found between these locations. Check that the selected places are correct.");
        const route = data.routes[0];
        return { distanceMeters: route.distance, durationSeconds: route.duration, coordinates: route.geometry.coordinates, provider: "Mapbox" };
    }

    const routingBase = window.SAFEHER_CONFIG?.routingBaseUrl;
    if (!routingBase) throw new Error("Routing service is not configured.");
    const url = `${routingBase}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=false`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error("Routing service is unavailable. Try again later or configure a Mapbox public token.");
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("No driving route found. Check the starting point and destination.");
    const route = data.routes[0];
    return { distanceMeters: route.distance, durationSeconds: route.duration, coordinates: route.geometry.coordinates, provider: "OSRM" };
}

async function startJourney() {
    if (activeJourney) {
        alert("A journey is already active. Complete or cancel it first.");
        return;
    }

    const userName = getJourneyValue("profileName");
    const startPoint = getJourneyValue("startPoint");
    const destination = getJourneyValue("destination");
    const driverName = getJourneyValue("driverName");
    const driverPhone = getJourneyValue("driverPhone").replace(/[\s()-]/g, "");
    const vehicleNumber = getJourneyValue("vehicleNumber").toUpperCase();
    const vehicleType = getJourneyValue("vehicleType");
    const minutesInput = Number(document.getElementById("journeyMinutes")?.value || 0);

    if (!userName || !startPoint || !destination || !driverName || !driverPhone || !vehicleNumber || !vehicleType || !document.getElementById("journeyMinutes")?.value) {
        alert("Please complete your name, starting point, destination, driver details, vehicle details and estimated arrival time.");
        return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(driverPhone)) {
        alert("Enter the driver's phone number with the international country code, e.g. +919876543210.");
        return;
    }
    if (userName.length > 120 || startPoint.length > 250 || destination.length > 250 || driverName.length > 120 || vehicleNumber.length > 40 || vehicleType.length > 80) {
        alert("One or more journey fields are too long. Please shorten the details and try again.");
        return;
    }
    if (!Number.isFinite(minutesInput) || minutesInput < 1 || minutesInput > 1440) {
        alert("Estimated journey time must be between 1 and 1440 minutes.");
        return;
    }
    if (typeof saveUserProfile === "function") saveUserProfile({ name: userName });
    if (!hasTrustedContacts()) {
        alert("Add at least one trusted contact before starting a journey.");
        return;
    }
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        alert("GPS requires HTTPS or localhost. On mobile, open the HTTPS deployed version.");
        return;
    }

    setJourneyStatus("📍 Requesting GPS permission...");

    try {
        if (typeof window.SafeHer?.ensureGPSPermission === "function") {
            const gpsReady = await window.SafeHer.ensureGPSPermission();
            if (!gpsReady) {
                setJourneyStatus("⚠️ GPS permission is required before starting a protected journey.");
                return;
            }
        }
        const position = await getCurrentPosition();
        const start = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
        };

        setJourneyStatus("🔎 Finding starting point and destination...");
        const startData = await geocodeDestination(startPoint);
        const destinationData = await geocodeDestination(destination);

        const distanceFromEnteredStart = getDistanceMeters(start.lat, start.lon, startData.lat, startData.lon);
        if (distanceFromEnteredStart > 5000) {
            throw new Error("The entered starting point is more than 5 km from your current GPS location. Enter a nearby starting point so route monitoring can work safely.");
        }

        setJourneyStatus("🗺 Building your real driving route...");
        routeData = await buildRoute(start.lat, start.lon, destinationData.lat, destinationData.lon);

        const estimatedMinutes = minutesInput > 0
            ? minutesInput
            : Math.max(1, Math.round(routeData.durationSeconds / 60));

        const now = Date.now();
        activeJourney = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(now),
            userName,
            startPoint,
            startPointResolved: startData.label,
            startLat: startData.lat,
            startLon: startData.lon,
            destination,
            destinationResolved: destinationData.label,
            destinationLat: destinationData.lat,
            destinationLon: destinationData.lon,
            driverName,
            driverPhone,
            vehicleNumber,
            vehicleType,
            route: `GPS route from ${startData.label} to ${destinationData.label}`,
            plannedDistanceMeters: routeData.distanceMeters,
            plannedDurationSeconds: routeData.durationSeconds,
            routeCoordinates: routeData.coordinates,
            estimatedMinutes,
            autoEscalateOnNoResponse: document.getElementById("autoEscalateOnNoResponse")?.checked === true,
            startTime: now,
            expectedEndTime: now + estimatedMinutes * 60000,
            status: "ACTIVE",
            lastLocation: start,
            lastLocationTime: now,
            deviationCount: 0,
            safetyCheckActive: false
        };

        saveJourney(activeJourney);
        window.SafeHer.journeyActive = true;
        const journeyButton = document.getElementById("journeyBtn");
        if (journeyButton) journeyButton.textContent = "Journey Active";
        window.SafeHer.logSafetyEvent?.("Journey started", `${destination} • ${vehicleNumber}`);
        window.SafeHer.renderJourneyRoute?.(routeData.coordinates);
        setJourneyStatus(`🟢 Journey active • ${routeData.provider || "Road route"} • ${formatDistance(routeData.distanceMeters)} • ETA ${estimatedMinutes} min`);
        closeJourneyPanel();

        if (typeof startGuardian === "function") startGuardian();
        if (typeof monitorJourney === "function") monitorJourney();
        startEtaTimer();

        if (typeof speak === "function") {
            speak(`Journey started. Your destination is ${destination}. Guardian AI is monitoring your route.`);
        }
    } catch (error) {
        console.error(error);
        setJourneyStatus(`❌ ${error.message}`);
        alert(`Unable to start journey: ${error.message}`);
    }
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const radians = value => value * Math.PI / 180;
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "0 km";
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function startEtaTimer() {
    clearInterval(etaTimer);
    checkETA();
    etaTimer = setInterval(checkETA, 30000);
}

function checkETA() {
    if (!activeJourney) return;
    const remainingMs = activeJourney.expectedEndTime - Date.now();
    const minutes = Math.ceil(remainingMs / 60000);
    if (minutes > 0) {
        setJourneyStatus(`🛰 Journey active • approximately ${minutes} min remaining`);
    } else {
        setJourneyStatus("⚠️ Expected arrival time reached. Please confirm whether you are safe.");
        if (!activeJourney.etaCheckPromptedAt) {
            activeJourney.etaCheckPromptedAt = Date.now();
            saveJourney(activeJourney);
            if (typeof promptSafetyOnce === "function") {
                promptSafetyOnce("your expected arrival time has passed");
            }
        }
    }
}


function completeJourney() {
    if (!activeJourney || activeJourney.status !== "ACTIVE") {
        return;
    }

    const confirmed = confirm(
        "Have you safely reached your destination? Completing this journey will stop GPS monitoring."
    );

    if (!confirmed) return;

    const completed = {
        ...activeJourney,
        status: "COMPLETED",
        completedAt: Date.now()
    };

    addJourneyHistory(completed);
    clearJourney();
    activeJourney = null;
    window.SafeHer.journeyActive = false;

    const journeyButton = document.getElementById("journeyBtn");
    if (journeyButton) {
        journeyButton.textContent = "Start Safe Journey";
    }

    routeData = null;

    if (etaTimer !== null) {
        clearInterval(etaTimer);
        etaTimer = null;
    }
    stopJourneySimulation();

    if (typeof stopGuardian === "function") {
        stopGuardian();
    }

    window.SafeHer.renderJourneyRoute?.([]);
    window.SafeHer.logSafetyEvent?.(
        "Journey completed",
        completed.destination || "Journey"
    );

    setJourneyStatus("Journey marked as completed. GPS monitoring has stopped.");

    if (typeof speak === "function") {
        speak("Journey completed. GPS monitoring has stopped.");
    }
}
function cancelJourney() {
    if (!activeJourney) {
        closeJourneyPanel();
        return;
    }
    if (!confirm("Cancel the active journey?")) return;
    const cancelled = { ...activeJourney, status: "CANCELLED", cancelledAt: Date.now() };
    addJourneyHistory(cancelled);
    clearJourney();
    activeJourney = null;
    window.SafeHer.journeyActive = false;
    const journeyButton = document.getElementById("journeyBtn");
    if (journeyButton) journeyButton.textContent = "Start Safe Journey";
    routeData = null;
    clearInterval(etaTimer);
    stopJourneySimulation();
    if (typeof stopGuardian === "function") stopGuardian();
    closeJourneyPanel();
    setJourneyStatus("Journey cancelled.");
    if (typeof speak === "function") speak("Journey cancelled.");
}


let simulationTimer = null;
let simulationStartedAt = 0;
let simulationDurationMs = 60000;
let simulationAnomalyTriggered = false;

function setSimulationStatus(message) {
    const el = document.getElementById("simulationStatus");
    if (el) el.textContent = message;
}

function interpolateRoutePosition(coordinates, progress) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error("The route has too few points to simulate.");
    const distance = (a, b) => getDistanceMeters(a[1], a[0], b[1], b[0]);
    const lengths = [];
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const segment = distance(coordinates[i], coordinates[i + 1]);
        lengths.push(segment);
        total += segment;
    }
    if (!total) return { lat: coordinates[0][1], lon: coordinates[0][0] };
    let target = Math.min(1, Math.max(0, progress)) * total;
    for (let i = 0; i < lengths.length; i++) {
        if (target <= lengths[i] || i === lengths.length - 1) {
            const ratio = lengths[i] > 0 ? Math.min(1, target / lengths[i]) : 0;
            return {
                lon: coordinates[i][0] + (coordinates[i + 1][0] - coordinates[i][0]) * ratio,
                lat: coordinates[i][1] + (coordinates[i + 1][1] - coordinates[i][1]) * ratio
            };
        }
        target -= lengths[i];
    }
    const last = coordinates[coordinates.length - 1];
    return { lat: last[1], lon: last[0] };
}

async function startJourneySimulation() {
    if (activeJourney?.status === "ACTIVE") {
        alert("Complete or cancel the current journey before starting a simulation.");
        return;
    }
    const userName = getJourneyValue("profileName");
    const startPoint = getJourneyValue("startPoint");
    const destination = getJourneyValue("destination");
    const driverName = getJourneyValue("driverName");
    const driverPhone = getJourneyValue("driverPhone").replace(/[\s()-]/g, "");
    const vehicleNumber = getJourneyValue("vehicleNumber").toUpperCase();
    const vehicleType = getJourneyValue("vehicleType");
    const estimatedMinutes = Number(document.getElementById("journeyMinutes")?.value || 0);
    const durationSeconds = Number(document.getElementById("simulationDurationSeconds")?.value || 0);
    const anomalyPercent = Number(document.getElementById("simulationAnomalyPercent")?.value || 0);

    if (!userName || !startPoint || !destination || !driverName || !driverPhone || !vehicleNumber || !vehicleType || !estimatedMinutes) {
        alert("Complete the user, start, destination, driver, vehicle and estimated arrival fields first.");
        return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(driverPhone)) {
        alert("Enter the driver's phone number with the international country code, e.g. +919876543210.");
        return;
    }
    if (!hasTrustedContacts()) {
        alert("Add at least one trusted contact before starting the simulation.");
        return;
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds < 15 || durationSeconds > 600) {
        alert("Simulation duration must be between 15 and 600 seconds.");
        return;
    }
    if (!Number.isFinite(anomalyPercent) || anomalyPercent < 10 || anomalyPercent > 90) {
        alert("Choose an unusual-event point between 10% and 90% of the route.");
        return;
    }
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        alert("Route simulation needs HTTPS or localhost.");
        return;
    }

    try {
        setSimulationStatus("Looking up both entered locations and calculating a real route…");
        if (typeof saveUserProfile === "function") saveUserProfile({ name: userName });
        const [startData, destinationData] = await Promise.all([
            geocodeDestination(startPoint), geocodeDestination(destination)
        ]);
        routeData = await buildRoute(startData.lat, startData.lon, destinationData.lat, destinationData.lon);
        const now = Date.now();
        activeJourney = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(now),
            userName, startPoint, startPointResolved: startData.label, startLat: startData.lat, startLon: startData.lon,
            destination, destinationResolved: destinationData.label, destinationLat: destinationData.lat, destinationLon: destinationData.lon,
            driverName, driverPhone, vehicleNumber, vehicleType,
            route: `Simulated vehicle route from ${startData.label} to ${destinationData.label}`,
            plannedDistanceMeters: routeData.distanceMeters, plannedDurationSeconds: routeData.durationSeconds,
            routeCoordinates: routeData.coordinates, estimatedMinutes,
            autoEscalateOnNoResponse: false, simulationMode: true,
            simulationAllowRealSMS: document.getElementById("simulationAllowRealSMS")?.checked === true,
            simulationAnomalyPercent: anomalyPercent,
            startTime: now, expectedEndTime: now + estimatedMinutes * 60000,
            status: "ACTIVE", lastLocation: { lat: startData.lat, lon: startData.lon }, lastLocationTime: now,
            deviationCount: 0, safetyCheckActive: false
        };
        saveJourney(activeJourney);
        window.SafeHer.journeyActive = true;
        window.SafeHer.renderJourneyRoute?.(routeData.coordinates);
        closeJourneyPanel();
        // Simulation playback is intentionally separate from live GPS Guardian monitoring.
        if (typeof window.SafeHer.renderSimulationPosition === "function") {
            window.SafeHer.renderSimulationPosition(startData.lat, startData.lon, `${vehicleType} • ${vehicleNumber} (SIMULATION)`);
        }
        const journeyButton = document.getElementById("journeyBtn");
        if (journeyButton) journeyButton.textContent = "Simulation Active";
        window.SafeHer.logSafetyEvent?.("Journey simulation started", `${startPoint} → ${destination} • simulated route playback`);
        setJourneyStatus(`🧪 SIMULATION • ${formatDistance(routeData.distanceMeters)} route • ${durationSeconds}s playback`);
        setSimulationStatus(`Simulation running on ${routeData.provider || "road routing"}: ${startData.label} → ${destinationData.label}. The unusual-event check will appear at ${anomalyPercent}% of the route. No real GPS tracking is being used.`);

        simulationDurationMs = durationSeconds * 1000;
        simulationStartedAt = Date.now();
        simulationAnomalyTriggered = false;
        clearInterval(simulationTimer);
        simulationTimer = setInterval(() => {
            if (!activeJourney?.simulationMode || activeJourney.status !== "ACTIVE") {
                clearInterval(simulationTimer);
                simulationTimer = null;
                return;
            }
            const elapsed = Date.now() - simulationStartedAt;
            const progress = Math.min(1, elapsed / simulationDurationMs);
            const point = interpolateRoutePosition(routeData.coordinates, progress);
            activeJourney.lastLocation = point;
            activeJourney.lastLocationTime = Date.now();
            activeJourney.lastSpeedKmh = routeData.distanceMeters / (simulationDurationMs / 1000) * 3.6;
            saveJourney(activeJourney);
            window.SafeHer.gps && Object.assign(window.SafeHer.gps, {
                granted: true, ready: true, latitude: point.lat, longitude: point.lon,
                accuracy: 0, speedKmh: activeJourney.lastSpeedKmh, lastUpdated: Date.now(), simulated: true
            });
            window.SafeHer.renderSimulationPosition?.(point.lat, point.lon, `${vehicleType} • ${vehicleNumber} (SIMULATION)`);
            window.SafeHer.updateDashboard?.();
            const pct = Math.round(progress * 100);
            setSimulationStatus(`Simulated vehicle moving along route: ${pct}% complete. ${simulationAnomalyTriggered ? "Safety check has been triggered." : `Unusual-event trigger at ${anomalyPercent}%.`}`);
            if (!simulationAnomalyTriggered && pct >= anomalyPercent) {
                simulationAnomalyTriggered = true;
                window.SafeHer.logSafetyEvent?.("Simulated unusual journey event", `Route playback reached ${pct}% of the route`);
                if (typeof promptSafetyOnce === "function") promptSafetyOnce("a simulated unexpected route event");
                else if (typeof showSafetyCheck === "function") showSafetyCheck("a simulated unexpected route event");
                setSimulationStatus("Unusual event simulated. Respond to the 'Are you safe?' prompt to continue the scenario.");
            } else if (progress >= 1) {
                clearInterval(simulationTimer);
                simulationTimer = null;
                setSimulationStatus("The simulated vehicle reached the destination. Confirm completion from the dashboard.");
            }
        }, 200);
    } catch (error) {
        console.error("Journey simulation failed", error);
        setSimulationStatus(`Simulation could not start: ${error.message}`);
        alert(`Unable to start simulation: ${error.message}`);
    }
}

function handleSimulationUnsafeResponse() {
    stopJourneySimulation();
    if (typeof window.SafeHer.activateSimulationSOS === "function") {
        window.SafeHer.activateSimulationSOS({
            reason: "User selected No during a simulated journey safety check.",
            allowRealSMS: activeJourney?.simulationAllowRealSMS === true
        });
    } else {
        alert("Simulation SOS handler is unavailable. No message was sent.");
    }
}

function stopJourneySimulation() {
    if (simulationTimer !== null) clearInterval(simulationTimer);
    simulationTimer = null;
}

function getActiveJourney() {
    return activeJourney;
}

window.SafeHer = window.SafeHer || {};
window.SafeHer.getRouteData = () => routeData;
window.SafeHer.getActiveJourney = getActiveJourney;
window.SafeHer.completeJourney = completeJourney;
window.SafeHer.startJourneySimulation = startJourneySimulation;
window.SafeHer.handleSimulationUnsafeResponse = handleSimulationUnsafeResponse;
window.SafeHer.stopJourneySimulation = stopJourneySimulation;

window.addEventListener("DOMContentLoaded", () => {
    journeyPanel = document.getElementById("journeyPanel");
    document.getElementById("journeyBtn")?.addEventListener("click", openJourneyPanel);
    document.getElementById("startJourneyBtn")?.addEventListener("click", startJourney);
    document.getElementById("startJourneySimulationBtn")?.addEventListener("click", startJourneySimulation);
    document.getElementById("cancelJourneyBtn")?.addEventListener("click", cancelJourney);
    document.getElementById("journeyEmergencyBtn")?.addEventListener("click", openEmergencyCall);
    document.getElementById("completeJourneyBtn")
    ?.addEventListener("click", completeJourney);
    if (activeJourney?.status === "ACTIVE" && activeJourney.simulationMode === true) {
        addJourneyHistory({ ...activeJourney, status: "SIMULATION_INTERRUPTED", interruptedAt: Date.now() });
        clearJourney();
        activeJourney = null;
        window.SafeHer.journeyActive = false;
        setJourneyStatus("A previous simulation was interrupted when the page closed. Start a new simulation or live journey.");
    }
    if (activeJourney?.status === "ACTIVE") {
        if (activeJourney.routeCoordinates?.length) {
            routeData = {
                distanceMeters: activeJourney.plannedDistanceMeters,
                durationSeconds: activeJourney.plannedDurationSeconds,
                coordinates: activeJourney.routeCoordinates
            };
        }
        // Never imply that monitoring continued while the browser was closed.
        activeJourney.monitoringInterruptedAt = Date.now();
        activeJourney.safetyCheckActive = false;
        saveJourney(activeJourney);
        setJourneyStatus("A saved journey was found, but GPS monitoring is paused. Tap Resume GPS Monitoring to continue.");
        const button = document.getElementById("journeyBtn");
        if (button) button.textContent = "Resume GPS Monitoring";
    }
});
