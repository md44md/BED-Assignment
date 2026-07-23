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

// PUT /inspections/:id
async function updateInspection(req, res) {
    try {
        const inspectionID = parseInt(req.params.id, 10);
        if (isNaN(inspectionID)) {
            return res.status(400).json({ error: "Inspection ID must be a number." });
        }

        const existing = await inspectionModel.getInspectionById(inspectionID);
        if (!existing) {
            return res.status(404).json({ error: "Inspection not found." });
        }

        const { score, remarks, inspectionDate } = req.body;
        const date = inspectionDate ? new Date(inspectionDate) : existing.inspectionDate;

        const updated = await inspectionModel.updateInspection(inspectionID, score, remarks, date);

        res.status(200).json({
            message: "Inspection updated successfully.",
            inspection: updated,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating inspection." });
    }
}

// POST /inspections/schedule
async function scheduleInspection(req, res) {
    try {
        const { stallID, scheduledDate } = req.body;
        const officerID = req.user.officerID;

        const exists = await inspectionModel.stallExists(stallID);
        if (!exists) {
            return res.status(404).json({ error: "Stall not found." });
        }

        // Date-only comparison so scheduling for later today is still allowed.
        const date = new Date(scheduledDate);
        const today = new Date(new Date().toDateString());
        if (date < today) {
            return res.status(400).json({ error: "Scheduled date cannot be in the past." });
        }

        const inspection = await inspectionModel.scheduleInspection(stallID, officerID, date);

        res.status(201).json({
            message: "Inspection scheduled successfully.",
            inspection: inspection,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error scheduling inspection." });
    }
}

module.exports = {
    logInspection,
    updateInspection,
    scheduleInspection,
};