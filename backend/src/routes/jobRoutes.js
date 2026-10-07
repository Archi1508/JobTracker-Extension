import { Router } from "express";
import { getJobs, getJob, createJob, updateJob, deleteJob, exportJobs } from "../controllers/jobController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, validateIdParam } from "../middleware/validate.js";
import { createJobSchema, updateJobSchema, listJobsQuerySchema } from "../validation/jobSchemas.js";

// Mounted at /api/jobs in app.js, so "/" here means /api/jobs
const router = Router();

// Every job route needs a logged-in user.
router.use(requireAuth);

router.get("/", validate(listJobsQuerySchema, "Invalid query", "query"), getJobs);
router.post("/", validate(createJobSchema, "Invalid job data"), createJob);

// Must come BEFORE "/:id": Express checks routes from top to bottom, and
// "/:id" would otherwise match /export with id = "export".
router.get("/export", exportJobs);

// ":id" is a placeholder: for /api/jobs/2, req.params.id is "2"
router.get("/:id", validateIdParam, getJob);
router.patch("/:id", validateIdParam, validate(updateJobSchema, "Invalid job data"), updateJob);
router.delete("/:id", validateIdParam, deleteJob);

export default router;
