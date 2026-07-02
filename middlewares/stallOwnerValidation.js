const Joi = require("joi");

// Schema for registration
const registerSchema = Joi.object({
    email: Joi.string().email().max(255).required().messages({
        "string.base": "Email must be a string",
        "string.empty": "Email cannot be empty",
        "string.email": "Email must be a valid email address",
        "string.max": "Email cannot exceed 255 characters",
        "any.required": "Email is required",
    }),
    password: Joi.string().min(8).max(255).required().messages({
        "string.base": "Password must be a string",
        "string.empty": "Password cannot be empty",
        "string.min": "Password must be at least 8 characters long",
        "string.max": "Password cannot exceed 255 characters",
        "any.required": "Password is required",
    }),
    firstName: Joi.string().min(1).max(100).required().messages({
        "string.base": "First name must be a string",
        "string.empty": "First name cannot be empty",
        "string.max": "First name cannot exceed 100 characters",
        "any.required": "First name is required",
    }),
    lastName: Joi.string().min(1).max(100).required().messages({
        "string.base": "Last name must be a string",
        "string.empty": "Last name cannot be empty",
        "string.max": "Last name cannot exceed 100 characters",
        "any.required": "Last name is required",
    }),
    phone: Joi.string().max(20).optional().messages({
        "string.base": "Phone must be a string",
        "string.max": "Phone cannot exceed 20 characters",
    }),
});

// Schema for login
const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        "string.base": "Email must be a string",
        "string.empty": "Email cannot be empty",
        "string.email": "Email must be a valid email address",
        "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
        "string.base": "Password must be a string",
        "string.empty": "Password cannot be empty",
        "any.required": "Password is required",
    }),
});

// Middleware to validate registration body
function validateRegister(req, res, next) {
    const { error } = registerSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

// Middleware to validate login body
function validateLogin(req, res, next) {
    const { error } = loginSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

module.exports = {
    validateRegister,
    validateLogin,
};