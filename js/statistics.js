// SafeHer AI — show counts derived from this browser's real local records.
// These are personal-device counts, not app-wide analytics or safety outcomes.
"use strict";

function readArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (error) {
        console.warn(`Could not read local statistics for ${key}.`, error);
        return [];
    }
}

function refreshLocalStatistics() {
    const journeys = readArray("safeher_journey_history");
    const incidents = readArray("safeher_incident_log");
    const contacts = readArray("safeher_contacts");
    const screenings = readArray("safeher_history");

    const completed = journeys.filter(item => item?.status === "COMPLETED").length;
    const set = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    };

    set("completedJourneyCount", completed);
    set("incidentEventCount", incidents.length);
    set("trustedContactCount", contacts.length);
    set("situationScreeningCount", screenings.length);
}

document.addEventListener("DOMContentLoaded", () => {
    refreshLocalStatistics();
    document.getElementById("saveContactBtn")?.addEventListener("click", () => setTimeout(refreshLocalStatistics, 0));
    window.addEventListener("safeher:activity-updated", refreshLocalStatistics);
});

document.addEventListener("DOMContentLoaded", () => {
    const topBtn = document.getElementById("topBtn");
    if (!topBtn) return;
    const updateTopButton = () => {
        topBtn.style.display = window.scrollY > 300 ? "block" : "none";
    };
    window.addEventListener("scroll", updateTopButton, { passive: true });
    topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    updateTopButton();
});
