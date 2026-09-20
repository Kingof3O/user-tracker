import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTrackedIds, isTracked, diffRoles, formatRoleChange, formatSimpleEvent, trimHistory, buildEntry, isValidSnowflake, sanitizeText, isValidTrackerEntry } from "../src/userplugins/userTracker/utils.ts";

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

describe("trimHistory caps", () => {
    it("caps at 1000", () => {
        const arr = new Array(1005).fill(0).map((_, i) => i);
        const out = trimHistory(arr, 2000);
        assert.equal(out.length, 1000);
        assert.deepEqual(out.slice(0, 2), [5, 6]);
        assert.equal(out[out.length - 1], 1004);
    });
});

describe("trimHistory default", () => {
    it("default keeps 200", () => {
        const arr = new Array(250).fill(0).map((_, i) => i);
        const out = trimHistory(arr);
        assert.equal(out.length, 200);
        assert.equal(out[0], 50);
        assert.equal(out[out.length - 1], 249);
    });
});

describe("parseTrackedIds lengths", () => {
    it("ignores 16-digit and keeps 17-digit", () => {
        assert.deepEqual(parseTrackedIds("1234567890123456"), []);
        assert.deepEqual(parseTrackedIds("12345678901234567"), ["12345678901234567"]);
        assert.deepEqual(parseTrackedIds("1234567890123456 12345678901234567"), ["12345678901234567"]);
    });
});

describe("formatRoleChange empty", () => {
    it("returns message containing no change", () => {
        const msg = formatRoleChange("@bob", "MyServer", [], []);
        assert.ok(msg.includes("no change"));
    });
});

describe("isValidSnowflake", () => {
    it("accepts valid 17-20 digit snowflakes", () => {
        assert.equal(isValidSnowflake("12345678901234567"), true);
        assert.equal(isValidSnowflake("1234567890123456789"), true);
        assert.equal(isValidSnowflake("12345678901234567890"), true);
    });
    it("rejects non-strings or invalid lengths / characters", () => {
        assert.equal(isValidSnowflake("123"), false);
        assert.equal(isValidSnowflake("1234567890123456"), false);
        assert.equal(isValidSnowflake("123456789012345678901"), false);
        assert.equal(isValidSnowflake("12345678901234567a"), false);
        assert.equal(isValidSnowflake(" 12345678901234567 "), false);
        assert.equal(isValidSnowflake(null as any), false);
        assert.equal(isValidSnowflake(undefined as any), false);
        assert.equal(isValidSnowflake(123456789012345678 as any), false);
    });
});

describe("sanitizeText", () => {
    it("removes control characters, bidi overrides, and zero-width spaces", () => {
        const malicious = "Hello\x00\x08World\u202Ereversed\u200B\uFEFF";
        const cleaned = sanitizeText(malicious);
        assert.equal(cleaned, "HelloWorldreversed");
    });
    it("normalizes newlines and tabs to single spaces", () => {
        const text = "Line 1\nLine 2\r\nLine 3\tTab";
        assert.equal(sanitizeText(text), "Line 1 Line 2 Line 3 Tab");
    });
    it("clamps string length to max limit", () => {
        const longText = "a".repeat(200);
        assert.equal(sanitizeText(longText, 50).length, 50);
    });
    it("handles non-string safely", () => {
        assert.equal(sanitizeText(null as any), "");
        assert.equal(sanitizeText(undefined as any), "");
        assert.equal(sanitizeText(123 as any), "123");
    });
});

describe("isValidTrackerEntry", () => {
    it("validates a well-formed entry", () => {
        const entry = buildEntry({
            userId: "123456789012345678",
            userTag: "@bob",
            guildId: "987654321098765432",
            guildName: "MyServer",
            kind: "join",
            detail: "joined",
        });
        assert.equal(isValidTrackerEntry(entry), true);
    });
    it("rejects invalid or corrupted entries", () => {
        assert.equal(isValidTrackerEntry(null), false);
        assert.equal(isValidTrackerEntry({}), false);
        assert.equal(isValidTrackerEntry({
            id: "abc",
            ts: Date.now(),
            userId: "invalid-id",
            userTag: "@bob",
            guildId: "G1",
            guildName: "Server",
            kind: "join",
            detail: "joined",
        }), false);
        assert.equal(isValidTrackerEntry({
            id: "abc",
            ts: -1,
            userId: "123456789012345678",
            userTag: "@bob",
            guildId: "G1",
            guildName: "Server",
            kind: "join",
            detail: "joined",
        }), false);
        assert.equal(isValidTrackerEntry({
            id: "abc",
            ts: Date.now(),
            userId: "123456789012345678",
            userTag: "@bob",
            guildId: "G1",
            guildName: "Server",
            kind: "unknown-kind" as any,
            detail: "joined",
        }), false);
    });
});

