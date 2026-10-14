import { Router } from 'express';
import {
  postBattle,
  getBattle,
  postAnswer,
  postFinish,
  listMyBattles,
} from '../controllers/battleController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createBattleSchema, answerSchema } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', listMyBattles);
router.post('/', validate(createBattleSchema), postBattle);
router.get('/:id', getBattle);
router.post('/:id/answer', validate(answerSchema), postAnswer);
router.post('/:id/finish', postFinish);

export default router;
