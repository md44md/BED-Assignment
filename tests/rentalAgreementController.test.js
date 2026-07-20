// Unit tests for the rental agreement controller (stall owner viewing feature).
// rentalAgreementModel is mocked, so no database connection happens.

jest.mock("../models/rentalAgreementModel");

const rentalAgreementModel = require("../models/rentalAgreementModel");
const rentalAgreementController = require("../controllers/rentalAgreementController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

const mockReq = { user: { stallOwnerID: 1 } };

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getRentalAgreements", () => {
    test("returns the active agreements with a count", async () => {
        const agreements = [
            { agreementID: 2, stallID: 1, monthlyRent: 1300.0, status: "active" },
            { agreementID: 3, stallID: 2, monthlyRent: 1100.0, status: "active" },
        ];
        rentalAgreementModel.getActiveRentalAgreementsByStallOwnerID.mockResolvedValue(agreements);
        const res = mockRes();

        await rentalAgreementController.getRentalAgreements(mockReq, res);

        expect(rentalAgreementModel.getActiveRentalAgreementsByStallOwnerID).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ count: 2, rentalAgreements: agreements });
    });

    test("returns an empty list with count 0 when the owner has no active agreements", async () => {
        rentalAgreementModel.getActiveRentalAgreementsByStallOwnerID.mockResolvedValue([]);
        const res = mockRes();

        await rentalAgreementController.getRentalAgreements(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ count: 0, rentalAgreements: [] });
    });

    test("500s when the database call fails", async () => {
        rentalAgreementModel.getActiveRentalAgreementsByStallOwnerID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await rentalAgreementController.getRentalAgreements(mockReq, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error retrieving rental agreement details." });
    });
});
