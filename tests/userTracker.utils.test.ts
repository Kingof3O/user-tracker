import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTrackedIds, isTracked, diffRoles, formatRoleChange, formatSimpleEvent, trimHistory, buildEntry } from "../src/userplugins/userTracker/utils.ts";

describe("parseTrackedIds", () => {
    it("extracts 17-20 digit ids from mixed separators", () => {
        assert.deepEqual(parseTrackedIds("123456789012345678, 987654321098765432\nnot-an-id 123"), ["123456789012345678", "987654321098765432"]);
    });
    it("dedupes and returns empty for blank", () => {
        assert.deepEqual(parseTrackedIds("123456789012345678 123456789012345678"), ["123456789012345678"]);
        assert.deepEqual(parseTrackedIds("   ,, \n"), []);
    });
});

describe("isTracked", () => {
    it("matches exact id only", () => {
        assert.equal(isTracked("123456789012345678", ["123456789012345678"]), true);
        assert.equal(isTracked("123", ["123456789012345678"]), false);
    });
});

describe("diffRoles", () => {
    it("computes added and removed", () => {
        assert.deepEqual(diffRoles(["1", "2"], ["2", "3"]), { added: ["3"], removed: ["1"] });
        assert.deepEqual(diffRoles([], []), { added: [], removed: [] });
    });
});

describe("formatRoleChange", () => {
    it("formats adds and removes", () => {
        const msg = formatRoleChange("@bob", "MyServer", ["Admin"], ["Mod"]);
        assert.ok(msg.includes("@bob") && msg.includes("MyServer") && msg.includes("+Admin") && msg.includes("-Mod"));
    });
});

describe("formatSimpleEvent", () => {
    it("formats join/leave/ban labels", () => {
        assert.equal(formatSimpleEvent("@bob", "MyServer", "joined"), "Tracker • @bob in MyServer: joined");
    });
});

describe("trimHistory", () => {
    it("keeps newest N", () => {
        assert.deepEqual(trimHistory([1, 2, 3, 4], 2), [3, 4]);
        assert.deepEqual(trimHistory([1], 200), [1]);
    });
});

describe("buildEntry", () => {
    it("builds entry with id and ts", () => {
        const e = buildEntry({ userId: "123456789012345678", userTag: "@bob", guildId: "G1", guildName: "MyServer", kind: "join", detail: "joined" });
        assert.equal(e.userId, "123456789012345678");
        assert.equal(e.kind, "join");
        assert.ok(typeof e.id === "string" && e.id.length > 0);
        assert.ok(typeof e.ts === "number" && e.ts > 0);
    });
});
