import { Router } from "express";
import { getJobs, createJob, updateJobStatus, deleteJob } from "../controllers/jobController.js";
import { validateJob, validateStatus } from "../middleware/validateJob.js";

// Mounted at /api/jobs in app.js, so "/" here means /api/jobs
const router = Router();

router.get("/", getJobs);
// validateJob runs first; createJob only runs if validateJob calls next()
router.post("/", validateJob, createJob);
// ":id" is a placeholder: for /api/jobs/2, req.params.id is "2"
router.patch("/:id", validateStatus, updateJobStatus);
router.delete("/:id", deleteJob);

export default router;
