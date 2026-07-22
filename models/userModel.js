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

module.exports = {
    updateProfilePicture,
};
