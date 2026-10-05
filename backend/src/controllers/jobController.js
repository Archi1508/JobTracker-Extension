import * as jobService from "../services/jobService.js";

// Controllers only translate HTTP <-> service calls. Validation already
// happened in middleware (req.validated), and the database work lives in
// services/jobService.js. req.user comes from requireAuth.

// GET /api/jobs?status=Applied
export async function getJobs(req, res) {
    const jobs = await jobService.listJobs(req.user.id, req.validated.query);
    res.status(200).json({ success: true, jobs: jobs });
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
