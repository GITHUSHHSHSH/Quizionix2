import { createQuizEngine } from './core/quizEngine.js';

const engine = createQuizEngine();

const loadingScreen = document.getElementById('loadingScreen');
const loginPage = document.getElementById('loginPage');
const frontPage = document.getElementById('frontPage');
const loginCard = document.getElementById('loginCard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const app = document.getElementById('app');
const startBtn = document.getElementById('startBtn');
const questionsStatusEl = document.getElementById('questionsStatus');
const profileEmailEl = document.getElementById('profileEmail');
const showLoginBtn = document.getElementById('showLoginBtn');
const backToFrontBtn = document.getElementById('backToFrontBtn');
const aboutBtn = document.getElementById('aboutBtn');
const frontSettingsBtn = document.getElementById('frontSettingsBtn');
const frontSettingsPanel = document.getElementById('frontSettingsPanel');
const frontDarkModeToggle = document.getElementById('frontDarkModeToggle');
const frontHighContrastToggle = document.getElementById('frontHighContrastToggle');
const frontReduceMotionToggle = document.getElementById('frontReduceMotionToggle');

const subjectBtns = document.querySelectorAll('.subjectBtn');
const subjectStudyBtns = document.querySelectorAll('.subjectStudyBtn');
const subjectCards = document.querySelectorAll('.subject-card');
const subjectFilterSelect = document.getElementById('subjectFilterSelect');
const clearSubjectFilterBtn = document.getElementById('clearSubjectFilterBtn');
const subjectQuickMenu = document.getElementById('subjectQuickMenu');
const subjectsMenuItem = document.querySelector('.has-submenu[data-tab="subjectsTab"]');
const tabItems = document.querySelectorAll('.sidebar > ul > li');
const tabPages = document.querySelectorAll('.tab-page');
const menuToggleBtn = document.getElementById('menuToggleBtn');
const sidebarEl = document.querySelector('.sidebar');
const menuRankBadge = document.getElementById('menuRankBadge');

const subjectTitleEl = document.getElementById('subjectTitle');
const questionEl = document.getElementById('question');
const choicesEl = document.getElementById('choices');
const feedbackEl = document.getElementById('feedback');
const explanationEl = document.getElementById('explanation');
const nextBtn = document.getElementById('nextBtn');
const timeEl = document.getElementById('time');
const xpEl = document.getElementById('xp');
const streakEl = document.getElementById('streak');
const coinsEl = document.getElementById('coins');
const levelEl = document.getElementById('level');
const rankEl = document.getElementById('rank');

const summarySubtitleEl = document.getElementById('summarySubtitle');
const summaryList = document.getElementById('summaryList');
const totalXPSummary = document.getElementById('totalXPSummary');
const returnDashboard = document.getElementById('returnDashboard');

const fiftyFiftyBtn = document.getElementById('fiftyFiftyBtn');
const hintBtn = document.getElementById('hintBtn');
const skipBtn = document.getElementById('skipBtn');
const quizSettingsBtn = document.getElementById('quizSettingsBtn');
const quizBackMenuBtn = document.getElementById('quizBackMenuBtn');

const studySubjectSelect = document.getElementById('studySubjectSelect');
const generateStudyPlanBtn = document.getElementById('generateStudyPlanBtn');
const studyPlanOutput = document.getElementById('studyPlanOutput');
const studySnapshot = document.getElementById('studySnapshot');
const studyMethodsList = document.getElementById('studyMethodsList');
const studyMaterialsList = document.getElementById('studyMaterialsList');
const featuredMaterialsList = document.getElementById('featuredMaterialsList');

const homeRankGuide = document.getElementById('homeRankGuide');
const rankProgressFill = document.getElementById('rankProgressFill');
const rankProgressText = document.getElementById('rankProgressText');
const dashboardProgressText = document.getElementById('dashboardProgressText');
const dashboardRankFill = document.getElementById('dashboardRankFill');
const dashboardRankName = document.getElementById('dashboardRankName');
const dashboardRankHint = document.getElementById('dashboardRankHint');
const todoInput = document.getElementById('todoInput');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoList = document.getElementById('todoList');

const sfxToggle = document.getElementById('sfxToggle');
const musicVolumeInput = document.getElementById('musicVolume');
const timerPerQuestionSelect = document.getElementById('timerPerQuestion');
const highContrastToggle = document.getElementById('highContrastToggle');
const reduceMotionToggle = document.getElementById('reduceMotionToggle');
const clearLocalDataBtn = document.getElementById('clearLocalDataBtn');
const darkModeToggleSettings = document.getElementById('darkModeToggleSettings');

let selectedSubject = '';
let selectedGoal = 'practice_basics';
let timer = null;
let timerDuration = 15;
let timeLeft = 15;
let questionStartAt = 0;
let quizSummary = null;
let currentQuestion = null;
let questionLocked = false;
let lifelinesUsed = { fifty: false, hint: false, skip: false };
let latestProgression = {
  sessionXp: 0,
  streak: 0,
  totalCoins: 0,
  level: 1,
  rank: 'Nova Cadet',
  rankProgress: { current: 0, target: 200, nextRank: 'Pulse Explorer' }
};

const THEME_KEY = 'quizTheme';
const DEFAULT_THEME = 'green-progress';
const TODO_KEY = 'quizionix_todo_items';

const audioState = {
  context: null,
  masterGain: null,
  musicGain: null,
  musicIntervalId: null
};

function sfxEnabled() {
  return localStorage.getItem('sfxEnabled') !== 'false';
}

function getSoftVolume() {
  const raw = Number(localStorage.getItem('musicVolume') || '30');
  const safe = Number.isFinite(raw) ? raw : 30;
  return Math.min(1, Math.max(0, safe / 100));
}

function ensureAudioContext() {
  if (!sfxEnabled()) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioState.context) {
    audioState.context = new AudioCtx();
    audioState.masterGain = audioState.context.createGain();
    audioState.musicGain = audioState.context.createGain();
    audioState.masterGain.gain.value = 0.03 + (getSoftVolume() * 0.05);
    audioState.musicGain.gain.value = 0.012 + (getSoftVolume() * 0.03);
    audioState.masterGain.connect(audioState.context.destination);
    audioState.musicGain.connect(audioState.context.destination);
  }

  if (audioState.context.state === 'suspended') {
    audioState.context.resume().catch(() => {});
  }

  return audioState.context;
}

