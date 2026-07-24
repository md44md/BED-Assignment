const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Update the shared Users.profilePictureURL column — role-agnostic, works for any account.
async function updateProfilePicture(userID, profilePictureURL) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            UPDATE Users SET profilePictureURL = @profilePictureURL
            OUTPUT INSERTED.profilePictureURL
            WHERE userID = @userID
        `;
        const request = connection.request();
        request.input("userID", sql.Int, userID);
        request.input("profilePictureURL", sql.VarChar(500), profilePictureURL);
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

// Fetch a user's own credentials by userID (role-agnostic). Used to confirm the
// current password before an email change. Returns null if no such user.
async function getUserByUserID(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT userID, email, passwordHash FROM Users WHERE userID = @userID";
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

// Check whether an email is already taken by ANY account. Users.email is UNIQUE
// across every role, so this lookup is deliberately NOT role-scoped (unlike the
// per-role getUserByEmail). Returns the row (or null) so a caller can compare userIDs.
async function getUserByEmailGlobal(email) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT userID FROM Users WHERE email = @email";
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

// Update the shared Users.email column — role-agnostic, works for any account.
async function updateEmail(userID, newEmail) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            UPDATE Users SET email = @email
            OUTPUT INSERTED.email
            WHERE userID = @userID
        `;
        const request = connection.request();
        request.input("userID", sql.Int, userID);
        request.input("email", sql.VarChar(255), newEmail);
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
    updateProfilePicture,
    getUserByUserID,
    getUserByEmailGlobal,
    updateEmail,
};
