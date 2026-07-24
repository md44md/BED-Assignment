// Unit tests for the promotion controller (CRUD + notify repeat customers).
// promotionModel, notificationModel and the email service are all mocked, so no
// database connection and no real email are involved.

jest.mock("../models/promotionModel");
jest.mock("../models/notificationModel");
jest.mock("../services/emailService");

const promotionModel = require("../models/promotionModel");
const notificationModel = require("../models/notificationModel");
const emailService = require("../services/emailService");
const promotionController = require("../controllers/promotionController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const samplePromotion = {
    promotionID: 1,
    stallID: 1,
    title: "Weekday Special",
    description: "10% off all mains",
    discountType: "percentage",
    discountValue: 10,
    startDate: null,
    endDate: null,
    isActive: true,
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getPromotions", () => {
    const req = { user: { stallOwnerID: 1 } };

    test("returns the stall's promotions", async () => {
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        promotionModel.getPromotionsByStallID.mockResolvedValue([samplePromotion]);
        const res = mockRes();

        await promotionController.getPromotions(req, res);

        expect(promotionModel.getPromotionsByStallID).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith([samplePromotion]);
    });

    test("404s when the account has no stall", async () => {
        promotionModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await promotionController.getPromotions(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(promotionModel.getPromotionsByStallID).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        promotionModel.getStallByOwnerID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await promotionController.getPromotions(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("createPromotion", () => {
    const req = {
        user: { stallOwnerID: 1 },
        body: { title: "Weekday Special", description: "10% off all mains", discountType: "percentage", discountValue: 10 },
    };

    test("creates the promotion and emails each repeat customer, returning the notified count", async () => {
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1, stallName: "Tian Tian Chicken Rice" });
        promotionModel.createPromotion.mockResolvedValue(samplePromotion);
        promotionModel.getCustomersByStallID.mockResolvedValue([
            { customerID: 1, firstName: "Alice", email: "alice@example.com" },
            { customerID: 2, firstName: "Bob", email: "bob@example.com" },
        ]);
        emailService.sendPromotionNotification.mockResolvedValue({ ok: true });
        notificationModel.createNotification.mockResolvedValue(1);
        const res = mockRes();

        await promotionController.createPromotion(req, res);

        expect(promotionModel.createPromotion).toHaveBeenCalledWith(1, req.body);
        expect(emailService.sendPromotionNotification).toHaveBeenCalledTimes(2);
        expect(notificationModel.createNotification).toHaveBeenCalledTimes(2);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ notifiedCustomers: 2 }));
    });

    test("still succeeds (201) when there are no past customers to notify", async () => {
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1, stallName: "Tian Tian Chicken Rice" });
        promotionModel.createPromotion.mockResolvedValue(samplePromotion);
        promotionModel.getCustomersByStallID.mockResolvedValue([]);
        const res = mockRes();

        await promotionController.createPromotion(req, res);

        expect(emailService.sendPromotionNotification).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ notifiedCustomers: 0 }));
    });

    test("counts only successfully sent emails as notified", async () => {
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1, stallName: "Tian Tian Chicken Rice" });
        promotionModel.createPromotion.mockResolvedValue(samplePromotion);
        promotionModel.getCustomersByStallID.mockResolvedValue([
            { customerID: 1, firstName: "Alice", email: "alice@example.com" },
            { customerID: 2, firstName: "Bob", email: "bob@example.com" },
        ]);
        emailService.sendPromotionNotification
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: false, error: "bounced" });
        notificationModel.createNotification.mockResolvedValue(1);
        const res = mockRes();

        await promotionController.createPromotion(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ notifiedCustomers: 1 }));
    });

    test("400s when the end date is before the start date", async () => {
        const badReq = { user: { stallOwnerID: 1 }, body: { ...req.body, startDate: "2026-08-10", endDate: "2026-08-01" } };
        const res = mockRes();

        await promotionController.createPromotion(badReq, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(promotionModel.createPromotion).not.toHaveBeenCalled();
    });

    test("404s when the account has no stall", async () => {
        promotionModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await promotionController.createPromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(promotionModel.createPromotion).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        promotionModel.getStallByOwnerID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await promotionController.createPromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("updatePromotion", () => {
    const req = {
        params: { id: "1" },
        user: { stallOwnerID: 1 },
        body: { title: "Weekday Special", description: "15% off", discountType: "percentage", discountValue: 15, isActive: false },
    };

    test("updates the promotion when it belongs to the requesting stall owner", async () => {
        promotionModel.getPromotionById.mockResolvedValue(samplePromotion);
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        promotionModel.updatePromotion.mockResolvedValue({ ...samplePromotion, isActive: false });
        const res = mockRes();

        await promotionController.updatePromotion(req, res);

        expect(promotionModel.updatePromotion).toHaveBeenCalledWith(1, expect.objectContaining({ isActive: false }));
        expect(res.json).toHaveBeenCalledWith({ ...samplePromotion, isActive: false });
    });

    test("keeps the existing isActive when the body omits it", async () => {
        const reqNoActive = { params: { id: "1" }, user: { stallOwnerID: 1 }, body: { title: "X", discountType: "fixed", discountValue: 2 } };
        promotionModel.getPromotionById.mockResolvedValue(samplePromotion); // isActive: true
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        promotionModel.updatePromotion.mockResolvedValue(samplePromotion);
        const res = mockRes();

        await promotionController.updatePromotion(reqNoActive, res);

        expect(promotionModel.updatePromotion).toHaveBeenCalledWith(1, expect.objectContaining({ isActive: true }));
    });

    test("404s when the promotion does not exist", async () => {
        promotionModel.getPromotionById.mockResolvedValue(null);
        const res = mockRes();

        await promotionController.updatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(promotionModel.updatePromotion).not.toHaveBeenCalled();
    });

    test("403s when the promotion belongs to a different stall owner", async () => {
        promotionModel.getPromotionById.mockResolvedValue({ ...samplePromotion, stallID: 2 });
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        const res = mockRes();

        await promotionController.updatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(promotionModel.updatePromotion).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        promotionModel.getPromotionById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await promotionController.updatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("deletePromotion", () => {
    const req = { params: { id: "1" }, user: { stallOwnerID: 1 } };

    test("deletes the promotion when it belongs to the requesting stall owner", async () => {
        promotionModel.getPromotionById.mockResolvedValue(samplePromotion);
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        promotionModel.deletePromotion.mockResolvedValue(true);
        const res = mockRes();

        await promotionController.deletePromotion(req, res);

        expect(promotionModel.deletePromotion).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith({ message: "Promotion deleted successfully." });
    });

    test("404s when the promotion does not exist", async () => {
        promotionModel.getPromotionById.mockResolvedValue(null);
        const res = mockRes();

        await promotionController.deletePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(promotionModel.deletePromotion).not.toHaveBeenCalled();
    });

    test("403s when the promotion belongs to a different stall owner", async () => {
        promotionModel.getPromotionById.mockResolvedValue({ ...samplePromotion, stallID: 2 });
        promotionModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        const res = mockRes();

        await promotionController.deletePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(promotionModel.deletePromotion).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        promotionModel.getPromotionById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await promotionController.deletePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
