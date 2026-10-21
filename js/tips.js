// =====================================
// SafeHer AI
// tips.js
// =====================================

const tips = [

    "Share your live location with a trusted contact before travelling.",

    "Avoid isolated roads, especially at night.",

    "Use only verified cab services.",

    "Keep your phone charged before leaving.",

    "Stay aware of your surroundings.",

    "Trust your instincts if something feels unsafe.",

    "Keep emergency contacts updated.",

    "Avoid sharing personal information with strangers."

];

function newTip() {

    const tip = tips[Math.floor(Math.random() * tips.length)];

    const tipElement = document.getElementById("dailyTip");

    if (tipElement) {

        tipElement.innerText = tip;

    }

}

window.addEventListener("DOMContentLoaded", newTip);