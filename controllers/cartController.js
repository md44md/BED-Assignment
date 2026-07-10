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

// GET /cart
// Returns every cart the customer has (one per stall), each with its items and subtotal.
async function getCart(req, res) {
    try {
        const customerID = req.user.customerID;
        const rows = await cartModel.getCartsByCustomer(customerID);

        const cartsByID = new Map();
        for (const row of rows) {
            if (!cartsByID.has(row.cartID)) {
                cartsByID.set(row.cartID, {
                    cartID: row.cartID,
                    stallID: row.stallID,
                    stallName: row.stallName,
                    items: [],
                });
            }
            if (row.cartItemID) {
                cartsByID.get(row.cartID).items.push({
                    cartItemID: row.cartItemID,
                    menuItemID: row.menuItemID,
                    name: row.name,
                    price: row.price,
                    category: row.category,
                    imageURL: row.imageURL,
                    isAvailable: row.isAvailable,
                    quantity: row.quantity,
                    notes: row.notes,
                });
            }
        }

        const carts = [...cartsByID.values()]
            .filter((cart) => cart.items.length > 0)
            .map((cart) => ({
                ...cart,
                subtotal: cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
            }));

        res.status(200).json({ carts: carts });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error fetching cart." });
    }
}

// DELETE /cart/items/:cartItemID
async function removeItem(req, res) {
    try {
        const cartItemID = parseInt(req.params.cartItemID, 10);
        const customerID = req.user.customerID;

        const cartItem = await cartModel.getCartItemWithOwner(cartItemID);
        if (!cartItem) {
            return res.status(404).json({ error: "Cart item not found." });
        }
        if (cartItem.customerID !== customerID) {
            return res.status(403).json({ error: "Access denied. This cart item does not belong to you." });
        }

        await cartModel.removeCartItem(cartItemID);
        res.status(200).json({ message: "Item removed from cart." });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error removing item from cart." });
    }
}

module.exports = {
    addItemToCart,
    getCart,
    removeItem,
};
