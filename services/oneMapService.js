// Third-party mapping integration (OneMap API, Singapore Land Authority).
// Used to geocode a hawker centre's postal code / address into latitude and
// longitude, so the front-end can plot it and rank centres by distance.
// The search/geocode endpoint is public (no token required); Node 18+ provides
// a global fetch, so no extra HTTP dependency is needed.

const ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const ONEMAP_TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const ONEMAP_ROUTE_URL = "https://www.onemap.gov.sg/api/public/routingsvc/route";

// Small in-memory cache so the same postal code isn't re-geocoded on every
// request. Keyed by search value; lives for the process lifetime.
const geocodeCache = new Map();

// Geocode a free-text value (postal code, address or building name) into
// { latitude, longitude } as numbers. Returns null when OneMap finds no match
// or the call fails — the caller decides how to handle a missing location, so
// this never throws.
async function geocode(searchVal) {
    if (!searchVal) return null;

    const key = String(searchVal).trim();
    if (geocodeCache.has(key)) {
        return geocodeCache.get(key);
    }

    try {
        const url =
            `${ONEMAP_SEARCH_URL}?searchVal=${encodeURIComponent(key)}` +
            `&returnGeom=Y&getAddrDetails=Y`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.results || data.results.length === 0) return null;

        const first = data.results[0];
        const location = {
            latitude: Number(first.LATITUDE),
            longitude: Number(first.LONGITUDE),
        };

        // Guard against a malformed row (non-numeric coordinates)
        if (Number.isNaN(location.latitude) || Number.isNaN(location.longitude)) {
            return null;
        }

        geocodeCache.set(key, location);
        return location;
    } catch (error) {
        // Network failure / DNS / timeout — report as "not found" to the caller.
        console.error("OneMap geocode error:", error.message);
        return null;
    }
}

// ---- Routing (needs authentication, unlike geocoding above) ----

// OneMap's routing endpoint requires a token obtained from your account's
// email/password. Tokens last ~3 days, so we cache and reuse one until it's
// close to expiring rather than logging in on every request.
let cachedToken = null; // { token, expiryMs }

async function getToken() {
    // Reuse a still-valid token (refresh a minute before expiry to be safe).
    if (cachedToken && cachedToken.expiryMs - 60000 > Date.now()) {
        return cachedToken.token;
    }

    const email = process.env.ONEMAP_EMAIL;
    const password = process.env.ONEMAP_PASSWORD;
    if (!email || !password) {
        console.error("OneMap routing is not configured (missing ONEMAP_EMAIL or ONEMAP_PASSWORD).");
        return null;
    }

    try {
        const res = await fetch(ONEMAP_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.access_token) return null;

        // expiry_timestamp is unix seconds; fall back to ~3 days if absent.
        const expiryMs = data.expiry_timestamp
            ? Number(data.expiry_timestamp) * 1000
            : Date.now() + 3 * 24 * 60 * 60 * 1000;
        cachedToken = { token: data.access_token, expiryMs };
        return cachedToken.token;
    } catch (error) {
        console.error("OneMap getToken error:", error.message);
        return null;
    }
}

// Get a route between two points. routeType is walk | drive | cycle.
// Returns { distanceMeters, timeSeconds, geometry } (geometry is an encoded
// polyline the front-end decodes to draw the line), or null on any failure so
// the caller can degrade gracefully.
async function getRoute(startLat, startLng, endLat, endLng, routeType = "walk") {
    const token = await getToken();
    if (!token) return null;

    try {
        const url =
            `${ONEMAP_ROUTE_URL}?start=${startLat},${startLng}` +
            `&end=${endLat},${endLng}&routeType=${routeType}`;
        const res = await fetch(url, { headers: { Authorization: token } });
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.route_summary) return null;

        return {
            distanceMeters: data.route_summary.total_distance,
            timeSeconds: data.route_summary.total_time,
            geometry: data.route_geometry, // encoded polyline
        };
    } catch (error) {
        console.error("OneMap getRoute error:", error.message);
        return null;
    }
}

module.exports = {
    geocode,
    getRoute,
};
