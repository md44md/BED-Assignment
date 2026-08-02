// Unit tests for the hygiene grade controller (NEA officer: issue / view / update / revoke).
// The model is mocked, so no database connection happens -- these tests only check that the
// controller wires the guards, model calls, and responses together correctly.

jest.mock("../models/hygieneGradeModel");

const hygieneGradeModel = require("../models/hygieneGradeModel");
const hygieneGradeController = require("../controllers/hygieneGradeController");

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

describe("issueGrade", () => {
    const reqBody = { body: { stallID: 1, inspectionID: 1, grade: "A" } };

    test("issues a grade off a completed inspection and returns 201", async () => {
        hygieneGradeModel.getCompletedInspection.mockResolvedValue({ inspectionID: 1, stallID: 1 });
        hygieneGradeModel.createHygieneGrade.mockResolvedValue({ gradeID: 5, stallID: 1, grade: "A" });
        const res = mockRes();

        await hygieneGradeController.issueGrade(reqBody, res);

        expect(hygieneGradeModel.getCompletedInspection).toHaveBeenCalledWith(1, 1);
        // Server owns the dates: issued now, valid for a fixed period.
        expect(hygieneGradeModel.createHygieneGrade).toHaveBeenCalledWith(
            1, 1, "A", expect.any(Date), expect.any(Date)
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Hygiene grade issued successfully.",
            grade: { gradeID: 5, stallID: 1, grade: "A" },
        });
    });

    test("404s when there is no completed inspection for the stall", async () => {
        hygieneGradeModel.getCompletedInspection.mockResolvedValue(null);
        const res = mockRes();

        await hygieneGradeController.issueGrade(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(hygieneGradeModel.createHygieneGrade).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        hygieneGradeModel.getCompletedInspection.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await hygieneGradeController.issueGrade(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error issuing hygiene grade." });
    });
});

describe("getStallGrades", () => {
    test("returns the stall's grades with 200", async () => {
        const grades = [{ gradeID: 5, grade: "A" }];
        hygieneGradeModel.getGradesByStall.mockResolvedValue(grades);
        const res = mockRes();

        await hygieneGradeController.getStallGrades({ params: { stallID: "1" } }, res);

        expect(hygieneGradeModel.getGradesByStall).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ grades });
    });

    test("400s when the stall ID is not a number", async () => {
        const res = mockRes();

        await hygieneGradeController.getStallGrades({ params: { stallID: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(hygieneGradeModel.getGradesByStall).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        hygieneGradeModel.getGradesByStall.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await hygieneGradeController.getStallGrades({ params: { stallID: "1" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("updateGrade", () => {
    const reqUpdate = { params: { gradeID: "5" }, body: { grade: "B" } };

    test("updates the grade letter and returns 200, keeping the original expiry", async () => {
        hygieneGradeModel.getGradeById.mockResolvedValue({ gradeID: 5, grade: "A", expiryDate: "2027-01-01" });
        hygieneGradeModel.updateHygieneGrade.mockResolvedValue({ gradeID: 5, grade: "B" });
        const res = mockRes();

        await hygieneGradeController.updateGrade(reqUpdate, res);

        expect(hygieneGradeModel.updateHygieneGrade).toHaveBeenCalledWith(5, "B", "2027-01-01");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Hygiene grade updated successfully.",
            grade: { gradeID: 5, grade: "B" },
        });
    });

    test("400s when the grade ID is not a number", async () => {
        const res = mockRes();

        await hygieneGradeController.updateGrade({ params: { gradeID: "abc" }, body: { grade: "B" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(hygieneGradeModel.getGradeById).not.toHaveBeenCalled();
    });

    test("404s when the grade does not exist", async () => {
        hygieneGradeModel.getGradeById.mockResolvedValue(null);
        const res = mockRes();

        await hygieneGradeController.updateGrade(reqUpdate, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(hygieneGradeModel.updateHygieneGrade).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        hygieneGradeModel.getGradeById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await hygieneGradeController.updateGrade(reqUpdate, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("deleteGrade", () => {
    const reqDelete = { params: { gradeID: "5" } };

    test("revokes the grade and returns 200", async () => {
        hygieneGradeModel.getGradeById.mockResolvedValue({ gradeID: 5, grade: "A" });
        hygieneGradeModel.deleteHygieneGrade.mockResolvedValue({ gradeID: 5, grade: "A" });
        const res = mockRes();

        await hygieneGradeController.deleteGrade(reqDelete, res);

        expect(hygieneGradeModel.deleteHygieneGrade).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Hygiene grade revoked successfully.",
            grade: { gradeID: 5, grade: "A" },
        });
    });

    test("400s when the grade ID is not a number", async () => {
        const res = mockRes();

        await hygieneGradeController.deleteGrade({ params: { gradeID: "abc" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(hygieneGradeModel.getGradeById).not.toHaveBeenCalled();
    });

    test("404s when the grade does not exist", async () => {
        hygieneGradeModel.getGradeById.mockResolvedValue(null);
        const res = mockRes();

        await hygieneGradeController.deleteGrade(reqDelete, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(hygieneGradeModel.deleteHygieneGrade).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        hygieneGradeModel.getGradeById.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await hygieneGradeController.deleteGrade(reqDelete, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
