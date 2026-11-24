import { Router } from "express";
import { create, getOne } from "../controllers/review.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { createReviewValidator } from "../validators/review.validators";

const router = Router();

router.use(requireAuth);

router.post("/", validate(createReviewValidator), create);
router.get("/:id", getOne);

export default router;
