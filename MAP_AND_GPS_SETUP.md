# SafeHer AI map, geocoding, and journey simulation setup

## What this changes
- Location searches are restricted to India to reduce wrong matches for similarly named places.
- If configured, Mapbox Geocoding v6 and Directions API are used for place resolution and road-route geometry.
- If no Mapbox token is configured, the project falls back to OpenStreetMap Nominatim and OSRM.
- Simulation playback interpolates along the returned road geometry; it is simulated movement, not live GPS.

## Configure Mapbox (recommended for more consistent place search/routing)
1. Create/sign in to a Mapbox account: https://account.mapbox.com/
2. Create a **public** access token with the required search/geocoding and directions access. Do not use a secret token in frontend code.
3. Restrict the token to your development and deployed domains where possible.
4. Open `js/config.js` and set `mapboxPublicToken` to the token string.
5. Save, restart your local server if needed, then hard-refresh the browser.

Mapbox usage may be subject to account limits and billing; check current terms/pricing before deployment. The map background still uses OpenStreetMap tiles.

## GPS accuracy and safety
An API key cannot make a device's GPS more accurate. GPS accuracy depends on the device, OS permissions, browser, sky visibility, and network-assisted location. For real journeys, serve the site over HTTPS, grant precise location permission, and inspect the reported GPS accuracy. The app should show a clear warning when GPS is stale or inaccurate.

Simulation mode deliberately does not use live GPS. It moves the vehicle marker along the calculated road geometry over the selected duration and should always be labelled SIMULATION. Never treat simulation coordinates as the user's actual location or use them to dispatch emergency responders.

## If a place is still wrong
Enter a fuller location, such as `Durg Railway Station, Durg, Chhattisgarh, India` or include the city/state/PIN code. Check the resolved place labels shown by SafeHer before starting a journey. No geocoder can guarantee every local name or landmark.
