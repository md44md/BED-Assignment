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

module.exports = {
    createComplaint,
    getComplaintsByCustomer
};