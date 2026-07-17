const Joi = require("joi");

// Schema for logging an inspection (score + remarks for a stall)
const logInspectionSchema = Joi.object({
    stallID: Joi.number().integer().positive().required().messages({
        "number.base": "Stall ID must be a number",
        "number.integer": "Stall ID must be an integer",
        "number.positive": "Stall ID must be a positive number",
        "any.required": "Stall ID is required",
    }),
    score: Joi.number().integer().min(0).max(100).required().messages({
        "number.base": "Score must be a number",
        "number.integer": "Score must be an integer",
        "number.min": "Score must be at least 0",
        "number.max": "Score must be at most 100",
        "any.required": "Score is required",
    }),
    remarks: Joi.string().trim().min(1).max(2000).required().messages({
        "string.base": "Remarks must be a string",
        "string.empty": "Remarks cannot be empty",
        "string.min": "Remarks cannot be empty",
        "string.max": "Remarks cannot exceed 2000 characters",
        "any.required": "Remarks are required",
    }),
    // Optional
    inspectionDate: Joi.date().iso().max("now").optional().messages({
        "date.base": "Inspection date must be a valid date",
        "date.format": "Inspection date must be in ISO format (YYYY-MM-DD)",
        "date.max": "Inspection date cannot be in the future",
    }),
});

// Schema for correcting a previously logged inspection (stallID stays fixed)
const updateInspectionSchema = Joi.object({
    score: Joi.number().integer().min(0).max(100).required().messages({
        "number.base": "Score must be a number",
        "number.integer": "Score must be an integer",
        "number.min": "Score must be at least 0",
        "number.max": "Score must be at most 100",
        "any.required": "Score is required",
    }),
    remarks: Joi.string().trim().min(1).max(2000).required().messages({
        "string.base": "Remarks must be a string",
        "string.empty": "Remarks cannot be empty",
        "string.min": "Remarks cannot be empty",
        "string.max": "Remarks cannot exceed 2000 characters",
        "any.required": "Remarks are required",
    }),
    // Optional
    inspectionDate: Joi.date().iso().max("now").optional().messages({
        "date.base": "Inspection date must be a valid date",
        "date.format": "Inspection date must be in ISO format (YYYY-MM-DD)",
        "date.max": "Inspection date cannot be in the future",
    }),
});

// Middleware to validate log inspection req body
function validateLogInspection(req, res, next) {
    const { error } = logInspectionSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }
    next();
}

// Middleware to validate update inspection req body
function validateUpdateInspection(req, res, next) {
    const { error } = updateInspectionSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }
    next();
}

module.exports = {
    validateLogInspection,
    validateUpdateInspection,
};