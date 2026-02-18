const gameState = {
  currentZoneId: null,
  currentZone: null,
  currentBranch: null,
  masteryLevel: 0,
  difficultyLevel: "Beginner",
  correctStreak: 0,
  wrongCount: 0,
  knowledgeHealth: 100,
  remediationNeeded: false,
  branchProgress: {},
  bossProgress: {},
  zoneUnlocks: {},
  zoneOrder: [],
  zoneBranches: {},
  zoneNamesById: {},
  researchLog: [],
  badges: {},
  badgeOrder: [],
  knowledgeHealthHighStreak: 0
  ,
  totalPoints: 0,
  questionTypeStats: {
    "multiple-choice": { attempts: 0, correct: 0 },
    text: { attempts: 0, correct: 0 }
  }
};

const MAX_KNOWLEDGE_HEALTH = 100;
const LOW_KNOWLEDGE_HEALTH_THRESHOLD = 20;
const BOSS_MAX_HP = 100;
const BRANCH_CLEAR_TARGET = 10;
const KNOWLEDGE_HEALTH_STREAK_BADGE_TARGET = 5;
const DIFFICULTY_POINT_MULTIPLIER = {
  Beginner: 1.0,
  Advanced: 1.15,
  Master: 1.3
};

function initializeZones(zoneDefinitions) {
  gameState.zoneOrder = zoneDefinitions.map((zone) => zone.id);

  zoneDefinitions.forEach((zone, index) => {
    gameState.zoneUnlocks[zone.id] = index === 0;
    gameState.zoneBranches[zone.name] = zone.branches.map((branch) => branch.name);
    gameState.zoneNamesById[zone.id] = zone.name;
  });

  updateMasteryLevelFromProgress();
}

function setCurrentZone(zoneId, zoneName) {
  gameState.currentZoneId = zoneId;
  gameState.currentZone = zoneName;
}

function setCurrentBranch(branchName) {
  gameState.currentBranch = branchName;
}

function isZoneUnlocked(zoneId) {
  return Boolean(gameState.zoneUnlocks[zoneId]);
}

function unlockNextZone() {
  const currentIndex = gameState.zoneOrder.indexOf(gameState.currentZoneId);
  if (currentIndex < 0) {
    return;
  }

  const nextZoneId = gameState.zoneOrder[currentIndex + 1];
  if (!nextZoneId) {
    return;
  }

  gameState.zoneUnlocks[nextZoneId] = true;
}

function unlockOneZoneForTesting() {
  for (let i = 0; i < gameState.zoneOrder.length; i += 1) {
    const zoneId = gameState.zoneOrder[i];
    if (!gameState.zoneUnlocks[zoneId]) {
      gameState.zoneUnlocks[zoneId] = true;
      return zoneId;
    }
  }

  return null;
}

function getBranchKey() {
  if (!gameState.currentZone || !gameState.currentBranch) {
    return null;
  }

  return `${gameState.currentZone}::${gameState.currentBranch}`;
}

function ensureBranchProgressRecord() {
  const key = getBranchKey();
  if (!key) {
    return null;
  }

  if (!gameState.branchProgress[key]) {
    gameState.branchProgress[key] = {
      attempts: 0,
      correct: 0,
      completed: false
    };
  }

  return gameState.branchProgress[key];
}

function recordBranchOutcome(success) {
  const record = ensureBranchProgressRecord();
  if (!record) {
    return;
  }

  record.attempts += 1;
  if (success) {
    record.correct += 1;
  }

  if (record.correct >= BRANCH_CLEAR_TARGET) {
    record.completed = true;
  }

  updateMasteryLevelFromProgress();
}

function ensureBossRecord(zoneName = gameState.currentZone) {
  const branchName = gameState.currentBranch;
  if (!zoneName || !branchName) {
    return null;
  }

  const key = `${zoneName}::${branchName}`;
  if (!gameState.bossProgress[key]) {
    gameState.bossProgress[key] = {
      attempts: 0,
      correct: 0,
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      completed: false
    };
  }

  return gameState.bossProgress[key];
}

