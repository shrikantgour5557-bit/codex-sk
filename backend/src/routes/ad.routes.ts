import { Router } from 'express';
import { createAd, deleteAd, getAdDetail, getAds, updateAd } from '../controllers/ad.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const adRouter = Router();

adRouter.get('/', getAds);
adRouter.get('/:id', getAdDetail);
adRouter.post('/', requireAuth, createAd);
adRouter.patch('/:id', requireAuth, updateAd);
adRouter.delete('/:id', requireAuth, deleteAd);
