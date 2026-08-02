// Unit tests for the customer "like menu item" parts of the menu item controller
// (getMyLikedMenuItems, likeMenuItem, unlikeMenuItem). menuItemModel is mocked, so
// no database connection happens. (The stall-owner CRUD parts of this controller
// are covered in menuItemController.test.js.)

jest.mock("../models/menuItemModel");

const menuItemModel = require("../models/menuItemModel");
const menuItemController = require("../controllers/menuItemController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getMyLikedMenuItems", () => {
    const req = { user: { customerID: 1 } };

    test("returns the customer's liked menu item IDs", async () => {
        menuItemModel.getLikedMenuItemIDsByCustomer.mockResolvedValue([2, 7]);
        const res = mockRes();

        await menuItemController.getMyLikedMenuItems(req, res);

        expect(menuItemModel.getLikedMenuItemIDsByCustomer).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith({ likedMenuItemIDs: [2, 7] });
    });

    test("500s when the model call fails", async () => {
        menuItemModel.getLikedMenuItemIDsByCustomer.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await menuItemController.getMyLikedMenuItems(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("likeMenuItem", () => {
    const req = { user: { customerID: 1 }, params: { id: "7" } };

    test("inserts a like and returns the new count", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue({ menuItemID: 7 });
        menuItemModel.getLike.mockResolvedValue(null);
        menuItemModel.getLikeCountByMenuItemID.mockResolvedValue(3);
        const res = mockRes();

        await menuItemController.likeMenuItem(req, res);

        expect(menuItemModel.likeMenuItem).toHaveBeenCalledWith(1, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ liked: true, likeCount: 3 });
    });

    test("does not insert again when the customer already liked the item", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue({ menuItemID: 7 });
        menuItemModel.getLike.mockResolvedValue({ likeID: 55 });
        menuItemModel.getLikeCountByMenuItemID.mockResolvedValue(3);
        const res = mockRes();

        await menuItemController.likeMenuItem(req, res);

        expect(menuItemModel.likeMenuItem).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ liked: true, likeCount: 3 });
    });

    test("404s when the menu item does not exist", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(null);
        const res = mockRes();

        await menuItemController.likeMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(menuItemModel.likeMenuItem).not.toHaveBeenCalled();
    });

    test("500s when a model call fails", async () => {
        menuItemModel.getMenuItemById.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await menuItemController.likeMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("unlikeMenuItem", () => {
    const req = { user: { customerID: 1 }, params: { id: "7" } };

    test("removes the like and returns the new count", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue({ menuItemID: 7 });
        menuItemModel.getLikeCountByMenuItemID.mockResolvedValue(2);
        const res = mockRes();

        await menuItemController.unlikeMenuItem(req, res);

        expect(menuItemModel.unlikeMenuItem).toHaveBeenCalledWith(1, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ liked: false, likeCount: 2 });
    });

    test("404s when the menu item does not exist", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue(null);
        const res = mockRes();

        await menuItemController.unlikeMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(menuItemModel.unlikeMenuItem).not.toHaveBeenCalled();
    });

    test("500s when a model call fails", async () => {
        menuItemModel.getMenuItemById.mockResolvedValue({ menuItemID: 7 });
        menuItemModel.getLikeCountByMenuItemID.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await menuItemController.unlikeMenuItem(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
