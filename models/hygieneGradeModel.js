const sql = require("mssql");
const dbConfig = require("../dbConfig");

// Return a completed inspection only if it exists AND belongs to the given stall.
// Used to enforce that a hygiene grade is issued only after a valid inspection.
async function getCompletedInspection(inspectionID, stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT inspectionID, stallID, status
            FROM Inspection
            WHERE inspectionID = @inspectionID
              AND stallID = @stallID
              AND status = 'completed'
        `;
        const request = connection.request();
        request.input("inspectionID", sql.Int, inspectionID);
        request.input("stallID", sql.Int, stallID);
        const result = await request.query(query);
        return result.recordset.length > 0 ? result.recordset[0] : null;
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

// Issue a new hygiene grade for a stall.
// Uses a transaction so that retiring the old grade and inserting the new one
// happens together; a stall is never left without an active grade.
async function createHygieneGrade(stallID, inspectionID, grade, issuedDate, expiryDate) {
    let connection;
    let transaction;
    try {
        connection = await sql.connect(dbConfig);

        // Start a transaction on this connection
        transaction = new sql.Transaction(connection);
        await transaction.begin();

        // Step 1: retire the stall's current active grade(s)
        const deactivateReq = new sql.Request(transaction);
        deactivateReq.input("stallID", sql.Int, stallID);
        await deactivateReq.query(
            "UPDATE HygieneGrade SET isActive = 0 WHERE stallID = @stallID AND isActive = 1"
        );

        // Step 2: insert the new active grade
        const insertReq = new sql.Request(transaction);
        insertReq.input("stallID", sql.Int, stallID);
        insertReq.input("inspectionID", sql.Int, inspectionID);
        insertReq.input("grade", sql.Char(1), grade);
        insertReq.input("issuedDate", sql.Date, issuedDate);
        insertReq.input("expiryDate", sql.Date, expiryDate);
        const result = await insertReq.query(`
            INSERT INTO HygieneGrade (stallID, inspectionID, grade, issuedDate, expiryDate, isActive)
            OUTPUT INSERTED.*
            VALUES (@stallID, @inspectionID, @grade, @issuedDate, @expiryDate, 1)
        `);

        // Both succeeded, commit the transaction
        await transaction.commit();
        return result.recordset[0];
    } catch (error) {
        // Something failed, rollback the transaction
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error("Rollback error:", rollbackErr);
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

// Read: a stall's full grade history, newest first.
// Public for customers to use to see a stall's food safety standard.
async function getGradesByStall(stallID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            SELECT gradeID, stallID, inspectionID, grade, issuedDate, expiryDate, isActive
            FROM HygieneGrade
            WHERE stallID = @stallID
            ORDER BY issuedDate DESC
        `;
        const request = connection.request();
        request.input("stallID", sql.Int, stallID);
        const result = await request.query(query);
        return result.recordset; // array; an empty array can be returned if no grades exist for the stall
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

// Read one grade by its ID (used to confirm a grade exists before update/delete)
async function getGradeById(gradeID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "SELECT * FROM HygieneGrade WHERE gradeID = @gradeID";
        const request = connection.request();
        request.input("gradeID", sql.Int, gradeID);
        const result = await request.query(query);
        return result.recordset.length > 0 ? result.recordset[0] : null;
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

// Update: correct an existing grade's letter and expiry date
async function updateHygieneGrade(gradeID, grade, expiryDate) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = `
            UPDATE HygieneGrade
            SET grade = @grade, expiryDate = @expiryDate
            OUTPUT INSERTED.*
            WHERE gradeID = @gradeID
        `;
        const request = connection.request();
        request.input("gradeID", sql.Int, gradeID);
        request.input("grade", sql.Char(1), grade);
        request.input("expiryDate", sql.Date, expiryDate);
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

// Delete: revoke a grade permanently
async function deleteHygieneGrade(gradeID) {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const query = "DELETE FROM HygieneGrade OUTPUT DELETED.* WHERE gradeID = @gradeID";
        const request = connection.request();
        request.input("gradeID", sql.Int, gradeID);
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
    getCompletedInspection,
    createHygieneGrade,
    getGradesByStall,
    getGradeById,
    updateHygieneGrade,
    deleteHygieneGrade,
};