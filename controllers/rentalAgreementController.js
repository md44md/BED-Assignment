const rentalAgreementModel = require("../models/rentalAgreementModel");

// GET /rental-agreements
async function getRentalAgreements(req, res) {
    try {
        const stallOwnerID = req.user.stallOwnerID;

        const agreements = await rentalAgreementModel.getActiveRentalAgreementsByStallOwnerID(stallOwnerID);

        res.status(200).json({
            count: agreements.length,
            rentalAgreements: agreements,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving rental agreement details." });
    }
}

module.exports = {
    getRentalAgreements,
};