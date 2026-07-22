const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Check if email already exists in Users table
async function getUserByEmail(email) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT userID, email, passwordHash, role, isActive, profilePictureURL FROM Users WHERE email = @email AND role = 'stallOwner'";
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

// Insert into Users table, return new userID
async function createUser(email, passwordHash) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = 
            "INSERT INTO Users (email, passwordHash, role) VALUES (@email, @passwordHash, 'stallOwner'); SELECT SCOPE_IDENTITY() AS userID;";
        const request = connection.request();
        request.input("email", sql.VarChar(255), email);
        request.input("passwordHash", sql.VarChar(255), passwordHash);
        const result = await request.query(query);

        return result.recordset[0].userID;
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

// Insert into StallOwner table using the userID from createUser
async function createStallOwner(userID, firstName, lastName, phone) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query =
            "INSERT INTO StallOwner (userID, firstName, lastName, phone) VALUES (@userID, @firstName, @lastName, @phone); SELECT SCOPE_IDENTITY() AS stallOwnerID;";
        const request = connection.request();
        request.input("userID", sql.Int, userID);
        request.input("firstName", sql.VarChar(100), firstName);
        request.input("lastName", sql.VarChar(100), lastName);
        request.input("phone", sql.VarChar(20), phone);
        const result = await request.query(query);

        return result.recordset[0].stallOwnerID;
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

// Get stallOwnerID for a given userID (used after login)
async function getStallOwnerByUserID(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query =
        "SELECT stallOwnerID, firstName, lastName FROM StallOwner WHERE userID = @userID";
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

// Soft delete: mark the Users row inactive (StallOwner has no isActive column of its own)
async function deactivateAccount(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "UPDATE Users SET isActive = 0 WHERE userID = @userID";
        const request = connection.request();
        request.input("userID", sql.Int, userID);
        await request.query(query);
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

// Get a stall owner's own profile (never includes passwordHash)
async function getAccountByUserID(userID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT u.email, u.isActive, u.profilePictureURL, s.firstName, s.lastName, s.phone
            FROM Users u
            JOIN StallOwner s ON s.userID = u.userID
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
    createUser,
    createStallOwner,
    getStallOwnerByUserID,
    deactivateAccount,
    getAccountByUserID,
};