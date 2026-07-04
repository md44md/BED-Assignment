const Joi = require("joi");

// Schema for submitting feedback for a completed order
const submitFeedbackSchema = Joi.object({
    orderID: Joi.number().integer().positive().required().messages({
        "number.base": "Order ID must be a number",
        "number.integer": "Order ID must be an integer",
        "number.positive": "Order ID must be a positive number",
        "any.required": "Order ID is required",
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
        "number.base": "Rating must be a number",
        "number.integer": "Rating must be an integer",
        "number.min": "Rating must be at least 1",
        "number.max": "Rating must be at most 5",
        "any.required": "Rating is required",
    }),
    comments: Joi.string().max(2000).optional().messages({
        "string.base": "Comments must be a string",
        "string.max": "Comments cannot exceed 2000 characters",
    }),
});

// Schema for editing an existing feedback entry
const editFeedbackSchema = Joi.object({
    feedbackID: Joi.number().integer().positive().required().messages({
        "number.base": "Feedback ID must be a number",
        "number.integer": "Feedback ID must be an integer",
        "number.positive": "Feedback ID must be a positive number",
        "any.required": "Feedback ID is required",
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
        "number.base": "Rating must be a number",
        "number.integer": "Rating must be an integer",
        "number.min": "Rating must be at least 1",
        "number.max": "Rating must be at most 5",
        "any.required": "Rating is required",
    }),
    comments: Joi.string().max(2000).optional().messages({
        "string.base": "Comments must be a string",
        "string.max": "Comments cannot exceed 2000 characters",
    }),
});

// Middleware to validate submit feedback body
function validateSubmitFeedback(req, res, next) {
    const { error } = submitFeedbackSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

// Middleware to validate edit feedback body
function validateEditFeedback(req, res, next) {
    const { error } = editFeedbackSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

module.exports = {
    validateSubmitFeedback,
    validateEditFeedback,
};
