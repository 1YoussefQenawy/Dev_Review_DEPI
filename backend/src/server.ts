import "dotenv/config";
import express from "express";
import { registerUser, loginUser, AuthError } from "./services/auth.service";
import snippetRoutes from "./routes/snippets";

const app = express();
const PORT = process.env.PORT ?? 5000;

// ─── CORS ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

// ─── Health ─────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.send("Server is running");
});

// ─── Auth routes ────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const result = await registerUser(email, password, name);
    res.status(201).json(result);
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 409;
    res.status(status).json({ message: (e as Error).message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await loginUser(email, password);
    res.status(200).json({ token, user });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    res.status(status).json({ message: (e as Error).message });
  }
});

// ─── Snippets routes (protected) ────────────────────────────────────
app.use("/api/snippets", snippetRoutes);

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
