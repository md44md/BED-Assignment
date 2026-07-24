const orderModel = require("../models/orderModel");
const pdfService = require("../services/pdfService");

// POST /orders
async function submitOrder(req, res) {
    try {
        const { cartID, paymentMethod } = req.body;

        // Check the cart exists
        const cart = await orderModel.getCartById(cartID);
        if (!cart) {
            return res.status(404).json({ error: "Cart not found." });
        }

        // Check the cart belongs to the logged-in customer
        if (cart.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This cart does not belong to you." });
        }

        // Load cart items with menu info
        const items = await orderModel.getCartItemsForOrder(cartID);
        if (items.length === 0) {
            return res.status(400).json({ error: "Cart is empty." });
        }

        // Check every item is still available
        const hasUnavailableItem = items.some((item) => !item.isAvailable);
        if (hasUnavailableItem) {
            return res.status(409).json({ error: "One or more items are no longer available." });
        }

        // Calculate order totals
        const rawSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const subtotal = Math.round(rawSubtotal * 100) / 100;
        const packagingFee = 0;
        const gstAmount = Math.round((subtotal + packagingFee) * 0.09 * 100) / 100;
        const totalAmount = Math.round((subtotal + packagingFee + gstAmount) * 100) / 100;

        // Get the next queue number for this stall
        const queueNumber = await orderModel.getNextQueueNumber(cart.stallID);

        // Create the order, order items, payment record, and clear the cart
        const order = await orderModel.submitOrder(
            cart,
            items,
            paymentMethod,
            subtotal,
            packagingFee,
            gstAmount,
            totalAmount,
            queueNumber
        );

        res.status(201).json({
            message: "Order submitted successfully.",
            orderID: order.orderID,
            queueNumber: order.queueNumber,
            totalAmount: order.totalAmount,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error submitting order." });
    }
}

// GET /orders
async function getMyOrders(req, res) {
    try {
        // req.user.customerID is set by verifyJWT from the logged-in customer's token
        const orders = await orderModel.getOrdersByCustomer(req.user.customerID);
        res.json(orders);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving orders." });
    }
}

// Split line items into base dishes/drinks vs priced add-ons so the receipt can show
// "base price" and "optional add-ons" as separate breakdown totals. Shared by the JSON
// and PDF receipt endpoints so they can never drift apart on how totals are computed.
function buildReceiptView(receipt) {
    const addonItems = receipt.items.filter((item) => item.category === "add-on");
    const baseItems = receipt.items.filter((item) => item.category !== "add-on");
    const sumItemTotal = (items) => items.reduce((sum, item) => sum + Number(item.itemTotal), 0);

    return {
        orderID: receipt.orderID,
        stallName: receipt.stallName,
        queueNumber: receipt.queueNumber,
        status: receipt.status,
        paymentMethod: receipt.paymentMethod,
        paymentStatus: receipt.paymentStatus,
        createdAt: receipt.createdAt,
        items: baseItems,
        addons: addonItems,
        baseItemsTotal: sumItemTotal(baseItems),
        addonsTotal: sumItemTotal(addonItems),
        subtotal: receipt.subtotal,
        packagingFee: receipt.packagingFee,
        gstAmount: receipt.gstAmount,
        totalAmount: receipt.totalAmount,
    };
}

// GET /orders/:orderID/receipt
async function getOrderReceipt(req, res) {
    try {
        const orderID = parseInt(req.params.orderID);

        const receipt = await orderModel.getOrderReceipt(orderID);
        if (!receipt) {
            return res.status(404).json({ error: "Order not found." });
        }

        // req.user.customerID is set by verifyJWT from the logged-in customer's token
        if (receipt.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This order does not belong to you." });
        }

        res.json(buildReceiptView(receipt));
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving receipt." });
    }
}

function formatCurrency(value) {
    return `$${Number(value).toFixed(2)}`;
}

// Escape free text before interpolating it into the HTML sent to PDFShift. itemName is
// stall-owner-controlled and addons is a customer-written cart note, so neither is trusted
// to render safely as-is (it could otherwise break the layout or inject markup).
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderLineItemRow(item) {
    const noteText = item.addons ? ` &middot; "${escapeHtml(item.addons)}"` : "";
    return `
        <tr>
            <td>
                <div class="item-name">${escapeHtml(item.itemName)}</div>
                <div class="item-meta">${formatCurrency(item.unitPrice)} &times; ${item.quantity}${noteText}</div>
            </td>
            <td class="amount">${formatCurrency(item.itemTotal)}</td>
        </tr>
    `;
}

// Render the itemized receipt as a self-contained HTML document for PDFShift to convert.
function renderReceiptHtml(view) {
    const addonsSection = view.addons.length > 0 ? `
        <h2>Add-ons</h2>
        <table class="items">${view.addons.map(renderLineItemRow).join("")}</table>
    ` : "";

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <style>
                body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 32px; }
                h1 { font-size: 20px; margin-bottom: 4px; }
                h2 { font-size: 14px; margin: 20px 0 6px; }
                .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
                table.items { width: 100%; border-collapse: collapse; }
                table.items td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
                .item-name { font-weight: bold; }
                .item-meta { color: #6b7280; font-size: 12px; margin-top: 2px; }
                .amount { text-align: right; white-space: nowrap; }
                table.summary { width: 100%; margin-top: 20px; border-top: 1px dashed #d1d5db; padding-top: 10px; }
                table.summary td { padding: 3px 0; font-size: 13px; }
                table.summary tr.total td { font-weight: bold; font-size: 15px; padding-top: 8px; }
                table.summary td.amount { text-align: right; }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(view.stallName)}</h1>
            <div class="meta">
                Order #${view.orderID} &middot; Queue ${view.queueNumber} &middot; ${view.status}<br />
                Paid by ${view.paymentMethod} &middot; Payment ${view.paymentStatus}
            </div>

            <h2>Items</h2>
            <table class="items">${view.items.map(renderLineItemRow).join("")}</table>

            ${addonsSection}

            <table class="summary">
                <tr><td>Base items</td><td class="amount">${formatCurrency(view.baseItemsTotal)}</td></tr>
                ${view.addons.length > 0 ? `<tr><td>Add-ons</td><td class="amount">${formatCurrency(view.addonsTotal)}</td></tr>` : ""}
                ${Number(view.packagingFee) > 0 ? `<tr><td>Packaging</td><td class="amount">${formatCurrency(view.packagingFee)}</td></tr>` : ""}
                <tr><td>GST</td><td class="amount">${formatCurrency(view.gstAmount)}</td></tr>
                <tr class="total"><td>Total</td><td class="amount">${formatCurrency(view.totalAmount)}</td></tr>
            </table>
        </body>
        </html>
    `;
}

// GET /orders/:orderID/receipt/pdf
async function getOrderReceiptPdf(req, res) {
    try {
        const orderID = parseInt(req.params.orderID);

        const receipt = await orderModel.getOrderReceipt(orderID);
        if (!receipt) {
            return res.status(404).json({ error: "Order not found." });
        }

        // req.user.customerID is set by verifyJWT from the logged-in customer's token
        if (receipt.customerID !== req.user.customerID) {
            return res.status(403).json({ error: "Access denied. This order does not belong to you." });
        }

        const view = buildReceiptView(receipt);
        const html = renderReceiptHtml(view);
        const pdf = await pdfService.convertHtmlToPdf(html);

        if (!pdf.ok) {
            console.error("PDF service error:", pdf.error);
            return res.status(502).json({ error: "Could not generate the receipt PDF. Please try again later." });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="receipt-${orderID}.pdf"`);
        res.send(pdf.buffer);
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error generating receipt PDF." });
    }
}

module.exports = {
    submitOrder,
    getMyOrders,
    getOrderReceipt,
    getOrderReceiptPdf,
};
