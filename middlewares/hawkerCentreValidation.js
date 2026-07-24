const Joi = require("joi");

// The customer's current position comes in as lat/lng query params from the
// browser's geolocation API. Validate they're present and within valid ranges
// before we spend OneMap calls geocoding centres to compare against them.
const nearbySchema = Joi.object({
    lat: Joi.number().min(-90).max(90).required().messages({
        "number.base": "Latitude must be a number",
        "number.min": "Latitude is out of range",
        "number.max": "Latitude is out of range",
        "any.required": "Latitude (lat) is required",
    }),
    lng: Joi.number().min(-180).max(180).required().messages({
        "number.base": "Longitude must be a number",
        "number.min": "Longitude is out of range",
        "number.max": "Longitude is out of range",
        "any.required": "Longitude (lng) is required",
    }),
});

function validateNearbyQuery(req, res, next) {
    const { error } = nearbySchema.validate(req.query, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ message: errorMessage });
    }

    next();
}

// Directions need a start (the customer) and an end (a chosen centre), plus an
// optional travel mode limited to the modes whose response shape we handle.
const directionsSchema = Joi.object({
    startLat: Joi.number().min(-90).max(90).required(),
    startLng: Joi.number().min(-180).max(180).required(),
    endLat: Joi.number().min(-90).max(90).required(),
    endLng: Joi.number().min(-180).max(180).required(),
    routeType: Joi.string().valid("walk", "drive", "cycle").optional(),
}).messages({
    "number.base": "Coordinates must be numbers",
    "any.required": "startLat, startLng, endLat and endLng are all required",
    "any.only": "routeType must be one of: walk, drive, cycle",
});

function validateDirectionsQuery(req, res, next) {
    const { error } = directionsSchema.validate(req.query, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ message: errorMessage });
    }

    next();
}

module.exports = {
    validateNearbyQuery,
    validateDirectionsQuery,
};
