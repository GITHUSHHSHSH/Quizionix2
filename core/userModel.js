const STORAGE_KEY = 'quizionix_user_model_v3';
const LEGACY_STORAGE_KEY = 'quizionix_user_model_v2';
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

const RANK_TIERS = [
  { name: 'Nova Cadet', minXp: 0 },
  { name: 'Pulse Explorer', minXp: 200 },
  { name: 'Vector Ranger', minXp: 400 },
  { name: 'Arc Scholar', minXp: 650 },
  { name: 'Quantum Vanguard', minXp: 900 },
  { name: 'Aether Sage', minXp: 1200 }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeParse(jsonText) {
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch (_error) {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyTopicState() {
  return {
    attempted: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
    timedOut: 0,
    recentResults: [],
    lastSeenAt: null
  };
}

function createEmptySubjectState() {
  return {
    attempted: 0,
    correct: 0,
    incorrect: 0,
    skipped: 0,
    timedOut: 0,
    streak: 0,
    bestStreak: 0,
    recentResults: [],
    difficultyHistory: [],
    weakTopicHistory: [],
    topicStats: {},
    lastDifficulty: 'Intermediate'
  };
}

function createDefaultProgression() {
  return {
    subjectXp: {},
    totalCoins: 0
  };
}

function createEmptyUserState() {
  return {
    subjects: {},
    sessions: [],
    progression: createDefaultProgression(),
    telemetry: []
  };
}

function normalizeTopicState(raw) {
  const src = safeObject(raw);
  return {
    attempted: Math.max(0, safeNumber(src.attempted, 0)),
    correct: Math.max(0, safeNumber(src.correct, 0)),
    incorrect: Math.max(0, safeNumber(src.incorrect, 0)),
    skipped: Math.max(0, safeNumber(src.skipped, 0)),
    timedOut: Math.max(0, safeNumber(src.timedOut, 0)),
    recentResults: safeArray(src.recentResults).filter(value => typeof value === 'boolean').slice(-20),
    lastSeenAt: src.lastSeenAt ? safeString(src.lastSeenAt, null) : null
  };
}

function normalizeSubjectState(raw) {
  const src = safeObject(raw);
  const topicStatsRaw = safeObject(src.topicStats);
  const topicStats = {};

  for (const topic of Object.keys(topicStatsRaw)) {
    topicStats[topic] = normalizeTopicState(topicStatsRaw[topic]);
  }

  const difficultyHistory = safeArray(src.difficultyHistory)
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      difficulty: DIFFICULTIES.includes(entry.difficulty) ? entry.difficulty : 'Intermediate',
      isCorrect: Boolean(entry.isCorrect),
      topic: safeString(entry.topic),
      learningGoal: safeString(entry.learningGoal, 'practice_basics'),
      outcome: safeString(entry.outcome, 'answer'),
      timeSpent: Math.max(0, safeNumber(entry.timeSpent, 0)),
      at: safeString(entry.at, nowIso())
    }))
    .slice(-200);

  const weakTopicHistory = safeArray(src.weakTopicHistory)
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      at: safeString(entry.at, nowIso()),
      weakTopics: safeArray(entry.weakTopics).filter(item => typeof item === 'string').slice(0, 5)
    }))
    .slice(-120);

  return {
    attempted: Math.max(0, safeNumber(src.attempted, 0)),
    correct: Math.max(0, safeNumber(src.correct, 0)),
    incorrect: Math.max(0, safeNumber(src.incorrect, 0)),
    skipped: Math.max(0, safeNumber(src.skipped, 0)),
    timedOut: Math.max(0, safeNumber(src.timedOut, 0)),
    streak: Math.max(0, safeNumber(src.streak, 0)),
    bestStreak: Math.max(0, safeNumber(src.bestStreak, 0)),
    recentResults: safeArray(src.recentResults).filter(value => typeof value === 'boolean').slice(-30),
    difficultyHistory,
    weakTopicHistory,
    topicStats,
    lastDifficulty: DIFFICULTIES.includes(src.lastDifficulty) ? src.lastDifficulty : 'Intermediate'
  };
}

