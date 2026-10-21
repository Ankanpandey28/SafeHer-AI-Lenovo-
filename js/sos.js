// SafeHer AI - Emergency Orchestrator
"use strict";

let sosActive = false;
let currentLatitude = null;
let currentLongitude = null;
let sosWatchId = null;
let emergencyProcessing = false;
let nearbyPolice = null;

function getEmergencyContacts() {
    return getTrustedContacts().filter(c => c?.phone).slice(0, 5);
}
function showEmergencyOverlay() {
    let overlay = document.getElementById("safeherEmergencyOverlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "safeherEmergencyOverlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "safeherEmergencyTitle");

        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99999",
            background: "rgba(10, 10, 15, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            overflowY: "auto"
        });

        overlay.innerHTML = `
          <section style="
            box-sizing:border-box;width:100%;max-width:480px;
            max-height:92vh;overflow-y:auto;background:#fff;color:#171717;
            border-radius:22px;padding:24px;
            box-shadow:0 24px 80px rgba(0,0,0,.35);
            font-family:system-ui,-apple-system,sans-serif">

            <header style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
              <div style="font-size:30px" aria-hidden="true">🛡️</div>
              <div style="flex:1">
                <h2 id="safeherEmergencyTitle"
                    style="font-size:22px;margin:0 0 4px">Emergency Response</h2>
                <p style="margin:0;color:#666;font-size:13px">
                  SafeHer AI · Immediate assistance
                </p>
              </div>
              <span style="background:#fee2e2;color:#b91c1c;padding:6px 10px;
                           border-radius:20px;font-weight:800;font-size:12px">SOS</span>
            </header>

            <div style="background:#fff1f2;border-radius:14px;padding:16px;margin-bottom:16px">
              <strong style="color:#b91c1c">You are not alone.</strong>
              <p style="margin:7px 0 0;line-height:1.5">
                Emergency mode is active. Your available location will be included
                in the emergency message.
              </p>
            </div>

            <div style="border:1px solid #e5e7eb;border-radius:14px;
                        padding:0 14px;margin-bottom:18px">

            <div style="display:flex;gap:12px;padding:15px 0">
  <span style="font-size:22px" aria-hidden="true">💬</span>
  <div style="flex:1;min-width:0">
    <strong>Trusted contact</strong>
    <p id="safeherContactStatus"
       role="status"
       aria-live="polite"
       style="font-size:13px;color:#555;margin:6px 0">
      Waiting to send emergency SMS…
    </p>
    <button id="safeherRetrySMS" type="button"
      style="border:1px solid #ddd;border-radius:8px;
      background:white;padding:8px 12px;margin-top:6px;cursor:pointer">
      Retry SMS
    </button>
  </div>
</div>

              <div style="height:1px;background:#eee"></div>

              <div style="display:flex;gap:12px;padding:15px 0">
                <span style="font-size:22px" aria-hidden="true">📍</span>
                <div style="flex:1;min-width:0">
                  <strong>Nearby police station</strong>
                  <p id="safeherPoliceName"
                     style="font-size:14px;margin:5px 0;overflow-wrap:anywhere">
                    Finding nearby station…
                  </p>
                  <p id="safeherPolicePhone"
                     style="font-size:12px;color:#666;margin:0;overflow-wrap:anywhere">
                    Checking available contact information…
                  </p>
                </div>
              </div>
            </div>

            <h3 style="font-size:15px;margin:0 0 10px">Call for help</h3>

            <button id="safeherCallContact" type="button"
              style="width:100%;padding:14px;border:1px solid #ddd;
              border-radius:30px;background:#fff;color:#171717;font-weight:700;
              font-size:15px;margin-bottom:10px;cursor:pointer">
              ☎ Call trusted contact
            </button>

            <button id="safeherCallPolice" type="button"
              style="width:100%;padding:14px;border:1px solid #ddd;
              border-radius:30px;background:#fff;color:#171717;font-weight:700;
              font-size:15px;margin-bottom:10px;cursor:pointer">
              ☎ Call nearby police station
            </button>

            <button id="safeherCall112" type="button"
              style="width:100%;padding:14px;border:0;
              border-radius:30px;background:#dc2626;color:#fff;font-weight:800;
              font-size:15px;cursor:pointer">
              ☎ Call emergency services (112)
            </button>

            <p id="safeherEmergencyStatus" role="status" aria-live="polite"
               style="font-size:13px;line-height:1.5;color:#555;margin:16px 0 0">
              Activating emergency response…
            </p>

            <button id="safeherCloseEmergency" type="button"
              style="width:100%;padding:12px;margin-top:12px;border:0;
              background:#f3f4f6;border-radius:12px;font-weight:600;cursor:pointer">
              Close emergency screen
            </button>
          </section>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("#safeherCallContact")
            .addEventListener("click", callTrustedContact);

        overlay.querySelector("#safeherCallPolice")
            .addEventListener("click", callNearbyPolice);

        overlay.querySelector("#safeherCall112")
            .addEventListener("click", callEmergency);
        overlay.querySelector("#safeherRetrySMS")
    .addEventListener("click", async () => {
        const button = overlay.querySelector("#safeherRetrySMS");
        button.disabled = true;

        try {
            await sendEmergencySMS();
        } finally {
            button.disabled = false;
        }
    });
        overlay.querySelector("#safeherCloseEmergency")
            .addEventListener("click", () => {
                if (confirm("Close this screen? SOS will remain active until you explicitly stop it.")) {
                    overlay.style.display = "none";
                }
            });

        overlay.addEventListener("click", event => {
            if (event.target === overlay) return;
        });
    }

    overlay.style.display = "flex";
    renderEmergencyTargets();
    return overlay;
}
async function startSOS(context = {}) {
    if (emergencyProcessing || sosActive) {
        updateEmergencyUI("SOS is already active. Use the emergency controls below if you need to call or retry a notification.");
        return;
    }

    emergencyProcessing = true;
    sosActive = true;
    window.SafeHer.sosActive = true;
    if (typeof clearSafetyResponseCountdown === "function") clearSafetyResponseCountdown();
    const safetyPanel = document.getElementById("safetyCheckPanel");
    safetyPanel?.classList.add("hidden");
    safetyPanel?.setAttribute("aria-hidden", "true");
    const activeJourney = getActiveJourney();
    if (activeJourney) {
        activeJourney.safetyCheckActive = false;
        saveJourney(activeJourney);
    }
    // Open the dedicated emergency interface instead of the crowded SOS panel.
    showEmergencyOverlay();

    updateAssistantStatus(
    "SOS is active. Sending the emergency alert and locating nearby police."
    );
    updateEmergencyUI("SOS activated. Preparing emergency SMS and nearby police details…");
    window.SafeHer.logSafetyEvent?.("SOS activated", context.reason || "Emergency mode started");

    try {
        // Location is best-effort: a GPS failure must never block access to 112
        // or prevent a trusted-contact message from being prepared.
        let gpsTimeoutId;
        try {
            await Promise.race([
                ensureEmergencyGPS(),
                new Promise((_, reject) => {
                    gpsTimeoutId = setTimeout(() => reject(new Error("GPS acquisition timed out")), 4000);
                })
            ]);
        } catch (gpsError) {
            console.warn("Emergency GPS unavailable:", gpsError.message);
            updateEmergencyUI("GPS is unavailable or taking too long. The alert will identify location as unavailable or last known.");
        } finally {
            clearTimeout(gpsTimeoutId);
        }

        // Police lookup is informational only and must never delay contacting saved contacts.
        findNearbyPoliceStation().then(renderEmergencyTargets).catch(() => {});
        renderEmergencyTargets();
        const message = buildEmergencyMessage(context.reason || "Emergency reported by user");
        const contacts = getEmergencyContacts();

        let smsResult;
        if (contacts.length) {
            smsResult = await sendEmergencySMSAll(message);
        } else {
            smsResult = {
                sent: false,
                summary: "No trusted contacts are saved. SOS remains active; use the emergency call control or add a contact when safe."
            };
        }

        updateEmergencyUI(smsResult.summary);
        window.SafeHer.logSafetyEvent?.("Emergency notification attempt", smsResult.summary);

        // Do not navigate to tel: after an async operation: browsers may block
        // that navigation, and automatic calling without a fresh user gesture is
        // unreliable. The user must tap the visible emergency-call control.
        updateAssistantStatus("SOS is active. Use the emergency-call control if you need emergency services.");
        if (typeof speak === "function") speak("SOS is active. Please use the emergency-call button if you need emergency services. Check the notification status on screen.");
    } catch (error) {
        console.error("SOS workflow error", error);
        updateEmergencyUI("SOS remains active, but an automatic step failed. Use the emergency-call and contact controls.");
        updateAssistantStatus("SOS remains active. Some automatic actions failed; use the visible emergency controls.");
    } finally {
        emergencyProcessing = false;
    }
}

function stopSOS() {
    sosActive = false;
    window.SafeHer.sosActive = false;
    if (sosWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(sosWatchId);
    sosWatchId = null;
    document.getElementById("sosPanel")?.classList.add("hidden");
    if (typeof speak === "function") window.speechSynthesis.cancel();
    updateAssistantStatus("SOS stopped. Guardian monitoring remains active if your journey is active.");
}

async function ensureEmergencyGPS() {
    if (window.SafeHer.gps?.latitude != null) {
        currentLatitude = window.SafeHer.gps.latitude;
        currentLongitude = window.SafeHer.gps.longitude;
        startSOSLocationWatch();
        return true;
    }
    const ok = await (window.SafeHer.ensureGPSPermission ? window.SafeHer.ensureGPSPermission() : Promise.resolve(false));
    if (!ok) throw new Error("GPS permission is required to attach a live emergency location.");
    await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(position => {
            setEmergencyPosition(position);
            resolve();
        }, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
    startSOSLocationWatch();
    return true;
}

function setEmergencyPosition(position) {
    currentLatitude = position.coords.latitude;
    currentLongitude = position.coords.longitude;
    Object.assign(window.SafeHer.gps, {
        granted: true, ready: true, latitude: currentLatitude, longitude: currentLongitude,
        accuracy: position.coords.accuracy, speedKmh: Number.isFinite(position.coords.speed) ? position.coords.speed * 3.6 : 0,
        lastUpdated: Date.now()
    });
    updateLocationUI(currentLatitude, currentLongitude, position.coords.accuracy);
    window.SafeHer.updateDashboard?.();
}

function startSOSLocationWatch() {
    if (!navigator.geolocation || sosWatchId !== null) return;
    sosWatchId = navigator.geolocation.watchPosition(
        position => {
            setEmergencyPosition(position);
            updateEmergencyUI(`📍 Live location updating • ±${Math.round(position.coords.accuracy || 0)} m accuracy`);
        },
        error => console.warn("SOS GPS watch:", error.message),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
}

async function findNearbyPoliceStation() {
    if (currentLatitude == null || currentLongitude == null) return null;
    const lat = Number(currentLatitude), lon = Number(currentLongitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    try {
        const query = `[out:json][timeout:10];(node[amenity=police](around:5000,${lat},${lon});way[amenity=police](around:5000,${lat},${lon});relation[amenity=police](around:5000,${lat},${lon}););out center tags;`;
        const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error("Nearby police search unavailable");
        const data = await response.json();
        const haversine = (aLat, aLon, bLat, bLon) => {
            const rad = v => v * Math.PI / 180;
            const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
            return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        const candidates = (data.elements || []).map(item => {
            const tags = item.tags || {};
            const itemLat = Number(item.lat ?? item.center?.lat);
            const itemLon = Number(item.lon ?? item.center?.lon);
            return {
                name: tags.name || tags["name:en"] || "Police Station",
                displayName: tags.name || tags["name:en"] || "Police Station mapped by OpenStreetMap",
                lat: itemLat, lon: itemLon,
                phone: tags.phone || tags["contact:phone"] || tags["phone:mobile"] || "",
                distanceMeters: haversine(lat, lon, itemLat, itemLon)
            };
        }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon) && item.distanceMeters <= 5000)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);
        nearbyPolice = candidates[0] || null;
        return nearbyPolice;
    } catch (error) {
        console.warn("Nearby police lookup failed", error);
        nearbyPolice = null;
        return null;
    }
}

function renderEmergencyTargets() {
    const name = nearbyPolice?.name || "Nearby mapped police station not found";

    const phone = nearbyPolice?.phone
        ? `Phone: ${nearbyPolice.phone}`
        : "Station phone unavailable. Use the map search or call 112.";

    const oldName = document.getElementById("policeStationName");
    const oldPhone = document.getElementById("policeStationPhone");

    if (oldName) oldName.textContent = name;
    if (oldPhone) oldPhone.textContent = phone;

    const overlayName = document.getElementById("safeherPoliceName");
    const overlayPhone = document.getElementById("safeherPolicePhone");

    if (overlayName) overlayName.textContent = name;
    if (overlayPhone) overlayPhone.textContent = phone;

    const policeBtn = document.getElementById("policeCallBtn");
    if (policeBtn) policeBtn.disabled = false;
}

function buildEmergencyMessage(reason = "Emergency reported") {
    const journey = getActiveJourney() || {};
    const lat = currentLatitude ?? journey.lastLocation?.lat;
    const lon = currentLongitude ?? journey.lastLocation?.lon;
    const location = lat != null && lon != null ? getMapLink(lat, lon) : "Location unavailable";
    const gpsUpdatedAt = Number(window.SafeHer.gps?.lastUpdated || journey.lastLocationTime || 0);
    const gpsAgeSeconds = gpsUpdatedAt ? Math.max(0, Math.round((Date.now() - gpsUpdatedAt) / 1000)) : null;
    const locationFreshness = journey.simulationMode
        ? "SIMULATED vehicle position for demonstration only — not a live GPS fix"
        : gpsAgeSeconds == null
            ? "No valid GPS timestamp available"
            : gpsAgeSeconds <= 30
                ? `Recent location fix (${gpsAgeSeconds} seconds ago)`
                : `LAST KNOWN location (${gpsAgeSeconds} seconds old; may be outdated)`;
    const started = journey.startTime ? new Date(journey.startTime).toLocaleString() : "Not available";
    const eta = journey.expectedEndTime ? new Date(journey.expectedEndTime).toLocaleString() : "Not available";

    return `🚨 SAFEHER AI EMERGENCY ALERT 🚨\n\nReason: ${reason}\n\nJOURNEY DETAILS\nDestination: ${journey.destination || "Not provided"}\nResolved destination: ${journey.destinationResolved || "Not available"}\nDriver: ${journey.driverName || "Not provided"}\nVehicle: ${journey.vehicleNumber || "Not provided"}\nVehicle Type: ${journey.vehicleType || "Not provided"}\nPlanned Route: ${journey.route || "GPS route"}\nJourney started: ${started}\nExpected arrival: ${eta}\n\nLOCATION STATUS\n${locationFreshness}\n${location}\nGPS accuracy: ±${Math.round(window.SafeHer.gps?.accuracy || journey.lastAccuracy || 0)} m\nTime of alert: ${new Date().toLocaleString()}\n\nPlease contact me and/or emergency services immediately.`;
}
async function sendEmergencySMSAll(message) {
    const contacts = getEmergencyContacts();
    const status = document.getElementById("safeherContactStatus");

    const setStatus = (text, color = "#555") => {
        if (status) {
            status.textContent = text;
            status.style.color = color;
        }
    };

    if (!contacts.length) {
        setStatus("Failed: no trusted contact with a phone number is saved.", "#b91c1c");
        return { sent: false, summary: "No trusted contacts are saved." };
    }

    const recipients = contacts.map(c => ({
        name: c.name || "Trusted Contact",
        phone: c.phone,
        type: "trusted"
    }));

    setStatus("Sending emergency SMS to your saved trusted contact…", "#92400e");

    try {
        const api = window.SAFEHER_SMS_API || "/api/sos";

        const response = await fetch(api, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipients, message })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.ok !== true) {
            throw new Error(data.error || `SMS service returned HTTP ${response.status}`);
        }

        const accepted = Number(data.acceptedCount ?? data.sentCount ?? 0);
        const failed = Number(data.failedCount ?? 0);

        if (accepted < 1) {
            throw new Error("TextBee did not confirm acceptance of any SMS.");
        }

        const summary =
            `TextBee accepted ${accepted} SMS request(s).` +
            (failed ? ` ${failed} recipient(s) failed.` : "") +
            " Check TextBee message history for delivery status.";

        setStatus(
            `✓ ${summary}`,
            "#15803d"
        );

        return { sent: true, summary, acceptedCount: accepted, failedCount: failed };

    } catch (error) {
        console.error("Emergency SMS failed:", error);

        const summary = `SMS failed: ${error.message}. Check the TextBee server configuration or retry.`;

        setStatus(`✕ ${summary}`, "#b91c1c");

        return { sent: false, summary };
    }
}
     

async function sendEmergencySMS() {
    const message = buildEmergencyMessage("Emergency alert");
    const result = await sendEmergencySMSAll(message);
    updateEmergencyUI(result.summary);
    return result;
}

function openNativeSMSComposer() {
    const contact = getEmergencyContacts()[0];
    if (!contact?.phone) {
        alert("Add a trusted contact with an international phone number before using SMS.");
        return;
    }
    const message = buildEmergencyMessage("Emergency alert");
    const phone = String(contact.phone).replace(/[^+\d]/g, "");
    // This action is initiated directly by the user's tap. The user must review
    // the draft and press Send in their messaging app.
    const separator = /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
}

function notifyContacts() { return sendEmergencySMS(); }

async function shareLocation() {
    if (currentLatitude == null || currentLongitude == null) {
        try { await ensureEmergencyGPS(); } catch (_) { alert("Waiting for GPS location. Please allow location access and try again."); return; }
    }
    const url = getMapLink(currentLatitude, currentLongitude);
    const text = `🛡️ SafeHer AI live emergency location: ${url}`;
    try {
        if (navigator.share) await navigator.share({ title: "SafeHer AI Live Location", text, url });
        else if (navigator.clipboard) { await navigator.clipboard.writeText(text); alert("Live location copied. Paste it into WhatsApp/SMS."); }
        else window.prompt("Copy your live location:", text);
    } catch (_) {}
}

function initiatePhoneCall(phone) {
    if (!phone) return;
    const clean = String(phone).replace(/[^+\d]/g, "");
    if (clean) window.location.href = `tel:${clean}`;
}

function callEmergency() {
    const number = window.SAFEHER_CONFIG?.emergencyNumber || "112";
    initiatePhoneCall(number);
}
function callTrustedContact() {
    const contacts = getEmergencyContacts();
    if (!contacts.length) return alert("No trusted contact is saved for this profile.");
    const contact = contacts[0];
    if (confirm(`Open your phone dialer to call ${contact.name} (${contact.phone})?`)) initiatePhoneCall(contact.phone);
}
function callNearbyPolice() {
    const journey = getActiveJourney() || {};
    if (nearbyPolice?.phone) {
        const label = nearbyPolice.name || "the mapped police station";
        if (journey.simulationMode && !confirm(`SIMULATION: this is a real phone number listed for ${label}. The next step opens your phone dialer; do not place a test call. Continue?`)) return;
        initiatePhoneCall(nearbyPolice.phone);
        return;
    }
    // Never redirect a simulation click straight to 112: that could create a false emergency call.
    if (journey.simulationMode) {
        const lat = currentLatitude ?? journey.lastLocation?.lat;
        const lon = currentLongitude ?? journey.lastLocation?.lon;
        const query = lat != null && lon != null ? `police station near ${lat},${lon}` : "police station near me";
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
        updateEmergencyUI("No direct phone number was available in the map data. Opened a map search instead; verify the station and number before calling.");
        return;
    }
    if (confirm("A direct nearby-station number was not found. Open the configured emergency number in your phone dialer instead?")) callEmergency();
}
function openEmergencyCall() { callEmergency(); }
function userResponse(answer) { if (typeof respondToSafety === "function") respondToSafety(answer); }
function updateEmergencyUI(message) {
    const el = document.getElementById("sosWorkflowStatus");
    if (el) el.textContent = message;

    const emergencyStatus = document.getElementById("safeherEmergencyStatus");
    if (emergencyStatus) emergencyStatus.textContent = message;

    const preview = document.getElementById("emergencyMessagePreview");
    if (preview) {
        preview.textContent = buildEmergencyMessage(
            window.SafeHer.lastSafetyEvent?.detail || "Emergency alert"
        );
    }

    const contactStatus = document.getElementById("safeherContactStatus");
    if (contactStatus && /SMS/i.test(message)) {
        contactStatus.textContent = message;
    }
}

async function activateSimulationSOS({ reason, allowRealSMS = false } = {}) {
    const journey = getActiveJourney() || {};
    const point = journey.lastLocation || {};
    currentLatitude = Number.isFinite(point.lat) ? point.lat : null;
    currentLongitude = Number.isFinite(point.lon) ? point.lon : null;
    if (currentLatitude != null && currentLongitude != null) {
        Object.assign(window.SafeHer.gps, {
            latitude: currentLatitude, longitude: currentLongitude, accuracy: 0,
            lastUpdated: Date.now(), granted: true, ready: true, simulated: true
        });
    }
    sosActive = true;
    window.SafeHer.sosActive = true;
    showEmergencyOverlay();
    updateAssistantStatus("Simulation SOS is active. Police call requires a deliberate tap; no automatic phone call is possible from the browser.");
    updateEmergencyUI("Simulation SOS activated. Looking up nearby police stations from the simulated vehicle location…");
    const police = await findNearbyPoliceStation();
    renderEmergencyTargets();
    const baseMessage = buildEmergencyMessage(reason || "Simulated emergency");
    const message = `SIMULATION TEST — NOT A REAL EMERGENCY

