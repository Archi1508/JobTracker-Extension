import { jobs, getNextId } from "../data/jobs.js";

// GET /api/jobs → return all jobs
export function getJobs(req, res) {
    res.status(200).json({
        success: true,
        jobs: jobs
    });
}

// POST /api/jobs → add one job from the request body
export function createJob(req, res) {
    // req.body is filled in by express.json() in app.js.
    // validateJob (see jobRoutes.js) has already checked it before we get here.
    const { title, company, location, url, website } = req.body || {};

    const job = {
        id: getNextId(),
        title: title,
        company: company,
        location: location,
        url: url,
        website: website,
        status: "Saved" // every new job starts as Saved; PATCH changes it later
    };

    jobs.push(job);

    // 201 Created = a new resource was created
    res.status(201).json({
        success: true,
        job: job
    });
}

// PATCH /api/jobs/:id → change one job's status
export function updateJobStatus(req, res) {
    // req.params.id is always a string ("2"), but our ids are numbers (2).
    const id = Number(req.params.id);
    const job = jobs.find(job => job.id === id);

    if (!job) {
        return res.status(404).json({
            success: false,
            message: "Job not found"
        });
    }

    // find() returned the object stored in the array, so this changes it directly.
    // validateStatus has already checked req.body.status.
    job.status = req.body.status;

    res.status(200).json({
        success: true,
        job: job
    });
}

// DELETE /api/jobs/:id → remove one job
export function deleteJob(req, res) {
    const id = Number(req.params.id);

    // Position of the job in the array, or -1 if there is no such job.
    const index = jobs.findIndex(job => job.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Job not found"
        });
    }

    // splice removes 1 item at "index" from the array itself
    // and returns the removed items as an array.
    const deleted = jobs.splice(index, 1)[0];

    res.status(200).json({
        success: true,
        job: deleted
    });
}
