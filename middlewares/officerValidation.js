const Joi = require("joi");

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
    validateLogin,
};