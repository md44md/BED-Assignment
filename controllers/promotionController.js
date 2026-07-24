const promotionModel = require("../models/promotionModel");

// GET /promotions (stall owner's own promotions)
async function getPromotions(req, res) {
    try {
        const stall = await promotionModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const promotions = await promotionModel.getPromotionsByStallID(stall.stallID);
        res.json(promotions);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving promotions." });
    }
}

// POST /promotions
async function createPromotion(req, res) {
    try {
        if (req.body.startDate && req.body.endDate && req.body.endDate < req.body.startDate) {
            return res.status(400).json({ error: "End date cannot be before the start date." });
        }

        const stall = await promotionModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const newPromotion = await promotionModel.createPromotion(stall.stallID, req.body);
        res.status(201).json(newPromotion);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error creating promotion." });
    }
}

// PUT /promotions/:id (also used to activate/deactivate via isActive)
async function updatePromotion(req, res) {
    try {
        if (req.body.startDate && req.body.endDate && req.body.endDate < req.body.startDate) {
            return res.status(400).json({ error: "End date cannot be before the start date." });
        }

        const id = parseInt(req.params.id);
        const promotion = await promotionModel.getPromotionById(id);
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found." });
        }

        // Make sure the promotion actually belongs to the requesting stall owner
        const stall = await promotionModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall || promotion.stallID !== stall.stallID) {
            return res.status(403).json({ error: "You do not have permission to edit this promotion." });
        }

        const promotionData = {
            ...req.body,
            isActive: req.body.isActive === undefined ? promotion.isActive : req.body.isActive,
        };
        const updatedPromotion = await promotionModel.updatePromotion(id, promotionData);
        res.json(updatedPromotion);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating promotion." });
    }
}

// DELETE /promotions/:id
async function deletePromotion(req, res) {
    try {
        const id = parseInt(req.params.id);
        const promotion = await promotionModel.getPromotionById(id);
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found." });
        }

        // Make sure the promotion actually belongs to the requesting stall owner
        const stall = await promotionModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall || promotion.stallID !== stall.stallID) {
            return res.status(403).json({ error: "You do not have permission to delete this promotion." });
        }

        await promotionModel.deletePromotion(id);
        res.json({ message: "Promotion deleted successfully." });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error deleting promotion." });
    }
}

module.exports = {
    getPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
};
