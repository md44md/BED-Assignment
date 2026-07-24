const Joi = require("joi");

const promotionSchema = Joi.object({
    title: Joi.string().trim().min(1).max(255).required().messages({
        "string.base": "Title must be a string",
        "string.empty": "Title cannot be empty",
        "string.max": "Title cannot exceed 255 characters",
        "any.required": "Title is required",
    }),
    description: Joi.string().trim().max(1000).allow("").optional().messages({
        "string.base": "Description must be a string",
        "string.max": "Description cannot exceed 1000 characters",
    }),
    discountType: Joi.string().valid("percentage", "fixed", "points").required().messages({
        "any.only": "Discount type must be one of: percentage, fixed, points",
        "any.required": "Discount type is required",
    }),
    discountValue: Joi.number().positive().required().messages({
        "number.base": "Discount value must be a number",
        "number.positive": "Discount value must be greater than 0",
        "any.required": "Discount value is required",
    }),
    // Optional per the user story — a promotion doesn't have to be time-boxed.
    // Whether endDate falls before startDate is checked in the controller:
    // Joi's cross-field .min(ref) misbehaves once the referenced field is
    // allowed to be null (same issue hit with inspection scheduling).
    startDate: Joi.date().iso().allow(null, "").optional().messages({
        "date.base": "Start date must be a valid date",
    }),
    endDate: Joi.date().iso().allow(null, "").optional().messages({
        "date.base": "End date must be a valid date",
    }),
    isActive: Joi.boolean().optional(),
});

function validatePromotion(req, res, next) {
    const { error } = promotionSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ message: errorMessage });
    }

    next();
}

function validatePromotionId(req, res, next) {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid promotion ID. ID must be a positive number" });
    }

    next();
}

module.exports = {
    validatePromotion,
    validatePromotionId,
};
