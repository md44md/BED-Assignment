// Unit tests for the order controller's itemized receipt endpoints.
// The model and PDF service are mocked so no database connection or real PDFShift
// call is needed.

jest.mock("../models/orderModel");
jest.mock("../services/pdfService");

const orderModel = require("../models/orderModel");
const pdfService = require("../services/pdfService");
const orderController = require("../controllers/orderController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    return res;
}

function mockReq(orderID, customerID = 1) {
    return { params: { orderID: String(orderID) }, user: { customerID } };
}

const receiptRow = {
    orderID: 1,
    customerID: 1,
    stallID: 1,
    stallName: "Tian Tian Chicken Rice",
    queueNumber: 42,
    status: "completed",
    paymentMethod: "PayNow",
    paymentStatus: "paid",
    subtotal: 9.00,
    packagingFee: 0.00,
    gstAmount: 0.81,
    totalAmount: 9.81,
    createdAt: "2026-06-01T12:30:00.000Z",
    items: [
        { orderItemID: 1, menuItemID: 1, itemName: "Steamed Chicken Rice", unitPrice: 4.5, quantity: 2, addons: "No chilli", itemTotal: 9.0, category: "main" },
    ],
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getOrderReceipt", () => {
    test("returns the itemized breakdown, splitting base items from priced add-ons", async () => {
        const withAddon = {
            ...receiptRow,
            items: [
                ...receiptRow.items,
                { orderItemID: 2, menuItemID: 19, itemName: "Extra Chicken", unitPrice: 2.5, quantity: 1, addons: null, itemTotal: 2.5, category: "add-on" },
            ],
        };
        orderModel.getOrderReceipt.mockResolvedValue(withAddon);
        const res = mockRes();

        await orderController.getOrderReceipt(mockReq(1), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        expect(res.status).not.toHaveBeenCalledWith(403);
        const body = res.json.mock.calls[0][0];
        expect(body.items).toHaveLength(1);
        expect(body.addons).toHaveLength(1);
        expect(body.baseItemsTotal).toBe(9.0);
        expect(body.addonsTotal).toBe(2.5);
        expect(body.totalAmount).toBe(9.81);
    });

    test("404s when the order does not exist", async () => {
        orderModel.getOrderReceipt.mockResolvedValue(null);
        const res = mockRes();

        await orderController.getOrderReceipt(mockReq(999), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("403s when the order belongs to a different customer", async () => {
        orderModel.getOrderReceipt.mockResolvedValue(receiptRow);
        const res = mockRes();

        await orderController.getOrderReceipt(mockReq(1, 2), res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("500s when the database call fails", async () => {
        orderModel.getOrderReceipt.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await orderController.getOrderReceipt(mockReq(1), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getOrderReceiptPdf", () => {
    test("streams back a PDF with the right headers", async () => {
        orderModel.getOrderReceipt.mockResolvedValue(receiptRow);
        pdfService.convertHtmlToPdf.mockResolvedValue({ ok: true, buffer: Buffer.from("fake-pdf-bytes") });
        const res = mockRes();

        await orderController.getOrderReceiptPdf(mockReq(1), res);

        expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
        expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="receipt-1.pdf"');
        expect(res.send).toHaveBeenCalledWith(Buffer.from("fake-pdf-bytes"));
        expect(res.status).not.toHaveBeenCalledWith(404);
        expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test("passes the escaped stall name and item name into the HTML sent to PDFShift", async () => {
        const withUnsafeText = {
            ...receiptRow,
            stallName: "Tian Tian <script>alert(1)</script>",
            items: [{ ...receiptRow.items[0], addons: '"><img src=x onerror=alert(1)>' }],
        };
        orderModel.getOrderReceipt.mockResolvedValue(withUnsafeText);
        pdfService.convertHtmlToPdf.mockResolvedValue({ ok: true, buffer: Buffer.from("pdf") });
        const res = mockRes();

        await orderController.getOrderReceiptPdf(mockReq(1), res);

        const html = pdfService.convertHtmlToPdf.mock.calls[0][0];
        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).not.toContain("<img src=x onerror=alert(1)>");
    });

    test("404s when the order does not exist", async () => {
        orderModel.getOrderReceipt.mockResolvedValue(null);
        const res = mockRes();

        await orderController.getOrderReceiptPdf(mockReq(999), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(pdfService.convertHtmlToPdf).not.toHaveBeenCalled();
    });

    test("403s when the order belongs to a different customer", async () => {
        orderModel.getOrderReceipt.mockResolvedValue(receiptRow);
        const res = mockRes();

        await orderController.getOrderReceiptPdf(mockReq(1, 2), res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(pdfService.convertHtmlToPdf).not.toHaveBeenCalled();
    });

    test("502s when the PDF service fails", async () => {
        orderModel.getOrderReceipt.mockResolvedValue(receiptRow);
        pdfService.convertHtmlToPdf.mockResolvedValue({ ok: false, error: "Invalid API Key" });
        const res = mockRes();

        await orderController.getOrderReceiptPdf(mockReq(1), res);

        expect(res.status).toHaveBeenCalledWith(502);
    });

    test("500s when the database call fails", async () => {
        orderModel.getOrderReceipt.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await orderController.getOrderReceiptPdf(mockReq(1), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
