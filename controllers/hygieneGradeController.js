const hygieneGradeModel = require("../models/hygieneGradeModel");

// How long a hygiene grade stays valid (fixed period as per the NEA case)
const VALIDITY_MONTHS = 12;

// POST /hygiene-grades  (officer only)
async function issueGrade(req, res) {
    try {
        const { stallID, inspectionID, grade } = req.body;

        // A grade can only be issued off an existing, completed inspection for the same stall
        const inspection = await hygieneGradeModel.getCompletedInspection(inspectionID, stallID);
        if (!inspection) {
            return res.status(404).json({
                error: "No completed inspection found for this stall.",
            });
        }

        // Server owns the dates: issued today, valid for a fixed period (12 Months)
        const issuedDate = new Date();
        const expiryDate = new Date(issuedDate);
        expiryDate.setMonth(expiryDate.getMonth() + VALIDITY_MONTHS);

        const newGrade = await hygieneGradeModel.createHygieneGrade(
            stallID,
            inspectionID,
            grade,
            issuedDate,
            expiryDate
        );

        res.status(201).json({
            message: "Hygiene grade issued successfully.",
            grade: newGrade,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error issuing hygiene grade." });
    }
}

// GET /stalls/:stallID/hygiene-grades  (public - customers can see)
async function getStallGrades(req, res) {
    try {
        const stallID = parseInt(req.params.stallID, 10);
        if (isNaN(stallID)) {
            return res.status(400).json({ error: "Stall ID must be a number." });
        }

        const grades = await hygieneGradeModel.getGradesByStall(stallID);

        res.status(200).json({ grades: grades });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving hygiene grades." });
    }
}

// PUT /hygiene-grades/:gradeID  (officer only)
async function updateGrade(req, res) {
    try {
        const gradeID = parseInt(req.params.gradeID, 10);
        if (isNaN(gradeID)) {
            return res.status(400).json({ error: "Grade ID must be a number." });
        }

        const { grade } = req.body;

        // Confirm the grade exists before updating
        const existing = await hygieneGradeModel.getGradeById(gradeID);
        if (!existing) {
            return res.status(404).json({ error: "Hygiene grade not found." });
        }

        // Only the letter is editable; keep the original expiry (fixed period)
        const updated = await hygieneGradeModel.updateHygieneGrade(
            gradeID,
            grade,
            existing.expiryDate
        );

        res.status(200).json({
            message: "Hygiene grade updated successfully.",
            grade: updated,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating hygiene grade." });
    }
}

// DELETE /hygiene-grades/:gradeID  (officer only)
async function deleteGrade(req, res) {
    try {
        const gradeID = parseInt(req.params.gradeID, 10);
        if (isNaN(gradeID)) {
            return res.status(400).json({ error: "Grade ID must be a number." });
        }

        // Confirm the grade exists before deleting
        const existing = await hygieneGradeModel.getGradeById(gradeID);
        if (!existing) {
            return res.status(404).json({ error: "Hygiene grade not found." });
        }

        const deleted = await hygieneGradeModel.deleteHygieneGrade(gradeID);

        res.status(200).json({
            message: "Hygiene grade revoked successfully.",
            grade: deleted,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error deleting hygiene grade." });
    }
}

module.exports = {
    issueGrade,
    getStallGrades,
    updateGrade,
    deleteGrade,
};