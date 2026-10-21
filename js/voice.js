// =========================================
// SafeHer AI
// voice.js
// =========================================

// -----------------------------
// Speech Recognition
// -----------------------------
const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;
let selectedVoice = null;

// -----------------------------
// Load Best Voice
// -----------------------------
function loadVoice() {

    const voices = window.speechSynthesis.getVoices();

    selectedVoice =
        voices.find(v => v.name === "Samantha") ||
        voices.find(v => v.name === "Daniel") ||
        voices.find(v => v.name === "Karen") ||
        voices.find(v => v.lang === "en-US") ||
        voices.find(v => v.lang.startsWith("en")) ||
        voices[0];

    if (selectedVoice) {
        console.log("Voice Selected:", selectedVoice.name);
    }
}

loadVoice();

window.speechSynthesis.onvoiceschanged = loadVoice;

// -----------------------------
// Initialize Recognition
// -----------------------------
if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {

        isListening = true;

        console.log("🎤 Listening...");

    };

    recognition.onresult = function (event) {

        const transcript = event.results[0][0].transcript;

        console.log("User:", transcript);

        const input = document.getElementById("userInput");

        if (input) {

            input.value = transcript;

        }

        setTimeout(() => {

            if (typeof analyzeSituation === "function") {

                analyzeSituation();

            }

        }, 500);

    };

    recognition.onerror = function (event) {

        console.log("Speech Error:", event.error);

        isListening = false;

    };

    recognition.onend = function () {

        isListening = false;

        console.log("🎤 Listening Stopped");

    };

}

// -----------------------------
// Start Listening
// -----------------------------
function startListening() {

    if (!recognition) {

        alert("Speech Recognition is not supported.");

        return;

    }

    if (isListening) return;

    window.speechSynthesis.cancel();

    recognition.start();

}

// -----------------------------
// Stop Listening
// -----------------------------
function stopListening() {

    if (recognition && isListening) {

        recognition.stop();

    }

}

// -----------------------------
// AI Speak
// -----------------------------
function speak(text) {

    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-US";

    speech.rate = 0.88;      // clearer

    speech.pitch = 1;

    speech.volume = 1;

    if (selectedVoice) {

        speech.voice = selectedVoice;

    }

    speech.onstart = function () {

        console.log("🤖 AI Speaking");

    };

    speech.onend = function () {

        console.log("✅ AI Finished");

    };

    speech.onerror = function (e) {

        console.log(e);

    };

    window.speechSynthesis.speak(speech);

}

// -----------------------------
// Voice Button
// -----------------------------
document.addEventListener("DOMContentLoaded", function () {

    const voiceBtn = document.getElementById("voiceBtn");

    if (voiceBtn) {

        voiceBtn.addEventListener("click", startListening);

    }

});