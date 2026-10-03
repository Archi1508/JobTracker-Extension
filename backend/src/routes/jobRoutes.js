import { Router } from "express";
import { getJobs, createJob } from "../controllers/jobController.js";
import { validateJob } from "../middleware/validateJob.js";

// Mounted at /api/jobs in app.js, so "/" here means /api/jobs
const router = Router();

router.get("/", getJobs);
// validateJob runs first; createJob only runs if validateJob calls next()
router.post("/", validateJob, createJob);

export default router;
