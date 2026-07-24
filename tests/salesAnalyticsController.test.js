// Unit tests for the sales analytics controller: the operator-scoped view (any
// stall in centres they manage) and the stall-owner-scoped view (their own stall
// only). salesAnalyticsModel is mocked, so no database connection happens.

jest.mock("../models/salesAnalyticsModel");

const salesAnalyticsModel = require("../models/salesAnalyticsModel");
const salesAnalyticsController = require("../controllers/salesAnalyticsController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const summary = { totalOrders: 10, totalRevenue: 95.5, averageOrderValue: 9.55 };
const popularItems = [{ menuItemID: 1, name: "Steamed Chicken Rice", totalQuantitySold: 20 }];
const peakHours = [{ hourOfDay: 12, orderCount: 5 }];

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getSalesAnalytics (operator view)", () => {
    const req = { params: { stallID: "3" }, user: { operatorID: 2 } };

    test("returns the stall's analytics when it belongs to the operator's centres", async () => {
        const stall = { stallID: 3, stallName: "Lao Wang Char Kway Teow", centreID: 2 };
        salesAnalyticsModel.getStallOwnedByOperator.mockResolvedValue(stall);
        salesAnalyticsModel.getSalesSummaryByStallID.mockResolvedValue(summary);
        salesAnalyticsModel.getPopularItemsByStallID.mockResolvedValue(popularItems);
        salesAnalyticsModel.getPeakHoursByStallID.mockResolvedValue(peakHours);
        const res = mockRes();

        await salesAnalyticsController.getSalesAnalytics(req, res);

        expect(salesAnalyticsModel.getStallOwnedByOperator).toHaveBeenCalledWith(3, 2);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ stall, summary, popularItems, peakHours });
    });

    test("400s when the stallID in the URL is not a number", async () => {
        const res = mockRes();

        await salesAnalyticsController.getSalesAnalytics({ ...req, params: { stallID: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(salesAnalyticsModel.getStallOwnedByOperator).not.toHaveBeenCalled();
    });

    test("404s when the stall is not managed by this operator", async () => {
        salesAnalyticsModel.getStallOwnedByOperator.mockResolvedValue(null);
        const res = mockRes();

        await salesAnalyticsController.getSalesAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(salesAnalyticsModel.getSalesSummaryByStallID).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        salesAnalyticsModel.getStallOwnedByOperator.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await salesAnalyticsController.getSalesAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getMySalesAnalytics (stall owner view)", () => {
    const req = { user: { stallOwnerID: 1 } };

    test("returns analytics for the owner's own stall", async () => {
        const stall = { stallID: 1, stallName: "Tian Tian Chicken Rice", centreID: 1 };
        salesAnalyticsModel.getStallOwnedByOwner.mockResolvedValue(stall);
        salesAnalyticsModel.getSalesSummaryByStallID.mockResolvedValue(summary);
        salesAnalyticsModel.getPopularItemsByStallID.mockResolvedValue(popularItems);
        salesAnalyticsModel.getPeakHoursByStallID.mockResolvedValue(peakHours);
        const res = mockRes();

        await salesAnalyticsController.getMySalesAnalytics(req, res);

        expect(salesAnalyticsModel.getStallOwnedByOwner).toHaveBeenCalledWith(1);
        expect(salesAnalyticsModel.getSalesSummaryByStallID).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ stall, summary, popularItems, peakHours });
    });

    test("404s when the account has no stall", async () => {
        salesAnalyticsModel.getStallOwnedByOwner.mockResolvedValue(null);
        const res = mockRes();

        await salesAnalyticsController.getMySalesAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(salesAnalyticsModel.getSalesSummaryByStallID).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        salesAnalyticsModel.getStallOwnedByOwner.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await salesAnalyticsController.getMySalesAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
