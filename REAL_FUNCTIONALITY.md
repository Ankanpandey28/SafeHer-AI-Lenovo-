# SafeHer AI — Real Functionality and Deployment Notes

This project uses live browser/device capabilities and public routing/geocoding endpoints. It does not use simulated GPS coordinates. Situation assessment is sent to the configured AI provider through `api/analyze.js`; if that endpoint is disabled or unavailable, the app displays an error instead of fabricating a result.

## Implemented behavior

- Browser Geolocation API for real device coordinates, with permission and secure-context checks.
- Destination geocoding and driving route calculation through public OpenStreetMap Nominatim / OSRM endpoints.
- Route-deviation distance to route segments rather than only route vertices.
- GPS accuracy gating to avoid making route inferences from very weak fixes.
- Prolonged-stop detection from successive actual GPS positions.
- Saved journey is marked as monitoring-paused after page reload; user must explicitly resume.
- Reaching the destination area does not silently complete the journey; the user confirms completion.
- Situation descriptions are sent to the configured AI provider only after the user accepts the consent notice.
- AI assessment uses a server-side API key and a structured response schema; it never activates SOS automatically from an AI result.
- Trusted-contact numbers are validated as international-format numbers and rendered as text, not injected as HTML.
- Emergency message distinguishes a recent location from an older last-known location.
- GPS failure does not prevent the user from accessing the emergency workflow.
- The app does not try to navigate to `tel:112` automatically after an asynchronous operation; the user taps the emergency call control.
- SMS submission endpoint limits message size and recipient count, filters to a server-side recipient allowlist, avoids returning phone numbers/provider error details, and distinguishes provider acceptance from confirmed delivery.
- Native SMS composer is an explicit user action, and the user must review and press Send.
- Local history reads/writes handle malformed or unavailable browser storage more safely.

## Configure Vercel AI and SMS

Set the following in Vercel → Project → Settings → Environment Variables:

- `OPENAI_API_KEY` — secret key for the AI provider
- `OPENAI_MODEL` — set to a model enabled for your API account (for example, `gpt-5-mini`)
- `SAFEHER_AI_ENABLED=true` — explicitly enable the AI endpoint
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SAFEHER_ALLOWED_RECIPIENTS` — comma-separated, E.164 numbers for a private controlled pilot
- `SAFEHER_ALLOWED_ORIGIN` — exact frontend origin, required by both serverless endpoints

Redeploy after changing environment variables. The AI endpoint sends the user's situation description to the configured AI provider only after explicit consent. Avoid collecting unnecessary personal details. Test only with consenting, verified recipients. Twilio trial accounts may restrict destinations to verified numbers.

The API deliberately refuses to send if `SAFEHER_ALLOWED_RECIPIENTS` is not configured. This protects against turning the deployment into an unrestricted public SMS relay. The current allowlist is a **private-pilot safeguard, not per-user authorization**. Do not launch to the public until proper user authentication, per-user contact ownership/verification, persistent abuse controls, and incident storage are implemented.

## Browser and infrastructure limitations

- GPS updates are unavailable when permission is denied, and accuracy can degrade indoors or in dense urban areas.
- A browser page cannot guarantee GPS tracking while closed or suspended. A service worker does not provide continuous GPS tracking.
- `tel:` hands control to the phone's dialer; it cannot guarantee a call was placed or connected.
- SMS provider acceptance does not prove delivery or that a person read the alert.
- The app's journey, contacts and incident history remain in local browser storage. Clearing site data or changing devices can remove them; local storage is not a secure, account-backed database.
- Public Nominatim/OSRM endpoints may throttle or be unavailable and should not be treated as a production SLA. A public product needs an appropriate routing/geocoding provider or self-hosted infrastructure, quotas, monitoring and a fallback plan.
- A route deviation or stop is an anomaly indicator, not proof of assault, abduction or robbery. Thresholds need field validation to measure false alarms.

## Controlled test procedure

1. Use a real phone over HTTPS and grant GPS permission.
2. Start a journey to a real destination.
3. Verify location timestamps and GPS accuracy change with actual fixes.
4. Test route and stop rules safely; do not stage a dangerous situation.
5. Confirm the Guardian prompt and manual SOS flow.
6. Test SMS only with consenting contacts and verify provider status.
7. Confirm no automatic call is claimed or made by the app.
8. Close/reopen the page and confirm that monitoring is marked paused until the user resumes.
9. Test GPS denied, poor accuracy, network loss, route provider errors and SMS provider failures.
10. Do not test by sending messages to police or placing test calls to 112.

## Still required before a public real-world launch

1. User authentication and verified per-user trusted contacts.
2. Persistent per-user rate limiting and abuse controls for AI/SMS endpoints.
3. Secure server-side database with access control, retention policy and deletion/export workflows.
4. Durable abuse monitoring and an incident audit trail.
5. Production routing/geocoding service with monitored uptime and acceptable usage terms.
6. Mobile background tracking strategy (likely a native mobile app with appropriate OS permissions) if continuous tracking while the app is backgrounded is a requirement.
7. Independent safety testing, privacy review, accessibility review, and a controlled pilot measuring false positives and response times.


## Journey simulation mode

The journey form includes a separate simulation workflow. It geocodes the user's entered start and destination, requests a route from OSRM, and animates a labelled simulated vehicle marker along that route. The user controls simulation duration and the route-progress percentage at which a simulated unusual event appears. This is a visual scenario, not vehicle telematics or real GPS.

Selecting “No” in a simulation opens a simulation SOS panel and dynamically looks for mapped police features near the simulated vehicle location. It does not automatically call a police station. Browser applications cannot silently place reliable calls; the user must tap a phone-call action, and a station phone number must be present in map data. By default, no SMS is sent from simulation mode. A separate opt-in checkbox permits a clearly labelled `SIMULATION TEST — NOT A REAL EMERGENCY` SMS through the configured, server-allowlisted SMS provider. Only use it with consenting test recipients. OpenStreetMap/Overpass coverage and phone numbers may be incomplete or stale.
