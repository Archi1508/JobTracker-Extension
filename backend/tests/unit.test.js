// Unit tests: no server, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeJobUrl } from "../src/utils/normalizeUrl.js";
import { createJobSchema, updateJobSchema } from "../src/validation/jobSchemas.js";
import { registerSchema } from "../src/validation/authSchemas.js";

test("normalizeJobUrl removes tracking params, hash and trailing slash", () => {
    assert.equal(
        normalizeJobUrl("https://WWW.LinkedIn.com/jobs/view/123/?trk=abc&refId=x&utm_source=y#top"),
        "https://www.linkedin.com/jobs/view/123"
    );
});

test("normalizeJobUrl keeps meaningful params, sorted", () => {
    assert.equal(
        normalizeJobUrl("https://in.indeed.com/viewjob?jk=abc123&from=serp&b=2"),
        "https://in.indeed.com/viewjob?b=2&jk=abc123"
    );
});

test("createJobSchema accepts a minimal job and trims text", () => {
    const result = createJobSchema.parse({
        title: "  Developer ",
        jobUrl: "https://example.com/job/1",
        source: "other",
        company: ""
    });

    assert.equal(result.title, "Developer");
    assert.equal(result.company, null);
});

test("createJobSchema rejects bad url, source and status", () => {
    const result = createJobSchema.safeParse({
        title: "Dev",
        jobUrl: "javascript:alert(1)",
        source: "monster",
        status: "applied"
    });

    assert.equal(result.success, false);
    const fields = result.error.issues.map(issue => issue.path[0]).sort();
    assert.deepEqual(fields, ["jobUrl", "source", "status"]);
});

test("updateJobSchema converts dates and requires at least one field", () => {
    const parsed = updateJobSchema.parse({ dateApplied: "2026-10-01", workMode: "Remote" });
    assert.ok(parsed.dateApplied instanceof Date);

    assert.equal(updateJobSchema.safeParse({}).success, false);
    assert.equal(updateJobSchema.safeParse({ dateApplied: "not a date" }).success, false);
    assert.equal(updateJobSchema.parse({ workMode: "" }).workMode, null);
});

test("registerSchema lower-cases email and enforces password length", () => {
    assert.equal(registerSchema.parse({ email: " A@B.com ", password: "12345678" }).email, "a@b.com");
    assert.equal(registerSchema.safeParse({ email: "a@b.com", password: "short" }).success, false);
    assert.equal(registerSchema.safeParse({ email: "nope", password: "12345678" }).success, false);
});
