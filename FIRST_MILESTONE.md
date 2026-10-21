# SafeHer AI — Journey Details and Trusted Contacts Milestone

## Implemented

- A browser-local user profile name, saved in `localStorage` as `safeher_user_profile`.
- Required journey details: starting point, destination, driver name, driver phone number, vehicle type, vehicle registration number, and estimated time to reach.
- Driver phone numbers and trusted contact numbers must use international E.164 format, such as `+919876543210`.
- The starting point is geocoded and checked against the device's current GPS location. It must be within 5 km of current GPS to reduce unsafe origin mismatches.
- Route planning uses the device's actual GPS coordinates as the routing origin and the entered destination as the endpoint.
- Trusted contacts are saved with both the profile owner's name/key and the trusted contact's name/phone number. Contacts are separated by profile name in this browser.
- Contacts persist across browser sessions on the same browser/device unless browser data is cleared. Existing unassigned legacy contacts are assigned to the first profile name used after this update.
- The active journey object records the profile name, starting point, destination, driver details, vehicle details, and ETA.
- The dashboard displays the starting point, user name, driver name/phone, destination, and vehicle number for an active journey.
- Real secrets were removed from the example configuration; `server/.env.local` is not included.

## Important limitation

This milestone does **not** implement user authentication or cloud database storage. Browser `localStorage` is local to the browser profile and can be cleared; it is not a secure account system, cannot sync across devices, and should not be described as permanent cloud storage. For secure per-user persistence across devices, the next milestone should add authentication and a database (for example, Supabase) with row-level security policies.

## Run locally on macOS

1. Install Node.js if it is not installed.
2. Open this folder in VS Code.
3. Open Terminal in VS Code and run `npx vercel dev` to run the frontend and Vercel API routes together (first install/login/configuration may be required).
4. Open the local URL printed by Vercel, typically `http://localhost:3000`.
5. Enter your full name and journey details, add at least one trusted contact using an international phone number, then start a journey.
6. Allow location access. Use a starting point near the device's current GPS location.

The SMS and AI APIs still require correctly configured provider credentials in local environment variables. The provided `.env.example` contains placeholders only. Never commit or share real `.env.local` files. Rotate any credentials that were present in earlier shared ZIPs.

## Safety testing

Use your own test contact number and verify provider behavior in a controlled test. Do not test by sending alerts to emergency services or making test calls to 112. Browser GPS monitoring may pause when the browser/app is suspended or closed.
