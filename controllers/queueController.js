const stallModel = require("../models/stallModel");
const orderModel = require("../models/orderModel");
const notificationModel = require("../models/notificationModel");
const emailService = require("../services/emailService");

// The next-in-line row carries the customer's contact details so we can email them.
// Those are for the notification only, so responses expose just the queue fields.
function toQueueOrder(order) {
    if (!order) return null;
    return {
        orderID: order.orderID,
        customerID: order.customerID,
        queueNumber: order.queueNumber,
        status: order.status,
    };
}

// GET /stallowners/queue  (stall owner only)
// Returns today's active queue for the logged-in owner's stall, current customer first.
async function getQueue(req, res) {
    try {
        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        // Automatically clear uncollected orders (>45 min old) off the board before
        // reading it, so the queue an owner sees is always up to date.
        await orderModel.abandonStaleOrders(stall.stallID);

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
            servedOrder: toQueueOrder(result.servedOrder),
            nextOrder: toQueueOrder(next), // null when the queue is now empty
            notified, // true only when the next customer was emailed successfully
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error advancing queue." });
    }
}

// POST /stallowners/queue/abandon  (stall owner only)
// Marks the stall's uncollected orders (still active after 45 minutes) as abandoned,
// clearing them from the active order board for food-waste tracking. This also runs
// automatically whenever the queue board is loaded (see getQueue).
async function abandonStale(req, res) {
    try {
        const stall = await stallModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const abandoned = await orderModel.abandonStaleOrders(stall.stallID);

        res.status(200).json({
            message: abandoned.length
                ? `${abandoned.length} uncollected order(s) marked as abandoned.`
                : "No orders were old enough to abandon.",
            count: abandoned.length,
            abandoned: abandoned.map(toQueueOrder),
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error abandoning stale orders." });
    }
}

module.exports = {
    getQueue,
    advanceQueue,
    abandonStale,
};
