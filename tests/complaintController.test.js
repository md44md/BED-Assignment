// Unit tests for the complaint controller: customer complaint submission/viewing,
// and stall owner complaint viewing/status updates. complaintModel and stallModel
// are both mocked, so no database connection happens.

jest.mock("../models/complaintModel");
jest.mock("../models/stallModel");

const complaintModel = require("../models/complaintModel");
const stallModel = require("../models/stallModel");
const complaintController = require("../controllers/complaintController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("createComplaint", () => {
    const req = {
        user: { customerID: 1 },
        body: { stallID: 3, category: "Hygiene", description: "Cooking area was unclean." },
    };

    test("creates the complaint and returns 201 with the new complaintID", async () => {
        stallModel.getStallById.mockResolvedValue({ stallID: 3, stallName: "Lao Wang Char Kway Teow" });
        complaintModel.createComplaint.mockResolvedValue(4);
        const res = mockRes();

        await complaintController.createComplaint(req, res);

        expect(complaintModel.createComplaint).toHaveBeenCalledWith(1, 3, "Hygiene", "Cooking area was unclean.");
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Complaint submitted successfully.",
            complaintID: 4,
        });
    });

    test("404s when the stall being complained about does not exist", async () => {
        stallModel.getStallById.mockResolvedValue(null);
        const res = mockRes();

        await complaintController.createComplaint(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(complaintModel.createComplaint).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        stallModel.getStallById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await complaintController.createComplaint(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getComplaintsByCustomer", () => {
    test("returns the customer's complaints", async () => {
        const complaints = [{ complaintID: 1, stallID: 3, status: "underReview" }];
        complaintModel.getComplaintsByCustomer.mockResolvedValue(complaints);
        const res = mockRes();

        await complaintController.getComplaintsByCustomer({ user: { customerID: 1 } }, res);

        expect(complaintModel.getComplaintsByCustomer).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith(complaints);
    });

    test("500s when the database call fails", async () => {
        complaintModel.getComplaintsByCustomer.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await complaintController.getComplaintsByCustomer({ user: { customerID: 1 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getComplaintsByStall", () => {
    const req = { user: { stallOwnerID: 1 } };

    test("returns the stall's complaints with a count", async () => {
        stallModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        const complaints = [{ complaintID: 3, stallID: 1, status: "resolved" }];
        complaintModel.getComplaintsByStall.mockResolvedValue(complaints);
        const res = mockRes();

        await complaintController.getComplaintsByStall(req, res);

        expect(complaintModel.getComplaintsByStall).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ count: 1, complaints });
    });

    test("404s when the account has no stall", async () => {
        stallModel.getStallByOwnerID.mockResolvedValue(null);
        const res = mockRes();

        await complaintController.getComplaintsByStall(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(complaintModel.getComplaintsByStall).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        stallModel.getStallByOwnerID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await complaintController.getComplaintsByStall(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("updateComplaintStatus", () => {
    const req = {
        params: { complaintID: "1" },
        user: { stallOwnerID: 1 },
        body: { status: "resolved" },
    };

    test("updates the status when the complaint belongs to the requesting stall owner's stall", async () => {
        complaintModel.getComplaintById.mockResolvedValue({ complaintID: 1, stallID: 1, status: "open" });
        stallModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        complaintModel.updateComplaintStatus.mockResolvedValue({ complaintID: 1, stallID: 1, status: "resolved" });
        const res = mockRes();

        await complaintController.updateComplaintStatus(req, res);

        expect(complaintModel.updateComplaintStatus).toHaveBeenCalledWith(1, "resolved");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Complaint status updated successfully.",
            complaint: { complaintID: 1, stallID: 1, status: "resolved" },
        });
    });

    test("400s when the complaint ID in the URL is not a number", async () => {
        const res = mockRes();

        await complaintController.updateComplaintStatus({ ...req, params: { complaintID: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(complaintModel.getComplaintById).not.toHaveBeenCalled();
    });

    test("404s when the complaint does not exist", async () => {
        complaintModel.getComplaintById.mockResolvedValue(null);
        const res = mockRes();

        await complaintController.updateComplaintStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(complaintModel.updateComplaintStatus).not.toHaveBeenCalled();
    });

    test("403s when the complaint was raised against a different stall owner's stall", async () => {
        complaintModel.getComplaintById.mockResolvedValue({ complaintID: 1, stallID: 5, status: "open" });
        stallModel.getStallByOwnerID.mockResolvedValue({ stallID: 1 });
        const res = mockRes();

        await complaintController.updateComplaintStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(complaintModel.updateComplaintStatus).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        complaintModel.getComplaintById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await complaintController.updateComplaintStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
