// SafeHer AI - Mobile Safety Layer
// GPS permission gate, PWA install, live telemetry, map and SMS bridge.
"use strict";

window.SafeHer = window.SafeHer || {};
window.SafeHer.gps = {
    granted: false,
    ready: false,
    latitude: null,
    longitude: null,
    accuracy: null,
    speedKmh: 0,
    lastUpdated: null
};

let safeHerMap = null;
let safeHerMarker = null;
let safeHerAccuracyCircle = null;
let safeHerRouteLine = null;
let standalonePromptEvent = null;

function setGpsGateStatus(message, tone = "info") {
    const status = document.getElementById("gpsPermissionStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
}

function openGpsPermissionGate() {
    const gate = document.getElementById("gpsPermissionGate");
    if (gate) gate.classList.remove("hidden");
}

function closeGpsPermissionGate() {
    const gate = document.getElementById("gpsPermissionGate");
    if (gate) gate.classList.add("hidden");
}

function isGpsAvailable() {
    return !!navigator.geolocation;
}

async function requestGPSPermission() {
    if (!navigator.geolocation) {
        setGpsGateStatus("This phone/browser does not support GPS location.", "error");
        return false;
    }
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) {
        setGpsGateStatus("GPS needs HTTPS on a phone. Open the deployed HTTPS link or use localhost for development.", "error");
        return false;
    }

    setGpsGateStatus("Requesting GPS permission… please choose Allow.", "info");
    return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
            position => {
                updateMobileLocation(position);
                window.SafeHer.gps.granted = true;
                window.SafeHer.gps.ready = true;
                closeGpsPermissionGate();
                updateGpsPermissionUI("GPS enabled", true);
                if (typeof updateAssistantStatus === "function") updateAssistantStatus("📍 GPS enabled. SafeHer AI can now protect your journey.");
                resolve(true);
            },
            error => {
                const message = error.code === 1
                    ? "Location permission was denied. Enable Location Services for this browser in phone Settings."
                    : "GPS could not get a fix. Move near a window/outdoors and try again.";
                setGpsGateStatus(message, "error");
                updateGpsPermissionUI("GPS permission needed", false);
                resolve(false);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    });
}

async function ensureGPSPermission() {
    if (window.SafeHer.gps.granted && window.SafeHer.gps.ready) return true;
    return requestGPSPermission();
}

function updateGpsPermissionUI(label, active) {
    document.querySelectorAll("[data-gps-label]").forEach(el => {
        el.textContent = label;
        el.classList.toggle("is-active", active);
    });
}

function updateMobileLocation(position) {
    const { latitude, longitude, accuracy, speed } = position.coords;
    const speedKmh = Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : 0;
    Object.assign(window.SafeHer.gps, {
        granted: true,
        ready: true,
        latitude,
        longitude,
        accuracy,
        speedKmh,
        lastUpdated: Date.now()
    });

    updateLiveMap(latitude, longitude, accuracy);
    updateTelemetryUI();

    if (typeof updateLocationUI === "function") updateLocationUI(latitude, longitude, accuracy);
}