function updateAudioMix() {
  if (!audioState.masterGain || !audioState.musicGain) return;
  audioState.masterGain.gain.value = sfxEnabled() ? (0.03 + (getSoftVolume() * 0.05)) : 0;
  audioState.musicGain.gain.value = sfxEnabled() ? (0.012 + (getSoftVolume() * 0.03)) : 0;
}

function playTone({ freq, type = 'sine', duration = 0.08, volume = 0.05, attack = 0.01, release = 0.08, when = 0 }) {
  const ctx = ensureAudioContext();
  if (!ctx || !audioState.masterGain) return;

  const now = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

  osc.connect(gain);
  gain.connect(audioState.masterGain);

  osc.start(now);
  osc.stop(now + duration + release + 0.02);
}

function playMusicTone({ freq, type = 'sine', duration = 1.6, volume = 0.018, when = 0 }) {
  const ctx = ensureAudioContext();
  if (!ctx || !audioState.musicGain) return;

  const now = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.22);
  gain.gain.linearRampToValueAtTime(volume * 0.7, now + Math.max(0.3, duration - 0.45));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audioState.musicGain);

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function playAmbientCycle() {
  const pattern = [
    [220.0, 277.18, 329.63],
    [196.0, 246.94, 293.66],
    [207.65, 261.63, 311.13],
    [174.61, 220.0, 261.63]
  ];
  const index = Math.floor((Date.now() / 4800) % pattern.length);
  const chord = pattern[index];
  chord.forEach((freq, i) => {
    playMusicTone({
      freq,
      type: i === 0 ? 'triangle' : 'sine',
      duration: 2.6,
      volume: i === 0 ? 0.015 : 0.011,
      when: i * 0.05
    });
  });
}

function startAmbientMusic() {
  if (!sfxEnabled()) {
    stopAmbientMusic();
    return;
  }
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (audioState.musicIntervalId) return;
  playAmbientCycle();
  audioState.musicIntervalId = window.setInterval(playAmbientCycle, 2400);
}

function stopAmbientMusic() {
  if (!audioState.musicIntervalId) return;
  window.clearInterval(audioState.musicIntervalId);
  audioState.musicIntervalId = null;
}

function playSfx(type) {
  if (!sfxEnabled()) return;

  switch (type) {
    case 'ui':
      playTone({ freq: 320, type: 'triangle', duration: 0.03, volume: 0.035 });
      break;
    case 'tab':
      playTone({ freq: 280, type: 'sine', duration: 0.04, volume: 0.03 });
      playTone({ freq: 360, type: 'sine', duration: 0.05, volume: 0.028, when: 0.04 });
      break;
    case 'correct':
      playTone({ freq: 392, type: 'sine', duration: 0.05, volume: 0.045 });
      playTone({ freq: 494, type: 'sine', duration: 0.06, volume: 0.04, when: 0.06 });
      break;
    case 'wrong':
      playTone({ freq: 240, type: 'triangle', duration: 0.08, volume: 0.045 });
      playTone({ freq: 196, type: 'triangle', duration: 0.08, volume: 0.038, when: 0.07 });
      break;
    case 'timer':
      playTone({ freq: 260, type: 'sine', duration: 0.02, volume: 0.02 });
      break;
    case 'start':
      playTone({ freq: 262, type: 'sine', duration: 0.05, volume: 0.03 });
      playTone({ freq: 330, type: 'sine', duration: 0.05, volume: 0.03, when: 0.06 });
      playTone({ freq: 392, type: 'sine', duration: 0.06, volume: 0.03, when: 0.12 });
      break;
    case 'summary':
      playTone({ freq: 330, type: 'sine', duration: 0.06, volume: 0.03 });
      playTone({ freq: 392, type: 'sine', duration: 0.06, volume: 0.03, when: 0.07 });
      playTone({ freq: 523, type: 'sine', duration: 0.09, volume: 0.032, when: 0.14 });
      break;
    default:
      playTone({ freq: 300, type: 'sine', duration: 0.03, volume: 0.025 });
  }
}

