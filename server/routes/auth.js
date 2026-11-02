import express from "express";
import {
  changePassword,
  deleteSession,
  getCaptcha,
  getMe,
  getSessions,
  listAllUsers,
  login,
  logout,
  logoutAll,
  register,
  updateProfile,
} from "../controllers/authController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* ----------------------------- public routes ----------------------------- */
router.get("/captcha", getCaptcha);
router.post("/register", register);
router.post("/login", login);

/* --------------------------- authenticated routes ------------------------ */
router.post("/logout", requireAuth, logout);
router.post("/logout-all", requireAuth, logoutAll);

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateProfile);

router.post("/change-password", requireAuth, changePassword);

router.get("/sessions", requireAuth, getSessions);
router.delete("/sessions/:id", requireAuth, deleteSession);

/* ------------------- authorization: admin-only endpoint ------------------ */
router.get("/admin/users", requireAuth, requireRole("admin"), listAllUsers);

export default router;
