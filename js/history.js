// SafeHer AI — locally stored situation-screening history.
"use strict";

function saveHistory(text, result) {
    let history = [];
    try {
        const parsed = JSON.parse(localStorage.getItem("safeher_history") || "[]");
        if (Array.isArray(parsed)) history = parsed;
    } catch (error) {
        console.warn("Previous screening history could not be read.", error);
    }

    history.unshift({
        text: String(text).slice(0, 2000),
        level: String(result?.level || "Unknown"),
        summary: String(result?.summary || ""),
        time: new Date().toISOString()
    });

    try {
        localStorage.setItem("safeher_history", JSON.stringify(history.slice(0, 20)));
    } catch (error) {
        console.warn("Screening history could not be saved.", error);
    }
    loadHistory();
    window.dispatchEvent(new Event("safeher:activity-updated"));
}

function loadHistory() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;

    let history = [];
    try {
        const parsed = JSON.parse(localStorage.getItem("safeher_history") || "[]");
        if (Array.isArray(parsed)) history = parsed;
    } catch (error) {
        console.warn("Screening history is malformed.", error);
    }

    historyList.replaceChildren();
    if (!history.length) {
        const empty = document.createElement("p");
        empty.textContent = "No analyses yet.";
        historyList.appendChild(empty);
        return;
    }

    for (const item of history.slice(0, 20)) {
        const card = document.createElement("div");
        card.className = "history-item";
        const title = document.createElement("strong");
        title.textContent = String(item.level || "Unknown");
        const timestamp = document.createElement("small");
        const parsedDate = new Date(item.time);
        timestamp.textContent = Number.isNaN(parsedDate.getTime())
            ? "Date unavailable"
            : parsedDate.toLocaleString();
        const detail = document.createElement("p");
        detail.textContent = String(item.summary || item.text || "");
        card.append(title, document.createElement("br"), timestamp, detail);
        historyList.appendChild(card);
    }
}

window.addEventListener("DOMContentLoaded", loadHistory);
