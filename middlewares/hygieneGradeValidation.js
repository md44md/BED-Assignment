const Joi = require("joi");

// Schema for issuing a new hygiene grade (POST)
const issueGradeSchema = Joi.object({
    stallID: Joi.number().integer().positive().required().messages({
        "number.base": "Stall ID must be a number",
        "number.integer": "Stall ID must be an integer",
        "number.positive": "Stall ID must be a positive number",
        "any.required": "Stall ID is required",
    }),
    inspectionID: Joi.number().integer().positive().required().messages({
        "number.base": "Inspection ID must be a number",
        "number.integer": "Inspection ID must be an integer",
        "number.positive": "Inspection ID must be a positive number",
        "any.required": "Inspection ID is required",
    }),
    grade: Joi.string().uppercase().valid("A", "B", "C", "D").required().messages({
        "string.base": "Grade must be a string",
        "any.only": "Grade must be A, B, C or D",
        "any.required": "Grade is required",
    }),
});

// Schema for correcting an existing grade (PUT) — only the letter is editable
const updateGradeSchema = Joi.object({
    grade: Joi.string().uppercase().valid("A", "B", "C", "D").required().messages({
        "string.base": "Grade must be a string",
        "any.only": "Grade must be A, B, C or D",
        "any.required": "Grade is required",
    }),
});

// Middleware: validate issue-grade request body
function validateIssueGrade(req, res, next) {
    const { error, value } = issueGradeSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }
    // Apply Joi's normalised values (e.g. grade uppercased to A/B/C/D)
    req.body = value;
    next();
}

// Middleware: validate update-grade request body
function validateUpdateGrade(req, res, next) {
    const { error, value } = updateGradeSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(", ");
        return res.status(400).json({ error: errorMessage });
    }
    // Apply Joi's normalised values (e.g. grade uppercased to A/B/C/D)
    req.body = value;
    next();
}

module.exports = {
    validateIssueGrade,
    validateUpdateGrade,
};