function applyTapFeedback(element) {
  if (!(element instanceof HTMLElement)) return;
  if (document.body.classList.contains('reduced-motion')) return;
  element.classList.remove('tap-animate');
  // Force reflow so repeated taps retrigger the animation.
  void element.offsetWidth;
  element.classList.add('tap-animate');
  window.setTimeout(() => element.classList.remove('tap-animate'), 220);
}

function getGameRank(totalXp) {
  if (totalXp >= 1200) return 'Aether Sage';
  if (totalXp >= 900) return 'Quantum Vanguard';
  if (totalXp >= 650) return 'Arc Scholar';
  if (totalXp >= 400) return 'Vector Ranger';
  if (totalXp >= 200) return 'Pulse Explorer';
  return 'Nova Cadet';
}

function getNextRankHint(totalXp) {
  const checkpoints = [200, 400, 650, 900, 1200];
  const names = ['Pulse Explorer', 'Vector Ranger', 'Arc Scholar', 'Quantum Vanguard', 'Aether Sage'];
  for (let i = 0; i < checkpoints.length; i += 1) {
    if (totalXp < checkpoints[i]) {
      return `${checkpoints[i] - totalXp} XP to ${names[i]}`;
    }
  }
  return 'Top rank reached';
}

function applyTheme(themeName) {
  const theme = themeName || DEFAULT_THEME;
  const themeClasses = [
    'theme-blue-tech',
    'theme-dark-modern',
    'theme-purple-gamified',
    'theme-green-progress',
    'theme-blue-purple'
  ];

  document.body.classList.remove(...themeClasses);
  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem(THEME_KEY, theme);

  document.querySelectorAll('.settings-theme-option').forEach(option => {
    option.classList.toggle('active', option.dataset.theme === theme);
  });
}

function syncFrontToggles() {
  if (frontDarkModeToggle) frontDarkModeToggle.checked = localStorage.getItem('darkMode') !== 'false';
  if (frontHighContrastToggle) frontHighContrastToggle.checked = localStorage.getItem('highContrastEnabled') === 'true';
  if (frontReduceMotionToggle) frontReduceMotionToggle.checked = localStorage.getItem('reducedMotionEnabled') === 'true';
}

function showFrontPage() {
  if (frontPage) frontPage.classList.remove('hidden');
  if (loginCard) loginCard.classList.add('hidden');
}

function showLoginCard() {
  if (frontPage) frontPage.classList.add('hidden');
  if (loginCard) loginCard.classList.remove('hidden');
}

function setQuestionsStatus(message, isError = false) {
  if (!questionsStatusEl) return;
  questionsStatusEl.textContent = message;
  questionsStatusEl.classList.toggle('error', isError);
}

function showTab(tabId) {
  tabPages.forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = '';
  });

  const target = document.getElementById(tabId);
  if (!target) return;
  target.classList.add('active');
  if (tabId === 'quizPage' || tabId === 'summaryPage') target.style.display = 'flex';

  tabItems.forEach(item => item.classList.remove('active-tab'));
  const activeItem = Array.from(tabItems).find(item => item.dataset.tab === tabId);
  if (activeItem) activeItem.classList.add('active-tab');

  if (tabId === 'studyTab') renderStudyPlan();
  if (tabId === 'homeTab') renderFeaturedMaterials();
  if (tabId === 'dashboardTab') renderDashboard();
  playSfx('tab');
}

function clearTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function disableChoiceButtons() {
  document.querySelectorAll('.choiceBtn').forEach(btn => {
    btn.style.pointerEvents = 'none';
  });
}

