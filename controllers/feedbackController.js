const feedbackModel = require("../models/feedbackModel");
const stallModel = require("../models/stallModel");

// POST /feedback
async function submitFeedback(req, res) {
    try {
        const { orderID, rating, comments } = req.body;

        // Check the order exists
        const order = await feedbackModel.getOrderForFeedback(orderID);
        if (!order) {
            return res.status(404).json({ error: "Order not found." });
        }

        // Check the order belongs to the logged-in customer
        if (order.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This order does not belong to you." });
        }

        // Check the order is completed and paid
        if (order.status !== "completed" || order.paymentStatus !== "paid") {
            return res.status(400).json({ error: "Order must be completed and paid before leaving feedback." });
        }

        // Check the customer hasn't already reviewed this stall
        const existingFeedback = await feedbackModel.getFeedbackByCustomerAndStall(order.customerID, order.stallID);
        if (existingFeedback) {
            return res.status(409).json({
                error: "You have already reviewed this stall. You can edit your existing review instead.",
                feedbackID: existingFeedback.feedbackID,
            });
        }

        const feedbackID = await feedbackModel.createFeedback(order.customerID, order.stallID, orderID, rating, comments);

        res.status(201).json({
            message: "Feedback submitted successfully.",
            feedbackID: feedbackID,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error submitting feedback." });
    }
}

// POST /feedback/edit
async function editFeedback(req, res) {
    try {
        const { feedbackID, rating, comments } = req.body;

        // Check the feedback exists
        const feedback = await feedbackModel.getFeedbackById(feedbackID);
        if (!feedback) {
            return res.status(404).json({ error: "Feedback not found." });
        }

        // Check the feedback belongs to the logged-in customer
        if (feedback.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This feedback does not belong to you." });
        }

        await feedbackModel.updateFeedback(feedbackID, rating, comments);

        res.status(200).json({ message: "Feedback updated successfully." });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating feedback." });
    }
}

// GET /feedback
async function getMyFeedback(req, res) {
    try {
        const feedback = await feedbackModel.getFeedbackByCustomer(req.user.customerID);
        res.json(feedback);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving feedback." });
    }
}

// GET /stalls/:stallID/feedback  (public)
// Lets a customer check a stall's ratings/reviews before deciding to order.
async function getStallFeedback(req, res) {
    try {
        const stallID = parseInt(req.params.stallID, 10);
        if (isNaN(stallID)) {
            return res.status(400).json({ error: "Stall ID must be a number." });
        }

        const stall = await stallModel.getStallById(stallID);
        if (!stall) {
            return res.status(404).json({ error: "Stall not found." });
        }

        const reviews = await feedbackModel.getFeedbackByStall(stallID);
        const averageRating = reviews.length
            ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
            : null;

        res.status(200).json({
            averageRating: averageRating,
            reviewCount: reviews.length,
            reviews: reviews,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving stall feedback." });
    }
}

module.exports = {
    submitFeedback,
    editFeedback,
    getMyFeedback,
    getStallFeedback,
};
