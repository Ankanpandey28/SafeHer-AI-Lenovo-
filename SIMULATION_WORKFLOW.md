# SafeHer AI — Journey Simulation Workflow

## What this adds

- Uses the user's entered departure and destination; it geocodes both locations and requests a driving route from OSRM.
- Animates a clearly labelled simulated vehicle marker along the returned route on the dashboard map.
- Lets the user choose playback duration (15–600 seconds) and the route percentage at which to trigger a simulated unusual event (10–90%).
- Opens the existing “Are you safe?” prompt when the simulated vehicle reaches the selected point. Selecting “Yes” continues the playback. Selecting “No” opens the SOS response panel.
- Dynamically searches OpenStreetMap's Overpass data for mapped police stations within 5 km of the simulated position. If a station has a phone number in map data, the user can tap the call button to open the phone dialer. If no phone number is listed, the button falls back to the configured emergency number (112 by default).

## Run locally

1. Open this folder in VS Code.
2. Start a local server from the project root: `python3 -m http.server 8000`.
3. Open `http://localhost:8000`.
4. Choose **Start Safe Journey** and enter the user, start, destination, driver, vehicle, ETA, and trusted-contact details. Save at least one trusted contact.
5. Set simulation duration and unusual-event percentage, then choose **Simulate Journey + Safety Check**.
6. Watch the simulated vehicle marker move along the route. At the selected route percentage, answer the safety prompt.

## Notifications and calling limitations

- Simulation mode does not use live GPS and does not send SMS by default. The map marker and location in any test message are explicitly simulated.
- To test the SMS provider, check the **Send a REAL SMS through TextBee** opt-in before starting the simulation. This sends a message labelled **SIMULATION TEST — NOT A REAL EMERGENCY** to the saved contacts only if the configured backend is available and its server-side recipient allowlist permits those numbers. Test only with consenting contacts; never send a test alert to emergency services.
- The backend must be deployed/configured for SMS; a static local server does not execute Vercel `/api/sos` functions. A provider accepting a request does not guarantee SMS delivery.
- A browser cannot silently place a call. The user must tap **Call Trusted Contact** or **Call Nearby Police**. The trusted-contact action opens the phone dialer for the first saved contact. A mapped station number opens the dialer after a simulation warning/confirmation; if no station number is mapped during simulation, the app opens a map search rather than dialling 112. In a live SOS, if no station number is available, the user may explicitly choose to open the configured emergency number. Never place test calls to police or emergency services.
- This simulation demonstrates the journey and response workflow; it is not a substitute for live vehicle telemetry, background GPS tracking, or a verified emergency dispatch integration.


## TextBee setup for real SMS

1. Create/verify your TextBee account and pair an Android phone with a working SIM. Keep the phone online and grant the TextBee app SMS permissions.
2. For local testing on the existing `localhost:8000` origin, copy `server/.env.example` to `server/.env` and set `TEXTBEE_API_KEY`, optional `TEXTBEE_DEVICE_ID`, `SAFEHER_ALLOWED_RECIPIENTS`, and `SAFEHER_ALLOWED_ORIGIN=http://localhost:8000`.
3. Run `npm install` and `npm start` inside `server/`, then run `python3 -m http.server 8000` from the project root in a second terminal. Open `http://localhost:8000`; the frontend routes SMS to the local TextBee bridge. The backend refuses to send to contacts not on the server-side allowlist.
4. For a Vercel deployment, configure the root serverless environment with the same TextBee variables and set `SAFEHER_ALLOWED_ORIGIN` to the exact deployed HTTPS origin.
5. Select the real-test-SMS checkbox only after the contacts agree. The test message includes `SIMULATION TEST — NOT A REAL EMERGENCY`. For a live SOS, selecting “No” sends the emergency alert to configured, allowlisted trusted contacts.
6. A TextBee 200/accepted response means queued/accepted, not delivered. Check TextBee message history for `sent`, `delivered`, or `failed` status.
