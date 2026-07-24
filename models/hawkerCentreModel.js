const sql = require("mssql");
const dbConfig = require("../dbConfig");

// All hawker centres with the fields needed to geocode and display them.
// Public reference data, so no owner/role filtering is applied here.
async function getAllHawkerCentres() {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT centreID, name, address, postalCode, region
            FROM HawkerCentre
            ORDER BY name
        `;
        const request = connection.request();
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
    getAllHawkerCentres,
};
