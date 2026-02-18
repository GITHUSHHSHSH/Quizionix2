const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];

  const unique = [];
  const seen = new Set();

  for (const item of value) {
    const text = cleanText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    unique.push(text);
  }

  return unique;
}

function rotateList(list, offset) {
  if (!list.length) return [];
  const shift = ((offset % list.length) + list.length) % list.length;
  return list.slice(shift).concat(list.slice(0, shift));
}

function pickFromList(list, index, fallback) {
  if (!list.length) return fallback;
  return list[index % list.length];
}

function ensureDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : 'Beginner';
}

function nonEmptyOr(value, fallback) {
  const text = cleanText(value);
  return text || fallback;
}

export class QuestionEngine {
  constructor() {
    this.concepts = [];
  }

  async initialize() {
    const conceptBankRes = await fetch('./data/conceptBank.json');

    if (!conceptBankRes.ok) {
      throw new Error('Failed to load concept bank.');
    }

    const conceptBank = await conceptBankRes.json();
    if (!Array.isArray(conceptBank?.concepts) || conceptBank.concepts.length === 0) {
      throw new Error('Invalid conceptBank structure.');
    }

    this.concepts = conceptBank.concepts
      .map(concept => this.normalizeConcept(concept))
      .filter(Boolean);

    if (!this.concepts.length) {
      throw new Error('No valid concepts found in conceptBank.');
    }
  }

  normalizeConcept(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = cleanText(raw.id);
    const subject = cleanText(raw.subject);
    const topic = cleanText(raw.topic);
    const name = cleanText(raw.name);

    if (!id || !subject || !topic || !name) return null;

    return {
      id,
      subject,
      topic,
      name,
      skill: nonEmptyOr(raw.skill, `Understand ${name}`),
      learningTarget: nonEmptyOr(raw.learningTarget, `Explain ${name}`),
      keyIdea: nonEmptyOr(raw.keyIdea, `${name} is the main idea for this concept.`),
      questionStems: cleanList(raw.questionStems),
      correctStatements: cleanList(raw.correctStatements),
      misconceptions: cleanList(raw.misconceptions),
      applications: cleanList(raw.applications),
      challengePrompts: cleanList(raw.challengePrompts),
      hints: cleanList(raw.hints)
    };
  }

  getSubjects() {
    return Array.from(new Set(this.concepts.map(concept => concept.subject)));
  }

  getTopicsForSubject(subject) {
    const cleanSubject = cleanText(subject);
    if (!cleanSubject) return [];

    return Array.from(
      new Set(
        this.concepts
          .filter(concept => concept.subject === cleanSubject)
          .map(concept => concept.topic)
      )
    );
  }

  getWeakTopics(subject, userModel, limit = 3) {
    if (!userModel || typeof userModel.getWeakTopics !== 'function') return [];
    const weak = userModel.getWeakTopics(subject, limit);
    return cleanList(weak);
  }

  buildConceptCandidates({ subject, learningGoal, prioritizeWeakTopics, userModel }) {
    const subjectConcepts = this.concepts.filter(concept => concept.subject === subject);
    if (!subjectConcepts.length) return [];

    const shouldPrioritizeWeak = learningGoal === 'weak_areas' || prioritizeWeakTopics === true;
    if (!shouldPrioritizeWeak) return subjectConcepts;

    const weakTopics = this.getWeakTopics(subject, userModel, 5);
    if (!weakTopics.length) return subjectConcepts;

    const weakFirst = subjectConcepts.filter(concept => weakTopics.includes(concept.topic));
    const rest = subjectConcepts.filter(concept => !weakTopics.includes(concept.topic));
    return [...weakFirst, ...rest];
  }

  scoreConcept({ concept, learningGoal, weakTopics, quizConceptHistory }) {
    const seenCount = quizConceptHistory.filter(id => id === concept.id).length;

    let score = 0;
    if (weakTopics.includes(concept.topic)) score += 100;
    if (learningGoal === 'challenge_mode') score += concept.challengePrompts.length > 0 ? 10 : 0;
    if (learningGoal === 'practice_basics') score += concept.questionStems.length > 1 ? 4 : 0;

    score -= seenCount * 8;
    return score;
  }

