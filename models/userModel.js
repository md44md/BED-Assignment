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
        const query = "SELECT userID, isActive FROM Users WHERE email = @email";
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

// Store a new password-reset token for a user, superseding any of their still-unused
// tokens (so at most one reset link is ever valid at a time). tokenHash is a SHA-256
// hash of the raw token emailed to the user - the raw value is never persisted.
async function createPasswordResetToken(userID, tokenHash, expiresAt) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);

        const invalidateRequest = connection.request();
        invalidateRequest.input("userID", sql.Int, userID);
        await invalidateRequest.query(`
            UPDATE PasswordResetToken SET usedAt = GETDATE()
            WHERE userID = @userID AND usedAt IS NULL
        `);

        const insertRequest = connection.request();
        insertRequest.input("userID", sql.Int, userID);
        insertRequest.input("tokenHash", sql.VarChar(255), tokenHash);
        insertRequest.input("expiresAt", sql.DateTime, expiresAt);
        await insertRequest.query(`
            INSERT INTO PasswordResetToken (userID, tokenHash, expiresAt)
            VALUES (@userID, @tokenHash, @expiresAt)
        `);
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

// Look up a still-valid (unused, unexpired) reset token by its hash. Returns null if
// the hash doesn't match any token, or the matching one is used/expired.
async function getValidPasswordResetToken(tokenHash) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT tokenID, userID
            FROM PasswordResetToken
            WHERE tokenHash = @tokenHash AND usedAt IS NULL AND expiresAt > GETDATE()
        `;
        const request = connection.request();
        request.input("tokenHash", sql.VarChar(255), tokenHash);
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

// Redeem a reset token: update the password and mark the token used in one transaction,
// so a crash between the two steps can never leave a token still replayable after the
// password has already changed.
async function redeemPasswordResetToken(tokenID, userID, passwordHash) {
    let connection;
    let transaction;
    try {
        connection = await sql.connect(dbConfig);
        transaction = new sql.Transaction(connection);
        await transaction.begin();

        const passwordRequest = new sql.Request(transaction);
        passwordRequest.input("userID", sql.Int, userID);
        passwordRequest.input("passwordHash", sql.VarChar(255), passwordHash);
        await passwordRequest.query(`
            UPDATE Users SET passwordHash = @passwordHash WHERE userID = @userID
        `);

        const tokenRequest = new sql.Request(transaction);
        tokenRequest.input("tokenID", sql.Int, tokenID);
        await tokenRequest.query(`
            UPDATE PasswordResetToken SET usedAt = GETDATE() WHERE tokenID = @tokenID
        `);

        await transaction.commit();
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Error rolling back transaction:", rollbackError);
            }
        }
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
    createPasswordResetToken,
    getValidPasswordResetToken,
    redeemPasswordResetToken,
};
