import { asyncHandler } from "../middleware/asyncHandler";
import { getUserId } from "../middleware/auth.middleware";
import {
  createSnippet,
  deleteSnippet,
  getSnippet,
  listSnippets,
} from "../services/snippet.service";
import { parseIdParam } from "../utils/parseId";

export const create = asyncHandler(async (req, res) => {
  const { title, code, language } = req.body;
  const snippet = await createSnippet(getUserId(req), {
    title: title.trim(),
    code,
    language,
  });
  res.status(201).json(snippet);
});

export const list = asyncHandler(async (req, res) => {
  const snippets = await listSnippets(getUserId(req));
  res.status(200).json(snippets);
});

export const getOne = asyncHandler(async (req, res) => {
  const snippet = await getSnippet(getUserId(req), parseIdParam(req, "Snippet"));
  res.status(200).json(snippet);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteSnippet(getUserId(req), parseIdParam(req, "Snippet"));
  res.status(204).send();
});
