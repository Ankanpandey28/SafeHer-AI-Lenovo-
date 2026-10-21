// SafeHer AI - Trusted contacts associated with the current browser-local profile.
"use strict";

const contactNameInput = document.getElementById("contactName");
const contactPhoneInput = document.getElementById("contactPhone");
const contactList = document.getElementById("contactList");
const saveContactBtn = document.getElementById("saveContactBtn");
const profileNameInput = document.getElementById("profileName");

function normalizeProfileKey(name) {
    return String(name || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function getCurrentProfileName() {
    const inputName = profileNameInput?.value?.trim();
    if (inputName) return inputName;
    return getUserProfile().name || "";
}

function getCurrentProfileKey() {
    return normalizeProfileKey(getCurrentProfileName());
}

function getUserContacts() {
    const ownerName = getCurrentProfileName();
    const ownerKey = normalizeProfileKey(ownerName);
    if (!ownerKey) return [];
    const allContacts = getContacts();
    let migrated = false;
    allContacts.forEach(contact => {
        if (!contact.ownerKey && !contact.ownerName) {
            // Migrate legacy contacts once, when a user first supplies their profile name.
            contact.ownerName = ownerName;
            contact.ownerKey = ownerKey;
            migrated = true;
        } else if (!contact.ownerKey && contact.ownerName) {
            contact.ownerKey = normalizeProfileKey(contact.ownerName);
            migrated = true;
        }
    });
    if (migrated) saveContacts(allContacts);
    return allContacts.filter(contact => contact.ownerKey === ownerKey);
}

function saveContact() {
    const ownerName = getCurrentProfileName();
    const ownerKey = normalizeProfileKey(ownerName);
    const name = contactNameInput?.value?.trim() || "";
    const rawPhone = contactPhoneInput?.value?.trim() || "";
    const phone = rawPhone.replace(/[\s()-]/g, "");

    if (!ownerName) {
        alert("Enter your full name first. SafeHer uses it to associate trusted contacts with your profile.");
        profileNameInput?.focus();
        return;
    }
    if (name.length < 2 || !phone) {
        alert("Please enter the trusted contact's name and phone number.");
        return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        alert("Enter the contact number with its international country code, e.g. +919876543210.");
        return;
    }

    saveUserProfile({ name: ownerName });
    const allContacts = getContacts();
    const duplicate = allContacts.some(contact => contact.ownerKey === ownerKey && contact.phone === phone);
    if (duplicate) {
        alert("This phone number is already saved for your profile.");
        return;
    }
    allContacts.push({
        id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        ownerName,
        ownerKey,
        name,
        phone,
        createdAt: new Date().toISOString()
    });
    if (!saveContacts(allContacts)) {
        alert("The contact could not be saved in this browser. Check browser storage settings and try again.");
        return;
    }
    renderContacts();
    contactNameInput.value = "";
    contactPhoneInput.value = "";
}

function deleteContact(id) {
    const contact = getUserContacts().find(item => item.id === id);
    if (!contact || !confirm(`Delete ${contact.name} from ${getCurrentProfileName()}'s trusted contacts?`)) return;
    const allContacts = getContacts().filter(item => item.id !== id);
    saveContacts(allContacts);
    renderContacts();
}

function renderContacts() {
    if (!contactList) return;
    const ownerName = getCurrentProfileName();
    const ownerLabel = document.getElementById("contactOwnerLabel");
    if (ownerLabel) ownerLabel.textContent = ownerName || "your profile";
    contactList.replaceChildren();
    const currentContacts = getUserContacts();

    if (!ownerName) {
        const message = document.createElement("p");
        message.textContent = "Enter your full name above to create your local profile and manage its trusted contacts.";
        contactList.appendChild(message);
        return;
    }
    if (!currentContacts.length) {
        const message = document.createElement("p");
        message.textContent = `No trusted contacts saved for ${ownerName} yet.`;
        contactList.appendChild(message);
        return;
    }

    currentContacts.forEach(contact => {
        const card = document.createElement("div");
        card.className = "contact-card";
        const details = document.createElement("div");
        const name = document.createElement("h4");
        name.textContent = `👤 ${contact.name}`;
        const owner = document.createElement("p");
        owner.textContent = `Saved for: ${contact.ownerName || ownerName}`;
        const phoneLine = document.createElement("p");
        phoneLine.append("📞 ");
        const phoneLink = document.createElement("a");
        phoneLink.href = `tel:${String(contact.phone || "").replace(/[^+\d]/g, "")}`;
        phoneLink.textContent = String(contact.phone || "");
        phoneLine.appendChild(phoneLink);
        details.append(name, owner, phoneLine);

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-contact-btn";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete ${contact.name}`);
        deleteButton.addEventListener("click", () => deleteContact(contact.id));
        card.append(details, deleteButton);
        contactList.appendChild(card);
    });
}

function getTrustedContacts() {
    return getUserContacts().filter(contact => contact?.phone);
}

function getPrimaryContact() {
    return getTrustedContacts()[0] || null;
}

function hasTrustedContacts() {
    return getTrustedContacts().length > 0;
}

function clearAllContacts() {
    const ids = new Set(getUserContacts().map(contact => contact.id));
    if (!ids.size || !confirm(`Delete all trusted contacts for ${getCurrentProfileName()}?`)) return;
    saveContacts(getContacts().filter(contact => !ids.has(contact.id)));
    renderContacts();
}

function initializeContacts() {
    const profile = getUserProfile();
    if (profileNameInput && profile.name) profileNameInput.value = profile.name;
    profileNameInput?.addEventListener("change", () => {
        const name = profileNameInput.value.trim();
        if (name) saveUserProfile({ name });
        renderContacts();
    });
    profileNameInput?.addEventListener("input", renderContacts);
    saveContactBtn?.addEventListener("click", saveContact);
    renderContacts();
}

document.addEventListener("DOMContentLoaded", initializeContacts);
window.addEventListener("load", renderContacts);
