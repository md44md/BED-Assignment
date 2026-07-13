const complaintModel = require("../models/complaintModel");
const stallModel = require("../models/stallModel");

// POST /complaint
async function createComplaint(req, res) {
    try {
        const { stallID, category, description } = req.body;

        // Check the stall being complained about actually exists
        const stall = await stallModel.getStallById(stallID);
        if (!stall) {
            return res.status(404).json({ error: "Stall not found." });
        }

        const complaintID = await complaintModel.createComplaint(req.user.customerID, stallID, category, description);

        res.status(201).json({
            message: "Complaint submitted successfully.",
            complaintID: complaintID,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error creating complaint." });
    }
}

// GET /complaint
async function getComplaintsByCustomer(req, res) {
    try {
        const complaint = await complaintModel.getComplaintsByCustomer(req.user.customerID);
        res.json(complaint);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving complaint." });
    }
}

module.exports = {
    createComplaint,
    getComplaintsByCustomer,
};