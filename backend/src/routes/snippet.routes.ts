import { Router } from "express";
import { create, getOne, list, remove } from "../controllers/snippet.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { createSnippetValidator } from "../validators/snippet.validators";

const router = Router();

router.use(requireAuth);

router.post("/", validate(createSnippetValidator), create);
router.get("/", list);
router.get("/:id", getOne);
router.delete("/:id", remove);

export default router;
