// Unit tests for the feedback controller (submit, edit, list, public reviews).
// feedbackModel, stallModel and the profanity service are all mocked, so no
// database connection and no real PurgoMalum API call happens. That lets these
// tests drive situations that are awkward to stage by hand -- an order that
// isn't paid, a review that belongs to someone else, a profane comment.

jest.mock("../models/feedbackModel");
jest.mock("../models/stallModel");
jest.mock("../services/profanityService");

const feedbackModel = require("../models/feedbackModel");
const stallModel = require("../models/stallModel");
const { filterProfanity } = require("../services/profanityService");
const feedbackController = require("../controllers/feedbackController");

// Minimal stand-ins for Express's req/res. res records what the controller sent.
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// A completed + paid order owned by customer 1, as getOrderForFeedback returns it.
const paidOrder = { orderID: 5, customerID: 1, stallID: 2, status: "completed", paymentStatus: "paid" };

beforeEach(() => {
    jest.clearAllMocks();
    // Default: profanity filter leaves the text unchanged. Individual tests
    // override this when they want to exercise the censoring path.
    filterProfanity.mockResolvedValue({ cleaned: "Great food!", filtered: false });
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("submitFeedback", () => {
    const req = { user: { customerID: 1 }, body: { orderID: 5, rating: 5, comments: "Great food!" } };

    test("stores the review and returns the new feedbackID", async () => {
        feedbackModel.getOrderForFeedback.mockResolvedValue(paidOrder);
        feedbackModel.getFeedbackByCustomerAndStall.mockResolvedValue(null);
        feedbackModel.createFeedback.mockResolvedValue(42);
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(feedbackModel.createFeedback).toHaveBeenCalledWith(1, 2, 5, 5, "Great food!", false);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ feedbackID: 42 }));
    });

    test("stores the cleaned comment and filtered=true when profanity is found", async () => {
        feedbackModel.getOrderForFeedback.mockResolvedValue(paidOrder);
        feedbackModel.getFeedbackByCustomerAndStall.mockResolvedValue(null);
        feedbackModel.createFeedback.mockResolvedValue(43);
        filterProfanity.mockResolvedValue({ cleaned: "the food was ****", filtered: true });
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(feedbackModel.createFeedback).toHaveBeenCalledWith(1, 2, 5, 5, "the food was ****", true);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("404s when the order does not exist", async () => {
        feedbackModel.getOrderForFeedback.mockResolvedValue(null);
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(feedbackModel.createFeedback).not.toHaveBeenCalled();
    });

    test("403s when the order belongs to another customer", async () => {
        feedbackModel.getOrderForFeedback.mockResolvedValue({ ...paidOrder, customerID: 999 });
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(feedbackModel.createFeedback).not.toHaveBeenCalled();
    });

    test("400s when the order is not completed and paid", async () => {
        feedbackModel.getOrderForFeedback.mockResolvedValue({ ...paidOrder, status: "pending", paymentStatus: "pending" });
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(feedbackModel.createFeedback).not.toHaveBeenCalled();
    });

    test("409s when the customer has already reviewed this stall", async () => {
        feedbackModel.getOrderForFeedback.mockResolvedValue(paidOrder);
        feedbackModel.getFeedbackByCustomerAndStall.mockResolvedValue({ feedbackID: 7 });
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ feedbackID: 7 }));
        expect(feedbackModel.createFeedback).not.toHaveBeenCalled();
    });

    test("500s when a model call throws", async () => {
        feedbackModel.getOrderForFeedback.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await feedbackController.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("editFeedback", () => {
    const req = { user: { customerID: 1 }, body: { feedbackID: 4, rating: 4, comments: "Great food!" } };

    test("updates the review with the cleaned comment", async () => {
        feedbackModel.getFeedbackById.mockResolvedValue({ feedbackID: 4, customerID: 1 });
        const res = mockRes();

        await feedbackController.editFeedback(req, res);

        expect(feedbackModel.updateFeedback).toHaveBeenCalledWith(4, 4, "Great food!", false);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("404s when the review does not exist", async () => {
        feedbackModel.getFeedbackById.mockResolvedValue(null);
        const res = mockRes();

        await feedbackController.editFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(feedbackModel.updateFeedback).not.toHaveBeenCalled();
    });

    test("403s when the review belongs to another customer", async () => {
        feedbackModel.getFeedbackById.mockResolvedValue({ feedbackID: 4, customerID: 999 });
        const res = mockRes();

        await feedbackController.editFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(feedbackModel.updateFeedback).not.toHaveBeenCalled();
    });

    test("500s when a model call throws", async () => {
        feedbackModel.getFeedbackById.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await feedbackController.editFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getMyFeedback", () => {
    const req = { user: { customerID: 1 } };

    test("returns the customer's own reviews", async () => {
        const reviews = [{ feedbackID: 1, stallName: "Stall A", rating: 5 }];
        feedbackModel.getFeedbackByCustomer.mockResolvedValue(reviews);
        const res = mockRes();

        await feedbackController.getMyFeedback(req, res);

        expect(feedbackModel.getFeedbackByCustomer).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith(reviews);
    });

    test("500s when the model call fails", async () => {
        feedbackModel.getFeedbackByCustomer.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await feedbackController.getMyFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getStallReviews", () => {
    test("returns the average rating, count and reviews for a stall", async () => {
        stallModel.getStallById.mockResolvedValue({ stallID: 2, stallName: "Stall A" });
        feedbackModel.getFeedbackByStall.mockResolvedValue([
            { rating: 5, comments: "Great" },
            { rating: 4, comments: "Good" },
        ]);
        const res = mockRes();

        await feedbackController.getStallReviews({ params: { stallID: "2" } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ averageRating: 4.5, reviewCount: 2 }));
    });

    test("returns averageRating null when a stall has no reviews", async () => {
        stallModel.getStallById.mockResolvedValue({ stallID: 2 });
        feedbackModel.getFeedbackByStall.mockResolvedValue([]);
        const res = mockRes();

        await feedbackController.getStallReviews({ params: { stallID: "2" } }, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ averageRating: null, reviewCount: 0 }));
    });

    test("400s when the stall ID is not a number", async () => {
        const res = mockRes();

        await feedbackController.getStallReviews({ params: { stallID: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(feedbackModel.getFeedbackByStall).not.toHaveBeenCalled();
    });

    test("404s when the stall does not exist", async () => {
        stallModel.getStallById.mockResolvedValue(null);
        const res = mockRes();

        await feedbackController.getStallReviews({ params: { stallID: "999" } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(feedbackModel.getFeedbackByStall).not.toHaveBeenCalled();
    });

    test("500s when the model call fails", async () => {
        stallModel.getStallById.mockResolvedValue({ stallID: 2 });
        feedbackModel.getFeedbackByStall.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await feedbackController.getStallReviews({ params: { stallID: "2" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
