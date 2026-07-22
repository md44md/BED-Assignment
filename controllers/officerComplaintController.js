const complaintModel = require("../models/complaintModel");

// GET /officers/complaints  (NEA officer only)
// Officers regulate every stall, so this returns complaints across all stalls rather
// than being scoped to one. The optional query filters narrow the list down while
// investigating (validated upstream by validateComplaintFilters).
async function getAllComplaints(req, res) {
    try {
        const { status, stallID, category } = req.query;

        const complaints = await complaintModel.getAllComplaints({
            status,
            stallID: stallID ? parseInt(stallID, 10) : undefined,
            category,
        });

        // An empty list is a valid result (nothing matched the filters), not a 404.
        res.status(200).json({
            count: complaints.length,
            complaints: complaints,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving complaints." });
    }
}

// PUT /officers/complaints/:complaintID/status  (NEA officer only)
// Records the officer's follow-up action by moving the complaint through
// open -> underReview -> resolved/closed. Unlike the stall owner route there is no
// ownership check: an officer has authority over every stall's complaints.
async function updateComplaintStatus(req, res) {
    try {
        const complaintID = parseInt(req.params.complaintID, 10);

        if (isNaN(complaintID)) {
            return res.status(400).json({ error: "Complaint ID must be a number." });
        }

        const complaint = await complaintModel.getComplaintById(complaintID);
        if (!complaint) {
            return res.status(404).json({ error: "Complaint not found." });
        }

        const { status } = req.body;
        const updatedComplaint = await complaintModel.updateComplaintStatus(complaintID, status);

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
    getAllComplaints,
    updateComplaintStatus,
};
