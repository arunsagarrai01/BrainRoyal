import axios from "axios";
import pool from "../config/db.js";

const BANANA_API = process.env.BANANA_API || "https://marcconrad.com/uob/banana/api.php";

export const getQuestion = async (req, res) => {
  try {
    const response = await axios.get(BANANA_API);
    const data = response.data;
    // API returns { question: "...image_url...", solution: N }
    res.status(200).json({
      question: data.question,
      solution: data.solution,
    });
  } catch (err) {
    console.error("Error fetching question:", err.message);
    res.status(500).json({ message: "Failed to fetch question" });
  }
};

export const submitScore = async (req, res) => {
  try {
    const userId = req.user.id;
    const { score } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ message: "Score is required" });
    }

    await pool.query("INSERT INTO scores (user_id, score) VALUES ($1, $2)", [
      userId,
      score,
    ]);

    res.status(201).json({ message: "Score saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.username, MAX(s.score) as max_score, COUNT(s.id) as games_played
       FROM scores s
       JOIN users u ON s.user_id = u.id
       GROUP BY u.id, u.username
       ORDER BY max_score DESC
       LIMIT 50`
    );
    res.status(200).json({ leaderboard: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
