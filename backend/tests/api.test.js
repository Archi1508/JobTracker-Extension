// Integration tests: real Express app + real database (DATABASE_URL).
// Each run registers two throwaway users and deletes them at the end
// (their jobs are removed by ON DELETE CASCADE), so real data is untouched.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import ExcelJS from "exceljs";

const runId = Date.now();
const alice = { email: `test-alice-${runId}@example.com`, password: "alice-password" };
const bob = { email: `test-bob-${runId}@example.com`, password: "bob-password" };

let aliceToken;
let bobToken;
let jobId;

const sampleJob = {
    title: "Backend Developer",
    company: "Acme",
    location: "Pune",
    jobUrl: `https://www.linkedin.com/jobs/view/${runId}/?trk=search`,
    source: "linkedin"
};

function asAlice(req) {
    return req.set("Authorization", `Bearer ${aliceToken}`);
}

before(async () => {
    const a = await request(app).post("/api/auth/register").send(alice);
    const b = await request(app).post("/api/auth/register").send(bob);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    aliceToken = a.body.token;
    bobToken = b.body.token;
});

after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [alice.email, bob.email] } } });
    await prisma.$disconnect();
});

// ---------- health / misc ----------

test("GET /api/health reports API and database status", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.database, "connected");
    assert.equal(res.headers["x-powered-by"], undefined); // helmet
});

test("unknown routes return JSON 404", async () => {
    const res = await request(app).get("/api/nope");
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
});

test("malformed JSON returns 400 without a stack trace", async () => {
    const res = await asAlice(request(app).post("/api/jobs"))
        .set("Content-Type", "application/json")
        .send("{bad json");
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Request body is not valid JSON");
    assert.ok(!JSON.stringify(res.body).includes("at "));
});

// ---------- auth ----------

test("register rejects duplicate email and never returns the password hash", async () => {
    const res = await request(app).post("/api/auth/register").send(alice);
    assert.equal(res.status, 409);

    const login = await request(app).post("/api/auth/login").send(alice);
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    assert.equal(login.body.user.passwordHash, undefined);
});

test("login with a registered email but wrong password returns the generic 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ ...alice, password: "wrong-password" });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Invalid email or password.");
    assert.equal(res.body.code, undefined, "no ACCOUNT_NOT_FOUND code for a known email");
    assert.equal(res.body.token, undefined);
});

test("login with an unregistered email says the account was not found", async () => {
    const res = await request(app).post("/api/auth/login")
        .send({ email: `nobody-${runId}@example.com`, password: "whatever-password" });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Account not found. Please create an account.");
    assert.equal(res.body.code, "ACCOUNT_NOT_FOUND");
    assert.equal(res.body.token, undefined);
});

test("login email is case-insensitive (a registered email is not 'not found')", async () => {
    const res = await request(app).post("/api/auth/login").send({ ...alice, email: alice.email.toUpperCase() });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
});

test("GET /api/auth/me returns the logged-in user", async () => {
    const res = await asAlice(request(app).get("/api/auth/me"));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, alice.email);
});

test("job routes require a valid token", async () => {
    assert.equal((await request(app).get("/api/jobs")).status, 401);

    const res = await request(app).get("/api/jobs").set("Authorization", "Bearer not-a-token");
    assert.equal(res.status, 401);
});

// ---------- CRUD ----------

test("POST /api/jobs creates a job with status Saved and a clean URL", async () => {
    const res = await asAlice(request(app).post("/api/jobs")).send(sampleJob);
    assert.equal(res.status, 201);
    assert.equal(res.body.job.status, "Saved");
    assert.equal(res.body.job.jobUrl, `https://www.linkedin.com/jobs/view/${runId}`);
    jobId = res.body.job.id;
});

test("POST /api/jobs returns 409 for the same job (even with a different tracking URL)", async () => {
    const res = await asAlice(request(app).post("/api/jobs"))
        .send({ ...sampleJob, jobUrl: `https://www.linkedin.com/jobs/view/${runId}?refId=other` });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "This job is already saved.");
    assert.equal(res.body.existingJobId, jobId);
});

test("POST /api/jobs rejects invalid data with 400 and a list of errors", async () => {
    const res = await asAlice(request(app).post("/api/jobs")).send({ title: "", jobUrl: "nope", source: "x" });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid job data");
    assert.equal(res.body.errors.length, 3);
});

test("GET /api/jobs lists the user's jobs and filters by status", async () => {
    const all = await asAlice(request(app).get("/api/jobs"));
    assert.equal(all.status, 200);
    assert.equal(all.body.jobs.length, 1);

    const offers = await asAlice(request(app).get("/api/jobs?status=Offer"));
    assert.equal(offers.body.jobs.length, 0);

    const bad = await asAlice(request(app).get("/api/jobs?status=Hired"));
    assert.equal(bad.status, 400);
});

test("GET /api/jobs/:id returns one job; bad and unknown ids are handled", async () => {
    assert.equal((await asAlice(request(app).get(`/api/jobs/${jobId}`))).body.job.id, jobId);
    assert.equal((await asAlice(request(app).get("/api/jobs/abc"))).status, 400);
    assert.equal((await asAlice(request(app).get("/api/jobs/999999999"))).status, 404);
});

