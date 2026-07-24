/* public/js/customer-nearby.js
   ============================================================
   Nearby hawker centres page: shows hawker centres ranked by
   distance from the customer's current location, on a map.
   Protected page: no valid customer session -> redirect to login.

   Talks to the back-end API (needs a customer JWT):
     GET /hawker-centres/nearby?lat=..&lng=.. — centres nearest first,
         each geocoded via OneMap on the server.
   Map tiles are OpenStreetMap; the centre coordinates come from OneMap.
   Relies on helpers from common.js and Leaflet (both loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/customer-login.html";

// Central Singapore — the map's starting view before we have the user's location.
const SG_CENTER = [1.3521, 103.8198];

let map;              // the Leaflet map instance
let markerLayer;      // a layer group we can clear and repopulate on each search
let routeLayer;       // a separate layer for the drawn directions line
let lastUser = null;  // the customer's last known location, for directions

/* ---------- Auth guard / logout ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleLogout() {
    clearSession();
    window.location.href = LOGIN_URL;
}

function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Map setup ---------- */

function initMap() {
    map = L.map("map").setView(SG_CENTER, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors · Geocoding by OneMap (SLA)',
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
}

// OneMap returns the route as an encoded polyline (Google's algorithm, 1e5
// precision). Decode it to an array of [lat, lng] points for Leaflet to draw.
function decodePolyline(encoded) {
    let index = 0, lat = 0, lng = 0;
    const coordinates = [];
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;

        coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
}

/* ---------- Rendering ---------- */

function renderCentreCard(centre) {
    const card = document.createElement("article");
    card.className = "order-card";

    const distance =
        centre.distanceKm === null || centre.distanceKm === undefined
            ? '<span class="tag tag--historical">Location unavailable</span>'
            : `<span class="tag tag--available">${centre.distanceKm} km away</span>`;

    // Only offer directions when we actually have the centre's coordinates.
    const directionsBtn =
        centre.latitude !== null && centre.longitude !== null
            ? `<div class="order-card__actions">
                   <button type="button" class="btn btn--secondary btn--sm" data-action="directions"
                           data-lat="${centre.latitude}" data-lng="${centre.longitude}"
                           data-name="${centre.name.replace(/"/g, "&quot;")}">🚶 Directions</button>
               </div>`
            : "";

    card.innerHTML = `
        <div class="order-card__head">
            <div>
                <div class="order-card__title">${centre.name}</div>
                <div class="order-card__meta">${centre.address}</div>
            </div>
            ${distance}
        </div>
        <div class="order-card__meta">${centre.region || ""}</div>
        ${directionsBtn}
    `;
    return card;
}

function renderCentres(centres) {
    const results = $("#centre-results");
    results.innerHTML = "";
    if (!centres || centres.length === 0) {
        results.innerHTML = `<div class="empty">No hawker centres found.</div>`;
        return;
    }
    for (const centre of centres) {
        results.appendChild(renderCentreCard(centre));
    }
}

// Drop a pin for the user and for each locatable centre, then frame them all.
// `accuracy` is the browser's own estimate of how far off the position may be
// (in metres); we draw it as a circle so an approximate fix (common on laptops
// without GPS) looks approximate instead of misleadingly pin-point.
function renderMarkers(userLat, userLng, centres, accuracy) {
    markerLayer.clearLayers();

    const bounds = [[userLat, userLng]];

    const accuracyNote =
        accuracy && accuracy > 0 ? `<br />Accurate to about ${Math.round(accuracy)} m` : "";
    L.marker([userLat, userLng])
        .bindPopup(`<strong>You are here</strong>${accuracyNote}`)
        .addTo(markerLayer);

    // Uncertainty circle around the user's position.
    if (accuracy && accuracy > 0) {
        L.circle([userLat, userLng], {
            radius: accuracy,
            color: "#2563eb",
            weight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
        }).addTo(markerLayer);
    }

    for (const centre of centres) {
        if (centre.latitude === null || centre.longitude === null) continue;
        bounds.push([centre.latitude, centre.longitude]);
        L.marker([centre.latitude, centre.longitude])
            .bindPopup(
                `<strong>${centre.name}</strong><br />${centre.address}` +
                (centre.distanceKm !== null ? `<br />${centre.distanceKm} km away` : "")
            )
            .addTo(markerLayer);
    }

    // Fit the view to every pin (with a little padding).
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
}

/* ---------- Load ---------- */

async function loadNearby(userLat, userLng, accuracy) {
    const msg = $("#nearby-message");
    clearMessage(msg);
    try {
        const data = await api(`/hawker-centres/nearby?lat=${userLat}&lng=${userLng}`, { auth: true });
        lastUser = { lat: userLat, lng: userLng }; // remembered for directions
        renderCentres(data.hawkerCentres);
        renderMarkers(userLat, userLng, data.hawkerCentres, accuracy);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

// Format helpers for the route summary.
function formatDistance(metres) {
    return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} h ${mins % 60} min`;
}

async function showDirections(endLat, endLng, name) {
    const msg = $("#nearby-message");
    clearMessage(msg);

    if (!lastUser) {
        showMessage(msg, "error", "Please use 'Find near me' first so we know where you're starting from.");
        return;
    }

    const mode = $("#route-mode").value;
    showMessage(msg, "info", `Getting ${mode} directions to ${name}…`);

    try {
        const route = await api(
            `/hawker-centres/directions?startLat=${lastUser.lat}&startLng=${lastUser.lng}` +
            `&endLat=${endLat}&endLng=${endLng}&routeType=${mode}`,
            { auth: true }
        );

        routeLayer.clearLayers();
        const line = decodePolyline(route.geometry);
        const drawn = L.polyline(line, { color: "#dc2626", weight: 5, opacity: 0.8 }).addTo(routeLayer);
        map.fitBounds(drawn.getBounds(), { padding: [40, 40] });

        showMessage(
            msg,
            "success",
            `${name}: ${formatDistance(route.distanceMeters)} · about ${formatDuration(route.timeSeconds)} by ${mode}.`
        );
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

function handleResultsClick(event) {
    const btn = event.target.closest('button[data-action="directions"]');
    if (!btn) return;
    showDirections(Number(btn.dataset.lat), Number(btn.dataset.lng), btn.dataset.name);
}

function handleLocate() {
    const msg = $("#nearby-message");
    clearMessage(msg);

    if (!navigator.geolocation) {
        showMessage(msg, "error", "Your browser does not support location access.");
        return;
    }

    const btn = $("#locate-btn");
    btn.disabled = true;
    showMessage(msg, "info", "Getting your location…");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            clearMessage(msg);
            await loadNearby(latitude, longitude, accuracy);
            btn.disabled = false;
        },
        (error) => {
            // Permission denied / unavailable / timeout
            const reason =
                error.code === error.PERMISSION_DENIED
                    ? "Location permission was denied. Please allow it and try again."
                    : "Could not get your location. Please try again.";
            showMessage(msg, "error", reason);
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is customer-only. Check the role, not just for
    // any session, so a logged-in officer or stall owner can't land here.
    if (!isLoggedIn() || getRole() !== "customer") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which customer is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    $("#logout-btn").addEventListener("click", handleLogout);
    $("#locate-btn").addEventListener("click", handleLocate);
    $("#centre-results").addEventListener("click", handleResultsClick);

    initMap();
}

document.addEventListener("DOMContentLoaded", init);