function normalizeUserState(raw) {
  const src = safeObject(raw);
  const subjectsRaw = safeObject(src.subjects);
  const subjects = {};

  for (const subject of Object.keys(subjectsRaw)) {
    subjects[subject] = normalizeSubjectState(subjectsRaw[subject]);
  }

  const progressionRaw = safeObject(src.progression);
  const subjectXpRaw = safeObject(progressionRaw.subjectXp);
  const subjectXp = {};
  for (const subject of Object.keys(subjectXpRaw)) {
    subjectXp[subject] = Math.max(0, safeNumber(subjectXpRaw[subject], 0));
  }

  const sessions = safeArray(src.sessions)
    .filter(item => item && typeof item === 'object')
    .slice(-150);

  const telemetry = safeArray(src.telemetry)
    .filter(item => item && typeof item === 'object')
    .slice(-5000);

  return {
    subjects,
    sessions,
    progression: {
      subjectXp,
      totalCoins: Math.max(0, safeNumber(progressionRaw.totalCoins, 0))
    },
    telemetry
  };
}

function createDefaultRootState() {
  return {
    version: 3,
    updatedAt: nowIso(),
    users: {}
  };
}

export class UserModel {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.state = this.load();
  }

  getCurrentUserId() {
    const email = safeString(localStorage.getItem('userEmail'), '').trim().toLowerCase();
    return email || 'anonymous-user';
  }

  load() {
    const raw = safeParse(localStorage.getItem(this.storageKey));

    if (raw && raw.version === 3 && raw.users && typeof raw.users === 'object') {
      const users = {};
      for (const userId of Object.keys(raw.users)) {
        users[userId] = normalizeUserState(raw.users[userId]);
      }

      return {
        version: 3,
        updatedAt: safeString(raw.updatedAt, nowIso()),
        users
      };
    }

    // Migrate legacy v2 single-user shape into v3 under current user.
    const legacyRaw = raw || safeParse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacyRaw && legacyRaw.subjects && legacyRaw.progression) {
      const migrated = createDefaultRootState();
      const userId = this.getCurrentUserId();
      migrated.users[userId] = normalizeUserState(legacyRaw);
      return migrated;
    }

    return createDefaultRootState();
  }

  save() {
    try {
      this.state.updatedAt = nowIso();
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (_error) {
      // If localStorage is full/blocked, keep in-memory state so app still works.
    }
  }

  getActiveUserState() {
    const userId = this.getCurrentUserId();
    if (!this.state.users[userId]) {
      this.state.users[userId] = createEmptyUserState();
      this.save();
    }
    return this.state.users[userId];
  }

  ensureSubject(subject) {
    const user = this.getActiveUserState();
    if (!user.subjects[subject]) {
      user.subjects[subject] = createEmptySubjectState();
      this.save();
    }
    return user.subjects[subject];
  }

  ensureTopic(subjectState, topic) {
    if (!subjectState.topicStats[topic]) {
      subjectState.topicStats[topic] = createEmptyTopicState();
    }
    return subjectState.topicStats[topic];
  }

  getSubjectSnapshot(subject) {
    const subjectState = this.ensureSubject(subject);
    const accuracy = subjectState.attempted > 0
      ? Math.round((subjectState.correct / subjectState.attempted) * 100)
      : 0;

    const weakTopics = Object.entries(subjectState.topicStats)
      .map(([topic, stats]) => {
        const topicAccuracy = stats.attempted > 0 ? (stats.correct / stats.attempted) : 0;
        return {
          topic,
          attempted: stats.attempted,
          accuracy: Math.round(topicAccuracy * 100),
          score: topicAccuracy - Math.min(stats.attempted, 5) * 0.04
        };
      })
      .sort((a, b) => a.score - b.score)
      .map(item => ({ topic: item.topic, attempted: item.attempted, accuracy: item.accuracy }));

    return {
      attempted: subjectState.attempted,
      correct: subjectState.correct,
      incorrect: subjectState.incorrect,
      skipped: subjectState.skipped,
      timedOut: subjectState.timedOut,
      streak: subjectState.streak,
      bestStreak: subjectState.bestStreak,
      accuracy,
      weakTopics,
      lastDifficulty: subjectState.lastDifficulty,
      weakTopicHistory: [...subjectState.weakTopicHistory]
    };
  }

  getWeakTopics(subject, limit = 2) {
    return this.getSubjectSnapshot(subject).weakTopics.slice(0, limit).map(item => item.topic);
  }

  getRecentAccuracy(subject, sampleSize = 6) {
    const subjectState = this.ensureSubject(subject);
    const recent = subjectState.recentResults.slice(-sampleSize);
    if (!recent.length) return 0;
    const correct = recent.filter(Boolean).length;
    return correct / recent.length;
  }

  getRecommendedDifficulty(subject, learningGoal = 'practice_basics') {
    const snapshot = this.getSubjectSnapshot(subject);
    const recentAccuracy = this.getRecentAccuracy(subject, 6);

    let difficulty = 'Intermediate';
    const reasons = [];

    if (learningGoal === 'practice_basics') {
      difficulty = snapshot.accuracy >= 75 ? 'Intermediate' : 'Beginner';
      reasons.push('Practice basics favors stable foundational difficulty.');
    } else if (learningGoal === 'weak_areas') {
      difficulty = snapshot.accuracy >= 65 ? 'Intermediate' : 'Beginner';
      reasons.push('Weak-area mode starts lower to rebuild confidence.');
    } else if (learningGoal === 'challenge_mode') {
      difficulty = snapshot.accuracy >= 70 ? 'Advanced' : 'Intermediate';
      reasons.push('Challenge mode targets higher cognitive load.');
    }

    if (recentAccuracy >= 0.8 && difficulty !== 'Advanced') {
      difficulty = DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, DIFFICULTIES.indexOf(difficulty) + 1)];
      reasons.push('Recent high accuracy supports one level increase.');
    }

    if (recentAccuracy > 0 && recentAccuracy <= 0.4 && difficulty !== 'Beginner') {
      difficulty = DIFFICULTIES[Math.max(0, DIFFICULTIES.indexOf(difficulty) - 1)];
      reasons.push('Recent low accuracy suggests reducing difficulty.');
    }

    return { difficulty, reasons };
  }

  recordResponse({
    subject,
    topic,
    difficulty,
    isCorrect,
    timeSpent = 0,
    learningGoal = 'practice_basics',
    outcome = 'answer'
  }) {
    const subjectState = this.ensureSubject(subject);
    const topicState = this.ensureTopic(subjectState, topic);

    subjectState.attempted += 1;
    topicState.attempted += 1;

    if (isCorrect) {
      subjectState.correct += 1;
      topicState.correct += 1;
      subjectState.streak += 1;
      subjectState.bestStreak = Math.max(subjectState.bestStreak, subjectState.streak);
    } else {
      subjectState.incorrect += 1;
      topicState.incorrect += 1;
      subjectState.streak = 0;

      if (outcome === 'skip') {
        subjectState.skipped += 1;
        topicState.skipped += 1;
      }
      if (outcome === 'timeout') {
        subjectState.timedOut += 1;
        topicState.timedOut += 1;
      }
    }

    subjectState.lastDifficulty = DIFFICULTIES.includes(difficulty) ? difficulty : 'Intermediate';
    subjectState.recentResults.push(Boolean(isCorrect));
    subjectState.recentResults = subjectState.recentResults.slice(-30);

    topicState.recentResults.push(Boolean(isCorrect));
    topicState.recentResults = topicState.recentResults.slice(-20);
    topicState.lastSeenAt = nowIso();

    subjectState.difficultyHistory.push({
      difficulty: subjectState.lastDifficulty,
      isCorrect: Boolean(isCorrect),
      topic: safeString(topic),
      learningGoal: safeString(learningGoal, 'practice_basics'),
      outcome: safeString(outcome, 'answer'),
      timeSpent: Math.max(0, safeNumber(timeSpent, 0)),
      at: nowIso()
    });
    subjectState.difficultyHistory = subjectState.difficultyHistory.slice(-200);

    const weakTopics = this.getWeakTopics(subject, 5);
    subjectState.weakTopicHistory.push({ at: nowIso(), weakTopics });
    subjectState.weakTopicHistory = subjectState.weakTopicHistory.slice(-120);

    this.save();
  }

  getSubjectXP(subject) {
    const user = this.getActiveUserState();
    return Math.max(0, safeNumber(user.progression.subjectXp[subject], 0));
  }

  getTotalXP(subjects = []) {
    const user = this.getActiveUserState();

    if (!subjects.length) {
      return Object.values(user.progression.subjectXp)
        .reduce((sum, value) => sum + Math.max(0, safeNumber(value, 0)), 0);
    }

    return subjects.reduce((sum, subject) => sum + this.getSubjectXP(subject), 0);
  }

  getAcademicRank(totalXP) {
    for (let i = RANK_TIERS.length - 1; i >= 0; i -= 1) {
      if (totalXP >= RANK_TIERS[i].minXp) return RANK_TIERS[i].name;
    }
    return RANK_TIERS[0].name;
  }

  getRankProgress(totalXP) {
    const rank = this.getAcademicRank(totalXP);
    const index = RANK_TIERS.findIndex(tier => tier.name === rank);
    const currentTier = RANK_TIERS[index];
    const nextTier = RANK_TIERS[index + 1];

    if (!nextTier) {
      return { current: totalXP, target: totalXP, nextRank: 'Max Rank' };
    }

    return {
      current: Math.max(0, totalXP - currentTier.minXp),
      target: nextTier.minXp - currentTier.minXp,
      nextRank: nextTier.name
    };
  }

  applySessionRewards({ subject, xpEarned, coinsEarned }) {
    const user = this.getActiveUserState();
    const safeXp = Math.max(0, safeNumber(xpEarned, 0));
    const safeCoins = Math.max(0, safeNumber(coinsEarned, 0));

    user.progression.subjectXp[subject] = this.getSubjectXP(subject) + safeXp;
    user.progression.totalCoins = Math.max(0, safeNumber(user.progression.totalCoins, 0)) + safeCoins;

    this.save();
    return this.getProgressionSnapshot();
  }

  getProgressionSnapshot() {
    const user = this.getActiveUserState();
    const totalXp = this.getTotalXP();
    const totalCoins = Math.max(0, safeNumber(user.progression.totalCoins, 0));

    return {
      subjectXp: { ...user.progression.subjectXp },
      totalXp,
      totalCoins,
      level: Math.max(1, Math.floor(totalCoins / 50) + 1),
      rank: this.getAcademicRank(totalXp),
      rankProgress: this.getRankProgress(totalXp)
    };
  }

  recordSessionSummary(summary) {
    const user = this.getActiveUserState();
    user.sessions.push({ ...summary, finishedAt: nowIso() });
    user.sessions = user.sessions.slice(-150);
    this.save();
  }

  getResearchSignals(subject) {
    const snapshot = this.getSubjectSnapshot(subject);
    const user = this.getActiveUserState();
    const sessions = user.sessions.filter(item => item.subject === subject).slice(-10);

    const averageCompletion = sessions.length
      ? Math.round(sessions.reduce((sum, item) => sum + safeNumber(item.completionRate, 0), 0) / sessions.length)
      : 0;

    return {
      motivation: clamp(Math.round((snapshot.bestStreak * 4) + (averageCompletion * 0.6)), 0, 100),
      engagement: clamp(Math.round((snapshot.attempted * 2) + (snapshot.streak * 6)), 0, 100),
      perceivedEffectiveness: clamp(snapshot.accuracy, 0, 100),
      usability: clamp(Math.round(75 + ((snapshot.attempted > 0 ? 1 : -1) * 8)), 0, 100)
    };
  }

  recordTelemetryEvent(event) {
    const user = this.getActiveUserState();
    user.telemetry.push(event);
    user.telemetry = user.telemetry.slice(-5000);
    this.save();
  }

  getTelemetryEvents(limit = 100) {
    const user = this.getActiveUserState();
    return user.telemetry.slice(-Math.max(1, safeNumber(limit, 100)));
  }
}

export function createUserModel(storageKey) {
  return new UserModel(storageKey);
}