${baseMessage}`;
    const preview = document.getElementById("emergencyMessagePreview");
    if (preview) preview.textContent = message;
    if (allowRealSMS) {
        updateEmergencyUI("Sending a clearly labelled simulation-test SMS to configured, allowlisted trusted contacts…");
        const result = await sendEmergencySMSAll(message);
        updateEmergencyUI(result.summary);
        window.SafeHer.logSafetyEvent?.("Simulation test SMS attempt", result.summary);
    } else {
        updateEmergencyUI("SIMULATION ONLY: no SMS was sent. If you explicitly enabled test SMS, restart the simulation and select No to test the configured provider.");
    }
    const policeName = document.getElementById("policeStationName");
    if (policeName && police) policeName.textContent = `${police.name} • approx. ${Math.round(police.distanceMeters)} m away (OpenStreetMap data; verify before relying on it)`;
    const callBtn = document.getElementById("policeCallBtn");
    if (callBtn) callBtn.disabled = false;
    window.SafeHer.logSafetyEvent?.("Simulation SOS activated", police ? `Nearest mapped station: ${police.name}` : "No nearby mapped police station found");
}

window.SafeHer.activateSimulationSOS = activateSimulationSOS;

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("emergencyBtn")?.addEventListener("click", callEmergency);
    document.getElementById("shareLocationBtn")?.addEventListener("click", shareLocation);
    document.getElementById("trustedContactBtn")?.addEventListener("click", sendEmergencySMS);
    document.getElementById("nativeSmsFallbackBtn")?.addEventListener("click", openNativeSMSComposer);
    document.getElementById("trustedCallBtn")?.addEventListener("click", callTrustedContact);
    document.getElementById("policeCallBtn")?.addEventListener("click", callNearbyPolice);
    document.getElementById("exitSOSBtn")?.addEventListener("click", () => { if (confirm("Exit SOS mode? Only do this when you are safe.")) stopSOS(); });
});

window.SafeHer = window.SafeHer || {};
window.SafeHer.getNearbyPolice = () => nearbyPolice;
window.SafeHer.buildEmergencyMessage = buildEmergencyMessage;
