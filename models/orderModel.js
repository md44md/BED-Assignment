const sql = require("mssql");
const crypto = require("crypto");
const dbConfig = require("../dbConfig");

// Get a cart by its ID (used to confirm ownership before checkout)
async function getCartById(cartID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT cartID, customerID, sessionID, stallID FROM Cart WHERE cartID = @cartID";
        const request = connection.request();
        request.input("cartID", sql.Int, cartID);
        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return null;
        }

        return result.recordset[0];
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

// Get cart items joined with menu info (used to snapshot itemName/unitPrice onto the order)
async function getCartItemsForOrder(cartID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT ci.cartItemID, ci.menuItemID, mi.name AS itemName, mi.price AS unitPrice,
                   ci.quantity, ci.notes, mi.isAvailable
            FROM CartItem ci
            JOIN MenuItem mi ON ci.menuItemID = mi.menuItemID
            WHERE ci.cartID = @cartID
        `;
        const request = connection.request();
        request.input("cartID", sql.Int, cartID);
        const result = await request.query(query);

        return result.recordset;
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

// Get the next queue number for a stall, resetting the count each day
async function getNextQueueNumber(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT MAX(queueNumber) AS maxQueueNumber
            FROM Orders
            WHERE stallID = @stallID AND CAST(createdAt AS DATE) = CAST(GETDATE() AS DATE)
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        const result = await request.query(query);

        const maxQueueNumber = result.recordset[0].maxQueueNumber;
        return (maxQueueNumber || 0) + 1;
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

// Insert Orders + OrderItem + Payment and clear the cart, all in one transaction
async function submitOrder(cart, items, paymentMethod, subtotal, packagingFee, gstAmount, totalAmount, queueNumber) {
    let connection;
    let transaction;
    try {
        connection = await sql.connect(dbConfig);
        transaction = new sql.Transaction(connection);
        await transaction.begin();

        const orderRequest = new sql.Request(transaction);
        orderRequest.input("customerID", sql.Int, cart.customerID);
        orderRequest.input("stallID", sql.Int, cart.stallID);
        orderRequest.input("queueNumber", sql.Int, queueNumber);
        orderRequest.input("paymentMethod", sql.VarChar(20), paymentMethod);
        orderRequest.input("subtotal", sql.Decimal(10, 2), subtotal);
        orderRequest.input("packagingFee", sql.Decimal(10, 2), packagingFee);
        orderRequest.input("gstAmount", sql.Decimal(10, 2), gstAmount);
        orderRequest.input("totalAmount", sql.Decimal(10, 2), totalAmount);
        const orderResult = await orderRequest.query(`
            INSERT INTO Orders (customerID, stallID, queueNumber, status, paymentMethod, paymentStatus, subtotal, packagingFee, gstAmount, totalAmount)
            OUTPUT INSERTED.orderID
            VALUES (@customerID, @stallID, @queueNumber, 'pending', @paymentMethod, 'pending', @subtotal, @packagingFee, @gstAmount, @totalAmount)
        `);
        const orderID = orderResult.recordset[0].orderID;

        for (const item of items) {
            const itemRequest = new sql.Request(transaction);
            itemRequest.input("orderID", sql.Int, orderID);
            itemRequest.input("menuItemID", sql.Int, item.menuItemID);
            itemRequest.input("itemName", sql.VarChar(255), item.itemName);
            itemRequest.input("unitPrice", sql.Decimal(10, 2), item.unitPrice);
            itemRequest.input("quantity", sql.Int, item.quantity);
            itemRequest.input("addons", sql.VarChar(500), item.notes);
            await itemRequest.query(`
                INSERT INTO OrderItem (orderID, menuItemID, itemName, unitPrice, quantity, addons)
                VALUES (@orderID, @menuItemID, @itemName, @unitPrice, @quantity, @addons)
            `);
        }

        // NETS/PayNow are recorded via a simulated transaction reference (no real
        // payment gateway is integrated here - see ticket assumptions). Cash has none.
        const transactionRef =
            paymentMethod === "NETS" || paymentMethod === "PayNow"
                ? `${paymentMethod.toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
                : null;

        const paymentRequest = new sql.Request(transaction);
        paymentRequest.input("orderID", sql.Int, orderID);
        paymentRequest.input("method", sql.VarChar(20), paymentMethod);
        paymentRequest.input("transactionRef", sql.VarChar(255), transactionRef);
        await paymentRequest.query(`
            INSERT INTO Payment (orderID, method, status, transactionRef)
            VALUES (@orderID, @method, 'pending', @transactionRef)
        `);

        const clearItemsRequest = new sql.Request(transaction);
        clearItemsRequest.input("cartID", sql.Int, cart.cartID);
        await clearItemsRequest.query("DELETE FROM CartItem WHERE cartID = @cartID");

        const clearCartRequest = new sql.Request(transaction);
        clearCartRequest.input("cartID", sql.Int, cart.cartID);
        await clearCartRequest.query("DELETE FROM Cart WHERE cartID = @cartID");

        await transaction.commit();

        return { orderID, queueNumber, totalAmount };
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Error rolling back transaction:", rollbackError);
            }
        }
        console.error("Database error:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

// Get a customer's past orders, each with its line items (most recent first)
async function getOrdersByCustomer(customerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);

        // Fetch the orders themselves, newest first, with the stall name for display
        const ordersRequest = connection.request();
        ordersRequest.input("customerID", sql.Int, customerID);
        const ordersResult = await ordersRequest.query(`
            SELECT o.orderID, o.stallID, s.stallName, o.queueNumber, o.status,
                   o.paymentMethod, o.paymentStatus, o.subtotal, o.packagingFee,
                   o.gstAmount, o.totalAmount, o.createdAt
            FROM Orders o
            JOIN Stall s ON o.stallID = s.stallID
            WHERE o.customerID = @customerID
            ORDER BY o.createdAt DESC
        `);

        const orders = ordersResult.recordset;
        if (orders.length === 0) {
            return [];
        }

        // Fetch all line items for those orders in one query, then group them per order
        const itemsRequest = connection.request();
        itemsRequest.input("customerID", sql.Int, customerID);
        const itemsResult = await itemsRequest.query(`
            SELECT oi.orderItemID, oi.orderID, oi.menuItemID, oi.itemName,
                   oi.unitPrice, oi.quantity, oi.addons, oi.itemTotal
            FROM OrderItem oi
            JOIN Orders o ON oi.orderID = o.orderID
            WHERE o.customerID = @customerID
        `);

        const itemsByOrder = {};
        for (const item of itemsResult.recordset) {
            if (!itemsByOrder[item.orderID]) {
                itemsByOrder[item.orderID] = [];
            }
            itemsByOrder[item.orderID].push(item);
        }

        return orders.map((order) => ({
            ...order,
            items: itemsByOrder[order.orderID] || [],
        }));
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

module.exports = {
    getCartById,
    getCartItemsForOrder,
    getNextQueueNumber,
    submitOrder,
    getOrdersByCustomer,
};
