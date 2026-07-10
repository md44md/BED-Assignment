const Joi = require("joi");

// NETS is an online card payment, so it requires card details up front (Cash
// and PayNow are settled at the stall, so they carry no extra fields).
const billingInfoSchema = Joi.object({
    cardNumber: Joi.string().pattern(/^\d{16}$/).required().messages({
        "string.pattern.base": "Card number must be exactly 16 digits",
        "any.required": "Card number is required for NETS payments",
    }),
    expiryDate: Joi.string().pattern(/^(0[1-9]|1[0-2])\/\d{2}$/).required().messages({
        "string.pattern.base": "Card expiry must be in MM/YY format",
        "any.required": "Card expiry is required for NETS payments",
    }),
    cvv: Joi.string().pattern(/^\d{3,4}$/).required().messages({
        "string.pattern.base": "CVV must be 3 or 4 digits",
        "any.required": "CVV is required for NETS payments",
    }),
    cardHolderName: Joi.string().trim().min(2).max(100).required().messages({
        "string.min": "Cardholder name must be at least 2 characters",
        "any.required": "Cardholder name is required for NETS payments",
    }),
});

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
    billingInfo: billingInfoSchema.when("paymentMethod", {
        is: "NETS",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }).messages({
        "any.unknown": "Billing info is only accepted for NETS payments",
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

module.exports = {
    validateSubmitOrder,
};
