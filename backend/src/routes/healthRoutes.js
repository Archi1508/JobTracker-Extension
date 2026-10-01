import { Router } from "express";
import { getHealth } from "../controllers/healthController.js";

// Route: connects a METHOD + PATH to a controller function.
const router = Router();

router.get("/", getHealth);

export default router;
