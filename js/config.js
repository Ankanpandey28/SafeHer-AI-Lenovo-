// Deployment configuration. Defaults are for an India-focused pilot.
// Change the emergency number for the country/region where the app is deployed.
window.SAFEHER_CONFIG = Object.freeze({
  emergencyNumber: "112",
  // Optional Mapbox public access token. Create one at https://account.mapbox.com/.
  // Restrict it to your development/deployed domains. Never put a secret token here.
  // Leave blank to use the OpenStreetMap/Nominatim + OSRM fallback.
  mapboxPublicToken: "",
  geocodingSearchUrl: "https://nominatim.openstreetmap.org/search",
  routingBaseUrl: "https://router.project-osrm.org/route/v1/driving",
  mapTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  gpsMaximumAcceptedAccuracyMeters: 100,
  routeDeviationMeters: 300,
  routeDeviationConfirmSamples: 2,
  prolongedStopMinutes: 3,
  safetyPromptCooldownMinutes: 5,
  safetyResponseSeconds: 20
});

// On the local Python preview (localhost:8000), use the optional local TextBee bridge.
// Vercel/local Vercel dev uses the same-origin /api/sos function.
// Never put provider credentials or private API secrets in this browser file.
window.SAFEHER_SMS_API = (window.location.hostname === "localhost" && window.location.port === "8000")
  ? "http://localhost:8787/api/sos"
  : "";
window.SAFEHER_AI_API = "";
