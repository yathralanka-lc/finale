export const APP_RULES = Object.freeze({
  xp: Object.freeze({
    starting: 0,
    location: 100,
    photo: 70,
    quiz: 50,
    landmarkTotal: 220
  }),
  quiz: Object.freeze({
    questionsPerSession: 5,
    secondsPerQuestion: 30,
    maxAttempts: 3,
    cooldownMs: 30 * 60 * 1000,
    masteryPercent: 100
  }),
  verification: Object.freeze({
    radiusMeters: 500,
    maxAccuracyMeters: 200,
    locationFreshMs: 60 * 1000,
    defaultVisitMs: 15 * 60 * 1000,
    bmichVisitMs: 3 * 60 * 1000,
    outsideResumeWindowMs: 60 * 60 * 1000,
    photoMatchPercent: 75
  }),
  navigation: Object.freeze([
    Object.freeze({ id: 'home', label: 'Home' }),
    Object.freeze({ id: 'activism', label: 'Activism' }),
    Object.freeze({ id: 'rewards', label: 'Achievements' }),
    Object.freeze({ id: 'profile', label: 'Profile' })
  ])
});

export function createRankDefinitions(rankingScale) {
  return rankingScale.map(item => ({
    id: String(item.rank || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name: item.rank,
    minXP: item.threshold,
    maxXP: item.range?.[1] ?? null
  }));
}

export function getRankProgress(totalXP, rankDefinitions) {
  let xp = Number(totalXP);
  if (!Number.isFinite(xp) || xp < 0) xp = 0;
  xp = Math.floor(xp);

  let currentRank = rankDefinitions[0];
  let nextRank = rankDefinitions[1];
  for (let i = 0; i < rankDefinitions.length; i++) {
    const rank = rankDefinitions[i];
    if (rank.maxXP === null && xp >= rank.minXP) {
      currentRank = rank;
      nextRank = null;
    } else if (rank.maxXP !== null && xp >= rank.minXP && xp <= rank.maxXP) {
      currentRank = rank;
      nextRank = rankDefinitions[i + 1] || null;
      break;
    }
  }

  const isHighestRank = nextRank === null;
  const currentRankStartXP = currentRank.minXP;
  const xpIntoCurrentRank = xp - currentRankStartXP;
  const nextRankXP = isHighestRank ? null : nextRank.minXP;
  const xpRequiredForNextRank = isHighestRank ? 0 : nextRankXP - currentRankStartXP;
  const progressPercent = isHighestRank || xpRequiredForNextRank <= 0
    ? 100
    : Math.min(100, Math.max(0, Math.floor((xpIntoCurrentRank / xpRequiredForNextRank) * 100)));

  return { currentRank, nextRank, currentXP: xp, currentRankStartXP, nextRankXP, xpIntoCurrentRank, xpRequiredForNextRank, progressPercent, isHighestRank };
}
