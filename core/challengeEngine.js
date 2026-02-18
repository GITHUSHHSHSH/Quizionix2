import {
  awardTimedPoints,
  evaluateAndAwardBadges,
  appendResearchLog,
  applyAnswerOutcome,
  getBranchMastery,
  getBranchProgress,
  getClearTargets,
  getBossStatusForCurrentZone,
  getKnowledgeHealth,
  getOverallMastery,
  getZoneMastery,
  isCurrentZoneBossCompleted,
  isCurrentZoneReadyForBoss,
  isRemediationNeeded,
  modifyKnowledgeHealth,
  recordBossOutcome,
  recordBranchOutcome,
  recordQuestionTypeOutcome,
  getQuestionTypeMastery,
  getGameState
} from "./gameState.js";

const TEST_ZONE_QUESTIONS = {
  Science: {
    id: "science-test-1",
    questionType: "multiple-choice",
    prompt: "Science Test: Which quantity has SI unit N (newton)?",
    options: ["Force", "Speed", "Mass", "Time"],
    answer: "Force"
  },
  Technology: {
    id: "technology-test-1",
    questionType: "multiple-choice",
    prompt: "Technology Test: Which protocol secures web traffic?",
    options: ["HTTP", "FTP", "SSH", "HTTPS"],
    answer: "HTTPS"
  },
  Engineering: {
    id: "engineering-test-1",
    questionType: "multiple-choice",
    prompt: "Engineering Test: Which process compares solutions against constraints and tradeoffs?",
    options: ["Guessing", "Design optimization", "Copying", "Randomization"],
    answer: "Design optimization"
  },
  Mathematics: {
    id: "mathematics-test-1",
    questionType: "multiple-choice",
    prompt: "Mathematics Test: Solve 3x + 2 = 11. What is x?",
    options: ["1", "2", "3", "4"],
    answer: "3"
  }
};

const DEFAULT_TEST_QUESTION = {
  id: "default-test-1",
  questionType: "multiple-choice",
  prompt: "Test Node: Select the keyword used in this prototype fallback.",
  options: ["study", "alpha", "beta", "gamma"],
  answer: "study"
};

const BOSS_DAMAGE_PER_CORRECT = 20;

function elevateDifficultyForBoss(difficulty) {
  if (difficulty === "Beginner") {
    return "Advanced";
  }

  return "Master";
}

function getFlavorLine(type, difficulty) {
  if (type === "boss") {
    return "Branch Boss active: reduce HP to 0 by answering correctly.";
  }

  if (difficulty === "Master") {
    return "Master node: precision and consistency matter.";
  }

  if (difficulty === "Advanced") {
    return "Advanced node: verify once, then commit.";
  }

  return "Beginner node: build momentum with clean clears.";
}

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getZoneTestQuestion(zoneName) {
  return TEST_ZONE_QUESTIONS[zoneName] || DEFAULT_TEST_QUESTION;
}

function generateMockChallenge(zoneName, branchName, difficultyLevel) {
  const zoneLabel = zoneName || "Unknown Zone";
  const branchLabel = branchName || "General Path";
  const baseDifficulty = difficultyLevel || "Beginner";
  const isBossEncounter = isCurrentZoneReadyForBoss() && !isCurrentZoneBossCompleted();
  const difficulty = isBossEncounter ? elevateDifficultyForBoss(baseDifficulty) : baseDifficulty;
  const needsRemediation = isRemediationNeeded();
  const template = getZoneTestQuestion(zoneLabel);
  const bossStatus = isBossEncounter ? getBossStatusForCurrentZone() : null;
  const hpTag = isBossEncounter && bossStatus
    ? ` Branch Boss HP: ${bossStatus.hp}/${bossStatus.maxHp}.`
    : "";
  const remediationTag = needsRemediation
    ? " Remediation hint: slow down and focus on one concept."
    : "";

  return {
    id: `${template.id}${isBossEncounter ? "-boss" : "-normal"}`,
    prompt: `${isBossEncounter ? `BOSS (${zoneLabel} - ${branchLabel}):` : `Encounter (${zoneLabel} - ${branchLabel}):`} ${template.prompt}${hpTag}${remediationTag} ${getFlavorLine(isBossEncounter ? "boss" : "branch", difficulty)}`,
    answer: template.answer,
    options: [...template.options],
    difficulty,
    remediation: needsRemediation,
    type: isBossEncounter ? "boss" : "branch",
    questionType: template.questionType,
    sourceBranch: branchLabel
  };
}

