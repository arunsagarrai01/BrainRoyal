import { Router } from 'express';
import {
  getOverview,
  listUsers,
  updateUserRole,
  deleteUser,
  listBattles,
} from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Every admin route requires authentication + admin role.
router.use(requireAuth, requireAdmin);

router.get('/overview', getOverview);
router.get('/users', listUsers);
router.put('/users/:id', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/battles', listBattles);

export default router;
