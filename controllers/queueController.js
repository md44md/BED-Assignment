const stallModel = require("../models/stallModel");
const orderModel = require("../models/orderModel");

// GET /stallowners/queue  (stall owner only)
// Returns today's active queue for the logged-in owner's stall, current customer first.
async function getQueue(req, res) {
    try {
        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const queue = await orderModel.getCurrentQueue(stall.stallID);

        res.status(200).json({
            current: queue[0] || null, // the customer currently being served
            queue: queue,              // full queue including the current customer
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving queue." });
    }
}

// POST /stallowners/queue/advance  (stall owner only)
// Marks the current customer as served and advances to the next in line.
async function advanceQueue(req, res) {
    try {
        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const result = await orderModel.advanceQueue(stall.stallID);
        if (!result) {
            return res.status(404).json({ error: "There is no customer in the queue to serve." });
        }

        res.status(200).json({
            message: "Current customer served. Queue advanced.",
            servedOrder: result.servedOrder,
            nextOrder: result.nextOrder, // null when the queue is now empty
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error advancing queue." });
    }
}

module.exports = {
    getQueue,
    advanceQueue,
};
