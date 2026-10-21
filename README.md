# SafeHer AI

SafeHer AI is a browser-based journey safety companion. This repository contains a client-side application, real browser geolocation, route lookup, server-backed AI situation assessment (when configured), a Guardian journey-monitoring engine, trusted contacts, and optional server-side SMS submission.

## Important scope and safety boundaries

- Situation assessment calls the configured AI provider through the server-side `/api/analyze` endpoint. The API key stays on the server. If AI is not configured or unavailable, no simulated assessment is substituted. AI guidance is not proof of danger or safety, and it never activates SOS by itself.
- Browser GPS is real, but it is only available with permission and a secure context (HTTPS or localhost). Accuracy varies by device and environment.
- A browser cannot guarantee background GPS tracking after the page is closed, suspended, or the device sleeps. A saved journey is therefore marked as paused after reload and requires the user to resume monitoring.
- The app does not silently call 112 or any trusted contact. The user must tap a call control; the browser opens the phone dialer and the user confirms the call. In simulation mode, missing station phone data opens a map search instead of dialing 112.
- SMS provider acceptance is not the same as delivery. The app reports API acceptance, not that a contact has read the alert.
- Journey/contact/incident history is stored in this browser's Local Storage. It is not account-synced, encrypted storage or a secure multi-user database.
- The public OpenStreetMap Nominatim and OSRM services are real community endpoints, but they do not provide this app with a production availability guarantee. For a public product, use a provider or infrastructure you operate and can monitor.

## Run locally

For local end-to-end TextBee testing while keeping the app on `http://localhost:8000`:

**Terminal 1 — start the TextBee backend**

```bash
cd server
cp .env.example .env
# Edit server/.env and set TEXTBEE_API_KEY, SAFEHER_ALLOWED_RECIPIENTS, and SAFEHER_ALLOWED_ORIGIN=http://localhost:8000
npm install
npm start
```

**Terminal 2 — start the frontend from the project root**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. The frontend automatically calls the local bridge on port 8787 for SMS. This keeps existing browser-local profile/contact data on the same origin. Keep both terminals running. Never commit `server/.env` or paste secrets into chat. TextBee sends through a registered, online Android phone with SMS permission enabled.

For a Vercel deployment, configure the root `.env.local`/Vercel environment with `TEXTBEE_API_KEY`, optional `TEXTBEE_DEVICE_ID`, `SAFEHER_ALLOWED_RECIPIENTS`, and the exact `SAFEHER_ALLOWED_ORIGIN`, then use the root `api/sos.js` endpoint. For local Vercel function testing, run `npx vercel dev` at `http://localhost:3000`; browser-local contacts are separated by origin/port, so contacts saved on port 8000 won't automatically appear on port 3000.
## Trusted contacts

Enter phone numbers in international E.164 format, including the country code (for example, `+14155552671`). Do not guess a country code. Contact details are stored locally in the current browser.

## Configure server-side AI and TextBee SMS

The SMS API is deliberately restricted to a server-side recipient allowlist. Do not expose an unrestricted SMS relay to the public internet.

For Vercel deployment, configure these environment variables in the Vercel project settings:

- `OPENAI_API_KEY` — server-side AI provider key
- `OPENAI_MODEL` — set to a model enabled for your API account (for example, `gpt-5-mini`)
- `SAFEHER_AI_ENABLED=true` — explicitly enable the AI endpoint
- `TEXTBEE_API_KEY` — server-side TextBee key; never expose it in browser code
- `TEXTBEE_DEVICE_ID` — optional TextBee device ID if you want to select a specific registered Android sender
- `SAFEHER_ALLOWED_RECIPIENTS` — comma-separated E.164 recipient numbers that this private pilot is permitted to message
- `SAFEHER_ALLOWED_ORIGIN` — the exact deployed frontend origin, e.g. `https://your-app.example`

The situation description is sent to the configured AI provider only after the user checks the consent box. Do not include names, phone numbers or exact addresses in that description.

Deploy the project root (the directory containing `index.html`, `api/`, `js/`, and the root `package.json`). The frontend calls `/api/sos` by default.

**Important:** The recipient allowlist and best-effort rate limiter are not a replacement for per-user authentication. This configuration is for a private, controlled pilot with known recipients. Before opening SafeHer to multiple unrelated users, add a real identity/session system, per-user verified contacts, persistent rate limiting, abuse monitoring, and an auditable incident database. Never put a server secret in `js/config.js` or browser code.

The optional Express bridge in `server/` also uses TextBee. Copy `server/.env.example` to `server/.env`, set TextBee and allowlist variables, and configure `SAFEHER_ALLOWED_ORIGIN` to the frontend origin. Keep `.env` out of version control.

## Main modules

- `js/journey.js` — destination lookup, route calculation and journey lifecycle
- `js/guardian.js` — location-based deviation and prolonged-stop checks
- `js/sos.js` — emergency orchestration, message preparation and dialer handoff
- `js/ai.js` — server-backed AI assessment client; no mock/keyword fallback
- `js/contacts.js` — trusted-contact management
- `js/mobile.js` — browser GPS, map and device telemetry
- `js/storage.js` — local persistence
- `api/analyze.js` — Vercel AI assessment endpoint
- `api/sos.js` — Vercel SMS endpoint
- `server/server.js` — optional Express SMS bridge

## Minimum real-device test

1. Deploy over HTTPS and open it on a phone.
2. Add a trusted contact using an international-format number.
3. Start a journey to a real destination and allow location permission.
4. Verify that the location timestamp changes and the calculated route appears.
5. Test route deviation and prolonged-stop behavior in a safe, controlled setting.
6. Confirm that a Guardian prompt can be dismissed or can launch the SOS workflow.
7. Test the 112 handoff manually; do not place test calls to emergency services.
8. Test SMS using only verified, consenting test recipients. Confirm provider status separately from actual delivery.
9. Close/reopen the page and verify the app clearly states that monitoring was interrupted.
10. Test denied GPS, offline mode, unavailable routing, SMS configuration errors and weak GPS accuracy.

SafeHer AI is not a replacement for emergency services or a guarantee of safety. Do not rely on this browser-only implementation as the sole safety measure in a real emergency.
