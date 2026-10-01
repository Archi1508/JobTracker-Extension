import { Router } from "express";
import { getJobs, createJob } from "../controllers/jobController.js";

// Mounted at /api/jobs in app.js, so "/" here means /api/jobs
const router = Router();

router.get("/", getJobs);
router.post("/", createJob);

export default router;
