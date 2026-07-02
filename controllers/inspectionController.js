const inspectionModel = require("../models/inspectionModel");

// POST /inspections
async function logInspection(req, res) {
    try {
        const { stallID, score, remarks, inspectionDate } = req.body;
        const officerID = req.user.officerID;

        // Check the stall exists before logging against it
        const exists = await inspectionModel.stallExists(stallID);
        if (!exists) {
            return res.status(404).json({ error: "Stall not found." });
        }

        // Default inspection date to today if not provided
        const date = inspectionDate ? new Date(inspectionDate) : new Date();

        const inspection = await inspectionModel.createInspection(stallID, officerID, score, remarks, date);

        res.status(201).json({
            message: "Inspection logged successfully.",
            inspection: inspection,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error logging inspection." });
    }
}

module.exports = {
    logInspection,
};