function recordBossOutcome(success, damage = 0) {
  const record = ensureBossRecord();
  if (!record) {
    return null;
  }

  record.attempts += 1;
  let damageDealt = 0;
  if (success) {
    record.correct += 1;
    damageDealt = Math.max(0, Math.round(Number(damage) || 0));
    record.hp = Math.max(0, record.hp - damageDealt);
  }

  if (record.hp <= 0) {
    record.completed = true;
    if (isZoneFullyCompleted(gameState.currentZone)) {
      unlockNextZone();
    }
  }

  updateMasteryLevelFromProgress();
  return {
    ...record,
    damageDealt
  };
}

function getBossStatusForCurrentZone() {
  const record = ensureBossRecord();
  if (!record) {
    return null;
  }

  return {
    ...record,
    maxHp: BOSS_MAX_HP
  };
}

function isCurrentZoneBossCompleted() {
  const record = ensureBossRecord();
  return Boolean(record && record.completed);
}

function isCurrentZoneReadyForBoss() {
  if (!gameState.currentZone || !gameState.currentBranch) {
    return false;
  }

  // Branch boss unlocks inside the active branch quiz once branch clears are completed.
  const key = `${gameState.currentZone}::${gameState.currentBranch}`;
  return Boolean(gameState.branchProgress[key] && gameState.branchProgress[key].completed);
}

function getCurrentDifficulty() {
  return gameState.difficultyLevel;
}

function updateKnowledgeHealthFlag() {
  gameState.remediationNeeded = gameState.knowledgeHealth < LOW_KNOWLEDGE_HEALTH_THRESHOLD;
}

function modifyKnowledgeHealth(delta) {
  const nextValue = gameState.knowledgeHealth + delta;
  gameState.knowledgeHealth = Math.max(0, Math.min(MAX_KNOWLEDGE_HEALTH, nextValue));
  updateKnowledgeHealthFlag();
}

function getKnowledgeHealth() {
  return gameState.knowledgeHealth;
}

function isRemediationNeeded() {
  return gameState.remediationNeeded;
}

function updateDifficultyFromPerformance() {
  if (gameState.correctStreak >= 5) {
    gameState.difficultyLevel = "Master";
    return;
  }

  if (gameState.correctStreak >= 3) {
    gameState.difficultyLevel = "Advanced";
  }

  if (gameState.wrongCount >= 2 && gameState.difficultyLevel === "Master") {
    gameState.difficultyLevel = "Advanced";
  }

  if (gameState.wrongCount >= 3 && gameState.difficultyLevel === "Advanced") {
    gameState.difficultyLevel = "Beginner";
  }
}

function applyAnswerOutcome(success) {
  if (success) {
    gameState.correctStreak += 1;
    gameState.wrongCount = 0;
  } else {
    gameState.correctStreak = 0;
    gameState.wrongCount += 1;
  }

  updateDifficultyFromPerformance();
}

function calculateBranchMastery(zoneName, branchName) {
  const key = `${zoneName}::${branchName}`;
  const record = gameState.branchProgress[key];
  const earned = record ? Math.min(record.correct, BRANCH_CLEAR_TARGET) : 0;
  return Math.round((earned / BRANCH_CLEAR_TARGET) * 100);
}

function getBranchMastery(zoneName, branchName) {
  return calculateBranchMastery(zoneName, branchName);
}

function calculateZoneMastery(zoneName) {
  const branches = gameState.zoneBranches[zoneName] || [];
  const branchRequired = branches.length * BRANCH_CLEAR_TARGET;
  const bossRequired = branches.length * BOSS_MAX_HP;
  const totalRequired = branchRequired + bossRequired;

  if (totalRequired === 0) {
    return 0;
  }

  const branchEarned = branches.reduce((total, branchName) => {
    const key = `${zoneName}::${branchName}`;
    const record = gameState.branchProgress[key];
    return total + (record ? Math.min(record.correct, BRANCH_CLEAR_TARGET) : 0);
  }, 0);

  const bossEarned = branches.reduce((total, branchName) => {
    const key = `${zoneName}::${branchName}`;
    const bossRecord = gameState.bossProgress[key];
    const depleted = bossRecord ? (bossRecord.maxHp - bossRecord.hp) : 0;
    return total + Math.max(0, Math.min(BOSS_MAX_HP, depleted));
  }, 0);
  return Math.round(((branchEarned + bossEarned) / totalRequired) * 100);
}

