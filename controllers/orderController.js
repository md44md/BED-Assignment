const orderModel = require("../models/orderModel");

// POST /orders
async function submitOrder(req, res) {
    try {
        const { cartID, paymentMethod } = req.body;

        // Check the cart exists
        const cart = await orderModel.getCartById(cartID);
        if (!cart) {
            return res.status(404).json({ error: "Cart not found." });
        }

        // Check the cart belongs to the logged-in customer
        if (cart.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This cart does not belong to you." });
        }

        // Load cart items with menu info
        const items = await orderModel.getCartItemsForOrder(cartID);
        if (items.length === 0) {
            return res.status(400).json({ error: "Cart is empty." });
        }

        // Check every item is still available
        const hasUnavailableItem = items.some((item) => !item.isAvailable);
        if (hasUnavailableItem) {
            return res.status(409).json({ error: "One or more items are no longer available." });
        }

        // Calculate order totals
        const rawSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const subtotal = Math.round(rawSubtotal * 100) / 100;
        const packagingFee = 0;
        const gstAmount = Math.round((subtotal + packagingFee) * 0.07 * 100) / 100;
        const totalAmount = Math.round((subtotal + packagingFee + gstAmount) * 100) / 100;

        // Get the next queue number for this stall
        const queueNumber = await orderModel.getNextQueueNumber(cart.stallID);

        // Create the order, order items, payment record, and clear the cart
        const order = await orderModel.submitOrder(
            cart,
            items,
            paymentMethod,
            subtotal,
            packagingFee,
            gstAmount,
            totalAmount,
            queueNumber
        );

        res.status(201).json({
            message: "Order submitted successfully.",
            orderID: order.orderID,
            queueNumber: order.queueNumber,
            totalAmount: order.totalAmount,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error submitting order." });
    }
}

// GET /orders
async function getMyOrders(req, res) {
    try {
        // req.user.customerID is set by verifyJWT from the logged-in customer's token
        const orders = await orderModel.getOrdersByCustomer(req.user.customerID);
        res.json(orders);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving orders." });
    }
}

module.exports = {
    submitOrder,
    getMyOrders,
};
