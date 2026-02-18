const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

function clampDifficultyIndex(index) {
  return Math.max(0, Math.min(DIFFICULTIES.length - 1, index));
}

function difficultyToIndex(difficulty) {
  const index = DIFFICULTIES.indexOf(difficulty);
  return index >= 0 ? index : 0;
}

function stepDifficulty(currentDifficulty, step) {
  const currentIndex = difficultyToIndex(currentDifficulty);
  const nextIndex = clampDifficultyIndex(currentIndex + step);
  return DIFFICULTIES[nextIndex];
}

function normalizeResults(results) {
  if (!Array.isArray(results)) return [];
  return results.filter(value => typeof value === 'boolean');
}

export class AiEngine {
  evaluateResponse({ question, selectedChoice, timeSpent = 0, timeAllowed = 15 }) {
    const isSkipped = selectedChoice === null || selectedChoice === undefined;
    const isCorrect = !isSkipped && selectedChoice === question.answer;
    const paceRatio = timeAllowed > 0 ? Math.max(0, timeSpent) / timeAllowed : 1;

    let feedbackTone = 'Reinforce';
    if (isSkipped) {
      feedbackTone = 'Scaffold';
    } else if (isCorrect && paceRatio <= 0.6) {
      feedbackTone = 'Advance';
    } else if (!isCorrect) {
      feedbackTone = 'Corrective';
    }

    return {
      isCorrect,
      isSkipped,
      feedbackTone,
      feedback: this.buildFeedback({ question, isCorrect, isSkipped, feedbackTone }),
      explanation: question.explanation || ''
    };
  }

  buildFeedback({ question, isCorrect, isSkipped, feedbackTone }) {
    if (isSkipped) {
      return `Skipped. Use the hint and retry a similar ${question.topic} question.`;
    }

    if (isCorrect && feedbackTone === 'Advance') {
      return `Correct and fast. You are ready for a harder ${question.topic} item.`;
    }

    if (isCorrect) {
      return `Correct. Keep reinforcing ${question.skill}.`;
    }

    if (feedbackTone === 'Corrective') {
      return `Incorrect. Review the key idea, then try another ${question.topic} question.`;
    }

    return `Keep practicing ${question.topic}.`;
  }

  shouldFreezeForOscillation(recentResults) {
    if (recentResults.length < 3) return false;

    const r1 = recentResults[recentResults.length - 1];
    const r2 = recentResults[recentResults.length - 2];
    const r3 = recentResults[recentResults.length - 3];

    // Prevent up/down bouncing on alternating outcomes like T-F-T or F-T-F.
    return r1 !== r2 && r2 !== r3 && r1 === r3;
  }

  adjustDifficulty({ currentDifficulty, recentResults, learningGoal = 'practice_basics' }) {
    const recent = normalizeResults(recentResults).slice(-5);
    const correctCount = recent.filter(Boolean).length;
    const incorrectCount = recent.length - correctCount;
    const accuracy = recent.length ? correctCount / recent.length : 0;

    let step = 0;
    const reasons = [];

    if (recent.length >= 2) {
      const last = recent[recent.length - 1];
      const previous = recent[recent.length - 2];

      // Move harder only after stable success.
      if (last && previous && accuracy >= 0.6) {
        step = 1;
        reasons.push('Two recent correct answers increased difficulty.');
      }

      // Move easier only after stable errors.
      if (!last && !previous) {
        step = -1;
        reasons.push('Two recent incorrect answers reduced difficulty.');
      }
    }

    if (recent.length >= 4 && Math.abs(correctCount - incorrectCount) <= 1 && step !== 0) {
      step = 0;
      reasons.push('Mixed recent performance kept difficulty stable.');
    }

    if (this.shouldFreezeForOscillation(recent) && step !== 0) {
      step = 0;
      reasons.push('Alternating results detected; difficulty held to prevent oscillation.');
    }

    if (learningGoal === 'practice_basics' && step > 0) {
      step = 0;
      reasons.push('Practice basics keeps current level until mastery is consistent.');
    }

    if (learningGoal === 'challenge_mode' && step === 0 && accuracy >= 0.6) {
      step = 1;
      reasons.push('Challenge mode nudged difficulty upward after stable performance.');
    }

    const nextDifficulty = stepDifficulty(currentDifficulty, step);

    if (nextDifficulty === currentDifficulty && reasons.length === 0) {
      reasons.push('Difficulty unchanged. More evidence is needed before adapting.');
    }

    return { nextDifficulty, reasons };
  }

  generateRecommendations({ subject, learningGoal, userSnapshot }) {
    const weakTopics = Array.isArray(userSnapshot?.weakTopics) ? userSnapshot.weakTopics : [];
    const weakTopicText = weakTopics.length
      ? weakTopics.slice(0, 2).map(item => `${item.topic} (${item.accuracy}%)`).join(', ')
      : 'No weak topics yet';

    const recommendations = [];

    if (learningGoal === 'practice_basics') {
      recommendations.push('Use short retrieval practice on key definitions before harder questions.');
    }

    if (learningGoal === 'weak_areas') {
      recommendations.push(`Focus first on weak topics in ${subject}: ${weakTopicText}.`);
    }

    if (learningGoal === 'challenge_mode') {
      recommendations.push('After each advanced item, explain your reasoning in one sentence.');
    }

    if ((userSnapshot?.accuracy || 0) < 60) {
      recommendations.push('Review one worked example, then retry similar questions.');
    } else {
      recommendations.push('Mix topics to improve transfer and long-term retention.');
    }

    return recommendations;
  }
}

export function createAiEngine() {
  return new AiEngine();
}
