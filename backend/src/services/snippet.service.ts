import { prisma } from "../lib/prisma";
import { AppError } from "../errors/AppError";
import { UserId } from "../middleware/auth.middleware";

type CreateSnippetInput = {
  title: string;
  code: string;
  language: string;
};

export async function createSnippet(userId: UserId, input: CreateSnippetInput) {
  return prisma.snippet.create({
    data: {
      title: input.title,
      code: input.code,
      language: input.language,
      userId,
    },
  });
}

export async function listSnippets(userId: UserId) {
  return prisma.snippet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSnippet(userId: UserId, id: number) {
  const snippet = await prisma.snippet.findFirst({ where: { id, userId } });
  if (!snippet) {
    throw new AppError(404, "Snippet not found");
  }
  return snippet;
}

export async function deleteSnippet(userId: UserId, id: number) {
  const result = await prisma.snippet.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new AppError(404, "Snippet not found");
  }
}
