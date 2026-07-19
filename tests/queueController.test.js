// Unit tests for the queue controller.
// Every collaborator is mocked (jest.mock replaces the module with fakes), so no database
// connection and no real email is needed. That lets these tests drive situations that are
// awkward to stage by hand -- an empty queue, a Brevo outage, a failing INSERT.

jest.mock("../models/stallModel");
jest.mock("../models/orderModel");
jest.mock("../models/notificationModel");
jest.mock("../services/emailService");

const stallModel = require("../models/stallModel");
const orderModel = require("../models/orderModel");
const notificationModel = require("../models/notificationModel");
const emailService = require("../services/emailService");
const queueController = require("../controllers/queueController");

// Minimal stand-ins for Express's req/res. res records what the controller sent.
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const mockReq = { user: { stallOwnerID: 1 } };

// A next-in-line row as orderModel actually returns it: queue fields plus the contact
// details joined in for the notification.
const nextRow = {
    orderID: 9,
    customerID: 2,
    queueNumber: 44,
    status: "pending",
    customerEmail: "bob@email.com",
    customerFirstName: "Bob",
    stallName: "Stall 1",
};

const servedRow = { orderID: 8, customerID: 1, queueNumber: 43, status: "completed" };

beforeEach(() => {
    jest.clearAllMocks();
    stallModel.getStallByOwnerID.mockResolvedValue({ stallID: 1, stallName: "Stall 1" });
    // Silence the controller's console.error in expected-failure tests.
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getQueue", () => {
    test("returns the queue with the head as the current customer", async () => {
        const queue = [
            { orderID: 8, customerID: 1, queueNumber: 43, status: "preparing" },
            { orderID: 9, customerID: 2, queueNumber: 44, status: "pending" },
        ];
        orderModel.getCurrentQueue.mockResolvedValue(queue);
        const res = mockRes();

        await queueController.getQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ current: queue[0], queue });
    });

    test("returns current: null and an empty queue when nobody is waiting", async () => {
        orderModel.getCurrentQueue.mockResolvedValue([]);
        const res = mockRes();

        await queueController.getQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ current: null, queue: [] });
    });

    test("404s when the account has no stall", async () => {
        stallModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await queueController.getQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(orderModel.getCurrentQueue).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        orderModel.getCurrentQueue.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await queueController.getQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("advanceQueue", () => {
    test("serves the current customer, promotes the next, and reports them notified", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: nextRow });
        emailService.sendQueueNotification.mockResolvedValue({ ok: true });
        notificationModel.createNotification.mockResolvedValue(1);
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.servedOrder).toEqual(servedRow);
        expect(body.nextOrder.orderID).toBe(9);
        expect(body.notified).toBe(true);
    });

    test("emails the promoted customer using their joined-in details", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: nextRow });
        emailService.sendQueueNotification.mockResolvedValue({ ok: true });
        notificationModel.createNotification.mockResolvedValue(1);

        await queueController.advanceQueue(mockReq, mockRes());

        expect(emailService.sendQueueNotification).toHaveBeenCalledWith("bob@email.com", "Bob", "Stall 1", 44);
    });

    test("does not leak the customer's contact details into the response", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: nextRow });
        emailService.sendQueueNotification.mockResolvedValue({ ok: true });
        notificationModel.createNotification.mockResolvedValue(1);
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        const { nextOrder } = res.json.mock.calls[0][0];
        expect(nextOrder).toEqual({ orderID: 9, customerID: 2, queueNumber: 44, status: "pending" });
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("bob@email.com");
    });

    test("records the notification as sent", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: nextRow });
        emailService.sendQueueNotification.mockResolvedValue({ ok: true });
        notificationModel.createNotification.mockResolvedValue(1);

        await queueController.advanceQueue(mockReq, mockRes());

        expect(notificationModel.createNotification).toHaveBeenCalledWith(
            expect.objectContaining({ customerID: 2, orderID: 9, channel: "email", status: "sent" })
        );
    });

    test("still serves the customer when the email fails, recording it as failed", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: nextRow });
        emailService.sendQueueNotification.mockResolvedValue({ ok: false, error: "Key not found" });
        notificationModel.createNotification.mockResolvedValue(1);
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].notified).toBe(false);
        expect(notificationModel.createNotification).toHaveBeenCalledWith(
            expect.objectContaining({ status: "failed" })
        );
    });

    test("still serves the customer when recording the notification throws", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: nextRow });
        emailService.sendQueueNotification.mockResolvedValue({ ok: true });
        notificationModel.createNotification.mockRejectedValue(new Error("INSERT failed"));
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].notified).toBe(true);
    });

    test("serving the last customer empties the queue and notifies nobody", async () => {
        orderModel.advanceQueue.mockResolvedValue({ servedOrder: servedRow, nextOrder: null });
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.nextOrder).toBeNull();
        expect(body.notified).toBe(false);
        expect(emailService.sendQueueNotification).not.toHaveBeenCalled();
        expect(notificationModel.createNotification).not.toHaveBeenCalled();
    });

    test("404s when there is nobody in the queue to serve", async () => {
        orderModel.advanceQueue.mockResolvedValue(null);
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(emailService.sendQueueNotification).not.toHaveBeenCalled();
    });

    test("404s when the account has no stall, without touching the queue", async () => {
        stallModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(orderModel.advanceQueue).not.toHaveBeenCalled();
    });

    test("500s when advancing the queue fails", async () => {
        orderModel.advanceQueue.mockRejectedValue(new Error("transaction aborted"));
        const res = mockRes();

        await queueController.advanceQueue(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
