// SafeHer AI - Guardian AI / Route Deviation Safety Engine
"use strict";

let watchId = null;
let guardianRunning = false;
let previousPosition = null;
let stationarySince = null;
let lastSafetyPrompt = 0;
let routeDeviationSamples = 0;
let currentSpeedKmh = 0;
let safetyResponseTimer = null;
let safetyCountdownInterval = null;

const GUARDIAN = {
    stationaryMinutes: Number(window.SAFEHER_CONFIG?.prolongedStopMinutes || 3),
    deviationMeters: Number(window.SAFEHER_CONFIG?.routeDeviationMeters || 300),
    deviationConfirmSamples: Number(window.SAFEHER_CONFIG?.routeDeviationConfirmSamples || 2),
    safetyCooldownMs: Number(window.SAFEHER_CONFIG?.safetyPromptCooldownMinutes || 5) * 60 * 1000,
};

function startGuardian() {
    // Guardian monitoring runs only for an active journey; checks are triggered
    // by observed journey signals or the expected-arrival time, not a demo timer.
    const wasRunning = guardianRunning;
    guardianRunning = true;
    window.SafeHer.guardianActive = true;
    updateGuardianUI("active", "Monitoring your route and GPS");
    updateAssistantStatus("🛡 Guardian AI is active.");

    if (!wasRunning && typeof speak === "function") {
        speak("Guardian AI is now monitoring your journey.");
    }
}

function stopGuardian() {
    clearSafetyResponseCountdown();
    const safetyPanel = document.getElementById("safetyCheckPanel");
    safetyPanel?.classList.add("hidden");
    safetyPanel?.setAttribute("aria-hidden", "true");
    guardianRunning = false;
    window.SafeHer.guardianActive = false;
    if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    previousPosition = null;
    stationarySince = null;
    routeDeviationSamples = 0;
    lastSafetyPrompt = 0;
    updateGuardianUI("standby", "Not monitoring");
}