function getZoneMastery(zoneName) {
  return calculateZoneMastery(zoneName);
}

function calculateOverallMastery() {
  const zones = gameState.zoneOrder
    .map((zoneId) => gameState.zoneNamesById[zoneId])
    .filter(Boolean);

  if (zones.length === 0) {
    return 0;
  }

  const totals = zones.reduce((acc, zoneName) => {
    const branches = gameState.zoneBranches[zoneName] || [];
    const required = (branches.length * BRANCH_CLEAR_TARGET) + (branches.length * BOSS_MAX_HP);
    const earnedFromBranches = branches.reduce((sum, branchName) => {
      const key = `${zoneName}::${branchName}`;
      const record = gameState.branchProgress[key];
      return sum + (record ? Math.min(record.correct, BRANCH_CLEAR_TARGET) : 0);
    }, 0);
    const earnedFromBoss = branches.reduce((sum, branchName) => {
      const key = `${zoneName}::${branchName}`;
      const bossRecord = gameState.bossProgress[key];
      const depleted = bossRecord ? (bossRecord.maxHp - bossRecord.hp) : 0;
      return sum + Math.max(0, Math.min(BOSS_MAX_HP, depleted));
    }, 0);

    return {
      earned: acc.earned + earnedFromBranches + earnedFromBoss,
      required: acc.required + required
    };
  }, { earned: 0, required: 0 });

  if (totals.required === 0) {
    return 0;
  }

  return Math.round((totals.earned / totals.required) * 100);
}

function updateMasteryLevelFromProgress() {
  gameState.masteryLevel = calculateOverallMastery();
}

function getOverallMastery() {
  return calculateOverallMastery();
}

function getMasteryMap() {
  const allBadges = getBadges();
  return gameState.zoneOrder.map((zoneId) => {
    const zoneName = gameState.zoneNamesById[zoneId];
    const zoneBadges = allBadges.filter((badge) => badge.zone === zoneName && !badge.branch);
    const branches = (gameState.zoneBranches[zoneName] || []).map((branchName) => ({
      name: branchName,
      mastery: getBranchMastery(zoneName, branchName),
      badges: allBadges.filter((badge) => badge.zone === zoneName && badge.branch === branchName)
    }));
    const bossRequired = branches.length * BOSS_MAX_HP;
    const bossCorrect = branches.reduce((sum, branch) => {
      const key = `${zoneName}::${branch.name}`;
      const bossRecord = gameState.bossProgress[key];
      const depleted = bossRecord ? (bossRecord.maxHp - bossRecord.hp) : 0;
      return sum + Math.max(0, Math.min(BOSS_MAX_HP, depleted));
    }, 0);
    const bossCompleted = branches.every((branch) => {
      const key = `${zoneName}::${branch.name}`;
      return Boolean(gameState.bossProgress[key] && gameState.bossProgress[key].completed);
    });

    return {
      zoneId,
      zoneName,
      unlocked: isZoneUnlocked(zoneId),
      mastery: getZoneMastery(zoneName),
      bossMastery: bossRequired === 0 ? 0 : Math.round((bossCorrect / bossRequired) * 100),
      bossCompleted: bossCompleted,
      zoneBadges,
      branches
    };
  });
}

function getProgressSnapshot() {
  // Consolidated rendering snapshot keeps UI read-only and separate from gameplay mutation.
  return {
    currentZone: gameState.currentZone,
    currentBranch: gameState.currentBranch,
    difficultyLevel: gameState.difficultyLevel,
    knowledgeHealth: gameState.knowledgeHealth,
    overallMastery: getOverallMastery(),
    totalPoints: gameState.totalPoints,
    masteryMap: getMasteryMap(),
    badges: getBadges()
  };
}

