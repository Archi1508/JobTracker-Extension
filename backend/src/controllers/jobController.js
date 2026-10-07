import * as jobService from "../services/jobService.js";
import { buildJobsWorkbook } from "../services/exportService.js";

// Controllers only translate HTTP <-> service calls. Validation already
// happened in middleware (req.validated), and the database work lives in
// services/jobService.js. req.user comes from requireAuth.

// GET /api/jobs?status=Applied
export async function getJobs(req, res) {
    const jobs = await jobService.listJobs(req.user.id, req.validated.query);
    res.status(200).json({ success: true, jobs: jobs });
}

// GET /api/jobs/export → download all of the user's jobs as an Excel file
export async function exportJobs(req, res) {
    // Same function as GET /api/jobs, so only the logged-in user's jobs
    // are included, read fresh from the database.
    const jobs = await jobService.listJobs(req.user.id);
    const file = await buildJobsWorkbook(jobs);

    const today = new Date().toISOString().slice(0, 10); // "2026-10-07"

    // Tell the client this is an .xlsx file and suggest a file name.
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Job_Applications_${today}.xlsx"`);
    res.status(200).send(Buffer.from(file));
}

// GET /api/jobs/:id
export async function getJob(req, res) {
    const job = await jobService.getJob(req.user.id, req.jobId);
    res.status(200).json({ success: true, job: job });
}

// POST /api/jobs
export async function createJob(req, res) {
    const job = await jobService.createJob(req.user.id, req.validated.body);
    // 201 Created = a new resource was created
    res.status(201).json({ success: true, job: job });
}

// PATCH /api/jobs/:id
export async function updateJob(req, res) {
    const job = await jobService.updateJob(req.user.id, req.jobId, req.validated.body);
    res.status(200).json({ success: true, job: job });
}

// DELETE /api/jobs/:id
export async function deleteJob(req, res) {
    const job = await jobService.deleteJob(req.user.id, req.jobId);
    res.status(200).json({ success: true, job: job });
}
