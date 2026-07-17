const stallModel = require("../models/stallModel");
const orderModel = require("../models/orderModel");
const notificationModel = require("../models/notificationModel");
const emailService = require("../services/emailService");

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

        // Notify the next customer that they are now up (third-party email via Brevo).
        // A delivery failure must NOT fail the serve action, so it is handled here and
        // recorded against the notification, while the request still succeeds.
        let notified = false;
        const next = result.nextOrder;
        if (next) {
            const title = `You're next in line at ${next.stallName}`;
            const message =
                `You are now the current customer at ${next.stallName} ` +
                `(queue number ${next.queueNumber}). Please get ready to collect your order.`;

            const emailResult = await emailService.sendQueueNotification(
                next.customerEmail,
                next.customerFirstName,
                next.stallName,
                next.queueNumber
            );
            notified = emailResult.ok;

            try {
                await notificationModel.createNotification({
                    customerID: next.customerID,
                    orderID: next.orderID,
                    channel: "email",
                    title,
                    message,
                    status: emailResult.ok ? "sent" : "failed",
                });
            } catch (recordError) {
                // Logging the notification is best-effort; the serve already succeeded.
                console.error("Failed to record notification:", recordError);
            }
        }

        res.status(200).json({
            message: "Current customer served. Queue advanced.",
            servedOrder: result.servedOrder,
            nextOrder: next, // null when the queue is now empty
            notified, // true only when the next customer was emailed successfully
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
