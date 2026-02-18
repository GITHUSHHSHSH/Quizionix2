import { createUserModel } from './userModel.js';
import { createQuestionEngine } from './questionEngine.js';
import { createAiEngine } from './aiEngine.js';

function nowIso() {
  return new Date().toISOString();
}

function simpleHash(input) {
  const text = String(input || 'anonymous-user');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `u_${Math.abs(hash)}`;
}

function latencyBucket(timeSpent, timeAllowed) {
  if (!timeAllowed || timeAllowed <= 0) return 'expected';
  const ratio = timeSpent / timeAllowed;
  if (ratio <= 0.5) return 'fast';
  if (ratio >= 0.9) return 'slow';
  return 'expected';
}

export class QuizEngine {
  constructor() {
    this.userModel = createUserModel();
    this.questionEngine = createQuestionEngine();
    this.aiEngine = createAiEngine();
    this.state = null;
  }

  async initialize() {
    await this.questionEngine.initialize();
  }

  getAvailableSubjects() {
    return this.questionEngine.getSubjects();
  }

  buildSessionId() {
    return `sess_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  resolveUserHash() {
    const email = localStorage.getItem('userEmail') || 'anonymous-user';
    return simpleHash(email);
  }

  ensureActiveQuiz() {
    if (!this.state) {
      throw new Error('Quiz has not been started.');
    }
  }

  ensureQuestionReady() {
    this.ensureActiveQuiz();
    if (!this.state.currentQuestion || this.state.currentEvaluated) {
      throw new Error('Current question is not available for submission.');
    }
  }

  toPublicQuestion(question) {
    if (!question) return null;
    return {
      id: question.id,
      subject: question.subject,
      topic: question.topic,
      skill: question.skill,
      learningTarget: question.learningTarget,
      difficulty: question.difficulty,
      prompt: question.prompt,
      choices: [...question.choices],
      hint: question.hint,
      selectionReason: question.selectionReason
    };
  }

  emitTelemetry(eventName, payload = {}) {
    if (!this.state) return;

    this.userModel.recordTelemetryEvent({
      event_name: eventName,
      event_version: 1,
      timestamp: nowIso(),
      session_id: this.state.sessionId,
      user_id_hash: this.state.userHash,
      subject: this.state.subject,
      learning_goal: this.state.learningGoal,
      question_id: payload.question_id ?? null,
      concept_id: payload.concept_id ?? null,
      topic: payload.topic ?? null,
      difficulty_before: payload.difficulty_before ?? null,
      difficulty_after: payload.difficulty_after ?? null,
      is_correct: payload.is_correct ?? null,
      is_skipped: payload.is_skipped ?? null,
      time_allowed_sec: payload.time_allowed_sec ?? null,
      time_spent_sec: payload.time_spent_sec ?? null,
      answer_latency_bucket: payload.answer_latency_bucket ?? null,
      question_index: payload.question_index ?? null,
      total_questions: this.state.totalQuestions,
      completion_rate: payload.completion_rate ?? null,
      error_code: payload.error_code ?? null,
      error_stage: payload.error_stage ?? null,
      motivation_proxy: payload.motivation_proxy ?? null,
      engagement_proxy: payload.engagement_proxy ?? null,
      perceived_effectiveness_proxy: payload.perceived_effectiveness_proxy ?? null,
      usability_proxy: payload.usability_proxy ?? null,
      metadata: payload.metadata || {}
    });
  }

  startQuiz({ subject, learningGoal = 'practice_basics', totalQuestions = 5 }) {
    if (!subject) {
      throw new Error('Subject is required.');
    }

    const availableSubjects = this.getAvailableSubjects();
    if (!availableSubjects.includes(subject)) {
      throw new Error(`Subject is not available: ${subject}`);
    }

    const safeTotalQuestions = Math.max(1, Number(totalQuestions) || 5);
    const subjectSnapshot = this.userModel.getSubjectSnapshot(subject);
    const recommendation = this.userModel.getRecommendedDifficulty(subject, learningGoal);

    this.state = {
      sessionId: this.buildSessionId(),
      userHash: this.resolveUserHash(),
      subject,
      learningGoal,
      totalQuestions: safeTotalQuestions,
      currentIndex: 0,
      currentDifficulty: recommendation.difficulty,
      difficultyReasons: recommendation.reasons,
      askedConceptIds: [],
      results: [],
      currentQuestion: null,
      currentEvaluated: false,
      startedAt: nowIso(),
      streak: 0,
      sessionXp: 0,
      sessionCoins: 0,
      rewardsCommitted: false
    };

    this.state.currentQuestion = this.questionEngine.generateQuestion({
      subject,
      learningGoal,
      difficulty: this.state.currentDifficulty,
      userModel: this.userModel,
      quizConceptHistory: this.state.askedConceptIds,
      prioritizeWeakTopics: learningGoal === 'weak_areas'
    });
    this.state.askedConceptIds.push(this.state.currentQuestion.conceptId);

    this.emitTelemetry('session_started', {
      question_id: this.state.currentQuestion.id,
      concept_id: this.state.currentQuestion.conceptId,
      topic: this.state.currentQuestion.topic,
      difficulty_before: this.state.currentDifficulty,
      difficulty_after: this.state.currentDifficulty,
      question_index: 1,
      metadata: { rationale: recommendation.reasons }
    });

    return {
      question: this.toPublicQuestion(this.state.currentQuestion),
      difficulty: this.state.currentDifficulty,
      rationale: recommendation.reasons,
      subjectSnapshot,
      progression: this.getProgressionDisplay()
    };
  }

  getCurrentQuestion() {
    this.ensureActiveQuiz();
    return this.toPublicQuestion(this.state.currentQuestion);
  }

  buildResult({ selectedChoice, response, timeSpent, timeAllowed, outcome }) {
    const isCorrect = response.isCorrect;
    const isSkipped = outcome === 'skip';
    const isTimedOut = outcome === 'timeout';

    if (isCorrect) {
      this.state.streak += 1;
      const streakBonus = Math.floor(this.state.streak / 3) * 2;
      const xpEarned = 10 + streakBonus;
      const coinsEarned = 5 + streakBonus;
      this.state.sessionXp += xpEarned;
      this.state.sessionCoins += coinsEarned;

      return {
        selectedChoice,
        isCorrect: true,
        isSkipped: false,
        isTimedOut: false,
        feedback: response.feedback,
        explanation: response.explanation,
        xpEarned,
        coinsEarned,
        timeSpent,
        timeAllowed,
        latency: latencyBucket(timeSpent, timeAllowed),
        outcome: 'answer_correct'
      };
    }

    this.state.streak = 0;

    if (isTimedOut) {
      return {
        selectedChoice: null,
        isCorrect: false,
        isSkipped: false,
        isTimedOut: true,
        feedback: `Time is up. ${response.explanation}`,
        explanation: response.explanation,
        xpEarned: 0,
        coinsEarned: 0,
        timeSpent,
        timeAllowed,
        latency: 'slow',
        outcome: 'timeout'
      };
    }

    if (isSkipped) {
      return {
        selectedChoice: null,
        isCorrect: false,
        isSkipped: true,
        isTimedOut: false,
        feedback: response.feedback,
        explanation: response.explanation,
        xpEarned: 0,
        coinsEarned: 0,
        timeSpent,
        timeAllowed,
        latency: latencyBucket(timeSpent, timeAllowed),
        outcome: 'skip'
      };
    }

    return {
      selectedChoice,
      isCorrect: false,
      isSkipped: false,
      isTimedOut: false,
      feedback: response.feedback,
      explanation: response.explanation,
      xpEarned: 0,
      coinsEarned: 0,
      timeSpent,
      timeAllowed,
      latency: latencyBucket(timeSpent, timeAllowed),
      outcome: 'answer_incorrect'
    };
  }

  commitResult(resultCore) {
    const question = this.state.currentQuestion;

    const record = {
      questionId: question.id,
      conceptId: question.conceptId,
      topic: question.topic,
      difficulty: this.state.currentDifficulty,
      selectedChoice: resultCore.selectedChoice,
      correctAnswer: question.answer,
      isCorrect: resultCore.isCorrect,
      isSkipped: resultCore.isSkipped,
      isTimedOut: resultCore.isTimedOut,
      feedback: resultCore.feedback,
      explanation: resultCore.explanation,
      xpEarned: resultCore.xpEarned,
      coinsEarned: resultCore.coinsEarned,
      timeSpent: resultCore.timeSpent,
      timeAllowed: resultCore.timeAllowed,
      outcome: resultCore.outcome
    };

    this.state.results.push(record);
    this.state.currentEvaluated = true;

    this.userModel.recordResponse({
      subject: this.state.subject,
      topic: question.topic,
      difficulty: this.state.currentDifficulty,
      isCorrect: resultCore.isCorrect,
      timeSpent: resultCore.timeSpent,
      learningGoal: this.state.learningGoal,
      outcome: resultCore.outcome
    });

    const previousDifficulty = this.state.currentDifficulty;
    const adaptation = this.aiEngine.adjustDifficulty({
      currentDifficulty: this.state.currentDifficulty,
      recentResults: this.state.results.map(item => item.isCorrect),
      learningGoal: this.state.learningGoal
    });

    this.state.currentDifficulty = adaptation.nextDifficulty;

    return {
      resultRecord: record,
      adaptation,
      previousDifficulty,
      progression: this.getProgressionDisplay()
    };
  }

  submitAnswer({ selectedChoice, timeSpent = 0, timeAllowed = 15 }) {
    this.ensureQuestionReady();

    const response = this.aiEngine.evaluateResponse({
      question: this.state.currentQuestion,
      selectedChoice,
      timeSpent,
      timeAllowed
    });

    const resultCore = this.buildResult({
      selectedChoice,
      response,
      timeSpent,
      timeAllowed,
      outcome: response.isCorrect ? 'answer' : 'incorrect'
    });

    const finalized = this.commitResult(resultCore);

    this.emitTelemetry('answer_submitted', {
      question_id: finalized.resultRecord.questionId,
      concept_id: finalized.resultRecord.conceptId,
      topic: finalized.resultRecord.topic,
      difficulty_before: finalized.previousDifficulty,
      difficulty_after: finalized.adaptation.nextDifficulty,
      is_correct: finalized.resultRecord.isCorrect,
      is_skipped: false,
      time_allowed_sec: timeAllowed,
      time_spent_sec: timeSpent,
      answer_latency_bucket: resultCore.latency,
      question_index: this.state.currentIndex + 1
    });

    return {
      ...finalized.resultRecord,
      adaptation: finalized.adaptation,
      progression: finalized.progression
    };
  }

  skipCurrentQuestion({ timeSpent = 0, timeAllowed = 15 }) {
    this.ensureQuestionReady();

    const response = this.aiEngine.evaluateResponse({
      question: this.state.currentQuestion,
      selectedChoice: null,
      timeSpent,
      timeAllowed
    });

    const resultCore = this.buildResult({
      selectedChoice: null,
      response,
      timeSpent,
      timeAllowed,
      outcome: 'skip'
    });

    const finalized = this.commitResult(resultCore);

    this.emitTelemetry('question_skipped', {
      question_id: finalized.resultRecord.questionId,
      concept_id: finalized.resultRecord.conceptId,
      topic: finalized.resultRecord.topic,
      difficulty_before: finalized.previousDifficulty,
      difficulty_after: finalized.adaptation.nextDifficulty,
      is_correct: false,
      is_skipped: true,
      time_allowed_sec: timeAllowed,
      time_spent_sec: timeSpent,
      answer_latency_bucket: resultCore.latency,
      question_index: this.state.currentIndex + 1
    });

    return {
      ...finalized.resultRecord,
      adaptation: finalized.adaptation,
      progression: finalized.progression
    };
  }

  timeoutCurrentQuestion({ timeSpent = 0, timeAllowed = 15 }) {
    this.ensureQuestionReady();

    const response = this.aiEngine.evaluateResponse({
      question: this.state.currentQuestion,
      selectedChoice: null,
      timeSpent,
      timeAllowed
    });

    const resultCore = this.buildResult({
      selectedChoice: null,
      response,
      timeSpent,
      timeAllowed,
      outcome: 'timeout'
    });

    const finalized = this.commitResult(resultCore);

    this.emitTelemetry('question_timeout', {
      question_id: finalized.resultRecord.questionId,
      concept_id: finalized.resultRecord.conceptId,
      topic: finalized.resultRecord.topic,
      difficulty_before: finalized.previousDifficulty,
      difficulty_after: finalized.adaptation.nextDifficulty,
      is_correct: false,
      is_skipped: false,
      time_allowed_sec: timeAllowed,
      time_spent_sec: timeSpent,
      answer_latency_bucket: 'slow',
      question_index: this.state.currentIndex + 1
    });

    return {
      ...finalized.resultRecord,
      adaptation: finalized.adaptation,
      progression: finalized.progression
    };
  }

  applyFiftyFifty() {
    this.ensureActiveQuiz();
    if (!this.state.currentQuestion) return [];

    const { choices, answer } = this.state.currentQuestion;
    const wrongChoices = choices.filter(choice => choice !== answer).sort((a, b) => a.localeCompare(b));
    const keep = new Set([answer, wrongChoices[0]]);
    return choices.filter(choice => !keep.has(choice));
  }

  getHint() {
    this.ensureActiveQuiz();
    return this.state.currentQuestion?.hint || '';
  }

  hasNextQuestion() {
    this.ensureActiveQuiz();
    return this.state.currentIndex + 1 < this.state.totalQuestions;
  }

  nextQuestion() {
    this.ensureActiveQuiz();

    if (!this.state.currentEvaluated) {
      throw new Error('Answer the current question before moving to next question.');
    }

    if (!this.hasNextQuestion()) {
      this.state.currentQuestion = null;
      return null;
    }

    this.state.currentIndex += 1;
    this.state.currentEvaluated = false;

    this.state.currentQuestion = this.questionEngine.generateQuestion({
      subject: this.state.subject,
      learningGoal: this.state.learningGoal,
      difficulty: this.state.currentDifficulty,
      userModel: this.userModel,
      quizConceptHistory: this.state.askedConceptIds,
      prioritizeWeakTopics: this.state.learningGoal === 'weak_areas'
    });

    this.state.askedConceptIds.push(this.state.currentQuestion.conceptId);

    this.emitTelemetry('question_presented', {
      question_id: this.state.currentQuestion.id,
      concept_id: this.state.currentQuestion.conceptId,
      topic: this.state.currentQuestion.topic,
      difficulty_before: this.state.currentDifficulty,
      difficulty_after: this.state.currentDifficulty,
      question_index: this.state.currentIndex + 1
    });

    return this.toPublicQuestion(this.state.currentQuestion);
  }

  getProgress() {
    this.ensureActiveQuiz();
    return {
      current: this.state.currentIndex + 1,
      total: this.state.totalQuestions,
      answered: this.state.results.length
    };
  }

  getProgressionDisplay() {
    const persisted = this.userModel.getProgressionSnapshot();

    return {
      totalXp: persisted.totalXp,
      rank: persisted.rank,
      rankProgress: persisted.rankProgress,
      totalCoins: persisted.totalCoins,
      level: persisted.level,
      sessionXp: this.state ? this.state.sessionXp : 0,
      streak: this.state ? this.state.streak : 0
    };
  }

  finishQuiz() {
    this.ensureActiveQuiz();

    if (this.state.results.length < this.state.totalQuestions) {
      throw new Error('Cannot finish quiz before all questions are answered.');
    }

    const total = this.state.totalQuestions;
    const correct = this.state.results.filter(item => item.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const completionRate = total > 0 ? Math.round((this.state.results.length / total) * 100) : 0;

    if (!this.state.rewardsCommitted) {
      this.userModel.applySessionRewards({
        subject: this.state.subject,
        xpEarned: this.state.sessionXp,
        coinsEarned: this.state.sessionCoins
      });
      this.state.rewardsCommitted = true;
    }

    const snapshot = this.userModel.getSubjectSnapshot(this.state.subject);
    const recommendations = this.aiEngine.generateRecommendations({
      subject: this.state.subject,
      learningGoal: this.state.learningGoal,
      userSnapshot: snapshot
    });
    const signals = this.userModel.getResearchSignals(this.state.subject);
    const progression = this.userModel.getProgressionSnapshot();

    this.userModel.recordSessionSummary({
      subject: this.state.subject,
      learningGoal: this.state.learningGoal,
      accuracy,
      completionRate,
      totalQuestions: total,
      sessionXp: this.state.sessionXp,
      sessionCoins: this.state.sessionCoins
    });

    this.emitTelemetry('session_completed', {
      completion_rate: completionRate,
      motivation_proxy: signals.motivation,
      engagement_proxy: signals.engagement,
      perceived_effectiveness_proxy: signals.perceivedEffectiveness,
      usability_proxy: signals.usability,
      question_index: this.state.results.length,
      metadata: {
        accuracy,
        correct,
        total,
        session_xp: this.state.sessionXp,
        session_coins: this.state.sessionCoins,
        final_rank: progression.rank
      }
    });

    const summary = {
      subject: this.state.subject,
      learningGoal: this.state.learningGoal,
      score: { correct, total, accuracy },
      results: [...this.state.results],
      recommendations,
      userSnapshot: snapshot,
      researchSignals: signals,
      progression,
      rewards: {
        sessionXp: this.state.sessionXp,
        sessionCoins: this.state.sessionCoins
      }
    };

    this.state = null;
    return summary;
  }

  getStudyPlan(subject = null) {
    const subjects = subject ? [subject] : this.getAvailableSubjects();

    return subjects
      .map(currentSubject => {
        const snapshot = this.userModel.getSubjectSnapshot(currentSubject);
        const recommendedDifficulty = this.userModel.getRecommendedDifficulty(currentSubject, 'weak_areas').difficulty;

        return {
          subject: currentSubject,
          accuracy: snapshot.accuracy,
          weakTopics: snapshot.weakTopics.slice(0, 2),
          recommendedDifficulty,
          totalXP: this.userModel.getSubjectXP(currentSubject)
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy);
  }

  getSubjectProgress() {
    return this.userModel.getProgressionSnapshot().subjectXp;
  }
}

export function createQuizEngine() {
  return new QuizEngine();
}