function updateStatsFromProgress(progression) {
  if (!progression) return;
  latestProgression = progression;
  const totalXp = Number(progression.totalXp || 0);
  const gameRank = getGameRank(totalXp);
  const nextHint = getNextRankHint(totalXp);

  if (xpEl) xpEl.textContent = String(progression.sessionXp || 0);
  if (streakEl) streakEl.textContent = String(progression.streak || 0);
  if (coinsEl) coinsEl.textContent = String(progression.totalCoins || 0);
  if (levelEl) levelEl.textContent = String(progression.level || 1);
  if (rankEl) rankEl.textContent = gameRank;
  if (menuRankBadge) menuRankBadge.textContent = `Rank: ${gameRank}`;

  const rankProgress = progression.rankProgress || { current: 0, target: 1, nextRank: 'Next Rank' };
  if (homeRankGuide) {
    homeRankGuide.textContent = `Rank: ${gameRank} | Total XP: ${totalXp} | ${nextHint}`;
  }

  if (rankProgressFill) {
    const pct = rankProgress.target <= 0
      ? 100
      : Math.min(100, Math.round((rankProgress.current / rankProgress.target) * 100));
    rankProgressFill.style.width = `${pct}%`;
  }

  if (rankProgressText) {
    rankProgressText.textContent = rankProgress.target <= 0
      ? 'Maximum rank reached.'
      : `${rankProgress.current} / ${rankProgress.target} XP to ${rankProgress.nextRank}`;
  }

  if (dashboardProgressText) {
    dashboardProgressText.textContent = `Total XP: ${totalXp} | Coins: ${progression.totalCoins || 0} | Level: ${progression.level || 1}`;
  }

  if (dashboardRankName) {
    dashboardRankName.textContent = gameRank;
  }

  if (dashboardRankHint) {
    dashboardRankHint.textContent = nextHint;
  }

  if (dashboardRankFill) {
    const dashPct = rankProgress.target <= 0
      ? 100
      : Math.min(100, Math.round((rankProgress.current / rankProgress.target) * 100));
    dashboardRankFill.style.width = `${dashPct}%`;
  }
}

function updateDashboardProgress() {
  const subjectXp = engine.getSubjectProgress();

  subjectCards.forEach(card => {
    const subject = card.dataset.subject;
    if (!subject) return;

    const progressEl = card.querySelector('.progress');
    const lastScoreEl = card.querySelector('.lastScore');
    const xp = Number(subjectXp[subject] || 0);

    if (progressEl) progressEl.style.width = `${Math.min(100, xp)}%`;
    if (lastScoreEl) lastScoreEl.textContent = `Total XP: ${xp}`;
  });
}

function applyAccessibility() {
  document.body.classList.toggle('high-contrast', localStorage.getItem('highContrastEnabled') === 'true');
  document.body.classList.toggle('reduced-motion', localStorage.getItem('reducedMotionEnabled') === 'true');
  syncFrontToggles();
}

function setupSettings() {
  applyTheme(localStorage.getItem(THEME_KEY) || DEFAULT_THEME);

  const savedTimer = Number(localStorage.getItem('timerDuration') || 15);
  if ([10, 15, 20].includes(savedTimer)) timerDuration = savedTimer;
  if (timerPerQuestionSelect) timerPerQuestionSelect.value = String(timerDuration);

  if (sfxToggle) {
    sfxToggle.checked = localStorage.getItem('sfxEnabled') !== 'false';
    sfxToggle.addEventListener('change', () => {
      localStorage.setItem('sfxEnabled', String(sfxToggle.checked));
      updateAudioMix();
      if (sfxToggle.checked) startAmbientMusic();
      else stopAmbientMusic();
      playSfx('ui');
    });
  }

  if (musicVolumeInput) {
    musicVolumeInput.value = localStorage.getItem('musicVolume') || '30';
    musicVolumeInput.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicVolumeInput.value);
      updateAudioMix();
    });
  }

  if (timerPerQuestionSelect) {
    timerPerQuestionSelect.addEventListener('change', () => {
      timerDuration = Number(timerPerQuestionSelect.value);
      localStorage.setItem('timerDuration', String(timerDuration));
    });
  }

  if (highContrastToggle) {
    highContrastToggle.checked = localStorage.getItem('highContrastEnabled') === 'true';
    highContrastToggle.addEventListener('change', () => {
      localStorage.setItem('highContrastEnabled', String(highContrastToggle.checked));
      applyAccessibility();
    });
  }

  if (reduceMotionToggle) {
    reduceMotionToggle.checked = localStorage.getItem('reducedMotionEnabled') === 'true';
    reduceMotionToggle.addEventListener('change', () => {
      localStorage.setItem('reducedMotionEnabled', String(reduceMotionToggle.checked));
      applyAccessibility();
    });
  }

  if (darkModeToggleSettings) {
    darkModeToggleSettings.checked = localStorage.getItem('darkMode') !== 'false';
    document.body.classList.toggle('light', !darkModeToggleSettings.checked);
    darkModeToggleSettings.addEventListener('change', () => {
      document.body.classList.toggle('light', !darkModeToggleSettings.checked);
      localStorage.setItem('darkMode', String(darkModeToggleSettings.checked));
      syncFrontToggles();
    });
  }

  document.querySelectorAll('.settings-theme-option').forEach(option => {
    option.addEventListener('click', () => {
      applyTheme(option.dataset.theme);
    });
  });

  if (clearLocalDataBtn) {
    clearLocalDataBtn.addEventListener('click', () => {
      localStorage.clear();
      window.location.reload();
    });
  }

  applyAccessibility();
  syncFrontToggles();
  updateAudioMix();
}

