// Unit tests for the order submission + history parts of the order controller
// (submitOrder, getMyOrders). orderModel is mocked, so no database connection
// happens and cases like an empty cart or an unavailable item are easy to stage.
// (The receipt/PDF parts of this controller are covered in orderController.test.js.)

jest.mock("../models/orderModel");

const orderModel = require("../models/orderModel");
const orderController = require("../controllers/orderController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// A cart owned by customer 1, and its items, as the model returns them.
const cart = { cartID: 3, customerID: 1, stallID: 2 };
const items = [
    { menuItemID: 7, unitPrice: 5.5, quantity: 2, isAvailable: true },
    { menuItemID: 8, unitPrice: 4.0, quantity: 1, isAvailable: true },
];

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("submitOrder", () => {
    const req = { user: { customerID: 1 }, body: { cartID: 3, paymentMethod: "NETS" } };

    test("places the order and returns orderID, queueNumber and total", async () => {
        orderModel.getCartById.mockResolvedValue(cart);
        orderModel.getCartItemsForOrder.mockResolvedValue(items);
        orderModel.getNextQueueNumber.mockResolvedValue(12);
        orderModel.submitOrder.mockResolvedValue({ orderID: 100, queueNumber: 12, totalAmount: 16.35 });
        const res = mockRes();

        await orderController.submitOrder(req, res);

        // subtotal = 5.5*2 + 4.0 = 15.00, gst = 9% = 1.35, total = 16.35
        expect(orderModel.submitOrder).toHaveBeenCalledWith(cart, items, "NETS", 15, 0, 1.35, 16.35, 12);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ orderID: 100, queueNumber: 12, totalAmount: 16.35 }));
    });

    test("404s when the cart does not exist", async () => {
        orderModel.getCartById.mockResolvedValue(null);
        const res = mockRes();

        await orderController.submitOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(orderModel.submitOrder).not.toHaveBeenCalled();
    });

    test("403s when the cart belongs to another customer", async () => {
        orderModel.getCartById.mockResolvedValue({ ...cart, customerID: 999 });
        const res = mockRes();

        await orderController.submitOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(orderModel.submitOrder).not.toHaveBeenCalled();
    });

    test("400s when the cart is empty", async () => {
        orderModel.getCartById.mockResolvedValue(cart);
        orderModel.getCartItemsForOrder.mockResolvedValue([]);
        const res = mockRes();

        await orderController.submitOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(orderModel.submitOrder).not.toHaveBeenCalled();
    });

    test("409s when an item is no longer available", async () => {
        orderModel.getCartById.mockResolvedValue(cart);
        orderModel.getCartItemsForOrder.mockResolvedValue([{ ...items[0], isAvailable: false }]);
        const res = mockRes();

        await orderController.submitOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(orderModel.submitOrder).not.toHaveBeenCalled();
    });

    test("500s when a model call throws", async () => {
        orderModel.getCartById.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await orderController.submitOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getMyOrders", () => {
    const req = { user: { customerID: 1 } };

    test("returns the customer's own orders", async () => {
        const orders = [{ orderID: 100, queueNumber: 12, status: "pending" }];
        orderModel.getOrdersByCustomer.mockResolvedValue(orders);
        const res = mockRes();

        await orderController.getMyOrders(req, res);

        expect(orderModel.getOrdersByCustomer).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith(orders);
    });

    test("500s when the model call fails", async () => {
        orderModel.getOrdersByCustomer.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await orderController.getMyOrders(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
