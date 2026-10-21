// ===============================================
// SafeHer AI
// Storage Manager
// File: storage.js
// ===============================================

"use strict";

// ===============================================
// Storage Keys
// ===============================================

const STORAGE_KEYS = {

    CONTACTS: "safeher_contacts",
    PROFILE: "safeher_user_profile",

    JOURNEY: "safeher_active_journey",

    HISTORY: "safeher_journey_history",

    SETTINGS: "safeher_settings"

};

// ===============================================
// Initialize Storage
// ===============================================

function initializeStorage() {

    Object.values(STORAGE_KEYS).forEach(key => {

        let existing = null;
        try { existing = localStorage.getItem(key); } catch (error) {
            console.warn("Browser storage is unavailable; journey data may not persist.", error);
            return;
        }
        if (existing === null) {

            switch (key) {

                case STORAGE_KEYS.CONTACTS:
                    localStorage.setItem(key, JSON.stringify([]));
                    break;

                case STORAGE_KEYS.PROFILE:
                    localStorage.setItem(key, JSON.stringify({ name: "" }));
                    break;

                case STORAGE_KEYS.HISTORY:
                    localStorage.setItem(key, JSON.stringify([]));
                    break;

                case STORAGE_KEYS.SETTINGS:
                    localStorage.setItem(key, JSON.stringify({
                        voice: true,
                        guardian: true
                    }));
                    break;

                case STORAGE_KEYS.JOURNEY:
                    localStorage.setItem(key, JSON.stringify(null));
                    break;
            }

        }

    });

}

// ===============================================
// Generic Save
// ===============================================

function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Could not save SafeHer data for "${key}".`, error);
        return false;
    }
}

// ===============================================
// Generic Load
// ===============================================

function loadData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.warn(`Could not read SafeHer data for "${key}".`, error);
        return null;
    }
}

// ===============================================
// Generic Remove
// ===============================================

function removeData(key) {
    try { localStorage.removeItem(key); } catch (error) {
        console.warn(`Could not remove SafeHer data for "${key}".`, error);
    }
}


// ===============================================
// LOCAL USER PROFILE
// Note: browser-local only; this is not account authentication or cloud sync.
// ===============================================
function getUserProfile() {
    return loadData(STORAGE_KEYS.PROFILE) || { name: "" };
}

function saveUserProfile(profile) {
    const current = getUserProfile();
    return saveData(STORAGE_KEYS.PROFILE, { ...current, ...profile, updatedAt: Date.now() });
}

// ===============================================
// CONTACTS
// ===============================================

function saveContacts(contacts) {
    const saved = saveData(STORAGE_KEYS.CONTACTS, contacts);
    if (saved) window.dispatchEvent(new Event("safeher:activity-updated"));
    return saved;
}

function getContacts() {

    return loadData(

        STORAGE_KEYS.CONTACTS

    ) || [];

}

// ===============================================
// ACTIVE JOURNEY
// ===============================================

function saveJourney(journey) {

    saveData(

        STORAGE_KEYS.JOURNEY,

        journey

    );

}

function getJourney() {

    return loadData(

        STORAGE_KEYS.JOURNEY

    );

}

function clearJourney() {

    saveData(

        STORAGE_KEYS.JOURNEY,

        null

    );

}

// ===============================================
// JOURNEY HISTORY
// ===============================================

function addJourneyHistory(journey) {

    const history = getJourneyHistory();

    history.unshift(journey);

    const saved = saveData(STORAGE_KEYS.HISTORY, history);
    if (saved) window.dispatchEvent(new Event("safeher:activity-updated"));
}

function getJourneyHistory() {

    return loadData(

        STORAGE_KEYS.HISTORY

    ) || [];

}

function clearJourneyHistory() {

    saveData(

        STORAGE_KEYS.HISTORY,

        []

    );

}

// ===============================================
// SETTINGS
// ===============================================

function getSettings() {

    return loadData(

        STORAGE_KEYS.SETTINGS

    );

}

function saveSettings(settings) {

    saveData(

        STORAGE_KEYS.SETTINGS,

        settings

    );

}

// ===============================================
// CLEAR EVERYTHING
// ===============================================

function resetSafeHerStorage() {

    Object.values(STORAGE_KEYS).forEach(key => {

        localStorage.removeItem(key);

    });

    initializeStorage();

}

// ===============================================
// Storage Info
// ===============================================

function printStorageStatus() {

    console.log("===== SafeHer Storage =====");

    console.log(

        "Contacts:",

        getContacts().length

    );

    console.log(

        "Journey:",

        getJourney()

    );

    console.log(

        "History:",

        getJourneyHistory().length

    );

    console.log(

        "Settings:",

        getSettings()

    );

}

// ===============================================
// Initialize Automatically
// ===============================================

initializeStorage();

console.log(
    "%cSafeHer Storage Ready",
    "color:#6C63FF;font-size:16px;font-weight:bold;"
);