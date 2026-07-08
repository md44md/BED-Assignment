const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Get all active rental agreements for the stalls owned by a given stallOwnerID
async function getActiveRentalAgreementsByStallOwnerID(stallOwnerID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT
                ra.agreementID,
                ra.stallID,
                s.stallName,
                s.unitNumber,
                hc.centreID,
                hc.name AS centreName,
                hc.address AS centreAddress,
                ra.monthlyRent,
                ra.startDate,
                ra.endDate,
                ra.status,
                ra.notes,
                ra.createdAt
            FROM RentalAgreement ra
            INNER JOIN Stall s ON ra.stallID = s.stallID
            INNER JOIN HawkerCentre hc ON s.centreID = hc.centreID
            WHERE s.stallOwnerID = @stallOwnerID AND ra.status = 'active'
            ORDER BY s.stallID
        `;
        const request = connection.request();
        request.input("stallOwnerID", sql.Int, stallOwnerID);
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
    getActiveRentalAgreementsByStallOwnerID,
};