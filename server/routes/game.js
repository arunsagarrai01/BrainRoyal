import express from "express";
import {
  getQuestion,
  checkAnswer,
  submitScore,
  getLeaderboard,
  getStats,
} from "../controllers/gameController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/question", getQuestion);
router.post("/answer", checkAnswer);
router.post("/score", requireAuth, submitScore);
router.get("/leaderboard", getLeaderboard);
router.get("/stats", getStats);

export default router;
