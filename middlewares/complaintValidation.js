const Joi = require("joi");

// Schema for submitting a new complaint
const createComplaintSchema = Joi.object({
    stallID: Joi.number().integer().positive().required().messages({
        "number.base": "Stall ID must be a number",
        "number.integer": "Stall ID must be an integer",
        "number.positive": "Stall ID must be a positive number",
        "any.required": "Stall ID is required",
    }),
    category: Joi.string().valid("Hygiene", "Service", "Food Quality", "Other").required().messages({
        "any.only": "Category must be one of: Hygiene, Service, Food Quality, Other",
        "any.required": "Category is required",
    }),
    description: Joi.string().min(1).max(2000).required().messages({
        "string.base": "Description must be a string",
        "string.empty": "Description cannot be empty",
        "string.max": "Description cannot exceed 2000 characters",
        "any.required": "Description is required",
    }),
});

// Schema for updating a complaint's status
const updateComplaintStatusSchema = Joi.object({
    status: Joi.string().valid("open", "underReview", "resolved", "closed").required().messages({
        "any.only": "Status must be one of: open, underReview, resolved, closed",
        "any.required": "Status is required",
    }),
});

// Middleware to validate create complaint body
function validateCreateComplaint(req, res, next) {
    const { error } = createComplaintSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

// Middleware to validate update complaint status
function validateUpdateComplaintStatus(req, res, next) {
    const { error } = updateComplaintStatusSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

module.exports = {
    validateCreateComplaint,
    validateUpdateComplaintStatus
};