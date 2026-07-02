const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if a stallID exists
async function stallExists(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT stallID FROM Stall WHERE stallID = @stallID";
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        const result = await request.query(query);
        return result.recordset.length > 0;
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

// Insert a completed inspection record for a stall, logged by the given officer
async function createInspection(stallID, officerID, score, remarks, inspectionDate) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            INSERT INTO Inspection (stallID, officerID, inspectionDate, score, remarks, status)
            OUTPUT INSERTED.*
            VALUES (@stallID, @officerID, @inspectionDate, @score, @remarks, 'completed')
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        request.input("officerID", sql.Int, officerID);
        request.input("inspectionDate", sql.Date, inspectionDate);
        request.input("score", sql.Int, score);
        request.input("remarks", sql.VarChar(2000), remarks);
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

// Get a single inspection by its ID (used to confirm a logged inspection)
async function getInspectionById(inspectionID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT * FROM Inspection WHERE inspectionID = @inspectionID";
        const request = connection.request();
        request.input("inspectionID", sql.Int, inspectionID);
        const result = await request.query(query);
        if (result.recordset.length === 0) return null;
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
    stallExists, 
    createInspection, 
    getInspectionById,
};