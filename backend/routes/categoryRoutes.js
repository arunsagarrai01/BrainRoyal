import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { categorySchema } from '../validators/schemas.js';

const router = Router();

router.get('/', listCategories);
router.get('/:id', getCategory);
router.post('/', requireAuth, requireAdmin, validate(categorySchema), createCategory);
router.put('/:id', requireAuth, requireAdmin, updateCategory);
router.delete('/:id', requireAuth, requireAdmin, deleteCategory);

export default router;
