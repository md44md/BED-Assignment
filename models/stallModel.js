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

module.exports = {
    getAllStalls,
};
