// Unit tests for the inspection controller — the officer features for updating
// a logged inspection (INS-02), scheduling an inspection, and viewing upcoming
// scheduled inspections. inspectionModel is mocked, so no database is touched.

jest.mock("../models/inspectionModel");

const inspectionModel = require("../models/inspectionModel");
const inspectionController = require("../controllers/inspectionController");

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

describe("updateInspection", () => {
    const existing = { inspectionID: 1, stallID: 1, score: 70, remarks: "Old", inspectionDate: new Date("2026-07-01") };
    const req = {
        params: { id: "1" },
        user: { officerID: 1 },
        body: { score: 85, remarks: "Re-checked; resolved.", inspectionDate: "2026-07-20" },
    };

    test("updates the inspection and returns 200 with the updated record", async () => {
        inspectionModel.getInspectionById.mockResolvedValue(existing);
        inspectionModel.updateInspection.mockResolvedValue({ ...existing, score: 85, remarks: "Re-checked; resolved." });
        const res = mockRes();

        await inspectionController.updateInspection(req, res);

        expect(inspectionModel.updateInspection).toHaveBeenCalledWith(1, 85, "Re-checked; resolved.", expect.any(Date));
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Inspection updated successfully." }));
    });

    test("keeps the existing date when the body omits inspectionDate", async () => {
        inspectionModel.getInspectionById.mockResolvedValue(existing);
        inspectionModel.updateInspection.mockResolvedValue(existing);
        const res = mockRes();

        await inspectionController.updateInspection({ ...req, body: { score: 90, remarks: "x" } }, res);

        expect(inspectionModel.updateInspection).toHaveBeenCalledWith(1, 90, "x", existing.inspectionDate);
    });

    test("400s when the inspection ID is not a number", async () => {
        const res = mockRes();

        await inspectionController.updateInspection({ ...req, params: { id: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(inspectionModel.getInspectionById).not.toHaveBeenCalled();
    });

    test("404s when the inspection does not exist", async () => {
        inspectionModel.getInspectionById.mockResolvedValue(null);
        const res = mockRes();

        await inspectionController.updateInspection(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(inspectionModel.updateInspection).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        inspectionModel.getInspectionById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await inspectionController.updateInspection(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("scheduleInspection", () => {
    // A clearly-future date so the "not in the past" check always passes.
    const futureDate = "2999-01-01";
    const req = { user: { officerID: 1 }, body: { stallID: 1, scheduledDate: futureDate } };

    test("schedules the inspection and returns 201", async () => {
        inspectionModel.stallExists.mockResolvedValue(true);
        inspectionModel.scheduleInspection.mockResolvedValue({ inspectionID: 5, stallID: 1, status: "scheduled" });
        const res = mockRes();

        await inspectionController.scheduleInspection(req, res);

        expect(inspectionModel.scheduleInspection).toHaveBeenCalledWith(1, 1, expect.any(Date));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Inspection scheduled successfully." }));
    });

    test("404s when the stall does not exist", async () => {
        inspectionModel.stallExists.mockResolvedValue(false);
        const res = mockRes();

        await inspectionController.scheduleInspection(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(inspectionModel.scheduleInspection).not.toHaveBeenCalled();
    });

    test("400s when the scheduled date is in the past", async () => {
        inspectionModel.stallExists.mockResolvedValue(true);
        const res = mockRes();

        await inspectionController.scheduleInspection(
            { user: { officerID: 1 }, body: { stallID: 1, scheduledDate: "2000-01-01" } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(inspectionModel.scheduleInspection).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        inspectionModel.stallExists.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await inspectionController.scheduleInspection(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getScheduledInspections", () => {
    const req = { user: { officerID: 1 } };

    test("returns the officer's scheduled inspections", async () => {
        const list = [{ inspectionID: 5, stallID: 1, scheduledDate: "2999-01-01", status: "scheduled" }];
        inspectionModel.getScheduledInspections.mockResolvedValue(list);
        const res = mockRes();

        await inspectionController.getScheduledInspections(req, res);

        expect(inspectionModel.getScheduledInspections).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ inspections: list });
    });

    test("500s when the database call fails", async () => {
        inspectionModel.getScheduledInspections.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await inspectionController.getScheduledInspections(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
