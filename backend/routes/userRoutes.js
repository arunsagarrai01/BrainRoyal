import { Router } from 'express';
import { getProfile, updateProfile, getPublicProfile } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/schemas.js';

const router = Router();

router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, validate(updateProfileSchema), updateProfile);
router.get('/:username', requireAuth, getPublicProfile);

export default router;
