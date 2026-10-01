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
    // "|| {}" avoids a crash if no JSON body was sent (validation comes next milestone).
    const { title, company, location, url, website } = req.body || {};

    const job = {
        id: getNextId(),
        title: title,
        company: company,
        location: location,
        url: url,
        website: website
    };

    jobs.push(job);

    // 201 Created = a new resource was created
    res.status(201).json({
        success: true,
        job: job
    });
}