function monitorJourney() {
    if (!guardianRunning) startGuardian();
    if (!navigator.geolocation) {
        updateAssistantStatus("❌ GPS is not supported by this browser.");
        return;
    }
    if (watchId !== null) return;

    if (typeof window.SafeHer?.ensureGPSPermission === "function" && !window.SafeHer.gps?.granted) {
        window.SafeHer.ensureGPSPermission().then(ok => { if (ok) monitorJourney(); });
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        analyzeLocation,
        handleLocationError,
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
}

function handleLocationError(error) {
    console.warn("GPS error:", error.message);
    updateGuardianUI("warning", error.code === 1 ? "GPS permission denied" : "Waiting for GPS signal");
    if (error.code === 1) updateAssistantStatus("⚠️ Location permission denied. Guardian needs GPS access.");
    else updateAssistantStatus("⚠️ GPS signal unavailable. Guardian will keep retrying.");
}

function analyzeLocation(position) {
    if (!guardianRunning) return;
    const { latitude, longitude, speed, accuracy } = position.coords;
    const now = Date.now();
    currentSpeedKmh = Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : 0;

    const journey = getActiveJourney();
    if (!journey) return;

    // Poor GPS fixes are displayed but not used to infer route deviations or stops.
    const maxAcceptedAccuracy = Number(window.SAFEHER_CONFIG?.gpsMaximumAcceptedAccuracyMeters || 100);
    if (!Number.isFinite(accuracy) || accuracy > maxAcceptedAccuracy) {
        updateGuardianUI("warning", `GPS accuracy is weak (±${Math.round(accuracy || 0)} m); route checks are paused`);
        window.SafeHer.gps && Object.assign(window.SafeHer.gps, {
            granted: true, ready: true, latitude, longitude, accuracy,
            speedKmh: currentSpeedKmh, lastUpdated: now
        });
        updateLocationUI(latitude, longitude, accuracy);
        window.SafeHer.updateDashboard?.();
        return;
    }

    journey.lastLocation = { lat: latitude, lon: longitude };
    journey.lastLocationTime = now;
    journey.lastAccuracy = accuracy;
    journey.lastSpeedKmh = currentSpeedKmh;
    saveJourney(journey);

    updateLocationUI(latitude, longitude, accuracy);
    window.SafeHer.gps && Object.assign(window.SafeHer.gps, {
        granted: true, ready: true, latitude, longitude, accuracy,
        speedKmh: currentSpeedKmh, lastUpdated: now
    });
    window.SafeHer.renderJourneyRoute?.(window.SafeHer.getRouteData?.()?.coordinates || journey.routeCoordinates || []);
    window.SafeHer.updateDashboard?.();

    if (previousPosition) {
        const distance = getDistance(previousPosition.lat, previousPosition.lon, latitude, longitude);
        const elapsed = Math.max(1, (now - previousPosition.time) / 1000);
        const measuredSpeed = distance / elapsed;

        if (measuredSpeed < 1.5 && currentSpeedKmh < 5) {
            if (!stationarySince) stationarySince = now;
            const stationaryMinutes = (now - stationarySince) / 60000;
            if (stationaryMinutes >= GUARDIAN.stationaryMinutes) promptSafetyOnce("a prolonged stop");
        } else {
            stationarySince = null;
        }

        const route = window.SafeHer.getRouteData?.();
        if (route?.coordinates?.length) {
            const deviation = distanceToRouteMeters(latitude, longitude, route.coordinates);
            const offRoute = deviation > GUARDIAN.deviationMeters;

            if (offRoute) {
                routeDeviationSamples += 1;
                journey.deviationCount = routeDeviationSamples;
                journey.lastDeviationMeters = Math.round(deviation);
                saveJourney(journey);
                updateGuardianUI("warning", `Route change detected • ${Math.round(deviation)} m off route`);
                const routeHealth = document.getElementById("routeHealth");
                if (routeHealth) routeHealth.textContent = `⚠️ ${Math.round(deviation)} m off route`;

                // Require two consecutive GPS observations to avoid false alarms caused by GPS drift.
                if (routeDeviationSamples >= GUARDIAN.deviationConfirmSamples) {
                    window.SafeHer.logSafetyEvent?.("Route deviation detected", `${Math.round(deviation)}m from planned route`);
                    promptSafetyOnce("an unexpected route change");
                }
            } else {
                routeDeviationSamples = 0;
                journey.deviationCount = 0;
                journey.lastDeviationMeters = 0;
                saveJourney(journey);
                updateGuardianUI("active", "On planned route");
                const routeHealth = document.getElementById("routeHealth");
                if (routeHealth) routeHealth.textContent = "🟢 On planned route";
            }
        }
    }

    const destinationDistance = getDistance(latitude, longitude, journey.destinationLat, journey.destinationLon);
    if (destinationDistance < 100 && !journey.nearDestinationNoticeShown) {
        journey.nearDestinationNoticeShown = true;
        saveJourney(journey);
        setJourneyStatus("You appear to be near your destination. Confirm completion yourself when you are ready.");
        window.SafeHer.logSafetyEvent?.("Near destination", "User confirmation required to complete journey");
    } else if (destinationDistance >= 150 && journey.nearDestinationNoticeShown) {
        journey.nearDestinationNoticeShown = false;
        saveJourney(journey);
    }

    previousPosition = { lat: latitude, lon: longitude, time: now };
}

function promptSafetyOnce(reason) {
    const now = Date.now();
    if (now - lastSafetyPrompt < GUARDIAN.safetyCooldownMs) return;
    const journey = getActiveJourney();
    if (journey?.safetyCheckActive || window.SafeHer.sosActive) return;

    lastSafetyPrompt = now;
    if (journey) {
        journey.safetyCheckActive = true;
        saveJourney(journey);
    }
    showSafetyCheck(reason);
}

function showSafetyCheck(reason = "unusual journey activity") {
    window.SafeHer.logSafetyEvent?.("Safety confirmation requested", reason);
    const panel = document.getElementById("safetyCheckPanel");
    const reasonEl = document.getElementById("safetyReason");
    const detailEl = document.getElementById("safetyReasonDetail");

    if (reasonEl) reasonEl.textContent = "I noticed something unusual during your journey.";
    if (detailEl) detailEl.textContent = formatSafetyReason(reason);
    if (panel) {
        // Keep the safety dialog at the document root so no parent section
        // can clip it, hide it, or create a stacking-context issue.
        if (panel.parentElement !== document.body) document.body.appendChild(panel);
        panel.classList.remove("hidden");
        panel.setAttribute("aria-hidden", "false");
        startSafetyResponseCountdown();
    } else {
        console.error("[Guardian] safetyCheckPanel was not found in the page.");
    }

    updateGuardianUI("warning", "Waiting for your safety confirmation");
    updateAssistantStatus("⚠️ Guardian AI needs a quick safety confirmation.");

    if (typeof speak === "function") {
        speak(`I noticed something unusual: ${formatSafetyReason(reason)}. Are you safe?`);
    }
}

function clearSafetyResponseCountdown() {
    if (safetyResponseTimer !== null) clearTimeout(safetyResponseTimer);
    if (safetyCountdownInterval !== null) clearInterval(safetyCountdownInterval);
    safetyResponseTimer = null;
    safetyCountdownInterval = null;
}

function startSafetyResponseCountdown() {
    clearSafetyResponseCountdown();
    const duration = Math.max(5, Number(window.SAFEHER_CONFIG?.safetyResponseSeconds || 20));
    const endAt = Date.now() + duration * 1000;
    const countdown = document.getElementById("safetyCountdown");

    const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        if (countdown) {
            countdown.textContent = remaining > 0
                ? `Please respond within ${remaining} seconds. The timer may be delayed if the browser is suspended.`
                : "Response window ended.";
        }
    };

    updateCountdown();
    safetyCountdownInterval = setInterval(updateCountdown, 250);
    safetyResponseTimer = setTimeout(() => {
        clearSafetyResponseCountdown();
        const journey = getActiveJourney();
        if (!journey || !journey.safetyCheckActive || window.SafeHer.sosActive) return;

        window.SafeHer.logSafetyEvent?.("Safety check unanswered", "No response within the configured response window");
        if (countdown) {
            countdown.textContent = journey.autoEscalateOnNoResponse
                ? "No response received. Starting the configured emergency alert workflow."
                : "No response received. If you need help, use the emergency controls. Automatic escalation is not enabled for this journey.";
        }

        if (journey.autoEscalateOnNoResponse === true) {
            journey.safetyCheckActive = false;
            saveJourney(journey);
            document.getElementById("safetyCheckPanel")?.classList.add("hidden");
            document.getElementById("safetyCheckPanel")?.setAttribute("aria-hidden", "true");
            updateAssistantStatus("No response to the Guardian check. Starting the configured emergency alert workflow.");
            startSOS({ reason: "No response to Guardian safety check within the configured response window." });
        } else {
            updateGuardianUI("warning", "Safety check unanswered — waiting for your action");
        }
    }, duration * 1000);
}

