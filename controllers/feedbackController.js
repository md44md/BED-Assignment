const feedbackModel = require("../models/feedbackModel");

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
            return res.status(409).json({ error: "You have already reviewed this stall. Use POST /feedback/edit to update your review." });
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

module.exports = {
    submitFeedback,
    editFeedback,
};
