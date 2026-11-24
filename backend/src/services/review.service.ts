import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { UserId } from "../middleware/auth.middleware";
import { analyzeCode } from "./ai.service";

export async function createReview(userId: UserId, snippetId: number) {
  const snippet = await prisma.snippet.findFirst({
    where: { id: snippetId, userId },
  });
  if (!snippet) {
    throw new AppError(404, "Snippet not found");
  }

  const review = await prisma.review.create({
    data: { snippetId, status: "pending" },
  });

  let analysis;
  try {
    analysis = await analyzeCode(snippet.code, snippet.language);
  } catch (err) {
    console.error(err);
    await prisma.review.update({
      where: { id: review.id },
      data: { status: "failed" },
    });
    throw new AppError(502, "AI analysis failed");
  }

  return prisma.review.update({
    where: { id: review.id },
    data: {
      status: "completed",
      score: analysis.score,
      result: analysis.result,
      documentation: {
        create: {
          content: analysis.documentation,
          testStubs: analysis.testStubs,
        },
      },
    },
    include: { documentation: true },
  });
}

export async function getReview(userId: UserId, id: number) {
  const review = await prisma.review.findFirst({
    where: { id, snippet: { userId } },
    include: { documentation: true },
  });
  if (!review) {
    throw new AppError(404, "Review not found");
  }
  return review;
}
