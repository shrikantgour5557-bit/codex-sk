import type { PlanType } from '../types.js';

export const FREE_AD_LIMIT = 2;

export function canPostAd(currentAdCount: number, plan: PlanType): boolean {
  if (plan !== 'FREE') return true;
  return currentAdCount < FREE_AD_LIMIT;
}
