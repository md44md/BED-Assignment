const sql = require('mssql');
const dbConfig = require('../dbConfig');


async function getStallOwnedByOperator(stallID, operatorID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT s.stallID, s.stallName, hc.centreID, hc.name AS centreName
            FROM Stall s
            INNER JOIN HawkerCentre hc ON s.centreID = hc.centreID
            WHERE s.stallID = @stallID AND hc.operatorID = @operatorID
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        request.input("operatorID", sql.Int, operatorID);
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

// All stalls inside hawker centres managed by this operator
async function getStallsByOperatorID(operatorID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT s.stallID, s.stallName, s.unitNumber, s.status, hc.name AS centreName
            FROM Stall s
            INNER JOIN HawkerCentre hc ON s.centreID = hc.centreID
            WHERE hc.operatorID = @operatorID
            ORDER BY hc.name, s.stallName
        `;
        const request = connection.request();
        request.input("operatorID", sql.Int, operatorID);
        const result = await request.query(query);
        if (result.recordset.length === 0) {
            return null;
        }

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

// Overall sales summary for a stall (completed orders only)
async function getSalesSummaryByStallID(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT
                COUNT(orderID) AS totalOrders,
                ISNULL(SUM(totalAmount), 0) AS totalRevenue,
                ISNULL(AVG(totalAmount), 0) AS averageOrderValue
            FROM Orders
            WHERE stallID = @stallID AND status = 'completed'
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
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

// Top-selling menu items for a stall, ranked by quantity sold
async function getPopularItemsByStallID(stallID, topN = 5) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT TOP (@topN)
                mi.menuItemID,
                mi.name,
                mi.category,
                SUM(oi.quantity) AS totalQuantitySold,
                SUM(oi.unitPrice * oi.quantity) AS totalRevenue,
                COUNT(DISTINCT oi.orderID) AS orderCount
            FROM OrderItem oi
            INNER JOIN Orders o ON oi.orderID = o.orderID
            INNER JOIN MenuItem mi ON oi.menuItemID = mi.menuItemID
            WHERE o.stallID = @stallID AND o.status = 'completed'
            GROUP BY mi.menuItemID, mi.name, mi.category
            ORDER BY totalQuantitySold DESC
        `;
        const request = connection.request();
        request.input('stallID', sql.Int, stallID);
        request.input('topN', sql.Int, topN);
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

// Order volume by hour of day, to identify peak hours for a stall
async function getPeakHoursByStallID(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT
                DATEPART(HOUR, createdAt) AS hourOfDay,
                COUNT(orderID) AS orderCount,
                ISNULL(SUM(totalAmount), 0) AS totalRevenue
            FROM Orders
            WHERE stallID = @stallID AND status = 'completed'
            GROUP BY DATEPART(HOUR, createdAt)
            ORDER BY orderCount DESC
        `;
        const request = connection.request();
        request.input('stallID', sql.Int, stallID);
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

module.exports = {
    getStallOwnedByOperator,
    getStallsByOperatorID,
    getSalesSummaryByStallID,
    getPopularItemsByStallID,
    getPeakHoursByStallID
};