function updateTelemetryUI() {
    const gps = window.SafeHer.gps;

    const gpsHealth = document.getElementById("gpsHealth");
    const speedHealth = document.getElementById("speedHealth");
    const accuracyHealth = document.getElementById("accuracyHealth");
    const lastUpdate = document.getElementById("lastGpsUpdate");

    const hasCoordinates =
        Number.isFinite(gps.latitude) &&
        Number.isFinite(gps.longitude);

    const timestamp = Number(gps.lastUpdated);
    const hasValidTimestamp =
        Number.isFinite(timestamp) && timestamp > 0;

    const ageSeconds = hasValidTimestamp
        ? Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
        : null;

    // Treat readings older than 30 seconds as stale.
    const isFresh =
        hasCoordinates &&
        ageSeconds !== null &&
        ageSeconds <= 30;

    if (gpsHealth) {
        if (!hasCoordinates || !gps.ready) {
            gpsHealth.textContent = "Waiting for GPS";
        } else if (!isFresh) {
            gpsHealth.textContent = "GPS data stale";
        } else if (Number.isFinite(gps.accuracy)) {
            gpsHealth.textContent =
                `Active (±${Math.round(gps.accuracy)} m)`;
        } else {
            gpsHealth.textContent = "Active";
        }
    }

    if (speedHealth) {
        speedHealth.textContent =
            Number.isFinite(gps.speedKmh)
                ? `${gps.speedKmh.toFixed(1)} km/h`
                : "--";
    }

    if (accuracyHealth) {
        accuracyHealth.textContent =
            Number.isFinite(gps.accuracy) && gps.accuracy >= 0
                ? `±${Math.round(gps.accuracy)} m`
                : "--";
    }

    if (lastUpdate) {
        if (ageSeconds === null) {
            lastUpdate.textContent = "No GPS update yet";
        } else if (ageSeconds > 30) {
            lastUpdate.textContent =
                `Stale — last update ${ageSeconds}s ago`;
        } else {
            lastUpdate.textContent = `${ageSeconds}s ago`;
        }
    }
}


function initLiveMap() {
    const mapEl = document.getElementById("liveMap");
    if (!mapEl || !window.L || safeHerMap) return;
    safeHerMap = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView([20.5937, 78.9629], 5);
    L.control.zoom({ position: "bottomright" }).addTo(safeHerMap);
    const tileUrl = window.SAFEHER_CONFIG?.mapTileUrl;
    if (!tileUrl) {
        console.error("Map tile provider is not configured.");
        return;
    }
    L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(safeHerMap);
}

function updateLiveMap(lat, lon, accuracy = 0) {
    if (!window.L) return;
    initLiveMap();
    if (!safeHerMap) return;
    const point = [lat, lon];
    if (!safeHerMarker) {
        safeHerMarker = L.marker(point).addTo(safeHerMap).bindPopup("📍 You are here");
    } else {
        safeHerMarker.setLatLng(point);
    }
    if (!safeHerAccuracyCircle) {
        safeHerAccuracyCircle = L.circle(point, { radius: Math.max(accuracy || 10, 10), weight: 1 }).addTo(safeHerMap);
    } else {
        safeHerAccuracyCircle.setLatLng(point).setRadius(Math.max(accuracy || 10, 10));
    }
    safeHerMap.setView(point, Math.max(safeHerMap.getZoom(), 16), { animate: true });
}

function renderJourneyRoute(coordinates = []) {
    if (!window.L || !coordinates?.length) return;
    initLiveMap();
    if (!safeHerMap) return;
    const points = coordinates.map(([lon, lat]) => [lat, lon]);
    if (safeHerRouteLine) safeHerRouteLine.remove();
    safeHerRouteLine = L.polyline(points, { weight: 5, opacity: 0.75 }).addTo(safeHerMap);
    safeHerMap.fitBounds(safeHerRouteLine.getBounds(), { padding: [24, 24] });
}

