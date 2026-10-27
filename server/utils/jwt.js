import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};
