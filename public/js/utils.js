// ======================================
// SafeHer AI - Utilities (CORE FILE)
// ======================================

// ----------------------------
// GLOBAL APP STATE
// ----------------------------

window.SafeHer = window.SafeHer || {
    sosActive: false,
    guardianActive: false,
    journeyActive: false
};
window.SafeHer.journeyActive = !!window.SafeHer.journeyActive;

// ----------------------------
// ASSISTANT STATUS (IMPORTANT)
// ----------------------------

function updateAssistantStatus(message) {

    let el = document.getElementById("assistantStatus");

    if (!el) return;

    el.innerText = message;
}

// ----------------------------
// SAFE SPEAK WRAPPER
// ----------------------------

function safeSpeak(text) {

    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const msg = new SpeechSynthesisUtterance(text);

    msg.lang = "en-US";
    msg.rate = 1;
    msg.pitch = 1;

    window.speechSynthesis.speak(msg);
}

// Override global speak (so all files use same engine)
window.speak = safeSpeak;

// ----------------------------
// DISTANCE CALCULATION (GLOBAL USE)
// ----------------------------

function getDistance(lat1, lon1, lat2, lon2) {

    const R = 6371000;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// ----------------------------
// FORMAT LOCATION LINK
// ----------------------------

function getMapLink(lat, lon) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
}

// ----------------------------
// SAFE LOCAL STORAGE WRAPPER
// ----------------------------

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn(`SafeHer could not persist "${key}" in this browser.`, error);
        return false;
    }
}

function getFromStorage(key, fallback = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (error) {
        console.warn(`SafeHer could not read "${key}" from this browser.`, error);
        return fallback;
    }
}

// ----------------------------
// LOGGING SYSTEM (DEBUG SAFE)
// ----------------------------

function logSafe(message, type = "info") {

    const styles = {
        info: "color:blue",
        warn: "color:orange",
        error: "color:red",
        success: "color:green"
    };

    console.log(`%c[SafeHer] ${message}`, styles[type]);
}
document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("sosBtn");

    if (btn) {
        btn.addEventListener("click", () => {
            if (typeof startSOS === "function") {
                startSOS();
            }
        });
    }

});
window.addEventListener("load", () => {

    console.log("SafeHer AI Fully Loaded ✅");

    if (typeof updateAssistantStatus === "function") {
        updateAssistantStatus("System Ready. SafeHer AI Active.");
    }

});