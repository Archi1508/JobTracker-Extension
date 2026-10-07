// Tests for extension/lib/api.js with a fake fetch().
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as api from "../../extension/lib/api.js";
import { API_BASE_URL } from "../../extension/lib/config.js";

let calls;

// Makes fetch() answer with the given status and JSON body.
function respondWith(status, body) {
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => {
                if (body === undefined) {
                    throw new SyntaxError("Unexpected end of JSON input");
                }
                return body;
            }
        };
    };
}

beforeEach(() => {
    calls = [];
    api.setAuthToken(null);
});

test("getJobs sends the auth token and returns the jobs array", async () => {
    respondWith(200, { success: true, jobs: [{ id: 1 }] });
    api.setAuthToken("abc");

    const jobs = await api.getJobs();

    assert.deepEqual(jobs, [{ id: 1 }]);
    assert.equal(calls[0].url, `${API_BASE_URL}/jobs`);
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.headers.Authorization, "Bearer abc");
});

test("createJob POSTs JSON", async () => {
    respondWith(201, { success: true, job: { id: 7, title: "Dev" } });

    const job = await api.createJob({ title: "Dev" });

    assert.equal(job.id, 7);
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.equal(calls[0].options.body, JSON.stringify({ title: "Dev" }));
});

test("updateJob and deleteJob use PATCH and DELETE on /jobs/:id", async () => {
    respondWith(200, { success: true, job: { id: 3 } });

    await api.updateJob(3, { status: "Offer" });
    await api.deleteJob(3);
    await api.getJob(3);

    assert.deepEqual(calls.map(call => [call.options.method, call.url]), [
        ["PATCH", `${API_BASE_URL}/jobs/3`],
        ["DELETE", `${API_BASE_URL}/jobs/3`],
        ["GET", `${API_BASE_URL}/jobs/3`]
    ]);
});

test("duplicate job: 409 becomes a friendly ApiError with existingJobId", async () => {
    respondWith(409, { success: false, message: "This job is already saved.", existingJobId: 12 });

    await assert.rejects(api.createJob({}), error => {
        assert.ok(error instanceof api.ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.message, "This job is already saved.");
        assert.equal(error.data.existingJobId, 12);
        return true;
    });
});

test("validation errors include the server's details", async () => {
    respondWith(400, { success: false, message: "Invalid job data", errors: ["title: is required"] });

    await assert.rejects(api.createJob({}), { status: 400, message: "Invalid job data. (title: is required)" });
});

test("server unreachable: network failure becomes status 0", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("Failed to fetch");
    };

    await assert.rejects(api.getJobs(), {
        status: 0,
        message: "Cannot connect to server. Is the backend running?"
    });
});

test("500 and non-JSON responses don't leak technical details", async () => {
    respondWith(500, undefined);

    await assert.rejects(api.getJobs(), {
        status: 500,
        message: "The server had a problem. Please try again in a moment."
    });
});

test("401 is passed through so the popup can log the user out", async () => {
    respondWith(401, { success: false, message: "Your session has expired. Please log in again." });
    await assert.rejects(api.getJobs(), { status: 401 });
});

test("exportJobs downloads /jobs/export as a Blob with the auth token", async () => {
    const fileBytes = new Blob(["fake xlsx bytes"]);
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, blob: async () => fileBytes };
    };
    api.setAuthToken("abc");

    const blob = await api.exportJobs();

    assert.equal(blob, fileBytes);
    assert.equal(calls[0].url, `${API_BASE_URL}/jobs/export`);
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.headers.Authorization, "Bearer abc");
});

test("exportJobs turns errors into friendly ApiErrors", async () => {
    respondWith(401, { success: false, message: "Please log in to continue." });
    await assert.rejects(api.exportJobs(), { status: 401 });

    respondWith(500, undefined);
    await assert.rejects(api.exportJobs(), { status: 500, message: "The server had a problem. Please try again in a moment." });

    globalThis.fetch = async () => {
        throw new TypeError("Failed to fetch");
    };
    await assert.rejects(api.exportJobs(), { status: 0, message: "Cannot connect to server. Is the backend running?" });
});
