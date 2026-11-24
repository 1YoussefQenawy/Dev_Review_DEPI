import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { loginValidator, registerValidator } from "../validators/auth.validators";

const router = Router();

router.post("/register", validate(registerValidator), register);
router.post("/login", validate(loginValidator), login);

export default router;
