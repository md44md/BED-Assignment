// Unit tests for the hawker centre controller (nearby ranking + directions).
// hawkerCentreModel and the OneMap service are mocked, so no database
// connection and no real OneMap API calls happen.

jest.mock("../models/hawkerCentreModel");
jest.mock("../services/oneMapService");

const hawkerCentreModel = require("../models/hawkerCentreModel");
const oneMapService = require("../services/oneMapService");
const hawkerCentreController = require("../controllers/hawkerCentreController");

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

describe("getNearbyHawkerCentres", () => {
    // Customer standing near Chinatown.
    const req = { query: { lat: "1.2847", lng: "103.8437" } };

    const centres = [
        { centreID: 3, name: "Geylang Serai Market", address: "1 Geylang Serai", postalCode: "402001", region: "East" },
        { centreID: 1, name: "Maxwell Food Centre", address: "1 Kadayanallur St", postalCode: "069184", region: "Central" },
    ];

    // Geocode by postal code (the controller tries postalCode first).
    function geocodeByPostal(val) {
        if (val === "069184") return { latitude: 1.2803, longitude: 103.8447 }; // ~0.5 km away
        if (val === "402001") return { latitude: 1.3167, longitude: 103.8980 }; // ~7 km away
        return null;
    }

    test("returns centres ranked nearest-first with a distance", async () => {
        hawkerCentreModel.getAllHawkerCentres.mockResolvedValue(centres);
        oneMapService.geocode.mockImplementation(async (val) => geocodeByPostal(val));
        const res = mockRes();

        await hawkerCentreController.getNearbyHawkerCentres(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.hawkerCentres).toHaveLength(2);
        // Maxwell (~0.5 km) must come before Geylang (~7 km).
        expect(payload.hawkerCentres[0].name).toBe("Maxwell Food Centre");
        expect(payload.hawkerCentres[1].name).toBe("Geylang Serai Market");
        expect(payload.hawkerCentres[0].distanceKm).toBeLessThan(payload.hawkerCentres[1].distanceKm);
    });

    test("still lists a centre OneMap cannot locate, with null distance, sunk to the bottom", async () => {
        hawkerCentreModel.getAllHawkerCentres.mockResolvedValue([
            { centreID: 1, name: "Maxwell Food Centre", address: "1 Kadayanallur St", postalCode: "069184", region: "Central" },
            { centreID: 9, name: "Mystery Centre", address: "Nowhere", postalCode: "000000", region: "Unknown" },
        ]);
        // Maxwell resolves; the mystery centre returns null for both postal code and address.
        oneMapService.geocode.mockImplementation(async (val) => geocodeByPostal(val));
        const res = mockRes();

        await hawkerCentreController.getNearbyHawkerCentres(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.hawkerCentres[0].name).toBe("Maxwell Food Centre");
        expect(payload.hawkerCentres[1].name).toBe("Mystery Centre");
        expect(payload.hawkerCentres[1].distanceKm).toBeNull();
        expect(payload.hawkerCentres[1].latitude).toBeNull();
    });

    test("500s when the database call fails", async () => {
        hawkerCentreModel.getAllHawkerCentres.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await hawkerCentreController.getNearbyHawkerCentres(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getDirections", () => {
    const req = {
        query: { startLat: "1.2847", startLng: "103.8437", endLat: "1.2803", endLng: "103.8447", routeType: "walk" },
    };

    test("returns the route summary from OneMap", async () => {
        const route = { distanceMeters: 620, timeSeconds: 480, geometry: "abc123" };
        oneMapService.getRoute.mockResolvedValue(route);
        const res = mockRes();

        await hawkerCentreController.getDirections(req, res);

        expect(oneMapService.getRoute).toHaveBeenCalledWith(1.2847, 103.8437, 1.2803, 103.8447, "walk");
        expect(res.json).toHaveBeenCalledWith(route);
    });

    test("defaults to walking when no routeType is given", async () => {
        oneMapService.getRoute.mockResolvedValue({ distanceMeters: 1, timeSeconds: 1, geometry: "x" });
        const noMode = { query: { startLat: "1.1", startLng: "103.1", endLat: "1.2", endLng: "103.2" } };
        const res = mockRes();

        await hawkerCentreController.getDirections(noMode, res);

        expect(oneMapService.getRoute).toHaveBeenCalledWith(1.1, 103.1, 1.2, 103.2, "walk");
    });

    test("502s when OneMap returns no route (e.g. unavailable or not configured)", async () => {
        oneMapService.getRoute.mockResolvedValue(null);
        const res = mockRes();

        await hawkerCentreController.getDirections(req, res);

        expect(res.status).toHaveBeenCalledWith(502);
    });

    test("500s when the routing call throws", async () => {
        oneMapService.getRoute.mockRejectedValue(new Error("network down"));
        const res = mockRes();

        await hawkerCentreController.getDirections(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
