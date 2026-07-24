// Unit tests for the menu item controller (CRUD + Cloudinary photo upload).
// menuItemModel and the Cloudinary uploader are both mocked, so no database
// connection and no real image upload happens.

jest.mock("../models/menuItemModel");
jest.mock("../cloudinaryConfig");

const menuItemModel = require("../models/menuItemModel");
const { uploadImageToCloudinary } = require("../cloudinaryConfig");
const menuItemController = require("../controllers/menuItemController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const mockReq = { user: { stallOwnerID: 1 } };

const sampleItem = {
    menuItemID: 1,
    stallID: 1,
    name: "Steamed Chicken Rice",
    price: 4.5,
    category: "main",
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getMenuItems", () => {
    test("returns the stall's menu items", async () => {
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        menuItemModel.getMenuItemsByStallID.mockResolvedValue([sampleItem]);
        const res = mockRes();

        await menuItemController.getMenuItems(mockReq, res);

        expect(menuItemModel.getMenuItemsByStallID).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith([sampleItem]);
    });

    test("404s when the account has no stall", async () => {
        menuItemModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await menuItemController.getMenuItems(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(menuItemModel.getMenuItemsByStallID).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        menuItemModel.getStallByOwnerID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await menuItemController.getMenuItems(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// NOTE: getMenuItemById is defined in menuItemController.js but is not in its
// module.exports, and app.js has no "GET /menuitems/:id" route wired to it —
// it's currently unreachable from the API, so there is nothing to test here.
// If you want single-item lookup, export it and add the route; happy to add
// tests for it once that's in place.

describe("createMenuItem", () => {
    const reqBody = {
        user: { stallOwnerID: 1 },
        body: { name: "Roasted Chicken Rice", description: "Roasted", price: 5.0, category: "main" },
    };

    test("creates a menu item without a photo", async () => {
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        menuItemModel.createMenuItem.mockResolvedValue({ ...sampleItem, menuItemID: 2 });
        const res = mockRes();

        await menuItemController.createMenuItem(reqBody, res);

        expect(uploadImageToCloudinary).not.toHaveBeenCalled();
        expect(menuItemModel.createMenuItem).toHaveBeenCalledWith(1, reqBody.body, null);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("uploads to Cloudinary first when a photo is attached, then passes its secure_url to the model", async () => {
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        uploadImageToCloudinary.mockResolvedValue({ secure_url: "https://cloudinary.com/img.jpg" });
        menuItemModel.createMenuItem.mockResolvedValue({ ...sampleItem, imageURL: "https://cloudinary.com/img.jpg" });
        const req = { ...reqBody, file: { buffer: Buffer.from("fake"), mimetype: "image/jpeg" } };
        const res = mockRes();

        await menuItemController.createMenuItem(req, res);

        expect(uploadImageToCloudinary).toHaveBeenCalledWith(req.file.buffer, "image/jpeg");
        expect(menuItemModel.createMenuItem).toHaveBeenCalledWith(1, req.body, "https://cloudinary.com/img.jpg");
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("404s when the account has no stall", async () => {
        menuItemModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await menuItemController.createMenuItem(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(menuItemModel.createMenuItem).not.toHaveBeenCalled();
    });

    test("500s when the Cloudinary upload fails", async () => {
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        uploadImageToCloudinary.mockRejectedValue(new Error("Cloudinary outage"));
        const req = { ...reqBody, file: { buffer: Buffer.from("fake"), mimetype: "image/jpeg" } };
        const res = mockRes();

        await menuItemController.createMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(menuItemModel.createMenuItem).not.toHaveBeenCalled();
    });
});

describe("updateMenuItem", () => {
    const req = {
        params: { id: "1" },
        user: { stallOwnerID: 1 },
        body: { name: "Steamed Chicken Rice", description: "Updated", price: 4.8, category: "main", isAvailable: 1 },
    };

    test("updates the menu item when it belongs to the requesting stall owner", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(sampleItem);
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        menuItemModel.updateMenuItem.mockResolvedValue({ ...sampleItem, price: 4.8 });
        const res = mockRes();

        await menuItemController.updateMenuItem(req, res);

        expect(menuItemModel.updateMenuItem).toHaveBeenCalledWith(1, req.body, null);
        expect(res.json).toHaveBeenCalledWith({ ...sampleItem, price: 4.8 });
    });

    test("uploads a new photo to Cloudinary when one is attached", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(sampleItem);
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        uploadImageToCloudinary.mockResolvedValue({ secure_url: "https://cloudinary.com/new.jpg" });
        menuItemModel.updateMenuItem.mockResolvedValue({ ...sampleItem, imageURL: "https://cloudinary.com/new.jpg" });
        const reqWithFile = { ...req, file: { buffer: Buffer.from("fake"), mimetype: "image/png" } };
        const res = mockRes();

        await menuItemController.updateMenuItem(reqWithFile, res);

        expect(uploadImageToCloudinary).toHaveBeenCalledWith(reqWithFile.file.buffer, "image/png");
        expect(menuItemModel.updateMenuItem).toHaveBeenCalledWith(1, req.body, "https://cloudinary.com/new.jpg");
    });

    test("404s when the menu item does not exist", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(null);
        const res = mockRes();

        await menuItemController.updateMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(menuItemModel.updateMenuItem).not.toHaveBeenCalled();
    });

    test("403s when the menu item belongs to a different stall owner", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue({ ...sampleItem, stallID: 2 });
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        const res = mockRes();

        await menuItemController.updateMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(menuItemModel.updateMenuItem).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        menuItemModel.getMenuItemById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await menuItemController.updateMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("deleteMenuItem", () => {
    const req = { params: { id: "1" }, user: { stallOwnerID: 1 } };

    test("deletes the menu item when it belongs to the requesting stall owner", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(sampleItem);
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        menuItemModel.deleteMenuItem.mockResolvedValue(true);
        const res = mockRes();

        await menuItemController.deleteMenuItem(req, res);

        expect(menuItemModel.deleteMenuItem).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith({ message: "Menu item deleted successfully." });
    });

    test("404s when the menu item does not exist", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(null);
        const res = mockRes();

        await menuItemController.deleteMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(menuItemModel.deleteMenuItem).not.toHaveBeenCalled();
    });

    test("403s when the menu item belongs to a different stall owner", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue({ ...sampleItem, stallID: 2 });
        menuItemModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        const res = mockRes();

        await menuItemController.deleteMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(menuItemModel.deleteMenuItem).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        menuItemModel.getMenuItemById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await menuItemController.deleteMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
