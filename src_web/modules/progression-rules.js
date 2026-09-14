export function createEmptyLandmarkProgress() {
  return { gpsVerified: false, gpsXP: 0, photoVerified: false, photoXP: 0, quizPassed: false, quizXP: 0, totalXP: 0 };
}

export function applyLandmarkPhaseAward(progress, phase, xpRules) {
  const next = { ...createEmptyLandmarkProgress(), ...progress };
  const rule = {
    GPS: { verified: 'gpsVerified', amount: 'gpsXP', xp: xpRules.location, message: `📍 GPS Geofence Arrival verified! +${xpRules.location} XP awarded.` },
    PHOTO: { verified: 'photoVerified', amount: 'photoXP', xp: xpRules.photo, message: `📸 Photo Verification submitted! +${xpRules.photo} XP awarded.` },
    QUIZ: { verified: 'quizPassed', amount: 'quizXP', xp: xpRules.quiz, message: `🧠 Heritage Lore Quiz passed! +${xpRules.quiz} XP awarded.` }
  }[phase];
  if (!rule || next[rule.verified]) return { progress: next, xpAwarded: 0, message: '' };
  next[rule.verified] = true;
  next[rule.amount] = rule.xp;
  const currentTotal = Number(next.totalXP) || 0;
  const actualGained = Math.max(0, Math.min(xpRules.landmarkTotal, currentTotal + rule.xp) - currentTotal);
  next.totalXP = currentTotal + actualGained;
  return { progress: next, xpAwarded: actualGained, message: actualGained ? rule.message : '' };
}
