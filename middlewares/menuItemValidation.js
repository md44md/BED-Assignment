const Joi = require("joi");

const menuItemSchema = Joi.object({
    name: Joi.string().min(1).max(255).required().messages({
        "string.base": "Name must be a string",
        "string.empty": "Name cannot be empty",
        "string.max": "Name cannot exceed 255 characters",
        "any.required": "Name is required",
    }),
    description: Joi.string().max(1000).allow("").optional().messages({
        "string.base": "Description must be a string",
        "string.max": "Description cannot exceed 1000 characters",
    }),
    price: Joi.number().positive().precision(2).required().messages({
        "number.base": "Price must be a number",
        "number.positive": "Price must be greater than 0",
        "any.required": "Price is required",
    }),
    category: Joi.string().valid("main", "drink", "dessert", "snack", "add-on").required().messages({
        "any.only": "Category must be one of: main, drink, dessert, snack, add-on",
        "any.required": "Category is required",
    }),
    isAvailable: Joi.boolean().optional(),
});

function validateMenuItem(req, res, next) {
    const { error } = menuItemSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ message: errorMessage });
    }

    next();
}

function validateMenuItemId(req, res, next) {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid menu item ID. ID must be a positive number" });
    }

    next();
}

module.exports = {
    validateMenuItem,
    validateMenuItemId,
};