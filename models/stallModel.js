const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get every stall, with its hawker centre name, for populating stall pickers.
// Public data — used by the hygiene grade front-end so users choose a stall by
// name instead of typing a raw ID.
async function getAllStalls() {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT s.stallID, s.stallName, s.unitNumber, s.status, hc.name AS centreName
            FROM Stall s
            INNER JOIN HawkerCentre hc ON s.centreID = hc.centreID
            ORDER BY hc.name, s.stallName
        `;
        const request = connection.request();
        const result = await request.query(query);
        return result.recordset; // array; empty array if no stalls exist
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

// Get stall belonging to a stall owner
async function getStallByOwnerID(stallOwnerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT stallID, status FROM Stall WHERE stallOwnerID = @stallOwnerID";
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

// Update a stall's status (open/busy/closed)
async function updateStallStatus(stallID, status) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query =
            "UPDATE Stall SET status = @status WHERE stallID = @stallID; SELECT stallID, status FROM Stall WHERE stallID = @stallID;";
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        request.input("status", sql.VarChar(20), status);
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
    getAllStalls,
    getStallByOwnerID,
    updateStallStatus,
};
