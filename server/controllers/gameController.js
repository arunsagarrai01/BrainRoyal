import axios from "axios";
import db from "../config/db.js";
import { saveQuestion, takeQuestion } from "../utils/questionStore.js";

const BANANA_API =
  process.env.BANANA_API || "https://marcconrad.com/uob/banana/api.php";

/**
 * GET /api/game/question
 * Fetches a puzzle from the Banana API. The solution stays server-side and is
 * linked to a short-lived questionId.
 */
export const getQuestion = async (req, res) => {
  try {
    const { data } = await axios.get(BANANA_API, {
      timeout: 8000,
      headers: { Accept: "application/json" },
    });

    if (!data || !data.question || data.solution === undefined) {
      return res
        .status(502)
        .json({ message: "Puzzle provider returned an unexpected response" });
    }

    const questionId = saveQuestion(data.solution);

    const payload = {
      questionId,
      question: data.question,
      expiresIn: 300,
    };

    // Automated tests need to know the expected value. Never exposed outside NODE_ENV=test.
    if (process.env.NODE_ENV === "test") {
      payload.solution = data.solution;
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("[game/question]", err.message);
    return res
      .status(502)
      .json({ message: "Could not fetch a puzzle right now. Try again." });
  }
};

/**
 * POST /api/game/answer  { questionId, answer }
 * Server-side answer checking. Reveals the solution only on a wrong answer.
 */
export const checkAnswer = async (req, res) => {
  const { questionId, answer } = req.body || {};

  if (!questionId || answer === undefined || answer === null || answer === "") {
    return res
      .status(400)
      .json({ message: "questionId and answer are required" });
  }

  const entry = takeQuestion(questionId);
  if (!entry) {
    return res
      .status(410)
      .json({ message: "This question expired. Request a new one." });
  }

  const numericAnswer = Number(answer);
  if (!Number.isInteger(numericAnswer)) {
    return res.status(400).json({ message: "Answer must be a whole number" });
  }

  const correct = numericAnswer === entry.solution;

  return res.status(200).json({
    correct,
    solution: entry.solution,
  });
};

/**
 * POST /api/game/score  { score }
 */
export const submitScore = async (req, res) => {
  try {
    const score = Number(req.body?.score);

    if (!Number.isInteger(score) || score < 0 || score > 10000) {
      return res.status(400).json({ message: "Score must be an integer from 0 to 10000" });
    }

    await db.query("INSERT INTO scores (user_id, score) VALUES ($1, $2)", [
      req.user.id,
      score,
    ]);

    const best = await db.query(
      "SELECT COALESCE(MAX(score), 0) AS best FROM scores WHERE user_id = $1",
      [req.user.id]
    );

    return res.status(201).json({
      message: "Score saved successfully",
      bestScore: Number(best.rows[0].best),
    });
  } catch (err) {
    console.error("[game/score]", err);
    return res.status(500).json({ message: "Could not save score" });
  }
};

/**
 * GET /api/game/leaderboard
 */
export const getLeaderboard = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.username,
              MAX(s.score) AS max_score,
              COUNT(s.id)  AS games_played
       FROM scores s
       JOIN users u ON u.id = s.user_id
       GROUP BY u.id, u.username
       HAVING MAX(s.score) > 0
       ORDER BY max_score DESC, games_played ASC, u.username ASC
       LIMIT 50`
    );

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      maxScore: Number(row.max_score),
      gamesPlayed: Number(row.games_played),
    }));

    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error("[game/leaderboard]", err);
    return res.status(500).json({ message: "Could not load leaderboard" });
  }
};

/**
 * GET /api/game/stats  - headline numbers for the dashboard
 */
export const getStats = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users)  AS total_players,
         (SELECT COUNT(*) FROM scores) AS total_games,
         (SELECT COUNT(*) FROM users)  AS total_questions,
         (SELECT COALESCE(MAX(score), 0) FROM scores) AS top_score`
    );

    const row = result.rows[0];
    return res.status(200).json({
      totalPlayers: Number(row.total_players),
      totalGames: Number(row.total_games),
      totalQuestions: Number(row.total_questions),
      topScore: Number(row.top_score),
    });
  } catch (err) {
    console.error("[game/stats]", err);
    return res.status(500).json({ message: "Could not load stats" });
  }
};
