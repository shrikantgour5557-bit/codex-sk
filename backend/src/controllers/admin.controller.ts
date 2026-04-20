import type { Request, Response } from 'express';

export function getAdminDashboard(_req: Request, res: Response) {
  return res.json({
    stats: {
      pendingAds: 0,
      approvedAds: 0,
      rejectedAds: 0,
      totalUsers: 0,
      blockedUsers: 0
    }
  });
}

export function moderateAd(req: Request, res: Response) {
  const adId = req.params.id;
  const { action, feedback } = req.body as { action: 'APPROVE' | 'REJECT'; feedback?: string };

  return res.json({
    message: `Ad ${adId} moderation action applied.`,
    moderation: { action, feedback }
  });
}

export function blockUser(req: Request, res: Response) {
  const userId = req.params.userId;
  return res.json({ message: `User ${userId} has been blocked.` });
}
