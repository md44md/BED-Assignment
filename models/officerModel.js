const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if email exists in Users table for an NEA Officer, and get their officer profile
async function getUserByEmail(email) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = 
            "SELECT userID, email, passwordHash, role, isActive FROM Users WHERE email = @email AND role = 'neaOfficer'";
        const request = connection.request();
        request.input("email", sql.VarChar(255), email);
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

// Get officerID for a given userID (used after login)
async function getOfficerByUserID(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query =
            "SELECT officerID, firstName, lastName, badgeNumber, department FROM NEAOfficer WHERE userID = @userID";
        const request = connection.request();
        request.input("userID", sql.Int, userID);
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

module.exports = {
    getUserByEmail,
    getOfficerByUserID,
};