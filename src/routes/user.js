import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

// Get user profile
router.get('/profile', getProfile);

// Update user profile
router.put('/profile', updateProfile);

export default router;
