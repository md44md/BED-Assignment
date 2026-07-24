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
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT mi.menuItemID, mi.stallID, mi.name, mi.description, mi.price, mi.category,
                   mi.isAvailable, mi.isLowStock, mi.imageURL,
                   (SELECT COUNT(*) FROM MenuItemLike mil WHERE mil.menuItemID = mi.menuItemID) AS likeCount
            FROM MenuItem mi
            WHERE mi.stallID = @stallID
        `;
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
// imageURL is optional — it's null when the vendor didn't attach a photo,
// and the Cloudinary secure_url when they did.
async function createMenuItem(stallID, itemData, imageURL) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "INSERT INTO MenuItem (stallID, name, description, price, category, imageURL) VALUES (@stallID, @name, @description, @price, @category, @imageURL); SELECT SCOPE_IDENTITY() AS menuItemID;";
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        request.input("name", sql.VarChar(255), itemData.name);
        request.input("description", sql.VarChar(1000), itemData.description);
        request.input("price", sql.Decimal(10, 2), itemData.price);
        request.input("category", sql.VarChar(50), itemData.category);
        request.input("imageURL", sql.VarChar(500), imageURL);
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
// imageURL is null when the vendor didn't upload a new photo on this edit —
// COALESCE keeps whatever image the item already had instead of wiping it out.
async function updateMenuItem(id, itemData, imageURL) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "UPDATE MenuItem SET name = @name, description = @description, price = @price, category = @category, isAvailable = @isAvailable, imageURL = COALESCE(@imageURL, imageURL) WHERE menuItemID = @id";
        const request = connection.request();
        request.input("id", sql.Int, id);
        request.input("name", sql.VarChar(255), itemData.name);
        request.input("description", sql.VarChar(1000), itemData.description);
        request.input("price", sql.Decimal(10, 2), itemData.price);
        request.input("category", sql.VarChar(50), itemData.category);
        request.input("isAvailable", sql.Bit, itemData.isAvailable);
        request.input("imageURL", sql.VarChar(500), imageURL);
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

// Check if a customer already has a like on this item
async function getLike(customerID, menuItemID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT likeID FROM MenuItemLike WHERE customerID = @customerID AND menuItemID = @menuItemID";
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
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

// Insert a like row
async function likeMenuItem(customerID, menuItemID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "INSERT INTO MenuItemLike (customerID, menuItemID) VALUES (@customerID, @menuItemID)";
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("menuItemID", sql.Int, menuItemID);
        await request.query(query);
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

// Delete a like row
async function unlikeMenuItem(customerID, menuItemID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "DELETE FROM MenuItemLike WHERE customerID = @customerID AND menuItemID = @menuItemID";
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("menuItemID", sql.Int, menuItemID);
        await request.query(query);
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

// Fresh like count for one item, returned after a like/unlike so the UI updates immediately
async function getLikeCountByMenuItemID(menuItemID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT COUNT(*) AS likeCount FROM MenuItemLike WHERE menuItemID = @menuItemID";
        const request = connection.request();
        request.input("menuItemID", sql.Int, menuItemID);
        const result = await request.query(query);

        return result.recordset[0].likeCount;
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

// All menuItemIDs a customer has liked, across every stall
async function getLikedMenuItemIDsByCustomer(customerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT menuItemID FROM MenuItemLike WHERE customerID = @customerID";
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        const result = await request.query(query);

        return result.recordset.map((row) => row.menuItemID);
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
    getLike,
    likeMenuItem,
    unlikeMenuItem,
    getLikeCountByMenuItemID,
    getLikedMenuItemIDsByCustomer,
};