function formatSafetyReason(reason) {
    const r = String(reason || "").toLowerCase();
    if (r.includes("route")) return "The vehicle appears to have moved away from the planned route.";
    if (r.includes("arrival") || r.includes("eta") || r.includes("estimated")) {
        return "Your expected arrival time has passed. Please confirm whether you are safe.";
    }
    if (r.includes("longer")) {
        return "Your journey appears to have stopped for longer than expected.";
    }
    if (r.includes("tracking") || r.includes("gps")) return "Your GPS tracking appears to have been interrupted.";
    if (r.includes("stop")) return "The journey appears to have stopped for longer than expected.";
    return "Your recent journey movement does not match the expected pattern.";
}

function respondToSafety(answer) {
    clearSafetyResponseCountdown();
    const panel = document.getElementById("safetyCheckPanel");
    if (panel) {
        panel.classList.add("hidden");
        panel.setAttribute("aria-hidden", "true");
    }

    const journey = getActiveJourney();
    if (journey) {
        journey.safetyCheckActive = false;
        journey.deviationCount = 0;
        saveJourney(journey);
    }

    if (answer === "no") {
        // Simulation must never silently send real alerts. Its handler can send a clearly labelled test SMS only if the user opted in.
        if (journey?.simulationMode === true) {
            window.SafeHer.logSafetyEvent?.("Simulation user reported unsafe", "Simulation SOS flow started");
            updateAssistantStatus("🚨 Simulation SOS flow started. Check the emergency response panel.");
            updateGuardianUI("danger", "Simulation SOS activated");
            window.SafeHer.handleSimulationUnsafeResponse?.();
            return;
        }
        // "No" means the user is NOT safe. Start SOS immediately.
        window.SafeHer.logSafetyEvent?.("User reported unsafe", "SOS activated from Guardian safety check");
        updateAssistantStatus("🚨 You reported that you are not safe. SOS is activating now.");
        updateGuardianUI("danger", "SOS activated");
        if (typeof speak === "function") speak("SOS is active. Check the notification status and use the emergency call control if you need emergency services.");
        startSOS({ reason: "User reported that she is not safe after a Guardian safety check." });
        return;
    }

    if (answer === "yes") {
        lastSafetyPrompt = Date.now();
        if (journey?.simulationMode === true) {
            updateGuardianUI("active", "Simulation resumed • vehicle playback continues");
            updateAssistantStatus("✅ Safety confirmed in simulation. The simulated vehicle will continue along the route.");
            if (typeof speak === "function") speak("Safety confirmed. The journey simulation will continue.");
            return;
        }
        updateGuardianUI("active", "You are safe • Monitoring continues");
        updateAssistantStatus("✅ Safety confirmed. Guardian monitoring continues.");
        if (typeof speak === "function") speak("Glad to hear you are safe. I will continue monitoring your journey.");
    }
}

