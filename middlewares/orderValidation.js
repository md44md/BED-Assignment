const Joi = require("joi");

// Schema for submitting a cart as an order
const submitOrderSchema = Joi.object({
    cartID: Joi.number().integer().positive().required().messages({
        "number.base": "Cart ID must be a number",
        "number.integer": "Cart ID must be an integer",
        "number.positive": "Cart ID must be a positive number",
        "any.required": "Cart ID is required",
    }),
    paymentMethod: Joi.string().valid("Cash", "NETS", "PayNow").required().messages({
        "string.base": "Payment method must be a string",
        "any.only": "Payment method must be one of Cash, NETS, PayNow",
        "any.required": "Payment method is required",
    }),
});

// Middleware to validate submit order body
function validateSubmitOrder(req, res, next) {
    const { error } = submitOrderSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }

    next();
}

// Middleware to validate the :orderID route param
function validateOrderId(req, res, next) {
    const id = parseInt(req.params.orderID, 10);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid order ID. ID must be a positive number" });
    }

    next();
}

function validateOrderIdParam(req, res, next) {
    const id = parseInt(req.params.orderID);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid order ID. ID must be a positive number" });
    }

    next();
}

module.exports = {
    validateSubmitOrder,
    validateOrderId,
    validateOrderIdParam,
};