function renderStudyMethods() {
  if (!studyMethodsList) return;

  studyMethodsList.innerHTML = `
    <div class="study-method-item"><strong>Active Recall</strong><p>Answer first from memory, then validate.</p></div>
    <div class="study-method-item"><strong>Error Clustering</strong><p>Group mistakes by topic and repair patterns.</p></div>
    <div class="study-method-item"><strong>Timed Reflection</strong><p>After each set, explain one correct and one incorrect decision.</p></div>
  `;
}

function renderFeaturedMaterials() {
  if (!featuredMaterialsList) return;

  const plan = engine.getStudyPlan(null).slice(0, 4);
  featuredMaterialsList.innerHTML = plan.map(item => {
    const weak = item.weakTopics[0]?.topic || 'Balanced topics';
    return `
      <div class="study-method-item">
        <strong>${item.subject}</strong>
        <p><strong>Current Accuracy:</strong> ${item.accuracy}%</p>
        <p><strong>Focus:</strong> ${weak}</p>
        <p><strong>Suggested Difficulty:</strong> ${item.recommendedDifficulty}</p>
      </div>
    `;
  }).join('');
}

function renderStudyPlan() {
  const selected = studySubjectSelect?.value || 'all';
  const subject = selected === 'all' ? null : selected;
  const rows = engine.getStudyPlan(subject);

  if (studyPlanOutput) {
    studyPlanOutput.innerHTML = rows.map((row, index) => {
      const weakA = row.weakTopics[0]?.topic || 'No weak topic yet';
      const weakB = row.weakTopics[1]?.topic || 'No second weak topic';
      return `<p><strong>${index + 1}. ${row.subject}:</strong> Focus ${weakA} then ${weakB}. Target ${row.recommendedDifficulty} difficulty.</p>`;
    }).join('');
  }

  if (studySnapshot) {
    const first = rows[0];
    studySnapshot.innerHTML = first
      ? `<p><strong>Priority Subject:</strong> ${first.subject}</p><p><strong>Accuracy:</strong> ${first.accuracy}%</p>`
      : '<p>No quiz data yet. Complete one quiz to generate a plan.</p>';
  }

  if (studyMaterialsList) {
    studyMaterialsList.innerHTML = rows.map(row => {
      const weakText = row.weakTopics.length
        ? row.weakTopics.map(item => `${item.topic} (${item.accuracy}%)`).join(', ')
        : 'No weak topic data';
      return `<div class="study-method-item"><strong>${row.subject}</strong><p>${weakText}</p></div>`;
    }).join('');
  }
}

function applySubjectFilter(subject) {
  const value = subject || 'all';
  if (subjectFilterSelect) subjectFilterSelect.value = value;

  subjectCards.forEach(card => {
    const cardSubject = card.dataset.subject || '';
    const shouldShow = value === 'all' || cardSubject === value;
    card.classList.toggle('filtered-out', !shouldShow);
  });
}

function loadTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TODO_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveTodos(items) {
  localStorage.setItem(TODO_KEY, JSON.stringify(items));
}

function renderTodos() {
  if (!todoList) return;
  const items = loadTodos();
  if (!items.length) {
    todoList.innerHTML = '<p>No tasks yet.</p>';
    return;
  }

  todoList.innerHTML = items.map((item, index) => `
    <div class="todo-row">
      <span>${item}</span>
      <button class="btn-ghost todo-remove-btn" data-remove-index="${index}">Remove</button>
    </div>
  `).join('');
}

function renderDashboard() {
  updateStatsFromProgress(engine.getProgressionDisplay());
  renderTodos();
}

function highlightAnswers(correctAnswer, selectedChoice) {
  document.querySelectorAll('.choiceBtn').forEach(btn => {
    if (btn.textContent === correctAnswer) {
      btn.classList.add('correct-answer');
    }

    if (selectedChoice && btn.textContent === selectedChoice && selectedChoice !== correctAnswer) {
      btn.classList.add('wrong-answer');
    }

    if (btn.textContent !== correctAnswer && btn.textContent !== selectedChoice) {
      btn.classList.add('disabled');
    }
  });
}

function handleResult(result, selectedChoice) {
  questionLocked = true;
  disableChoiceButtons();

  if (feedbackEl) {
    feedbackEl.textContent = result.feedback;
    feedbackEl.style.color = result.isCorrect ? '#97c9ae' : (result.isSkipped ? '#c5b694' : '#d2a0ab');
  }

  if (result.isCorrect) playSfx('correct');
  else if (!result.isSkipped) playSfx('wrong');

  if (explanationEl) explanationEl.textContent = result.explanation || '';
  highlightAnswers(result.correctAnswer, selectedChoice);
  if (nextBtn) nextBtn.style.display = 'block';

  updateStatsFromProgress(result.progression);
}

