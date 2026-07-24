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
        const gstAmount = Math.round((subtotal + packagingFee) * 0.09 * 100) / 100;
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

// GET /orders/:orderID/receipt
async function getOrderReceipt(req, res) {
    try {
        const orderID = parseInt(req.params.orderID);

        const receipt = await orderModel.getOrderReceipt(orderID);
        if (!receipt) {
            return res.status(404).json({ error: "Order not found." });
        }

        // req.user.customerID is set by verifyJWT from the logged-in customer's token
        if (receipt.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This order does not belong to you." });
        }

        // Split line items into base dishes/drinks vs priced add-ons so the receipt can
        // show "base price" and "optional add-ons" as separate breakdown totals.
        const addonItems = receipt.items.filter((item) => item.category === "add-on");
        const baseItems = receipt.items.filter((item) => item.category !== "add-on");
        const sumItemTotal = (items) => items.reduce((sum, item) => sum + Number(item.itemTotal), 0);

        res.json({
            orderID: receipt.orderID,
            stallName: receipt.stallName,
            queueNumber: receipt.queueNumber,
            status: receipt.status,
            paymentMethod: receipt.paymentMethod,
            paymentStatus: receipt.paymentStatus,
            createdAt: receipt.createdAt,
            items: baseItems,
            addons: addonItems,
            baseItemsTotal: sumItemTotal(baseItems),
            addonsTotal: sumItemTotal(addonItems),
            subtotal: receipt.subtotal,
            packagingFee: receipt.packagingFee,
            gstAmount: receipt.gstAmount,
            totalAmount: receipt.totalAmount,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving receipt." });
    }
}

module.exports = {
    submitOrder,
    getMyOrders,
    getOrderReceipt,
};
