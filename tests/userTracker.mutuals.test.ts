import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffMutuals, computeBackoff, snapshotUsable, formatMutualEvent, isRateLimited, capMutualTargets, getRateLimitCooldown, isValidMutualCacheEntry } from "../src/userplugins/userTracker/mutuals.ts";

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

describe("isRateLimited", () => {
    it("identifies 429 status from different error shapes", () => {
        assert.equal(isRateLimited({ status: 429 }), true);
        assert.equal(isRateLimited({ statusCode: 429 }), true);
        assert.equal(isRateLimited({ response: { status: 429 } }), true);
        assert.equal(isRateLimited(new Error("Request failed with status 429")), true);
        assert.equal(isRateLimited({ message: "rate limited" }), true);
    });
    it("returns false for non-429 errors or null", () => {
        assert.equal(isRateLimited({ status: 500 }), false);
        assert.equal(isRateLimited(new Error("Network timeout")), false);
        assert.equal(isRateLimited(null), false);
        assert.equal(isRateLimited(undefined), false);
    });
});

describe("computeBackoff with 429", () => {
    it("applies heavier backoff when 429 occurred", () => {
        assert.equal(computeBackoff(1, true), 16);
        assert.equal(computeBackoff(3, true), 32);
    });
});

describe("getRateLimitCooldown", () => {
    it("returns at least 10 minutes (600000ms) on 429", () => {
        assert.equal(getRateLimitCooldown(true), 600000);
        assert.equal(getRateLimitCooldown(true, 300000), 600000);
        assert.equal(getRateLimitCooldown(true, 900000), 900000);
    });
    it("returns 0 when not rate limited", () => {
        assert.equal(getRateLimitCooldown(false), 0);
    });
});

describe("capMutualTargets", () => {
    it("caps target list to limit (default 25)", () => {
        const ids = Array.from({ length: 50 }, (_, i) => `12345678901234567${i.toString().padStart(2, "0")}`);
        const capped = capMutualTargets(ids);
        assert.equal(capped.length, 25);
        assert.deepEqual(capped, ids.slice(0, 25));
    });
    it("handles smaller lists or empty/invalid input", () => {
        assert.deepEqual(capMutualTargets(["123456789012345678"]), ["123456789012345678"]);
        assert.deepEqual(capMutualTargets([]), []);
        assert.deepEqual(capMutualTargets(null as any), []);
    });
});

describe("isValidMutualCacheEntry", () => {
    it("validates a proper [userId, mutualIds] tuple", () => {
        assert.equal(isValidMutualCacheEntry(["123456789012345678", ["987654321098765432", "111111111111111111"]]), true);
        assert.equal(isValidMutualCacheEntry(["123456789012345678", []]), true);
    });
    it("rejects invalid tuples or invalid snowflakes", () => {
        assert.equal(isValidMutualCacheEntry(null), false);
        assert.equal(isValidMutualCacheEntry(["invalid-id", []]), false);
        assert.equal(isValidMutualCacheEntry(["123456789012345678", "not-an-array" as any]), false);
        assert.equal(isValidMutualCacheEntry(["123456789012345678", ["invalid-friend-id"]]), false);
    });
});

