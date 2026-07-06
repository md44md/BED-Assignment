const cartModel = require("../models/cartModel");
const menuItemModel = require("../models/menuItemModel");

// POST /cart/items
async function addItemToCart(req, res) {
    try {
        const { menuItemID, quantity, notes } = req.body;
        const customerID = req.user.customerID;

        // Check the menu item exists and is available
        const menuItem = await menuItemModel.getMenuItemById(menuItemID);
        if (!menuItem) {
            return res.status(404).json({ error: "Menu item not found." });
        }
        if (!menuItem.isAvailable) {
            return res.status(400).json({ error: "Menu item is currently unavailable." });
        }

        // Get or create the customer's cart for this stall
        let cart = await cartModel.getCartByCustomerAndStall(customerID, menuItem.stallID);
        if (!cart) {
            cart = await cartModel.createCart(customerID, menuItem.stallID);
        }

        // If the item is already in the cart, increase its quantity instead of duplicating it
        const existingItem = await cartModel.getCartItem(cart.cartID, menuItemID);
        const cartItem = existingItem
            ? await cartModel.updateCartItemQuantity(existingItem.cartItemID, existingItem.quantity + quantity)
            : await cartModel.addCartItem(cart.cartID, menuItemID, quantity, notes);

        res.status(201).json({
            message: "Item added to cart.",
            cartItem: cartItem,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error adding item to cart." });
    }
}

module.exports = {
    addItemToCart,
};
