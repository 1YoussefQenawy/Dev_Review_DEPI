import { asyncHandler } from "../middleware/asyncHandler";
import { getUserId } from "../middleware/auth.middleware";
import { createReview, getReview } from "../services/review.service";
import { parseIdParam } from "../utils/parseId";

export const create = asyncHandler(async (req, res) => {
  const review = await createReview(getUserId(req), req.body.snippetId);
  res.status(201).json(review);
});

export const getOne = asyncHandler(async (req, res) => {
  const review = await getReview(getUserId(req), parseIdParam(req, "Review"));
  res.status(200).json(review);
});
