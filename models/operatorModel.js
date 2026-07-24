const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if email exists in Users table for an operator, and get their operator profile
async function getUserByEmail(email) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = 
            "SELECT userID, email, passwordHash, role, isActive, profilePictureURL FROM Users WHERE email = @email AND role = 'operator'";
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

// Get operatorID for a given userID (used after login)
async function getOperatorByUserID(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query =
            "SELECT operatorID, firstName, lastName, phone FROM Operator WHERE userID = @userID";
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

// Get an operator's own profile (never includes passwordHash)
async function getAccountByUserID(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT u.email, u.isActive, u.profilePictureURL, o.firstName, o.lastName, o.phone
            FROM Users u
            JOIN Operator o ON o.userID = u.userID
            WHERE u.userID = @userID
        `;
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
    getOperatorByUserID,
    getAccountByUserID,
};