function startTimer() {
  clearTimer();
  timeLeft = timerDuration;
  questionStartAt = Date.now();
  if (timeEl) timeEl.textContent = String(timeLeft);

  timer = setInterval(async () => {
    timeLeft -= 1;
    if (timeEl) timeEl.textContent = String(Math.max(0, timeLeft));

    if (timeLeft <= 0) {
      clearTimer();

      if (questionLocked) return;

      const timeSpent = Math.max(0, Math.round((Date.now() - questionStartAt) / 1000));
      try {
        const result = engine.timeoutCurrentQuestion({ timeSpent, timeAllowed: timerDuration });
        handleResult(result, null);
      } catch (err) {
        if (feedbackEl) {
          feedbackEl.textContent = String(err.message || err);
          feedbackEl.style.color = '#d2a0ab';
        }
      }
    } else if (timeLeft <= 5) {
      playSfx('timer');
    }
  }, 1000);
}

function renderCurrentQuestion() {
  currentQuestion = engine.getCurrentQuestion();
  if (!currentQuestion) return;

  questionLocked = false;

  if (subjectTitleEl) {
    subjectTitleEl.textContent = `${selectedSubject} | ${currentQuestion.difficulty}`;
  }
  if (questionEl) questionEl.textContent = currentQuestion.prompt;

  if (feedbackEl) {
    feedbackEl.textContent = '';
    feedbackEl.style.color = '';
  }

  if (explanationEl) explanationEl.textContent = '';
  if (nextBtn) nextBtn.style.display = 'none';

  choicesEl.innerHTML = '';
  currentQuestion.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choiceBtn';
    btn.textContent = choice;
    btn.addEventListener('click', () => submitCurrentAnswer(choice));
    choicesEl.appendChild(btn);
  });

  startTimer();
}

function submitCurrentAnswer(selectedChoice) {
  if (questionLocked) return;

  clearTimer();

  const timeSpent = Math.max(0, Math.round((Date.now() - questionStartAt) / 1000));

  try {
    const result = engine.submitAnswer({
      selectedChoice,
      timeSpent,
      timeAllowed: timerDuration
    });
    handleResult(result, selectedChoice);
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.textContent = String(err.message || err);
      feedbackEl.style.color = '#d2a0ab';
    }
  }
}

function skipCurrentQuestion() {
  if (questionLocked) return;

  clearTimer();
  const timeSpent = Math.max(0, Math.round((Date.now() - questionStartAt) / 1000));

  try {
    const result = engine.skipCurrentQuestion({
      timeSpent,
      timeAllowed: timerDuration
    });
    handleResult(result, null);
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.textContent = String(err.message || err);
      feedbackEl.style.color = '#d2a0ab';
    }
  }
}

function showSummary() {
  try {
    quizSummary = engine.finishQuiz();
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.textContent = String(err.message || err);
      feedbackEl.style.color = '#ff6b6b';
    }
    return;
  }

  showTab('summaryPage');
  playSfx('summary');

  if (summarySubtitleEl) {
    summarySubtitleEl.textContent = `${quizSummary.score.correct}/${quizSummary.score.total} correct (${quizSummary.score.accuracy}%).`;
  }

  if (totalXPSummary) {
    totalXPSummary.textContent = String(quizSummary.rewards.sessionXp);
  }

  summaryList.innerHTML = '';

  quizSummary.results.forEach((result, index) => {
    const item = document.createElement('div');
    item.className = `question-item ${result.isCorrect ? 'correct' : 'incorrect'}`;
    item.innerHTML = `
      <span class="question-number ${result.isCorrect ? 'correct-badge' : 'incorrect-badge'}">${result.isCorrect ? '[OK]' : '[X]'} Question ${index + 1}</span>
      <p class="question-text-summary"><strong>Topic:</strong> ${result.topic}</p>
      <p class="question-text-summary"><strong>Difficulty:</strong> ${result.difficulty}</p>
      <p class="question-text-summary"><strong>Feedback:</strong> ${result.feedback}</p>
      <p class="explanation-summary">${result.explanation}</p>
    `;
    summaryList.appendChild(item);
  });

  const recBlock = document.createElement('div');
  recBlock.className = 'question-item';
  recBlock.innerHTML = `<p class="question-text-summary"><strong>Recommendations:</strong> ${quizSummary.recommendations.join(' | ')}</p>`;
  summaryList.appendChild(recBlock);

  updateStatsFromProgress({
    ...quizSummary.progression,
    sessionXp: 0,
    streak: 0
  });
  updateDashboardProgress();
  renderStudyPlan();
  renderFeaturedMaterials();
}

function startQuizForSubject(subject, learningGoal) {
  selectedSubject = subject;
  selectedGoal = learningGoal;
  lifelinesUsed = { fifty: false, hint: false, skip: false };

  if (fiftyFiftyBtn) fiftyFiftyBtn.disabled = false;
  if (hintBtn) hintBtn.disabled = false;
  if (skipBtn) skipBtn.disabled = false;

  try {
    const start = engine.startQuiz({ subject, learningGoal, totalQuestions: 5 });
    updateStatsFromProgress(start.progression);
    showTab('quizPage');
    playSfx('start');
    renderCurrentQuestion();
  } catch (err) {
    if (loginError) {
      loginError.textContent = String(err.message || err);
    }
  }
}

