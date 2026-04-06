import { Router } from 'express';
import { googleAuth, register, login, syncUser } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// Google Authentication
router.post('/google', googleAuth);

// Email Registration
router.post('/register', register);

// Email Login
router.post('/login', login);

// Sync user (verify token and ensure user exists in MongoDB)
router.post('/sync', verifyToken, syncUser);

export default router;
