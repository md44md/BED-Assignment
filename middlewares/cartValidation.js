const Joi = require("joi");

// Schema for adding an item to the cart
const addItemSchema = Joi.object({
    menuItemID: Joi.number().integer().positive().required().messages({
        "number.base": "Menu item ID must be a number",
        "number.integer": "Menu item ID must be an integer",
        "number.positive": "Menu item ID must be a positive number",
        "any.required": "Menu item ID is required",
    }),
    quantity: Joi.number().integer().min(1).max(99).required().messages({
        "number.base": "Quantity must be a number",
        "number.integer": "Quantity must be an integer",
        "number.min": "Quantity must be at least 1",
        "number.max": "Quantity cannot exceed 99",
        "any.required": "Quantity is required",
    }),
    notes: Joi.string().trim().max(500).optional().allow("").messages({
        "string.base": "Notes must be a string",
        "string.max": "Notes cannot exceed 500 characters",
    }),
});

// Middleware to validate add-to-cart request body
function validateAddItem(req, res, next) {
    const { error } = addItemSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

// Middleware to validate the :cartItemID route param
function validateCartItemId(req, res, next) {
    const id = parseInt(req.params.cartItemID);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid cart item ID. ID must be a positive number" });
    }

    next();
}

module.exports = {
    validateAddItem,
    validateCartItemId,
};
