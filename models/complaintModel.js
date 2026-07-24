const sql = require("mssql");
const dbConfig = require("../dbConfig");

async function createComplaint(customerID, stallID, category, description) {
    let connection;
    try {
        connection = await sql.connect(dbConfig)
        const query = `
            INSERT INTO Complaint (customerID, stallID, category, description)
            OUTPUT INSERTED.complaintID
            VALUES (@customerID, @stallID, @category, @description)
        `;
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("stallID", sql.Int, stallID);
        request.input("category", sql.VarChar(50), category);
        request.input("description", sql.VarChar(2000), description);
        const result = await request.query(query);

        return result.recordset[0].complaintID;
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
async function getComplaintsByCustomer(customerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT c.complaintID, c.stallID, s.stallName, c.category, c.description, c.status, c.createdAt, c.resolvedAt
            FROM Complaint c
            JOIN Stall s ON s.stallID = c.stallID
            WHERE c.customerID = @customerID
            ORDER BY c.createdAt DESC
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

async function getComplaintsByStall(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT c.complaintID, c.stallID, s.stallName, c.category, c.description, c.status, c.createdAt, c.resolvedAt, cu.firstName, cu.lastName
            FROM Complaint c
            JOIN Stall s ON s.stallID = c.stallID
            JOIN Customer cu ON cu.customerID = c.customerID
            WHERE c.stallID = @stallID
            ORDER BY c.createdAt DESC
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

// Get every complaint across all stalls, newest first (NEA officer oversight view).
// Each filter is optional; only the ones supplied are added to the WHERE clause, and
// their values always go in as bound parameters so the query stays injection-safe.
async function getAllComplaints({ status, stallID, category } = {}) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        let query = `
            SELECT c.complaintID, c.stallID, s.stallName, hc.name AS centreName, c.category, c.description,
                   c.status, c.createdAt, c.resolvedAt, cu.firstName, cu.lastName
            FROM Complaint c
            JOIN Stall s ON s.stallID = c.stallID
            JOIN HawkerCentre hc ON hc.centreID = s.centreID
            JOIN Customer cu ON cu.customerID = c.customerID
            WHERE 1 = 1
        `;
        const request = connection.request();

        if (status) {
            query += " AND c.status = @status";
            request.input("status", sql.VarChar(20), status);
        }
        if (stallID) {
            query += " AND c.stallID = @stallID";
            request.input("stallID", sql.Int, stallID);
        }
        if (category) {
            query += " AND c.category = @category";
            request.input("category", sql.VarChar(50), category);
        }

        query += " ORDER BY c.createdAt DESC";
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

// Get a complaint by its ID (used to confirm ownership before updating status)
async function getComplaintById(complaintID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT complaintID, customerID, stallID, category, description, status, createdAt, resolvedAt FROM Complaint WHERE complaintID = @complaintID";
        const request = connection.request();
        request.input("complaintID", sql.Int, complaintID);
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

// Update a complaint's status (used by stall owners and NEA officers to review/resolve
// complaints). resolvedAt is stamped when the complaint is closed off and cleared again
// if it is reopened, so the resolution date always matches the current status.
async function updateComplaintStatus(complaintID, status) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            UPDATE Complaint
            SET status = @status,
                resolvedAt = CASE WHEN @status IN ('resolved', 'closed') THEN GETDATE() ELSE NULL END
            WHERE complaintID = @complaintID`;
        const request = connection.request();
        request.input("complaintID", sql.Int, complaintID);
        request.input("status", sql.VarChar(20), status);
        const result = await request.query(query);

        return await getComplaintById(complaintID);
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
    createComplaint,
    getComplaintsByCustomer,
    getComplaintsByStall,
    getAllComplaints,
    getComplaintById,
    updateComplaintStatus
};