import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { generateToken } from "../utils/jwt.js";

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, password_hash]
    );

    const token = generateToken(newUser.rows[0]);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user.rows[0]);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        email: user.rows[0].email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, username, email, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    res.status(200).json({ user: user.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
