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

// Get /menuitems/:id
async function getMenuItemById(req, res) {
    try {
        const id = parseInt(req.params.id);
        const menuItem = await menuItemModel.getMenuItemById(id);
        if (!menuItem) {
            return res.status(404).json({ message: "Menu item not found." });
        }

        res.json(menuItem);
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

module.exports = {
    getMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
};