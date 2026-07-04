const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get stall belonging to a stall owner
async function getStallByOwnerID(stallOwnerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT stallID FROM Stall WHERE stallOwnerID = @stallOwnerID";
        const request = connection.request();
        request.input("stallOwnerID", sql.Int, stallOwnerID);
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

async function getMenuItemsByStallID(stallID) {
    let connection;
    try {
        const query = "SELECT menuItemID, stallID, name, description, price, category, isAvailable, isLowStock, imageURL FROM MenuItem WHERE stallID = @stallID";
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
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

async function getMenuItemById(id) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT menuItemID, stallID, name, description, price, category, isAvailable, isLowStock, imageURL FROM MenuItem WHERE menuItemID = @id";
        const request = connection.request();
        request.input("id", sql.Int, id);
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

// Create new menu item
async function createMenuItem(stallID, itemData) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "INSERT INTO MenuItem (stallID, name, description, price, category) VALUES (@stallID, @name, @description, @price, @category); SELECT SCOPE_IDENTITY() AS menuItemID;";
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        request.input("name", sql.VarChar(255), itemData.name);
        request.input("description", sql.VarChar(1000), itemData.description);
        request.input("price", sql.Decimal(10, 2), itemData.price);
        request.input("category", sql.VarChar(50), itemData.category);
        const result = await request.query(query);

        const newMenuItemID = result.recordset[0].menuItemID;
        return await getMenuItemById(newMenuItemID);
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

// Update menu item
async function updateMenuItem(id, itemData) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "UPDATE MenuItem SET name = @name, description = @description, price = @price, category = @category, isAvailable = @isAvailable WHERE menuItemID = @id";
        const request = connection.request();
        request.input("id", sql.Int, id);
        request.input("name", sql.VarChar(255), itemData.name);
        request.input("description", sql.VarChar(1000), itemData.description);
        request.input("price", sql.Decimal(10, 2), itemData.price);
        request.input("category", sql.VarChar(50), itemData.category);
        request.input("isAvailable", sql.Bit, itemData.isAvailable);
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return null;
        }

        return await getMenuItemById(id);
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

// Delete menu item
async function deleteMenuItem(id) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "DELETE FROM MenuItem WHERE menuItemID = @id";
        const request = connection.request();
        request.input("id", sql.Int, id);
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return null;
        }

        return true;
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
    getStallByOwnerID,
    getMenuItemsByStallID,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
};