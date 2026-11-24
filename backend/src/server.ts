import express from "express";
import authRoutes from "./routes/auth.routes";
import snippetRoutes from "./routes/snippet.routes";
import reviewRoutes from "./routes/review.routes";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/auth", authRoutes);
app.use("/snippets", snippetRoutes);
app.use("/reviews", reviewRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
