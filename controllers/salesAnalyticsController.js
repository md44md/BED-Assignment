const salesAnalyticsModel = require("../models/salesAnalyticsModel");

// GET /stalls/:stallID/sales-analytics
async function getSalesAnalytics(req, res) {
    try {
        const stallID = parseInt(req.params.stallID, 10);
        if (isNaN(stallID)) {
            return res.status(400).json({ error: "Stall ID must be a number." });
        }

        const operatorID = req.user.operatorID;

        const stall = await salesAnalyticsModel.getStallOwnedByOperator(stallID, operatorID);
        if (!stall) {
            return res.status(404).json({ error: "Stall not found for this operator." });
        }

        const summary = await salesAnalyticsModel.getSalesSummaryByStallID(stallID);
        const popularItems = await salesAnalyticsModel.getPopularItemsByStallID(stallID);
        const peakHours = await salesAnalyticsModel.getPeakHoursByStallID(stallID);

        res.status(200).json({
            stall: stall,
            summary: summary,
            popularItems: popularItems,
            peakHours: peakHours,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving sales analytics." });
    }
}

module.exports = {
    getSalesAnalytics,
};