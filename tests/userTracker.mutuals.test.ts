import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffMutuals, computeBackoff, snapshotUsable, formatMutualEvent } from "../src/userplugins/userTracker/mutuals.ts";

describe("diffMutuals", () => {
    it("detects added and removed friend ids", () => {
        assert.deepEqual(diffMutuals(["1", "2"], ["2", "3"]), { added: ["3"], removed: ["1"] });
    });
    it("empty on identical snapshots, order-insensitive", () => {
        assert.deepEqual(diffMutuals(["1", "2"], ["2", "1"]), { added: [], removed: [] });
        assert.deepEqual(diffMutuals([], []), { added: [], removed: [] });
    });
});

describe("computeBackoff", () => {
    it("grows then caps", () => {
        assert.equal(computeBackoff(0), 0);
        assert.equal(computeBackoff(1), 1);
        assert.equal(computeBackoff(2), 2);
        assert.equal(computeBackoff(3), 4);
        assert.equal(computeBackoff(10), 8);
        assert.equal(computeBackoff(100), 8);
    });
});

describe("snapshotUsable", () => {
    it("trusts list when no count given", () => {
        assert.equal(snapshotUsable(3, undefined), true);
    });
    it("rejects truncated previews", () => {
        assert.equal(snapshotUsable(3, 10), false);
        assert.equal(snapshotUsable(10, 10), true);
        assert.equal(snapshotUsable(12, 10), true);
    });
});

describe("formatMutualEvent", () => {
    it("formats added and removed", () => {
        assert.equal(formatMutualEvent("@t", "@f", "added"), "Tracker • @t became friends with @f");
        assert.equal(formatMutualEvent("@t", "@f", "removed"), "Tracker • @t unfriended @f");
    });
});