async function hashPassword(password) {
  if (!window.crypto?.subtle) throw new Error('Web Crypto unavailable');
  const bytes = new TextEncoder().encode(password);
  const hash = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

showLoginBtn?.addEventListener('click', () => {
  showLoginCard();
});

backToFrontBtn?.addEventListener('click', () => {
  showFrontPage();
});

aboutBtn?.addEventListener('click', () => {
  if (questionsStatusEl) {
    questionsStatusEl.textContent = 'About Us is coming soon.';
    questionsStatusEl.classList.remove('error');
  }
});

frontSettingsBtn?.addEventListener('click', () => {
  frontSettingsPanel?.classList.toggle('open');
});

document.addEventListener('click', event => {
  if (!frontSettingsPanel || !frontSettingsBtn) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (frontSettingsPanel.contains(target) || frontSettingsBtn.contains(target)) return;
  frontSettingsPanel.classList.remove('open');
});

document.addEventListener('pointerdown', () => {
  ensureAudioContext();
  updateAudioMix();
  startAmbientMusic();
}, { once: true });

document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const control = target.closest(
    '.btn-main, .btn-ghost, .subjectBtn, .subjectStudyBtn, .menu-toggle-btn, .settings-theme-option, .choiceBtn, .sidebar ul li, .submenu li, .front-settings-btn, .settings-toggle-inline input, .settings-toggle input'
  );
  if (!control) return;
  if ((control instanceof HTMLButtonElement || control instanceof HTMLInputElement) && control.disabled) return;
  playSfx('ui');
  applyTapFeedback(control);
});

document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!subjectsMenuItem) return;
  if (subjectsMenuItem.contains(target)) return;
  subjectsMenuItem.classList.remove('open');
});

frontDarkModeToggle?.addEventListener('change', () => {
  localStorage.setItem('darkMode', String(frontDarkModeToggle.checked));
  document.body.classList.toggle('light', !frontDarkModeToggle.checked);
  if (darkModeToggleSettings) darkModeToggleSettings.checked = frontDarkModeToggle.checked;
});

frontHighContrastToggle?.addEventListener('change', () => {
  localStorage.setItem('highContrastEnabled', String(frontHighContrastToggle.checked));
  if (highContrastToggle) highContrastToggle.checked = frontHighContrastToggle.checked;
  applyAccessibility();
});

frontReduceMotionToggle?.addEventListener('change', () => {
  localStorage.setItem('reducedMotionEnabled', String(frontReduceMotionToggle.checked));
  if (reduceMotionToggle) reduceMotionToggle.checked = frontReduceMotionToggle.checked;
  applyAccessibility();
});

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();

  const email = document.getElementById('email')?.value.trim() || '';
  const password = document.getElementById('password')?.value.trim() || '';

  if (loginError) loginError.textContent = '';

  if (!/^[a-zA-Z0-9._%+-]+@student\.fatima\.edu\.ph$/.test(email)) {
    if (loginError) loginError.textContent = 'Please use your Fatima University student email.';
    return;
  }

  if (password.length < 6) {
    if (loginError) loginError.textContent = 'Password must be at least 6 characters.';
    return;
  }

  try {
    const pwHash = await hashPassword(password);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userPasswordHash', pwHash);
  } catch (_error) {
    if (loginError) loginError.textContent = 'Secure login is unavailable in this browser.';
    return;
  }

  if (profileEmailEl) profileEmailEl.textContent = email;
  if (loginPage) loginPage.style.display = 'none';
  if (app) {
    app.style.display = 'flex';
    app.style.opacity = '1';
  }

  updateStatsFromProgress(engine.getProgressionDisplay());
  updateDashboardProgress();
  renderFeaturedMaterials();
  showTab('homeTab');
});

startBtn?.addEventListener('click', () => showTab('subjectsTab'));

tabItems.forEach(item => {
  item.addEventListener('click', event => {
    const target = item.dataset.tab;
    if (!target) return;

    if (item.classList.contains('has-submenu')) {
      const clickTarget = event.target;
      if (clickTarget instanceof Element && clickTarget.closest('.submenu')) {
        return;
      }
      item.classList.toggle('open');
      showTab(target);
      return;
    }

    subjectsMenuItem?.classList.remove('open');
    clearTimer();
    showTab(target);
  });
});

subjectBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.subject-card');
    const subject = card?.dataset.subject;
    if (!subject) return;

    const goalSelect = card.querySelector('.learningGoalSelect');
    const learningGoal = goalSelect?.value || 'practice_basics';
    startQuizForSubject(subject, learningGoal);
  });
});

subjectStudyBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.subject-card');
    const subject = card?.dataset.subject;
    if (!subject) return;
    if (studySubjectSelect) studySubjectSelect.value = subject;
    showTab('studyTab');
    renderStudyPlan();
  });
});

subjectFilterSelect?.addEventListener('change', () => {
  applySubjectFilter(subjectFilterSelect.value);
});

clearSubjectFilterBtn?.addEventListener('click', () => {
  applySubjectFilter('all');
});

subjectQuickMenu?.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const item = target.closest('[data-subject-filter]');
  if (!item) return;
  const filter = item.getAttribute('data-subject-filter');
  if (!filter) return;
  showTab('subjectsTab');
  applySubjectFilter(filter);
  subjectsMenuItem?.classList.add('open');
});

nextBtn?.addEventListener('click', () => {
  try {
    if (engine.hasNextQuestion()) {
      engine.nextQuestion();
      renderCurrentQuestion();
    } else {
      clearTimer();
      showSummary();
    }
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.textContent = String(err.message || err);
      feedbackEl.style.color = '#d2a0ab';
    }
  }
});

fiftyFiftyBtn?.addEventListener('click', () => {
  if (lifelinesUsed.fifty || questionLocked) return;

  const hiddenChoices = new Set(engine.applyFiftyFifty());
  document.querySelectorAll('.choiceBtn').forEach(btn => {
    if (hiddenChoices.has(btn.textContent)) {
      btn.style.visibility = 'hidden';
      btn.style.pointerEvents = 'none';
      btn.classList.add('disabled');
    }
  });

  lifelinesUsed.fifty = true;
  fiftyFiftyBtn.disabled = true;
});

hintBtn?.addEventListener('click', () => {
  if (lifelinesUsed.hint || questionLocked) return;

  const hint = engine.getHint();
  if (feedbackEl) {
    feedbackEl.textContent = `Hint: ${hint}`;
    feedbackEl.style.color = '#9ab9d7';
  }
  playSfx('ui');

  lifelinesUsed.hint = true;
  hintBtn.disabled = true;
});

skipBtn?.addEventListener('click', () => {
  if (lifelinesUsed.skip || questionLocked) return;

  lifelinesUsed.skip = true;
  skipBtn.disabled = true;
  skipCurrentQuestion();
});

returnDashboard?.addEventListener('click', () => {
  clearTimer();
  updateStatsFromProgress(engine.getProgressionDisplay());
  updateDashboardProgress();
  showTab('subjectsTab');
});

quizSettingsBtn?.addEventListener('click', () => {
  clearTimer();
  showTab('settingsTab');
});

quizBackMenuBtn?.addEventListener('click', () => {
  clearTimer();
  showTab('subjectsTab');
});

menuToggleBtn?.addEventListener('click', () => {
  app?.classList.toggle('menu-collapsed');
  menuToggleBtn.textContent = app?.classList.contains('menu-collapsed') ? 'Open Menu' : 'Close Menu';
  if (sidebarEl) sidebarEl.setAttribute('aria-hidden', String(app?.classList.contains('menu-collapsed')));
});

generateStudyPlanBtn?.addEventListener('click', renderStudyPlan);
addTodoBtn?.addEventListener('click', () => {
  const text = todoInput?.value.trim();
  if (!text) return;
  const items = loadTodos();
  items.unshift(text);
  saveTodos(items.slice(0, 20));
  if (todoInput) todoInput.value = '';
  renderTodos();
});

todoList?.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const index = target.getAttribute('data-remove-index');
  if (index === null) return;
  const items = loadTodos();
  const removeIndex = Number(index);
  if (Number.isNaN(removeIndex)) return;
  items.splice(removeIndex, 1);
  saveTodos(items);
  renderTodos();
});

async function initializeAdaptiveSystem() {
  setQuestionsStatus('Initializing adaptive learning engine...');
  if (startBtn) startBtn.disabled = true;
  subjectBtns.forEach(btn => { btn.disabled = true; });

  try {
    await engine.initialize();
    setQuestionsStatus('Adaptive engine ready.');
    if (startBtn) startBtn.disabled = false;
    subjectBtns.forEach(btn => { btn.disabled = false; });

    updateStatsFromProgress(engine.getProgressionDisplay());
    updateDashboardProgress();
    renderFeaturedMaterials();
  } catch (err) {
    setQuestionsStatus('Failed to initialize adaptive engine.', true);
    if (loginError) {
      loginError.textContent = 'Could not start adaptive quiz system. Refresh and try again.';
    }
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setupSettings();
  renderStudyMethods();
  initializeAdaptiveSystem();
  showFrontPage();
  applySubjectFilter('all');
  renderTodos();
  updateAudioMix();

  const savedEmail = localStorage.getItem('userEmail');
  if (savedEmail && profileEmailEl) profileEmailEl.textContent = savedEmail;
});

window.addEventListener('load', () => {
  const hide = () => loadingScreen?.classList.add('hidden');
  setTimeout(hide, 550);
});