test("PATCH /api/jobs/:id updates status and tracker fields", async () => {
    const res = await asAlice(request(app).patch(`/api/jobs/${jobId}`))
        .send({ status: "Applied", notes: "Referred by Sam", salary: "12 LPA", workMode: "Hybrid" });
    assert.equal(res.status, 200);
    assert.equal(res.body.job.status, "Applied");
    assert.equal(res.body.job.notes, "Referred by Sam");
    assert.ok(res.body.job.dateApplied, "dateApplied is filled in automatically");

    const cleared = await asAlice(request(app).patch(`/api/jobs/${jobId}`)).send({ notes: "" });
    assert.equal(cleared.body.job.notes, null);
});

test("PATCH /api/jobs/:id validates input", async () => {
    assert.equal((await asAlice(request(app).patch(`/api/jobs/${jobId}`)).send({ status: "Hired" })).status, 400);
    assert.equal((await asAlice(request(app).patch(`/api/jobs/${jobId}`)).send({})).status, 400);
    assert.equal((await asAlice(request(app).patch("/api/jobs/999999999")).send({ status: "Offer" })).status, 404);
});

test("data persists in the database (read back through Prisma)", async () => {
    const row = await prisma.job.findUnique({ where: { id: jobId } });
    assert.equal(row.status, "Applied");
    assert.equal(row.salary, "12 LPA");
});

// ---------- authorization ----------

test("another user cannot see, change or delete the job", async () => {
    const auth = { Authorization: `Bearer ${bobToken}` };

    assert.equal((await request(app).get("/api/jobs").set(auth)).body.jobs.length, 0);
    assert.equal((await request(app).get(`/api/jobs/${jobId}`).set(auth)).status, 404);
    assert.equal((await request(app).patch(`/api/jobs/${jobId}`).set(auth).send({ status: "Offer" })).status, 404);
    assert.equal((await request(app).delete(`/api/jobs/${jobId}`).set(auth)).status, 404);

    // Bob may save the same job for himself.
    assert.equal((await request(app).post("/api/jobs").set(auth).send(sampleJob)).status, 201);
});

// ---------- Excel export ----------

// supertest normally reads the body as text; this collects the raw bytes.
function binaryParser(res, callback) {
    const chunks = [];
    res.on("data", chunk => chunks.push(chunk));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
}

async function readSheet(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook.getWorksheet("Job Applications");
}

test("GET /api/jobs/export returns an .xlsx with only the user's jobs", async () => {
    const res = await asAlice(request(app).get("/api/jobs/export")).buffer(true).parse(binaryParser);

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /spreadsheetml/);
    assert.match(res.headers["content-disposition"], /filename="Job_Applications_\d{4}-\d{2}-\d{2}\.xlsx"/);

    const sheet = await readSheet(res.body);
    const header = sheet.getRow(1).values.slice(1); // values[0] is always empty in exceljs
    assert.ok(header.includes("Job Title") && header.includes("Application Status") && header.includes("Date Added"));

    // Alice has 1 job; Bob saved the same job too, but his row must not appear.
    assert.equal(sheet.rowCount, 2);
    const row = sheet.getRow(2);
    const cell = name => row.getCell(header.indexOf(name) + 1).value;

    assert.equal(cell("Job Title"), "Backend Developer");
    assert.equal(cell("Application Status"), "Applied");
    assert.equal(cell("Platform"), "LinkedIn");
    assert.equal(cell("Salary"), "12 LPA");
    assert.equal(cell("Notes"), null, "notes were cleared earlier, so the cell is blank");
    assert.equal(cell("Job URL").hyperlink, `https://www.linkedin.com/jobs/view/${runId}`);
    assert.ok(cell("Date Added") instanceof Date);
    assert.equal(cell("Interview Date"), null, "empty fields stay blank");
});

test("GET /api/jobs/export with no saved jobs returns a header-only file", async () => {
    const temp = { email: `test-export-${runId}@example.com`, password: "export-password" };
    const { body } = await request(app).post("/api/auth/register").send(temp);

    const res = await request(app).get("/api/jobs/export")
        .set("Authorization", `Bearer ${body.token}`)
        .buffer(true).parse(binaryParser);

    assert.equal(res.status, 200);
    assert.equal((await readSheet(res.body)).rowCount, 1);
    await prisma.user.delete({ where: { id: body.user.id } });
});

test("GET /api/jobs/export requires login", async () => {
    const res = await request(app).get("/api/jobs/export");
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
});

// ---------- delete ----------

test("DELETE /api/auth/me deletes the account and its jobs", async () => {
    const temp = { email: `test-temp-${runId}@example.com`, password: "temp-password" };
    const { body } = await request(app).post("/api/auth/register").send(temp);
    const auth = { Authorization: `Bearer ${body.token}` };
    await request(app).post("/api/jobs").set(auth).send(sampleJob);

    assert.equal((await request(app).delete("/api/auth/me").set(auth)).status, 200);
    assert.equal(await prisma.job.count({ where: { userId: body.user.id } }), 0);
    assert.equal((await request(app).get("/api/auth/me").set(auth)).status, 401);
    // The old token must not be usable for job routes either (no 500 from a missing user).
    assert.equal((await request(app).post("/api/jobs").set(auth).send(sampleJob)).status, 401);
});

test("DELETE /api/jobs/:id removes the job", async () => {
    const res = await asAlice(request(app).delete(`/api/jobs/${jobId}`));
    assert.equal(res.status, 200);
    assert.equal((await asAlice(request(app).get(`/api/jobs/${jobId}`))).status, 404);
    assert.equal((await asAlice(request(app).delete(`/api/jobs/${jobId}`))).status, 404);
});
