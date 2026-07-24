// Unit tests for the NEA officer complaint controller: viewing complaints across every
// stall (with optional filters) and recording follow-up action on one. complaintModel is
// mocked, so no database connection happens and failure cases that are awkward to stage
// by hand (a dead database, a missing complaint) can be driven directly.

jest.mock("../models/complaintModel");

const complaintModel = require("../models/complaintModel");
const officerComplaintController = require("../controllers/officerComplaintController");

// Minimal stand-ins for Express's req/res. res records what the controller sent.
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// A complaint row as getAllComplaints actually returns it: the complaint fields plus the
// stall, hawker centre and complainant joined in.
const complaintRow = {
    complaintID: 1,
    stallID: 3,
    stallName: "Lao Wang Char Kway Teow",
    centreName: "Chinatown Complex",
    category: "Hygiene",
    description: "Noticed the cooking area was unclean during my visit.",
    status: "underReview",
    createdAt: "2026-07-20T10:00:00.000Z",
    resolvedAt: null,
    firstName: "Alice",
    lastName: "Tan",
};

beforeEach(() => {
    jest.clearAllMocks();
    // Silence the controller's console.error in expected-failure tests.
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getAllComplaints", () => {
    test("returns 200 with the complaint count and list", async () => {
        complaintModel.getAllComplaints.mockResolvedValue([complaintRow]);
        const res = mockRes();

        await officerComplaintController.getAllComplaints({ query: {} }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ count: 1, complaints: [complaintRow] });
    });

    test("passes every supplied filter through to the model", async () => {
        complaintModel.getAllComplaints.mockResolvedValue([complaintRow]);
        const req = { query: { status: "underReview", stallID: "3", category: "Hygiene" } };

        await officerComplaintController.getAllComplaints(req, mockRes());

        // stallID arrives as a string on the query, so it must reach the model as a number.
        expect(complaintModel.getAllComplaints).toHaveBeenCalledWith({
            status: "underReview",
            stallID: 3,
            category: "Hygiene",
        });
    });

    test("leaves filters undefined when no query string is given", async () => {
        complaintModel.getAllComplaints.mockResolvedValue([]);

        await officerComplaintController.getAllComplaints({ query: {} }, mockRes());

        expect(complaintModel.getAllComplaints).toHaveBeenCalledWith({
            status: undefined,
            stallID: undefined,
            category: undefined,
        });
    });

    test("returns an empty list (not a 404) when nothing matches", async () => {
        complaintModel.getAllComplaints.mockResolvedValue([]);
        const res = mockRes();

        await officerComplaintController.getAllComplaints({ query: { status: "closed" } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ count: 0, complaints: [] });
    });

    test("returns 500 when the database lookup fails", async () => {
        complaintModel.getAllComplaints.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await officerComplaintController.getAllComplaints({ query: {} }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error retrieving complaints." });
    });
});

describe("updateComplaintStatus", () => {
    const req = { params: { complaintID: "1" }, body: { status: "resolved" } };

    test("updates the status and returns 200 with the updated complaint", async () => {
        const updated = { ...complaintRow, status: "resolved", resolvedAt: "2026-07-23T09:00:00.000Z" };
        complaintModel.getComplaintById.mockResolvedValue(complaintRow);
        complaintModel.updateComplaintStatus.mockResolvedValue(updated);
        const res = mockRes();

        await officerComplaintController.updateComplaintStatus(req, res);

        expect(complaintModel.updateComplaintStatus).toHaveBeenCalledWith(1, "resolved");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Complaint status updated successfully.",
            complaint: updated,
        });
    });

    test("updates a complaint about any stall, since officers are not scoped to one", async () => {
        complaintModel.getComplaintById.mockResolvedValue({ ...complaintRow, stallID: 99 });
        complaintModel.updateComplaintStatus.mockResolvedValue({ ...complaintRow, stallID: 99, status: "resolved" });
        const res = mockRes();

        await officerComplaintController.updateComplaintStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("returns 400 when the complaint ID is not a number", async () => {
        const res = mockRes();

        await officerComplaintController.updateComplaintStatus(
            { params: { complaintID: "abc" }, body: { status: "resolved" } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Complaint ID must be a number." });
        expect(complaintModel.updateComplaintStatus).not.toHaveBeenCalled();
    });

    test("returns 404 when the complaint does not exist", async () => {
        complaintModel.getComplaintById.mockResolvedValue(null);
        const res = mockRes();

        await officerComplaintController.updateComplaintStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Complaint not found." });
        expect(complaintModel.updateComplaintStatus).not.toHaveBeenCalled();
    });

    test("returns 500 when the update fails", async () => {
        complaintModel.getComplaintById.mockResolvedValue(complaintRow);
        complaintModel.updateComplaintStatus.mockRejectedValue(new Error("db down"));
        const res = mockRes();

        await officerComplaintController.updateComplaintStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error updating complaint status." });
    });
});
