import { Router } from 'express';
import { blockUser, getAdminDashboard, moderateAd } from '../controllers/admin.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/dashboard', getAdminDashboard);
adminRouter.post('/ads/:id/moderate', moderateAd);
adminRouter.post('/users/:userId/block', blockUser);
