import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { analyzeCode, isAiError, toFrontendReview } from "../services/ai";

const router = Router();
router.use(authMiddleware as any);

// ─── helpers ────────────────────────────────────────────────────────
function snippetToJson(s: any) {
  return {
    id: String(s.id),
    title: s.title,
    language: s.language,
    code: s.code,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    score: s.reviews?.[0]?.score ?? null,
    status: s.reviews?.[0]?.status ?? "pending",
  };
}

// ─── GET /api/snippets ──────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res) => {
  try {
    const snippets = await prisma.snippet.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    res.json(snippets.map(snippetToJson));
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

// ─── GET /api/snippets/:id ──────────────────────────────────────────
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const snippet = await prisma.snippet.findFirst({
      where: { id: Number(req.params.id), userId: req.userId! },
      include: { reviews: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!snippet) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }
    res.json(snippetToJson(snippet));
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

// ─── POST /api/snippets ─────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { title, language, code } = req.body;
    if (!title || !language || !code) {
      res.status(400).json({ message: "title, language and code are required" });
      return;
    }

    const snippet = await prisma.snippet.create({
      data: { title, language, code, userId: req.userId! },
    });

    // Fire-and-forget: run AI review in background
    analyzeCode({ code, language })
      .then(async ({ review }) => {
        await prisma.review.create({
          data: {
            snippetId: snippet.id,
            status: "analyzed",
            score: review.overallScore,
            result: review as any,
            documentation: {
              create: {
                content: review.documentation,
                testStubs: review.unitTestStubs,
              },
            },
          },
        });
        console.log(`[ai] Review completed for snippet ${snippet.id}`);
      })
      .catch(async (err) => {
        console.error(`[ai] Review failed for snippet ${snippet.id}:`, err);
        await prisma.review.create({
          data: {
            snippetId: snippet.id,
            status: "failed",
            score: null,
            result: Prisma.DbNull,
          },
        }).catch(() => {});
      });

    res.status(201).json({
      id: String(snippet.id),
      title: snippet.title,
      language: snippet.language,
      code: snippet.code,
      createdAt: snippet.createdAt.toISOString(),
      score: null,
      status: "pending",
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

// ─── DELETE /api/snippets/:id ───────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const snippet = await prisma.snippet.findFirst({
      where: { id: Number(req.params.id), userId: req.userId! },
    });
    if (!snippet) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }
    await prisma.snippet.delete({ where: { id: snippet.id } });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

// ─── GET /api/snippets/:id/review ───────────────────────────────────
router.get("/:id/review", async (req: AuthRequest, res) => {
  try {
    const snippet = await prisma.snippet.findFirst({
      where: { id: Number(req.params.id), userId: req.userId! },
      include: {
        reviews: {
          where: { status: "analyzed" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { documentation: true },
        },
      },
    });

    if (!snippet) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }

    const review = snippet.reviews[0];
    if (!review || !review.result) {
      res.status(404).json({ message: "Review not ready yet" });
      return;
    }

    const frontendReview = toFrontendReview(review.result as any, {
      snippetId: String(snippet.id),
      code: snippet.code,
    });

    res.json(frontendReview);
  } catch (e) {
    if (isAiError(e)) {
      res.status(e.httpStatus).json({ code: e.code, message: e.message });
      return;
    }
    res.status(500).json({ message: (e as Error).message });
  }
});

export default router;
