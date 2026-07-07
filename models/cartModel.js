const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get the customer's existing cart for a stall, if any
async function getCartByCustomerAndStall(customerID, stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT cartID FROM Cart WHERE customerID = @customerID AND stallID = @stallID";
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("stallID", sql.Int, stallID);
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

// Create a new cart for the customer at a stall
async function createCart(customerID, stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query =
            "INSERT INTO Cart (customerID, stallID) VALUES (@customerID, @stallID); SELECT SCOPE_IDENTITY() AS cartID;";
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("stallID", sql.Int, stallID);
        const result = await request.query(query);

        return { cartID: result.recordset[0].cartID };
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

// Check if a menu item is already in the cart
async function getCartItem(cartID, menuItemID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT cartItemID, quantity FROM CartItem WHERE cartID = @cartID AND menuItemID = @menuItemID";
        const request = connection.request();
        request.input("cartID", sql.Int, cartID);
        request.input("menuItemID", sql.Int, menuItemID);
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

// Insert a new cart item
async function addCartItem(cartID, menuItemID, quantity, notes) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            INSERT INTO CartItem (cartID, menuItemID, quantity, notes)
            OUTPUT INSERTED.*
            VALUES (@cartID, @menuItemID, @quantity, @notes)
        `;
        const request = connection.request();
        request.input("cartID", sql.Int, cartID);
        request.input("menuItemID", sql.Int, menuItemID);
        request.input("quantity", sql.Int, quantity);
        request.input("notes", sql.VarChar(500), notes || null);
        const result = await request.query(query);
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

// Update the quantity of an existing cart item
async function updateCartItemQuantity(cartItemID, quantity) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            UPDATE CartItem
            SET quantity = @quantity
            OUTPUT INSERTED.*
            WHERE cartItemID = @cartItemID
        `;
        const request = connection.request();
        request.input("cartItemID", sql.Int, cartItemID);
        request.input("quantity", sql.Int, quantity);
        const result = await request.query(query);
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

module.exports = {
    getCartByCustomerAndStall,
    createCart,
    getCartItem,
    addCartItem,
    updateCartItemQuantity,
};
