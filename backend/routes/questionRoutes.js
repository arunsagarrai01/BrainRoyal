import { Router } from 'express';
import {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { questionSchema } from '../validators/schemas.js';

const router = Router();

// All question management is admin-only.
router.use(requireAuth, requireAdmin);

router.get('/', listQuestions);
router.get('/:id', getQuestion);
router.post('/', validate(questionSchema), createQuestion);
router.put('/:id', validate(questionSchema), updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