let safeHerSimulationMarker = null;
function renderSimulationPosition(lat, lon, label = "Simulated vehicle") {
    if (!window.L || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    initLiveMap();
    if (!safeHerMap) return;
    const point = [lat, lon];
    if (!safeHerSimulationMarker) {
        safeHerSimulationMarker = L.marker(point).addTo(safeHerMap).bindPopup("");
    } else {
        safeHerSimulationMarker.setLatLng(point);
    }
    safeHerSimulationMarker.setPopupContent(String(label));
    safeHerSimulationMarker.openPopup();
    safeHerMap.panTo(point, { animate: true, duration: 0.25 });
}

function recenterLiveMap() {
    const gps = window.SafeHer.gps;
    if (gps.latitude == null) return requestGPSPermission();
    updateLiveMap(gps.latitude, gps.longitude, gps.accuracy);
}

async function shareSafetyStatus() {
    const gps = window.SafeHer.gps;
    if (gps.latitude == null) {
        const ok = await ensureGPSPermission();
        if (!ok) return;
    }
    const link = `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;
    const text = `🛡️ SafeHer AI safety update: I am sharing my current location. ${link}`;
    try {
        if (navigator.share) {
            await navigator.share({ title: "SafeHer AI Safety Update", text });
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            alert("Safety update copied. Paste it into WhatsApp/SMS.");
        } else {
            window.prompt("Copy safety update:", text);
        }
    } catch (_) {}
}

function logSafetyEvent(type, detail = "") {
    const key = "safeher_incident_log";
    let events = [];
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) events = parsed;
    } catch (error) {
        console.warn("Incident history could not be read.", error);
    }

    const event = {
        id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
        type: String(type || "Event").slice(0, 120),
        detail: String(detail || "").slice(0, 1000),
        at: new Date().toISOString(),
        latitude: window.SafeHer.gps.latitude,
        longitude: window.SafeHer.gps.longitude,
        locationUpdatedAt: window.SafeHer.gps.lastUpdated
    };
    events.unshift(event);
    events = events.slice(0, 100);
    try {
        localStorage.setItem(key, JSON.stringify(events));
    } catch (error) {
        console.warn("Incident history could not be saved.", error);
    }
    window.SafeHer.lastSafetyEvent = event;
    const el = document.getElementById("incidentCount");
    if (el) el.textContent = String(events.length);
    window.dispatchEvent(new Event("safeher:activity-updated"));
}

async function showBatteryAndNetwork() {
    const network = document.getElementById("networkHealth");
    if (network) network.textContent = navigator.onLine ? "Online" : "Offline";
    const battery = document.getElementById("batteryHealth");
    if (battery && navigator.getBattery) {
        try {
            const b = await navigator.getBattery();
            battery.textContent = `${Math.round(b.level * 100)}%${b.charging ? " • charging" : ""}`;
            b.addEventListener("levelchange", () => { battery.textContent = `${Math.round(b.level * 100)}%${b.charging ? " • charging" : ""}`; });
        } catch (_) { battery.textContent = "Unavailable"; }
    }
}

function installPWA() {
    if (!standalonePromptEvent) return;
    standalonePromptEvent.prompt();
    standalonePromptEvent.userChoice.finally(() => { standalonePromptEvent = null; document.getElementById("installAppBtn")?.classList.add("hidden"); });
}

window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    standalonePromptEvent = event;
    document.getElementById("installAppBtn")?.classList.remove("hidden");
});

window.addEventListener("online", () => { const n = document.getElementById("networkHealth"); if (n) n.textContent = "Online"; });
window.addEventListener("offline", () => { const n = document.getElementById("networkHealth"); if (n) n.textContent = "Offline"; });

document.addEventListener("DOMContentLoaded", async () => {
    initLiveMap();
    showBatteryAndNetwork();
    updateGpsPermissionUI("GPS permission needed", false);

    document.getElementById("enableGpsBtn")?.addEventListener("click", requestGPSPermission);
    document.getElementById("gpsSettingsBtn")?.addEventListener("click", () => alert("If GPS was denied, open your phone Settings → Browser → Location and allow access, then return to SafeHer AI."));
    document.getElementById("recenterMapBtn")?.addEventListener("click", recenterLiveMap);
    document.getElementById("shareSafetyBtn")?.addEventListener("click", shareSafetyStatus);
    document.getElementById("installAppBtn")?.addEventListener("click", installPWA);

    // Ask for permission before safety features start. The actual browser prompt is triggered by the button above.
    const gate = document.getElementById("gpsPermissionGate");
    if (gate && !window.SafeHer.gps.ready) gate.classList.remove("hidden");

    setInterval(updateTelemetryUI, 5000);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
});

window.SafeHer.requestGPSPermission = requestGPSPermission;
window.SafeHer.ensureGPSPermission = ensureGPSPermission;
window.SafeHer.logSafetyEvent = logSafetyEvent;
window.SafeHer.renderJourneyRoute = renderJourneyRoute;
window.SafeHer.renderSimulationPosition = renderSimulationPosition;
