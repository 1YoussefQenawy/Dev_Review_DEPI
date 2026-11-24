import { asyncHandler } from "../middleware/asyncHandler";
import { loginUser, registerUser } from "../services/auth.service";

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const user = await registerUser(email, password, name);
  res.status(201).json(user);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await loginUser(email, password);
  res.status(200).json(result);
});
