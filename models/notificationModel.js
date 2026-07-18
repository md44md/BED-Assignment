const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Record a notification that was sent to a customer. `status` reflects the
// third-party delivery result ('sent' or 'failed'), so the row doubles as a
// delivery log. Returns the new notificationID.
async function createNotification({ customerID, orderID, channel, title, message, status }) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            INSERT INTO Notification (customerID, orderID, channel, title, message, status)
            OUTPUT INSERTED.notificationID
            VALUES (@customerID, @orderID, @channel, @title, @message, @status)
        `;
        const request = connection.request();
        request.input("customerID", sql.Int, customerID);
        request.input("orderID", sql.Int, orderID);
        request.input("channel", sql.VarChar(20), channel);
        request.input("title", sql.VarChar(255), title);
        request.input("message", sql.VarChar(1000), message);
        request.input("status", sql.VarChar(20), status);
        const result = await request.query(query);

        return result.recordset[0].notificationID;
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
    createNotification,
};
