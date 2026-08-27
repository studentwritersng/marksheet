export type PlatformAdLike = {
  active: boolean;
  expiresAt: Date | null;
  targetRoles: string[];
  createdAt: Date;
};

export function filterActiveAdsForRole(
  ads: PlatformAdLike[],
  role: string,
  now: Date,
): PlatformAdLike[] {
  return ads
    .filter((a) => a.active)
    .filter((a) => a.expiresAt === null || a.expiresAt > now)
    .filter((a) => a.targetRoles.includes(role))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
