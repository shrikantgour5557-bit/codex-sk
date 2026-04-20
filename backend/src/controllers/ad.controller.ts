import type { Request, Response } from 'express';
import { z } from 'zod';
import { canPostAd } from '../utils/limits.js';
import { detectSpam } from '../services/spamDetection.service.js';

const adSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  category: z.enum(['Business', 'Jobs', 'Services', 'Digital', 'Local Ads']),
  externalLink: z.string().url().optional(),
  planType: z.enum(['FREE', 'FEATURED', 'HOMEPAGE_BOOST']).default('FREE')
});

export function createAd(req: Request, res: Response) {
  const ad = adSchema.parse(req.body);
  const currentUserAdCount = 2;

  if (!canPostAd(currentUserAdCount, ad.planType)) {
    return res.status(403).json({
      message: 'Free ad limit reached. Upgrade to FEATURED or HOMEPAGE_BOOST.'
    });
  }

  const spamResult = detectSpam(`${ad.title} ${ad.description}`);
  if (spamResult.isSpam) {
    return res.status(400).json({
      message: 'Potential spam ad blocked for moderation.',
      reason: spamResult.reason
    });
  }

  return res.status(201).json({
    message: 'Ad submitted and marked as PENDING for admin approval.',
    ad
  });
}

export function getAds(req: Request, res: Response) {
  const querySchema = z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    featured: z.enum(['true', 'false']).optional()
  });

  const filters = querySchema.parse(req.query);
  return res.json({
    message: 'Fetch APPROVED ads from DB with filters + pagination.',
    filters,
    data: []
  });
}

export function getAdDetail(req: Request, res: Response) {
  const adId = req.params.id;
  return res.json({
    adId,
    message: 'Return ad details and increment view count.'
  });
}

export function updateAd(req: Request, res: Response) {
  const adId = req.params.id;
  const payload = adSchema.partial().parse(req.body);
  return res.json({ message: `Update ad ${adId}`, payload });
}

export function deleteAd(req: Request, res: Response) {
  return res.status(204).send();
}