function getGameState() {
  return {
    ...gameState,
    branchProgress: { ...gameState.branchProgress },
    bossProgress: { ...gameState.bossProgress },
    zoneUnlocks: { ...gameState.zoneUnlocks },
    zoneBranches: { ...gameState.zoneBranches },
    zoneNamesById: { ...gameState.zoneNamesById },
    researchLog: [...gameState.researchLog],
    badges: { ...gameState.badges },
    badgeOrder: [...gameState.badgeOrder],
    questionTypeStats: Object.keys(gameState.questionTypeStats).reduce((acc, key) => {
      acc[key] = { ...gameState.questionTypeStats[key] };
      return acc;
    }, {})
  };
}

function getBranchProgress() {
  return { ...gameState.branchProgress };
}

function ensureQuestionTypeRecord(questionType) {
  const key = String(questionType || "text");
  if (!gameState.questionTypeStats[key]) {
    gameState.questionTypeStats[key] = { attempts: 0, correct: 0 };
  }
  return gameState.questionTypeStats[key];
}

function recordQuestionTypeOutcome(questionType, success) {
  const record = ensureQuestionTypeRecord(questionType);
  record.attempts += 1;
  if (success) {
    record.correct += 1;
  }
}

function getQuestionTypeMastery(questionType) {
  const record = ensureQuestionTypeRecord(questionType);
  if (record.attempts === 0) {
    return 0;
  }

  return Math.round((record.correct / record.attempts) * 100);
}

function getQuestionTypeMasteryMap() {
  return Object.keys(gameState.questionTypeStats).reduce((acc, typeKey) => {
    acc[typeKey] = getQuestionTypeMastery(typeKey);
    return acc;
  }, {});
}

function appendResearchLog(entry) {
  // Research logging is isolated from gameplay state mutation for ethical, non-intrusive metrics capture.
  gameState.researchLog.push({
    timestamp: new Date().toISOString(),
    zone: entry.zone || null,
    branch: entry.branch || null,
    challengeType: entry.challengeType || "normal",
    bossHpBefore: Number(entry.bossHpBefore ?? BOSS_MAX_HP),
    bossHpAfter: Number(entry.bossHpAfter ?? BOSS_MAX_HP),
    bossMaxHp: Number(entry.bossMaxHp ?? BOSS_MAX_HP),
    bossCompleted: Boolean(entry.bossCompleted),
    questionType: entry.questionType || "text",
    challengeId: entry.challengeId || null,
    isCorrect: Boolean(entry.isCorrect),
    difficultyAtAnswer: entry.difficultyAtAnswer || gameState.difficultyLevel,
    knowledgeHealthBefore: Number(entry.knowledgeHealthBefore ?? gameState.knowledgeHealth),
    knowledgeHealthAfter: Number(entry.knowledgeHealthAfter ?? gameState.knowledgeHealth),
    branchMastery: Number(entry.branchMastery ?? 0),
    zoneMastery: Number(entry.zoneMastery ?? 0),
    overallMastery: Number(entry.overallMastery ?? 0),
    badgesEarned: Array.isArray(entry.badgesEarned) ? [...entry.badgesEarned] : [],
    pointsEarned: Number(entry.pointsEarned ?? 0),
    totalPoints: Number(entry.totalPoints ?? gameState.totalPoints),
    timeRatio: Number(entry.timeRatio ?? 0),
    timeEfficiencyPercent: Number(entry.timeEfficiencyPercent ?? 0),
    performancePercent: Number(entry.performancePercent ?? 0),
    healthFactor: Number(entry.healthFactor ?? 1),
    masteryFactor: Number(entry.masteryFactor ?? 1),
    difficultyMultiplier: Number(entry.difficultyMultiplier ?? 1),
    rewardMultiplier: Number(entry.rewardMultiplier ?? 1)
  });
}

function getResearchLog() {
  return gameState.researchLog.map((entry) => ({ ...entry }));
}

