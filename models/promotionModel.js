const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get stall belonging to a stall owner
async function getStallByOwnerID(stallOwnerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT stallID, stallName FROM Stall WHERE stallOwnerID = @stallOwnerID";
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

// Repeat customers of a stall — everyone who has placed an order there before,
// with the contact details needed to email them about a new promotion. Guest
// orders (NULL customerID) are dropped by the INNER JOIN; soft-deleted customers
// are excluded so we don't email closed accounts.
async function getCustomersByStallID(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT DISTINCT c.customerID, c.firstName, u.email
            FROM Orders o
            INNER JOIN Customer c ON o.customerID = c.customerID
            INNER JOIN Users u ON c.userID = u.userID
            WHERE o.stallID = @stallID AND c.isActive = 1
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

async function getPromotionsByStallID(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT promotionID, stallID, title, description, discountType, discountValue,
                   startDate, endDate, isActive, createdAt
            FROM Promotion
            WHERE stallID = @stallID
            ORDER BY createdAt DESC
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

async function getPromotionById(id) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT promotionID, stallID, title, description, discountType, discountValue,
                   startDate, endDate, isActive, createdAt
            FROM Promotion
            WHERE promotionID = @id
        `;
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

// Create new promotion. startDate/endDate are optional per the user story.
async function createPromotion(stallID, promotionData) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            INSERT INTO Promotion (stallID, title, description, discountType, discountValue, startDate, endDate)
            VALUES (@stallID, @title, @description, @discountType, @discountValue, @startDate, @endDate);
            SELECT SCOPE_IDENTITY() AS promotionID;
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        request.input("title", sql.VarChar(255), promotionData.title);
        request.input("description", sql.VarChar(1000), promotionData.description || null);
        request.input("discountType", sql.VarChar(20), promotionData.discountType);
        request.input("discountValue", sql.Decimal(10, 2), promotionData.discountValue);
        request.input("startDate", sql.Date, promotionData.startDate || null);
        request.input("endDate", sql.Date, promotionData.endDate || null);
        const result = await request.query(query);

        const newPromotionID = result.recordset[0].promotionID;
        return await getPromotionById(newPromotionID);
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

// Edit promotion. Also carries isActive, so activating/deactivating goes
// through this same endpoint rather than a separate route.
async function updatePromotion(id, promotionData) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            UPDATE Promotion
            SET title = @title, description = @description, discountType = @discountType,
                discountValue = @discountValue, startDate = @startDate, endDate = @endDate,
                isActive = @isActive
            WHERE promotionID = @id
        `;
        const request = connection.request();
        request.input("id", sql.Int, id);
        request.input("title", sql.VarChar(255), promotionData.title);
        request.input("description", sql.VarChar(1000), promotionData.description || null);
        request.input("discountType", sql.VarChar(20), promotionData.discountType);
        request.input("discountValue", sql.Decimal(10, 2), promotionData.discountValue);
        request.input("startDate", sql.Date, promotionData.startDate || null);
        request.input("endDate", sql.Date, promotionData.endDate || null);
        request.input("isActive", sql.Bit, promotionData.isActive);
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return null;
        }

        return await getPromotionById(id);
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

async function deletePromotion(id) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "DELETE FROM Promotion WHERE promotionID = @id";
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
    getCustomersByStallID,
    getPromotionsByStallID,
    getPromotionById,
    createPromotion,
    updatePromotion,
    deletePromotion,
};
