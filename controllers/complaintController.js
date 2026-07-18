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

// GET /complaint/stall (stall owner only)
async function getComplaintsByStall(req, res) {
    try {
        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const complaints = await complaintModel.getComplaintsByStall(stall.stallID);

        res.status(200).json({
            count: complaints.length,
            complaints: complaints,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving complaints." });
    }
}

// GET /complaint/:complaintID/status (stall owner only)
async function updateComplaintStatus(req, res) {
    try {
        const complaintID = parseInt(req.params.complaintID, 10);

        // Check if complaintID is a valid number
        if (isNaN(complaintID)) {
            return res.status(400).json({ error: "Complaint ID must be a number." });
        }     

        // Check the complaint exists
        const complaint = await complaintModel.getComplaintById(complaintID);
        if (!complaint) {
            return res.status(404).json({ error: "Complaint not found." });
        }

        // Check the complaint was raised against this stall owner's stall
        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall || complaint.stallID !== stall.stallID) {
            return res.status(403).json({ error: "Access denied. This complaint does not belong to your stall." });
        }

        const updatedComplaint = await complaintModel.updateComplaintStatus(complaintID);
        
        res.status(200).json({
            message: "Complaint status updated successfully.",
            complaint: updatedComplaint,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating complaint status." });
    }
}

module.exports = {
    createComplaint,
    getComplaintsByCustomer,
    getComplaintsByStall,
    updateComplaintStatus
};