# Optional SafeHer TextBee SMS Bridge

The primary deployment uses the Vercel function at `api/sos.js`. This optional Express bridge also uses TextBee (not Twilio).

1. Copy `.env.example` to `.env`.
2. Set `TEXTBEE_API_KEY`, optional `TEXTBEE_DEVICE_ID`, `SAFEHER_ALLOWED_RECIPIENTS` (comma-separated E.164 numbers), and the exact frontend `SAFEHER_ALLOWED_ORIGIN`.
3. Run `npm install` and `npm start`. The bridge listens on port 8787 by default.
4. To use the bridge from the frontend, set `window.SAFEHER_SMS_API` to the bridge's reachable `/api/sos` URL in `js/config.js`; use HTTPS and appropriate CORS/origin configuration in deployment.

Keep `.env` private. The recipient allowlist is a safety control for a private pilot, not per-user authentication. Provider acceptance is not proof of SMS delivery.
