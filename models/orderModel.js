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

// Get a single order (with its items) by ID — used to rebuild a cart on reorder
async function getOrderWithItemsById(orderID) {
// Get one order's full itemized receipt: order + fee breakdown + line items, each tagged
// with its menu category so the caller can separate priced add-ons from base dishes/drinks.
// Returns null if the order doesn't exist (ownership is checked by the caller, which needs
// customerID from the returned row to do it).
async function getOrderReceipt(orderID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);

        const orderRequest = connection.request();
        orderRequest.input("orderID", sql.Int, orderID);
        const orderResult = await orderRequest.query(`
            SELECT orderID, customerID, stallID FROM Orders WHERE orderID = @orderID
        `);
            SELECT o.orderID, o.customerID, o.stallID, s.stallName, o.queueNumber, o.status,
                   o.paymentMethod, o.paymentStatus, o.subtotal, o.packagingFee,
                   o.gstAmount, o.totalAmount, o.createdAt
            FROM Orders o
            JOIN Stall s ON o.stallID = s.stallID
            WHERE o.orderID = @orderID
        `);

        if (orderResult.recordset.length === 0) {
            return null;
        }
        const order = orderResult.recordset[0];

        const itemsRequest = connection.request();
        itemsRequest.input("orderID", sql.Int, orderID);
        const itemsResult = await itemsRequest.query(`
            SELECT menuItemID, itemName, quantity, addons
            FROM OrderItem
            WHERE orderID = @orderID
            SELECT oi.orderItemID, oi.menuItemID, oi.itemName, oi.unitPrice,
                   oi.quantity, oi.addons, oi.itemTotal, mi.category
            FROM OrderItem oi
            JOIN MenuItem mi ON oi.menuItemID = mi.menuItemID
            WHERE oi.orderID = @orderID
            ORDER BY oi.orderItemID
        `);

        return { ...order, items: itemsResult.recordset };
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

// Get today's active queue for a stall (not yet completed/abandoned), lowest queue number first.
// The head of this list is the "current customer"; the rest are those waiting behind them.
async function getCurrentQueue(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT orderID, customerID, queueNumber, status, createdAt
            FROM Orders
            WHERE stallID = @stallID
              AND status IN ('pending', 'preparing', 'ready')
              AND CAST(createdAt AS DATE) = CAST(GETDATE() AS DATE)
            ORDER BY queueNumber ASC
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        const result = await request.query(query);

        return result.recordset; // array; empty if the queue is clear
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

// Serve the current customer (mark the head order 'completed') and return the order that
// becomes the new head of the queue. Done in one transaction so the queue can't half-advance.
async function advanceQueue(stallID) {
    let connection;
    let transaction;
    try {
        connection = await sql.connect(dbConfig);
        transaction = new sql.Transaction(connection);
        await transaction.begin();

        // Find the current customer: lowest queue number among today's active orders
        const headRequest = new sql.Request(transaction);
        headRequest.input("stallID", sql.Int, stallID);
        const headResult = await headRequest.query(`
            SELECT TOP 1 orderID, customerID, queueNumber, status
            FROM Orders
            WHERE stallID = @stallID
              AND status IN ('pending', 'preparing', 'ready')
              AND CAST(createdAt AS DATE) = CAST(GETDATE() AS DATE)
            ORDER BY queueNumber ASC
        `);

        // Nothing to serve — leave the transaction to roll back and signal an empty queue
        if (headResult.recordset.length === 0) {
            await transaction.rollback();
            return null;
        }
        const servedOrder = headResult.recordset[0];

        // Mark the current customer as served
        const serveRequest = new sql.Request(transaction);
        serveRequest.input("orderID", sql.Int, servedOrder.orderID);
        await serveRequest.query(`
            UPDATE Orders
            SET status = 'completed', updatedAt = GETDATE()
            WHERE orderID = @orderID
        `);

        // The row was read before the update, so its status is still the pre-serve value.
        servedOrder.status = "completed";

        // Find who is next in line after advancing, joining through to the customer's
        // email and the stall name so the caller can notify them (third-party email).
        const nextRequest = new sql.Request(transaction);
        nextRequest.input("stallID", sql.Int, stallID);
        const nextResult = await nextRequest.query(`
            SELECT TOP 1 o.orderID, o.customerID, o.queueNumber, o.status,
                   u.email AS customerEmail, c.firstName AS customerFirstName,
                   s.stallName
            FROM Orders o
            JOIN Customer c ON o.customerID = c.customerID
            JOIN Users u ON c.userID = u.userID
            JOIN Stall s ON o.stallID = s.stallID
            WHERE o.stallID = @stallID
              AND o.status IN ('pending', 'preparing', 'ready')
              AND CAST(o.createdAt AS DATE) = CAST(GETDATE() AS DATE)
            ORDER BY o.queueNumber ASC
        `);

        await transaction.commit();

        return {
            servedOrder,
            nextOrder: nextResult.recordset[0] || null, // null when the queue is now empty
        };
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

module.exports = {
    getCartById,
    getCartItemsForOrder,
    getNextQueueNumber,
    submitOrder,
    getOrdersByCustomer,
    getOrderWithItemsById,
    getOrderReceipt,
    getCurrentQueue,
    advanceQueue,
};
