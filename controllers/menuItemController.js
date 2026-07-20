const menuItemModel = require("../models/menuItemModel");
const { uploadImageToCloudinary } = require("../cloudinaryConfig");

// Get /menuitems
async function getMenuItems(req, res) {
    try {
        const stall = await menuItemModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ error: "No stall found for this account." });
        }

        const menuItems = await menuItemModel.getMenuItemsByStallID(stall.stallID);
        res.json(menuItems);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving menu items." });
    }
}

// Post /menuitems
// If the vendor attached a photo (multer puts it on req.file), upload it to
// Cloudinary first and pass the resulting secure_url down to the model.
async function createMenuItem(req, res) {
    try {
        const stall = await menuItemModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall) {
            return res.status(404).json({ message: "No stall found for this account." });
        }

        let imageURL = null;
        if (req.file) {
            const uploadResult = await uploadImageToCloudinary(req.file.buffer, req.file.mimetype);
            imageURL = uploadResult.secure_url;
        }

        const newMenuItem = await menuItemModel.createMenuItem(stall.stallID, req.body, imageURL);
        res.status(201).json(newMenuItem);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error creating menu item." });
    }
}

// PUT /menuitems/:id
async function updateMenuItem(req, res) {
    try {
        const id = parseInt(req.params.id);
        const menuItem = await menuItemModel.getMenuItemById(id);
        if (!menuItem) {
            return res.status(404).json({ error: "Menu item not found." });
        }

        // Make sure menu item actually belongs to the requesting stall owner
        const stall = await menuItemModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall || menuItem.stallID !== stall.stallID) {
            return res.status(403).json({ error: "You do not have permission to edit this menu item." });
        }

        let imageURL = null;
        if (req.file) {
            const uploadResult = await uploadImageToCloudinary(req.file.buffer, req.file.mimetype);
            imageURL = uploadResult.secure_url;
        }

        const updatedMenuItem = await menuItemModel.updateMenuItem(id, req.body, imageURL);
        res.json(updatedMenuItem);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error updating menu item." });
    }
}

// DELETE /menuitems/:id
async function deleteMenuItem(req, res) {
    try {
        const id = parseInt(req.params.id);
        const menuItem = await menuItemModel.getMenuItemById(id);
        if (!menuItem) {
            return res.status(404).json({ error: "Menu item not found." });
        }

        // Make sure menu item actually belongs to the requesting stall owner
        const stall = await menuItemModel.getStallByOwnerID(req.user.stallOwnerID);
        if (!stall || menuItem.stallID !== stall.stallID) {
            return res.status(403).json({ error: "You do not have permission to delete this menu item." });
        }

        await menuItemModel.deleteMenuItem(id);
        res.json({ message: "Menu item deleted successfully." });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error deleting menu item." });
    }
}

// GET /menuitems/likes (customer only)
// Returns the menu item IDs the logged-in customer has liked, so the
// front-end can mark hearts on the public GET /stalls/:stallID/menu response.
async function getMyLikedMenuItems(req, res) {
    try {
        const likedMenuItemIDs = await menuItemModel.getLikedMenuItemIDsByCustomer(req.user.customerID);
        res.json({ likedMenuItemIDs });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving your liked menu items." });
    }
}

// POST /menuitems/:id/like (customer only)
async function likeMenuItem(req, res) {
    try {
        const id = parseInt(req.params.id);
        const menuItem = await menuItemModel.getMenuItemById(id);
        if (!menuItem) {
            return res.status(404).json({ error: "Menu item not found." });
        }

        const existing = await menuItemModel.getLike(req.user.customerID, id);
        if (!existing) {
            await menuItemModel.likeMenuItem(req.user.customerID, id);
        }

        const likeCount = await menuItemModel.getLikeCountByMenuItemID(id);
        res.status(200).json({ liked: true, likeCount: likeCount });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error liking menu item." });
    }
}

// DELETE /menuitems/:id/like (customer only)
async function unlikeMenuItem(req, res) {
    try {
        const id = parseInt(req.params.id);
        const menuItem = await menuItemModel.getMenuItemById(id);
        if (!menuItem) {
            return res.status(404).json({ error: "Menu item not found." });
        }

        await menuItemModel.unlikeMenuItem(req.user.customerID, id);

        const likeCount = await menuItemModel.getLikeCountByMenuItemID(id);
        res.status(200).json({ liked: false, likeCount: likeCount });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error unliking menu item." });
    }
}

module.exports = {
    getMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getMyLikedMenuItems,
    likeMenuItem,
    unlikeMenuItem,
};