function getResearchExportData() {
  // Export bundle is intentionally anonymized: gameplay metrics only, no personal identifiers.
  return {
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    metrics: getResearchLog(),
    badges: getBadges(),
    masteryMap: getMasteryMap(),
    questionTypeMastery: getQuestionTypeMasteryMap()
  };
}

function getClearTargets() {
  return {
    branch: BRANCH_CLEAR_TARGET,
    boss: BOSS_MAX_HP
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function awardTimedPoints(
  isCorrect,
  elapsedSeconds,
  expectedSeconds,
  challengeType,
  difficultyLevel,
  knowledgeHealth,
  overallMastery,
  rewardMultiplier = 1
) {
  const elapsed = Math.max(Number(elapsedSeconds) || 0, 0.5);
  const expected = Math.max(Number(expectedSeconds) || 0, 1);
  // Starts at 3x and decreases as elapsed time rises relative to expected time.
  const elapsedRatio = elapsed / expected;
  const timeMultiplier = clamp(3 * Math.exp(-0.9 * elapsedRatio), 0.25, 3);
  const healthFactor = clamp(0.8 + ((Number(knowledgeHealth) || 0) / 400), 0.75, 1.1);
  const masteryFactor = clamp(1.1 - ((Number(overallMastery) || 0) / 500), 0.85, 1.1);
  const difficultyMultiplier = DIFFICULTY_POINT_MULTIPLIER[difficultyLevel] || 1.0;
  const timeEfficiencyPercent = Math.round((timeMultiplier / 3) * 100);
  const performancePercent = Math.round(
    clamp((timeMultiplier / 3 * 0.6) + (healthFactor * 0.25) + (masteryFactor * 0.15), 0, 1.2) * 100
  );

  if (!isCorrect) {
    return {
      pointsEarned: 0,
      totalPoints: gameState.totalPoints,
      timeRatio: timeMultiplier,
      timeEfficiencyPercent,
      performancePercent,
      healthFactor,
      masteryFactor,
      difficultyMultiplier
    };
  }

  const basePoints = challengeType === "boss" ? 260 : 100;
  const pointsEarned = Math.round(
    basePoints * timeMultiplier * healthFactor * masteryFactor * difficultyMultiplier * rewardMultiplier
  );
  gameState.totalPoints += pointsEarned;

  return {
    pointsEarned,
    totalPoints: gameState.totalPoints,
    timeRatio: timeMultiplier,
    timeEfficiencyPercent,
    performancePercent,
    healthFactor,
    masteryFactor,
    difficultyMultiplier,
    rewardMultiplier
  };
}

function hasBadge(badgeId) {
  return Boolean(gameState.badges[badgeId]);
}

function addBadge(payload) {
  if (!payload || !payload.id || hasBadge(payload.id)) {
    return null;
  }

  const badge = {
    id: payload.id,
    title: payload.title || "Achievement",
    description: payload.description || "",
    category: payload.category || "general",
    zone: payload.zone || null,
    branch: payload.branch || null,
    earnedAt: new Date().toISOString()
  };

  gameState.badges[payload.id] = badge;
  gameState.badgeOrder.push(payload.id);
  return { ...badge };
}

function getBadges() {
  return gameState.badgeOrder
    .map((badgeId) => gameState.badges[badgeId])
    .filter(Boolean)
    .map((badge) => ({ ...badge }));
}

function isZoneFullyCompleted(zoneName) {
  const branches = gameState.zoneBranches[zoneName] || [];
  if (branches.length === 0) {
    return false;
  }

  const branchesDone = branches.every((branchName) => {
    const key = `${zoneName}::${branchName}`;
    return Boolean(gameState.branchProgress[key] && gameState.branchProgress[key].completed);
  });

  const bossDone = branches.every((branchName) => {
    const key = `${zoneName}::${branchName}`;
    return Boolean(gameState.bossProgress[key] && gameState.bossProgress[key].completed);
  });
  return branchesDone && bossDone;
}

function evaluateAndAwardBadges(challengeType, bossDamage = 0) {
  const newlyEarned = [];
  const zoneName = gameState.currentZone;
  const branchName = gameState.currentBranch;

  if (zoneName && branchName) {
    const branchKey = `${zoneName}::${branchName}`;
    const branchRecord = gameState.branchProgress[branchKey];

    if (branchRecord && branchRecord.completed) {
      const branchBadge = addBadge({
        id: `branch-mastery::${zoneName}::${branchName}`,
        title: `${branchName} Branch Master`,
        description: `Completed branch mastery clears in ${branchName}.`,
        category: "branch",
        zone: zoneName,
        branch: branchName
      });
      if (branchBadge) {
        newlyEarned.push(branchBadge);
      }
    }
  }

  if (zoneName && challengeType === "boss") {
    const bossKey = `${zoneName}::${branchName}`;
    const bossRecord = gameState.bossProgress[bossKey];
    if (bossRecord && bossDamage > 0) {
      const chipBadge = addBadge({
        id: `boss-damage::${zoneName}::${branchName}`,
        title: `${branchName} Boss Engaged`,
        description: `Dealt damage to the ${branchName} boss in ${zoneName}.`,
        category: "boss_progress",
        zone: zoneName,
        branch: branchName
      });
      if (chipBadge) {
        newlyEarned.push(chipBadge);
      }
    }

    if (bossRecord && bossRecord.completed) {
      const bossBadge = addBadge({
        id: `boss-conqueror::${zoneName}::${branchName}`,
        title: `${branchName} Boss Conqueror`,
        description: `Defeated the ${branchName} boss challenge in ${zoneName}.`,
        category: "boss",
        zone: zoneName,
        branch: branchName
      });
      if (bossBadge) {
        newlyEarned.push(bossBadge);
      }
    }
  }

  if (zoneName && isZoneFullyCompleted(zoneName)) {
    const zoneBadge = addBadge({
      id: `zone-completion::${zoneName}`,
      title: `${zoneName} Zone Complete`,
      description: `Completed all branches and boss milestones in ${zoneName}.`,
      category: "zone",
      zone: zoneName
    });
    if (zoneBadge) {
      newlyEarned.push(zoneBadge);
    }
  }

  if (gameState.knowledgeHealth >= 80) {
    gameState.knowledgeHealthHighStreak += 1;
  } else {
    gameState.knowledgeHealthHighStreak = 0;
  }

  if (gameState.knowledgeHealthHighStreak >= KNOWLEDGE_HEALTH_STREAK_BADGE_TARGET) {
    const streakBadge = addBadge({
      id: `kh-streak::${KNOWLEDGE_HEALTH_STREAK_BADGE_TARGET}`,
      title: "Knowledge Guard",
      description: `Maintained Knowledge Health above 80 for ${KNOWLEDGE_HEALTH_STREAK_BADGE_TARGET} challenges.`,
      category: "knowledge_health"
    });
    if (streakBadge) {
      newlyEarned.push(streakBadge);
    }
  }

  return newlyEarned;
}

export {
  initializeZones,
  setCurrentZone,
  setCurrentBranch,
  isZoneUnlocked,
  unlockOneZoneForTesting,
  recordBossOutcome,
  getBossStatusForCurrentZone,
  isCurrentZoneBossCompleted,
  isCurrentZoneReadyForBoss,
  getCurrentDifficulty,
  applyAnswerOutcome,
  recordBranchOutcome,
  modifyKnowledgeHealth,
  getKnowledgeHealth,
  isRemediationNeeded,
  getBranchMastery,
  getZoneMastery,
  getOverallMastery,
  getMasteryMap,
  getProgressSnapshot,
  getBranchProgress,
  appendResearchLog,
  getResearchLog,
  getResearchExportData,
  getClearTargets,
  addBadge,
  hasBadge,
  getBadges,
  evaluateAndAwardBadges,
  awardTimedPoints,
  recordQuestionTypeOutcome,
  getQuestionTypeMastery,
  getQuestionTypeMasteryMap,
  getGameState
};
