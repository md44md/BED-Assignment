const orderModel = require("../models/orderModel");
const cartModel = require("../models/cartModel");
const menuItemModel = require("../models/menuItemModel");

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

// POST /orders/:orderID/reorder
// Re-adds every item from a past order into the customer's cart for that stall.
// Items that no longer exist or are unavailable are skipped and reported back.
async function reorder(req, res) {
    try {
        const orderID = parseInt(req.params.orderID, 10);
        const customerID = req.user.customerID;

        const order = await orderModel.getOrderWithItemsById(orderID);
        if (!order) {
            return res.status(404).json({ error: "Order not found." });
        }
        if (order.customerID !== customerID) {
            return res.status(403).json({ error: "Access denied. This order does not belong to you." });
        }

        let cart = await cartModel.getCartByCustomerAndStall(customerID, order.stallID);
        if (!cart) {
            cart = await cartModel.createCart(customerID, order.stallID);
        }

        const addedItems = [];
        const skippedItems = [];

        for (const item of order.items) {
            const menuItem = await menuItemModel.getMenuItemById(item.menuItemID);
            if (!menuItem || !menuItem.isAvailable) {
                skippedItems.push(item.itemName);
                continue;
            }

            const existingItem = await cartModel.getCartItem(cart.cartID, item.menuItemID);
            if (existingItem) {
                await cartModel.updateCartItemQuantity(existingItem.cartItemID, existingItem.quantity + item.quantity);
            } else {
                await cartModel.addCartItem(cart.cartID, item.menuItemID, item.quantity, item.addons);
            }
            addedItems.push(item.itemName);
        }

        if (addedItems.length === 0) {
            return res.status(409).json({ error: "None of the items from this order are available anymore." });
        }

        res.status(200).json({
            message: "Items added to cart.",
            cartID: cart.cartID,
            addedItems,
            skippedItems,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error reordering." });
    }
}

module.exports = {
    submitOrder,
    getMyOrders,
    reorder,
};
