import express from "express";
import { registerUser, loginUser } from "./services/auth.service";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await registerUser(email, password, name);
    res.status(201).json(user);
  } catch (e) {
    res.status(409).json({ message: (e as Error).message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await loginUser(email, password);
    res.status(200).json({ token, user });
  } catch (e) {
    res.status(401).json({ message: (e as Error).message });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});