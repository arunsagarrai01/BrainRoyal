import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { generateToken } from "../utils/jwt.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ message: "Username must be between 3 and 30 characters" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existing = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2",
      [email, username.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "An account with that email or username already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
      [username, email, password_hash]
    );

    const user = created.rows[0];
    const token = generateToken(user);

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (err) {
    console.error("[auth/register]", err);

    // Postgres unique_violation safety net
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ message: "An account with that email or username already exists" });
    }

    return res
      .status(500)
      .json({ message: "Could not create account. Please try again." });
  }
};

export const login = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const result = await db.query(
      "SELECT id, username, email, password_hash FROM users WHERE LOWER(email) = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const row = result.rows[0];
    const isMatch = await bcrypt.compare(password, row.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = { id: row.id, username: row.username, email: row.email };
    const token = generateToken(user);

    return res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("[auth/login]", err);
    return res
      .status(500)
      .json({ message: "Could not sign in. Please try again." });
  }
};

export const getMe = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.created_at,
              COALESCE(MAX(s.score), 0) AS best_score,
              COUNT(s.id) AS games_played
       FROM users u
       LEFT JOIN scores s ON s.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.username, u.email, u.created_at`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ message: "Could not load profile" });
  }
};
