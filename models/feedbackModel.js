const sql = require("mssql");
const dbConfig = require("../dbConfig");

// CUSTOMERS

// Get an order's ownership/stall/status info (used to check feedback eligibility)
async function getOrderForFeedback(orderID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT orderID, customerID, stallID, status, paymentStatus FROM Orders WHERE orderID = @orderID";
        const request = connection.request();
        request.input("orderID", sql.Int, orderID);
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

// Check if a customer already has a review for a stall
async function getFeedbackByCustomerAndStall(customerID, stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT feedbackID FROM Feedback WHERE customerID = @customerID AND stallID = @stallID";
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

// Insert a new feedback row, return the new feedbackID
async function createFeedback(customerID, stallID, orderID, rating, comments) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            INSERT INTO Feedback (customerID, stallID, orderID, rating, comments)
            OUTPUT INSERTED.feedbackID
            VALUES (@customerID, @stallID, @orderID, @rating, @comments)
        `;
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("stallID", sql.Int, stallID);
        request.input("orderID", sql.Int, orderID);
        request.input("rating", sql.Int, rating);
        request.input("comments", sql.VarChar(2000), comments);
        const result = await request.query(query);

        return result.recordset[0].feedbackID;
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

// Get a feedback row by its ID (used to confirm ownership before editing)
async function getFeedbackById(feedbackID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT feedbackID, customerID, stallID, orderID, rating, comments FROM Feedback WHERE feedbackID = @feedbackID";
        const request = connection.request();
        request.input("feedbackID", sql.Int, feedbackID);
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

// Get all of a customer's own feedback, with the stall name joined in
async function getFeedbackByCustomer(customerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT f.feedbackID, f.stallID, s.stallName, f.orderID, f.rating, f.comments, f.createdAt
            FROM Feedback f
            JOIN Stall s ON s.stallID = f.stallID
            WHERE f.customerID = @customerID
            ORDER BY f.createdAt DESC
        `;
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
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

// Update the rating/comments on an existing feedback row
async function updateFeedback(feedbackID, rating, comments) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "UPDATE Feedback SET rating = @rating, comments = @comments WHERE feedbackID = @feedbackID";
        const request = connection.request();
        request.input("feedbackID", sql.Int, feedbackID);
        request.input("rating", sql.Int, rating);
        request.input("comments", sql.VarChar(2000), comments);
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

// STALL OWNERS

// Get all feedback/ratings left for a stall (used by stall owners to review satisfaction)
async function getFeedbackByStallID(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT f.feedbackID, f.customerID, cu.firstName, cu.lastName, f.orderID, f.rating, f.comments, f.createdAt
            FROM Feedback f
            JOIN Customer cu ON cu.customerID = f.customerID
            WHERE f.stallID = @stallID
            ORDER BY f.createdAt DESC
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

// Satisfaction summary for a stall: total review count and average rating
async function getSatisfactionSummaryByStallID(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT
                COUNT(feedbackID) AS totalReviews,
                ISNULL(AVG(CAST(rating AS DECIMAL(3,2))), 0) AS averageRating
            FROM Feedback
            WHERE stallID = @stallID
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

module.exports = {
    getOrderForFeedback,
    getFeedbackByCustomerAndStall,
    createFeedback,
    getFeedbackById,
    getFeedbackByCustomer,
    updateFeedback,
    getFeedbackByStallID,
    getSatisfactionSummaryByStallID,
};