  selectConcept({ subject, learningGoal, prioritizeWeakTopics, userModel, quizConceptHistory }) {
    const candidates = this.buildConceptCandidates({
      subject,
      learningGoal,
      prioritizeWeakTopics,
      userModel
    });

    if (!candidates.length) {
      throw new Error(`No concepts found for subject: ${subject}`);
    }

    const weakTopics = this.getWeakTopics(subject, userModel, 5);

    const ranked = candidates
      .map(concept => ({
        concept,
        score: this.scoreConcept({
          concept,
          learningGoal,
          weakTopics,
          quizConceptHistory
        })
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.concept.id.localeCompare(b.concept.id);
      });

    return ranked[0];
  }

  buildPrompt(concept, difficulty, sequenceIndex) {
    const source = difficulty === 'Advanced'
      ? [...concept.challengePrompts, ...concept.questionStems]
      : concept.questionStems;

    return nonEmptyOr(
      pickFromList(source, sequenceIndex, ''),
      `Which statement best describes ${concept.name}?`
    );
  }

  buildCorrectAnswer(concept, difficulty, sequenceIndex) {
    const source = difficulty === 'Advanced' && concept.applications.length
      ? concept.applications
      : concept.correctStatements;

    return nonEmptyOr(
      pickFromList(source, sequenceIndex, ''),
      concept.keyIdea
    );
  }

  buildDistractors(concept, correctAnswer) {
    const distractors = [];
    const seen = new Set([correctAnswer]);

    for (const misconception of concept.misconceptions) {
      if (!seen.has(misconception)) {
        distractors.push(misconception);
        seen.add(misconception);
      }
      if (distractors.length === 3) break;
    }

    let fillerIndex = 1;
    while (distractors.length < 3) {
      const fallback = `Incorrect interpretation ${fillerIndex} of ${concept.name}.`;
      if (!seen.has(fallback)) {
        distractors.push(fallback);
        seen.add(fallback);
      }
      fillerIndex += 1;
    }

    return distractors;
  }

  buildChoices(correctAnswer, distractors, sequenceIndex) {
    const base = [correctAnswer, ...distractors.slice(0, 3)];
    const rotated = rotateList(base, sequenceIndex);
    return rotated.map((choice, index) => nonEmptyOr(choice, `Choice ${index + 1}`));
  }

  validateQuestion(question) {
    if (!cleanText(question.prompt)) {
      throw new Error('Generated question has empty prompt.');
    }

    if (!Array.isArray(question.choices) || question.choices.length < 2) {
      throw new Error('Generated question has invalid choices.');
    }

    if (question.choices.some(choice => !cleanText(choice))) {
      throw new Error('Generated question has empty choice text.');
    }

    const answerMatches = question.choices.filter(choice => choice === question.answer).length;
    if (answerMatches !== 1) {
      throw new Error('Generated question must include exactly one correct answer.');
    }
  }

  generateQuestion({
    subject,
    learningGoal = 'practice_basics',
    difficulty = 'Beginner',
    userModel,
    quizConceptHistory = [],
    prioritizeWeakTopics = false
  }) {
    const normalizedSubject = cleanText(subject);
    if (!normalizedSubject) {
      throw new Error('Subject is required to generate a question.');
    }

    const safeHistory = Array.isArray(quizConceptHistory) ? quizConceptHistory : [];
    const normalizedDifficulty = ensureDifficulty(difficulty);

    const selected = this.selectConcept({
      subject: normalizedSubject,
      learningGoal,
      prioritizeWeakTopics,
      userModel,
      quizConceptHistory: safeHistory
    });

    const concept = selected.concept;
    const sequenceIndex = safeHistory.length;

    const prompt = this.buildPrompt(concept, normalizedDifficulty, sequenceIndex);
    const answer = this.buildCorrectAnswer(concept, normalizedDifficulty, sequenceIndex);
    const distractors = this.buildDistractors(concept, answer);
    const choices = this.buildChoices(answer, distractors, sequenceIndex);

    const question = {
      id: `${concept.id}-${normalizedDifficulty}-${sequenceIndex}`,
      conceptId: concept.id,
      subject: concept.subject,
      topic: concept.topic,
      skill: concept.skill,
      learningTarget: concept.learningTarget,
      difficulty: normalizedDifficulty,
      prompt,
      choices,
      answer,
      hint: nonEmptyOr(
        pickFromList(concept.hints, sequenceIndex, ''),
        `Focus on this key idea: ${concept.keyIdea}`
      ),
      explanation: `${concept.keyIdea} Example: ${pickFromList(concept.applications, sequenceIndex, concept.learningTarget)}`,
      selectionReason: {
        learningGoal,
        selectedTopic: concept.topic,
        selectedConcept: concept.name,
        score: selected.score
      }
    };

    this.validateQuestion(question);
    return question;
  }
}

export function createQuestionEngine() {
  return new QuestionEngine();
}