function updateLocationUI(lat, lon, accuracy) {
    const link = getMapLink(lat, lon);
    const status = document.getElementById("locationStatus");
    const gps = document.getElementById("gpsStatus");
    if (status) status.innerHTML = `📍 <a href="${link}" target="_blank" rel="noopener">Live location</a>`;
    if (gps) gps.textContent = `GPS accuracy: ±${Math.round(accuracy || 0)} m • Speed: ${currentSpeedKmh.toFixed(1)} km/h`;
}

function distanceToRouteMeters(lat, lon, coordinates) {
    // Compute distance to route segments, not only sparse vertices.
    // A local equirectangular projection is suitable for these short-distance checks.
    if (!Array.isArray(coordinates) || coordinates.length < 2) return Infinity;
    const earthRadius = 6371000;
    const lat0 = lat * Math.PI / 180;
    const cosLat = Math.cos(lat0);
    const px = lon * Math.PI / 180 * earthRadius * cosLat;
    const py = lat * Math.PI / 180 * earthRadius;
    let minDistance = Infinity;

    for (let i = 0; i < coordinates.length - 1; i++) {
        const a = coordinates[i];
        const b = coordinates[i + 1];
        if (!Array.isArray(a) || !Array.isArray(b)) continue;
        const ax = a[0] * Math.PI / 180 * earthRadius * cosLat;
        const ay = a[1] * Math.PI / 180 * earthRadius;
        const bx = b[0] * Math.PI / 180 * earthRadius * cosLat;
        const by = b[1] * Math.PI / 180 * earthRadius;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
        const nearestX = ax + t * dx;
        const nearestY = ay + t * dy;
        minDistance = Math.min(minDistance, Math.hypot(px - nearestX, py - nearestY));
    }
    return minDistance;
}
function latitudeOf(point) { return point[1]; }
function longitudeOf(point) { return point[0]; }

function updateGuardianUI(state, message) {
    const badge = document.getElementById("guardianBadge");
    const summary = document.getElementById("guardianSummary");
    if (badge) {
        badge.textContent = state === "danger" ? "SOS" : state === "warning" ? "Attention" : state === "active" ? "Active" : "Standby";
        badge.classList.toggle("emergency", state === "danger" || state === "warning");
    }
    if (summary) summary.textContent = message || "Guardian AI is monitoring your journey.";
}

window.SafeHer = window.SafeHer || {};
window.SafeHer.respondToSafety = respondToSafety;
window.SafeHer.getGuardianState = () => guardianRunning;
window.SafeHer.getGuardianConfig = () => ({ ...GUARDIAN });
