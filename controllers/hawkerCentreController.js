const hawkerCentreModel = require("../models/hawkerCentreModel");
const oneMapService = require("../services/oneMapService");

// Straight-line distance in kilometres between two lat/lng points (Haversine).
function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371; // Earth's mean radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

// GET /hawker-centres/nearby?lat=..&lng=..  (customer only)
// Geocodes each hawker centre via OneMap, then ranks them by distance from the
// customer's current location (nearest first).
async function getNearbyHawkerCentres(req, res) {
    try {
        const lat = Number(req.query.lat);
        const lng = Number(req.query.lng);

        const centres = await hawkerCentreModel.getAllHawkerCentres();

        // Geocode each centre by its postal code, falling back to its address.
        // A centre OneMap can't locate is still returned, just without
        // coordinates/distance, so the list stays complete.
        const withLocation = [];
        for (const centre of centres) {
            const location =
                (await oneMapService.geocode(centre.postalCode)) ||
                (await oneMapService.geocode(centre.address));

            withLocation.push({
                ...centre,
                latitude: location ? location.latitude : null,
                longitude: location ? location.longitude : null,
                distanceKm: location
                    ? Number(haversineKm(lat, lng, location.latitude, location.longitude).toFixed(2))
                    : null,
            });
        }

        // Nearest first; centres we couldn't locate sink to the bottom.
        withLocation.sort((a, b) => {
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
        });

        res.json({ hawkerCentres: withLocation });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving nearby hawker centres." });
    }
}

// GET /hawker-centres/directions?startLat=..&startLng=..&endLat=..&endLng=..&routeType=walk
// (customer only) Proxies OneMap's routing service so the token stays server-side
// and is never exposed to the browser. Returns distance, time and the route line.
async function getDirections(req, res) {
    try {
        const startLat = Number(req.query.startLat);
        const startLng = Number(req.query.startLng);
        const endLat = Number(req.query.endLat);
        const endLng = Number(req.query.endLng);
        const routeType = req.query.routeType || "walk";

        const route = await oneMapService.getRoute(startLat, startLng, endLat, endLng, routeType);
        if (!route) {
            return res.status(502).json({
                error: "Could not retrieve directions from OneMap. Check the ONEMAP credentials or try again.",
            });
        }

        res.json(route);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving directions." });
    }
}

module.exports = {
    getNearbyHawkerCentres,
    getDirections,
};