function buildChoiceOptions(challenge) {
  if (!challenge || challenge.questionType !== "multiple-choice") {
    return [];
  }

  return [...(challenge.options || [])];
}

function evaluateAnswer(playerAnswer, challenge, timing = {}) {
  const stateBefore = getGameState();
  const knowledgeHealthBefore = getKnowledgeHealth();
  const difficultyAtAnswer = challenge.difficulty || stateBefore.difficultyLevel;
  const challengeTypeForLog = challenge.type === "boss" ? "boss" : "normal";
  const questionTypeForLog = challenge.questionType || "text";
  const cleanedPlayer = normalizeAnswer(playerAnswer);
  const cleanedCorrect = normalizeAnswer(challenge.answer);
  const isCorrect = cleanedPlayer === cleanedCorrect;
  let remediationHint = "";
  const elapsedSeconds = Number(timing.elapsedSeconds) || 0;
  const expectedSeconds = Number(timing.expectedSeconds) || 0;

  applyAnswerOutcome(isCorrect);
  recordQuestionTypeOutcome(questionTypeForLog, isCorrect);

  let bossHpBefore = 0;
  let bossHpAfter = 0;
  let bossMaxHp = getClearTargets().boss;
  let bossOutcome = null;
  let damageDealt = 0;

  if (challenge.type === "boss") {
    const before = getBossStatusForCurrentZone();
    bossHpBefore = before ? before.hp : bossMaxHp;
    bossMaxHp = before ? before.maxHp : bossMaxHp;
    damageDealt = isCorrect ? BOSS_DAMAGE_PER_CORRECT : 0;
    bossOutcome = recordBossOutcome(isCorrect, damageDealt);
    const after = getBossStatusForCurrentZone();
    bossHpAfter = after ? after.hp : bossHpBefore;
  } else {
    recordBranchOutcome(isCorrect);
  }

  if (isCorrect) {
    modifyKnowledgeHealth(6);
  } else {
    modifyKnowledgeHealth(-14);
  }

  if (isRemediationNeeded()) {
    remediationHint = "Remediation active: review key idea, then attempt next node.";
  }

  const state = getGameState();
  const knowledgeHealthAfter = getKnowledgeHealth();
  const progressMap = getBranchProgress();
  const branchKey = state.currentZone && state.currentBranch
    ? `${state.currentZone}::${state.currentBranch}`
    : null;
  const currentBranchProgress = branchKey ? progressMap[branchKey] : null;
  const correctClears = currentBranchProgress ? currentBranchProgress.correct : 0;
  const clearTargets = getClearTargets();
  const targetClears = clearTargets.branch;
  const branchProgressText = `Branch progress: ${correctClears}/${targetClears} correct clears`;
  const bossStatus = getBossStatusForCurrentZone();
  const bossProgressText = bossStatus
    ? `Branch Boss HP: ${bossStatus.hp}/${bossStatus.maxHp}`
    : `Branch Boss HP: ${clearTargets.boss}/${clearTargets.boss}`;
  const branchMastery = state.currentZone && state.currentBranch
    ? getBranchMastery(state.currentZone, state.currentBranch)
    : 0;
  const zoneMastery = state.currentZone ? getZoneMastery(state.currentZone) : 0;
  const overallMastery = getOverallMastery();
  const questionTypeMastery = getQuestionTypeMastery(questionTypeForLog);
  const newBadges = evaluateAndAwardBadges(challenge.type, bossOutcome ? bossOutcome.damageDealt : 0);
  const bossReady = isCurrentZoneReadyForBoss();
  const rewardMultiplier = challenge.type === "boss" && isCorrect ? 1.25 : 1;
  const pointReward = awardTimedPoints(
    isCorrect,
    elapsedSeconds,
    expectedSeconds,
    challengeTypeForLog,
    difficultyAtAnswer,
    knowledgeHealthAfter,
    overallMastery,
    rewardMultiplier
  );

  appendResearchLog({
    zone: state.currentZone,
    branch: state.currentBranch,
    challengeType: challengeTypeForLog,
    bossHpBefore,
    bossHpAfter,
    bossMaxHp,
    bossCompleted: Boolean(bossStatus && bossStatus.completed),
    questionType: questionTypeForLog,
    challengeId: challenge.id || null,
    isCorrect,
    difficultyAtAnswer,
    knowledgeHealthBefore,
    knowledgeHealthAfter,
    branchMastery,
    zoneMastery,
    overallMastery,
    badgesEarned: newBadges.map((badge) => badge.id),
    pointsEarned: pointReward.pointsEarned,
    totalPoints: pointReward.totalPoints,
    timeRatio: pointReward.timeRatio,
    timeEfficiencyPercent: pointReward.timeEfficiencyPercent,
    performancePercent: pointReward.performancePercent,
    healthFactor: pointReward.healthFactor,
    masteryFactor: pointReward.masteryFactor,
    difficultyMultiplier: pointReward.difficultyMultiplier,
    rewardMultiplier: pointReward.rewardMultiplier
  });

  return {
    success: isCorrect,
    message: isCorrect
      ? challenge.type === "boss"
        ? `Boss hit! ${damageDealt} damage dealt.`
        : "Node Cleared: Correct answer."
      : challenge.type === "boss"
        ? "Boss resisted. Incorrect answer."
        : "Node Failed: Incorrect answer.",
    remediationHint,
    branchProgressText,
    bossProgressText,
    encounterType: challenge.type,
    questionType: questionTypeForLog,
    knowledgeHealth: getKnowledgeHealth(),
    branchProgress: state.branchProgress,
    branchCompleted: correctClears >= clearTargets.branch,
    bossCompleted: Boolean(bossStatus && bossStatus.completed),
    branchCorrectClears: correctClears,
    bossCorrectClears: bossStatus ? (bossStatus.maxHp - bossStatus.hp) : 0,
    bossDamageDealt: damageDealt,
    clearTargets,
    bossReady,
    questionTypeMastery,
    newBadges,
    pointsEarned: pointReward.pointsEarned,
    totalPoints: pointReward.totalPoints,
    timeRatio: pointReward.timeRatio,
    timeEfficiencyPercent: pointReward.timeEfficiencyPercent,
    performancePercent: pointReward.performancePercent,
    researchLogEntry: {
      zone: state.currentZone,
      branch: state.currentBranch,
      challengeType: challengeTypeForLog,
      bossHpBefore,
      bossHpAfter,
      bossMaxHp,
      bossCompleted: Boolean(bossStatus && bossStatus.completed),
      questionType: questionTypeForLog,
      challengeId: challenge.id || null,
      isCorrect,
      difficultyAtAnswer,
      knowledgeHealthBefore,
      knowledgeHealthAfter,
      branchMastery,
      zoneMastery,
      overallMastery,
      questionTypeMastery,
      badgesEarned: newBadges.map((badge) => badge.id),
      pointsEarned: pointReward.pointsEarned,
      totalPoints: pointReward.totalPoints,
      timeRatio: pointReward.timeRatio,
      timeEfficiencyPercent: pointReward.timeEfficiencyPercent,
      performancePercent: pointReward.performancePercent,
      healthFactor: pointReward.healthFactor,
      masteryFactor: pointReward.masteryFactor,
      difficultyMultiplier: pointReward.difficultyMultiplier,
      rewardMultiplier: pointReward.rewardMultiplier
    }
  };
}

function getChallengeContentDiagnostics() {
  return {
    authoredZones: Object.keys(TEST_ZONE_QUESTIONS),
    authoredBranches: 0,
    bossModel: "branch_hp",
    bossMaxHp: getClearTargets().boss
  };
}

export {
  generateMockChallenge,
  buildChoiceOptions,
  evaluateAnswer,
  getChallengeContentDiagnostics
};
