import express from "express";
import { getQuestion, submitScore, getLeaderboard } from "../controllers/gameController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/question", getQuestion);
router.post("/score", authMiddleware, submitScore);
router.get("/leaderboard", getLeaderboard);

export default router;
