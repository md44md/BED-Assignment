const stallModel = require("../models/stallModel");
const menuItemModel = require("../models/menuItemModel");

// GET /stalls  (public)
// Returns the list of stalls so the front-end can offer a name-based picker.
async function getStalls(req, res) {
    try {
        const stalls = await stallModel.getAllStalls();
        res.status(200).json({ stalls: stalls });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving stalls." });
    }
}

// GET /stalls/:stallID/menu  (public)
// Lets a customer browse a stall's menu before adding items to their cart.
async function getStallMenu(req, res) {
    try {
        const stallID = parseInt(req.params.stallID, 10);
        if (isNaN(stallID)) {
            return res.status(400).json({ error: "Stall ID must be a number." });
        }

        const stall = await stallModel.getStallById(stallID);
        if (!stall) {
            return res.status(404).json({ error: "Stall not found." });
        }

        const menuItems = await menuItemModel.getMenuItemsByStallID(stallID);

        res.status(200).json({
            stall: stall,
            menuItems: menuItems,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error fetching stall menu." });
    }
}

const ALLOWED_STATUSES = ["open", "busy", "closed"];

// PUT /stalls/status  (stall owner only)
// Lets a stall owner pause incoming digital orders by marking their stall
// busy/closed when the real-life queue is too long.
async function updateStallStatus(req, res) {
    try {
        const { status } = req.body;

        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ error: "Status must be one of: open, busy, closed." });
        }

        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const updatedStall = await stallModel.updateStallStatus(stall.stallID, status);

        res.status(200).json({
            message: "Stall status updated successfully.",
            stall: updatedStall,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating stall status." });
    }
}

module.exports = {
    getStalls,
    getStallMenu,
    updateStallStatus,
};
