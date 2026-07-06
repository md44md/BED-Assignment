const stallModel = require("../models/stallModel");

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

module.exports = {
    getStalls,
};
