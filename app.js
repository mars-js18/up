// ==========================================
// CALISTENIA APP - MAIN LOGIC
// ==========================================

// Routine Data Structure (from up.txt)
const ROUTINE = [
  {
    id: 'warmup',
    category: '1. Preparación',
    title: 'Rotaciones & Scapular Pull-ups',
    targetSets: 2,
    targetReps: '8 - 10 reps',
    restSeconds: 60,
    instruction: '1 min de rotaciones articulares (hombros, cuello, muñecas). Luego cuélgate de la barra con brazos estirados y empuja los hombros hacia abajo (depresión escapular) sin doblar los codos.',
    hasTempo: false
  },
  {
    id: 'eccentric-pullups',
    category: '2. Tirón (Espalda & Brazos)',
    title: 'Dominadas Excéntricas (Negativas)',
    targetSets: 3,
    targetReps: '4 - 5 reps (bajada 5s)',
    restSeconds: 120,
    instruction: 'Súbete a la barra dando un salto o usando silla hasta superar con la barbilla. Desde ahí, baja de forma hiper-lenta tardando exactamente 5 segundos en descender.',
    hasTempo: true,
    tempoSeconds: 5,
    tempoLabel: 'segundos de bajada controlada'
  },
  {
    id: 'pushups',
    category: '3. Empuje (Pecho, Hombros, Tríceps)',
    title: 'Flexiones Estándar',
    targetSets: 3,
    targetReps: '8 - 12 reps',
    restSeconds: 120,
    instruction: 'Manos a la anchura de los hombros. Controla la bajada en 2s, sube en 1s sin pausa abajo. Si cuesta mantener la técnica recta, apoya las rodillas en el suelo.',
    hasTempo: false
  },
  {
    id: 'pushup-plus',
    category: '4. Hombro & Postura',
    title: 'Push-up Plus',
    targetSets: 3,
    targetReps: '10 - 15 reps',
    restSeconds: 90,
    instruction: 'En posición de plancha. Con codos totalmente estirados en todo momento, empuja el suelo con fuerza separando tus omóplatos al máximo.',
    hasTempo: false
  },
  {
    id: 'hollow-body',
    category: '5. Core & Abdomen',
    title: 'Hollow Body Hold (Cuerpo Hueco)',
    targetSets: 3,
    targetReps: '20 - 30 seg',
    restSeconds: 90,
    instruction: 'Tumbado boca arriba, aplasta tu zona lumbar firmemente contra el suelo. Despega omóplatos y piernas estiradas del suelo apretando el abdomen.',
    hasTempo: true,
    tempoSeconds: 30,
    tempoLabel: 'segundos de mantenimiento (Hold)'
  }
];

// App State
let state = {
  activeTab: 'tab-workout',
  soundEnabled: true,
  wakeLockActive: false,
  workoutActive: false,
  currentExerciseIdx: 0,
  workoutStartTime: null,
  workoutDurationInterval: null,
  elapsedSeconds: 0,
  loggedSets: {}, // { exerciseId: [{ reps: 8, completed: true }] }
  
  // Rest Timer State
  restTimerInterval: null,
  restTotalSeconds: 60,
  restRemainingSeconds: 60,
  restIsPaused: false,
  nextUpLabel: '',

  // Tempo Assistant State
  tempoInterval: null,
  tempoSecondsRemaining: 0,
  tempoIsRunning: false
};

// WakeLock Object
let wakeLock = null;

// Web Audio API Synthesizer
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBeep(freq = 440, type = 'sine', duration = 0.15) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error('Audio beep error:', e);
  }
}

function playCompletionChime() {
  if (!state.soundEnabled) return;
  playBeep(523.25, 'sine', 0.15); // C5
  setTimeout(() => playBeep(659.25, 'sine', 0.15), 150); // E5
  setTimeout(() => playBeep(783.99, 'sine', 0.3), 300);  // G5
}

function triggerVibration(pattern = [100, 50, 100]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// ==========================================
// DOM ELEMENTS & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHeaderControls();
  initWorkoutController();
  initHistoryView();
  registerServiceWorker();
});

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registrado:', reg.scope))
      .catch(err => console.error('Error registrando Service Worker:', err));
  }
}

// Navigation Tabs
function initNavigation() {
  const navButtons = document.querySelectorAll('.bottom-nav .nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update Nav Active state
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update Pane Display
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'tab-history') {
    renderHistoryList();
  }
}

// Header Actions (Sound & WakeLock)
function initHeaderControls() {
  const soundBtn = document.getElementById('btn-sound');
  const soundOnIcon = soundBtn.querySelector('.icon-sound-on');
  const soundOffIcon = soundBtn.querySelector('.icon-sound-off');

  soundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    soundBtn.classList.toggle('active', state.soundEnabled);
    soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
    soundOffIcon.classList.toggle('hidden', state.soundEnabled);
    if (state.soundEnabled) playBeep(600, 'sine', 0.1);
  });

  const wakeLockBtn = document.getElementById('btn-wakelock');
  wakeLockBtn.addEventListener('click', async () => {
    await toggleWakeLock();
  });
}

async function toggleWakeLock() {
  const wakeLockBtn = document.getElementById('btn-wakelock');
  if ('wakeLock' in navigator) {
    try {
      if (!state.wakeLockActive) {
        wakeLock = await navigator.wakeLock.request('screen');
        state.wakeLockActive = true;
        wakeLockBtn.classList.add('wakelock-on');
        wakeLock.addEventListener('release', () => {
          state.wakeLockActive = false;
          wakeLockBtn.classList.remove('wakelock-on');
        });
      } else if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
        state.wakeLockActive = false;
        wakeLockBtn.classList.remove('wakelock-on');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  }
}

// ==========================================
// WORKOUT CONTROLLER
// ==========================================
function initWorkoutController() {
  const btnStart = document.getElementById('btn-start-workout');
  const btnPrev = document.getElementById('btn-prev-exercise');
  const btnNext = document.getElementById('btn-next-exercise');
  const btnFinish = document.getElementById('btn-finish-workout');
  const btnDoneSummary = document.getElementById('btn-done-summary');

  btnStart.addEventListener('click', startWorkoutSession);
  btnPrev.addEventListener('click', navigatePrevExercise);
  btnNext.addEventListener('click', navigateNextExercise);
  btnFinish.addEventListener('click', confirmFinishWorkout);
  btnDoneSummary.addEventListener('click', resetToIdleView);

  // Tempo assistant button
  document.getElementById('btn-trigger-tempo').addEventListener('click', triggerTempoAssistant);

  // Rest timer modal controls
  document.getElementById('btn-rest-minus').addEventListener('click', () => adjustRestTimer(-15));
  document.getElementById('btn-rest-plus').addEventListener('click', () => adjustRestTimer(15));
  document.getElementById('btn-rest-pause').addEventListener('click', togglePauseRestTimer);
  document.getElementById('btn-rest-skip').addEventListener('click', skipRestTimer);
}

function startWorkoutSession() {
  getAudioContext(); // Resume audio context on user gesture
  toggleWakeLock();  // Request screen wake lock for training
  
  state.workoutActive = true;
  state.currentExerciseIdx = 0;
  state.elapsedSeconds = 0;
  state.workoutStartTime = new Date();
  
  // Initialize loggedSets object
  state.loggedSets = {};
  ROUTINE.forEach(ex => {
    state.loggedSets[ex.id] = Array.from({ length: ex.targetSets }, () => ({
      reps: ex.targetReps.includes('reps') ? parseInt(ex.targetReps) || 8 : 20,
      completed: false
    }));
  });

  // Start duration clock
  clearInterval(state.workoutDurationInterval);
  state.workoutDurationInterval = setInterval(() => {
    state.elapsedSeconds++;
    document.getElementById('workout-timer-clock').textContent = formatTime(state.elapsedSeconds);
  }, 1000);

  // Switch views
  document.getElementById('workout-idle-view').classList.add('hidden');
  document.getElementById('workout-completed-view').classList.add('hidden');
  document.getElementById('workout-active-view').classList.remove('hidden');

  renderCurrentExerciseView();
}

function renderCurrentExerciseView() {
  const ex = ROUTINE[state.currentExerciseIdx];
  const total = ROUTINE.length;

  // Header info
  document.getElementById('workout-step-label').textContent = `Ejercicio ${state.currentExerciseIdx + 1} de ${total}`;
  const progressPct = ((state.currentExerciseIdx + 1) / total) * 100;
  document.getElementById('workout-progress-fill').style.width = `${progressPct}%`;

  // Exercise card
  document.getElementById('ex-category-badge').textContent = ex.category;
  document.getElementById('ex-title').textContent = ex.title;
  document.getElementById('ex-target-sets').textContent = `${ex.targetSets} Series`;
  document.getElementById('ex-target-reps').textContent = ex.targetReps;
  document.getElementById('ex-target-rest').textContent = `${ex.restSeconds}s`;
  document.getElementById('ex-instruction-text').textContent = ex.instruction;

  // Navigation buttons
  document.getElementById('btn-prev-exercise').disabled = (state.currentExerciseIdx === 0);
  const isLast = (state.currentExerciseIdx === total - 1);
  document.getElementById('btn-next-exercise').textContent = isLast ? 'Finalizar Entrenamiento 🏆' : 'Siguiente Ejercicio →';

  // Tempo Assistant Setup
  const tempoContainer = document.getElementById('tempo-assistant-container');
  if (ex.hasTempo) {
    tempoContainer.classList.remove('hidden');
    document.getElementById('tempo-seconds').textContent = ex.tempoSeconds;
    document.getElementById('tempo-sub').textContent = ex.tempoLabel;
    document.getElementById('btn-trigger-tempo').textContent = `⏱️ Iniciar Temporizador (${ex.tempoSeconds}s)`;
  } else {
    tempoContainer.classList.add('hidden');
  }

  // Render Sets
  renderSetsList();
}

function renderSetsList() {
  const ex = ROUTINE[state.currentExerciseIdx];
  const setsContainer = document.getElementById('sets-list');
  setsContainer.innerHTML = '';

  const setsData = state.loggedSets[ex.id];
  setsData.forEach((setData, idx) => {
    const setRow = document.createElement('div');
    setRow.className = `set-row ${setData.completed ? 'completed' : ''}`;
    
    setRow.innerHTML = `
      <span class="set-tag">Serie ${idx + 1}</span>
      <div class="set-input-group">
        <input type="number" class="set-input" value="${setData.reps}" min="1" max="100" data-set-idx="${idx}">
        <button class="btn-check-set" data-set-idx="${idx}" aria-label="Marcar serie completada">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>
    `;

    // Listeners
    const input = setRow.querySelector('.set-input');
    input.addEventListener('change', (e) => {
      setData.reps = parseInt(e.target.value) || 0;
    });

    const checkBtn = setRow.querySelector('.btn-check-set');
    checkBtn.addEventListener('click', () => {
      setData.completed = !setData.completed;
      setRow.classList.toggle('completed', setData.completed);

      if (setData.completed) {
        playBeep(880, 'sine', 0.1);
        triggerVibration([80]);
        // Launch rest timer if not last set or exercise
        if (idx < setsData.length - 1) {
          launchRestTimer(ex.restSeconds, `Próxima: Serie ${idx + 2} de ${ex.title}`);
        } else if (state.currentExerciseIdx < ROUTINE.length - 1) {
          const nextEx = ROUTINE[state.currentExerciseIdx + 1];
          launchRestTimer(ex.restSeconds, `Próximo Ejercicio: ${nextEx.title}`);
        }
      }
    });

    setsContainer.appendChild(setRow);
  });
}

function navigatePrevExercise() {
  if (state.currentExerciseIdx > 0) {
    state.currentExerciseIdx--;
    renderCurrentExerciseView();
  }
}

function navigateNextExercise() {
  if (state.currentExerciseIdx < ROUTINE.length - 1) {
    state.currentExerciseIdx++;
    renderCurrentExerciseView();
  } else {
    finishWorkoutSession();
  }
}

function confirmFinishWorkout() {
  if (confirm('¿Deseas finalizar el entrenamiento de hoy?')) {
    finishWorkoutSession();
  }
}

function finishWorkoutSession() {
  clearInterval(state.workoutDurationInterval);
  clearInterval(state.restTimerInterval);
  clearInterval(state.tempoInterval);

  playCompletionChime();
  triggerVibration([200, 100, 200]);

  // Count completed sets
  let totalSetsCompleted = 0;
  Object.values(state.loggedSets).forEach(sets => {
    sets.forEach(s => { if (s.completed) totalSetsCompleted++; });
  });

  // Display summary stats
  document.getElementById('summary-duration').textContent = formatTime(state.elapsedSeconds);
  document.getElementById('summary-sets').textContent = `${totalSetsCompleted} / 14`;

  // Save to LocalStorage
  saveWorkoutToStorage({
    id: Date.now(),
    date: new Date().toISOString(),
    durationSeconds: state.elapsedSeconds,
    totalSetsCompleted,
    loggedSets: state.loggedSets
  });

  // Show summary pane
  document.getElementById('workout-active-view').classList.add('hidden');
  document.getElementById('rest-timer-modal').classList.add('hidden');
  document.getElementById('workout-completed-view').classList.remove('hidden');
}

function resetToIdleView() {
  state.workoutActive = false;
  document.getElementById('workout-completed-view').classList.add('hidden');
  document.getElementById('workout-idle-view').classList.remove('hidden');
}

// ==========================================
// REST TIMER MODAL CONTROLLER
// ==========================================
function launchRestTimer(seconds, nextLabel) {
  state.restTotalSeconds = seconds;
  state.restRemainingSeconds = seconds;
  state.restIsPaused = false;
  state.nextUpLabel = nextLabel;

  document.getElementById('rest-next-up').textContent = nextLabel;
  document.getElementById('btn-rest-pause').textContent = 'Pausar';
  document.getElementById('rest-timer-modal').classList.remove('hidden');

  updateRestTimerUI();

  clearInterval(state.restTimerInterval);
  state.restTimerInterval = setInterval(() => {
    if (state.restIsPaused) return;

    state.restRemainingSeconds--;
    updateRestTimerUI();

    if (state.restRemainingSeconds <= 3 && state.restRemainingSeconds > 0) {
      playBeep(440, 'triangle', 0.1);
    }

    if (state.restRemainingSeconds <= 0) {
      clearInterval(state.restTimerInterval);
      playCompletionChime();
      triggerVibration([150, 100, 150]);
      setTimeout(() => {
        document.getElementById('rest-timer-modal').classList.add('hidden');
      }, 500);
    }
  }, 1000);
}

function updateRestTimerUI() {
  const secs = state.restRemainingSeconds;
  document.getElementById('modal-rest-seconds').textContent = secs;

  // Ring offset calculation (dasharray is 326.7)
  const ring = document.getElementById('timer-ring-fill');
  const fraction = secs / state.restTotalSeconds;
  const offset = 326.7 * (1 - fraction);
  ring.style.strokeDashoffset = offset;
}

function adjustRestTimer(delta) {
  state.restRemainingSeconds = Math.max(1, state.restRemainingSeconds + delta);
  state.restTotalSeconds = Math.max(state.restTotalSeconds, state.restRemainingSeconds);
  updateRestTimerUI();
}

function togglePauseRestTimer() {
  state.restIsPaused = !state.restIsPaused;
  document.getElementById('btn-rest-pause').textContent = state.restIsPaused ? 'Reanudar' : 'Pausar';
}

function skipRestTimer() {
  clearInterval(state.restTimerInterval);
  document.getElementById('rest-timer-modal').classList.add('hidden');
}

// ==========================================
// TEMPO ASSISTANT CONTROLLER
// ==========================================
function triggerTempoAssistant() {
  const ex = ROUTINE[state.currentExerciseIdx];
  if (!ex.hasTempo) return;

  state.tempoSecondsRemaining = ex.tempoSeconds;
  const numDisplay = document.getElementById('tempo-seconds');
  const btn = document.getElementById('btn-trigger-tempo');

  numDisplay.textContent = state.tempoSecondsRemaining;
  btn.disabled = true;
  btn.textContent = '⏳ En Progreso...';

  playBeep(500, 'sine', 0.2);

  clearInterval(state.tempoInterval);
  state.tempoInterval = setInterval(() => {
    state.tempoSecondsRemaining--;
    numDisplay.textContent = state.tempoSecondsRemaining;

    if (state.tempoSecondsRemaining <= 3 && state.tempoSecondsRemaining > 0) {
      playBeep(600, 'sine', 0.15);
    }

    if (state.tempoSecondsRemaining <= 0) {
      clearInterval(state.tempoInterval);
      playBeep(880, 'sine', 0.3);
      triggerVibration([200]);
      btn.disabled = false;
      btn.textContent = '✅ ¡Completado! Repetir';
      numDisplay.textContent = ex.tempoSeconds;
    }
  }, 1000);
}

// ==========================================
// STORAGE & HISTORY MANAGER
// ==========================================
function saveWorkoutToStorage(workoutLog) {
  const history = getHistoryFromStorage();
  history.unshift(workoutLog);
  localStorage.setItem('calistenia_workout_history', JSON.stringify(history));
}

function getHistoryFromStorage() {
  try {
    const data = localStorage.getItem('calistenia_workout_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function initHistoryView() {
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que deseas borrar todo el historial?')) {
      localStorage.removeItem('calistenia_workout_history');
      renderHistoryList();
    }
  });
}

function renderHistoryList() {
  const history = getHistoryFromStorage();
  const container = document.getElementById('history-logs-container');
  const statTotal = document.getElementById('stat-total-workouts');
  const statLast = document.getElementById('stat-last-date');

  statTotal.textContent = history.length;

  if (history.length === 0) {
    statLast.textContent = 'Ninguna';
    container.innerHTML = `
      <div class="empty-state">
        <p>Aún no has registrado entrenamientos. ¡Inicia una sesión en la pestaña "Entrenar"!</p>
      </div>
    `;
    return;
  }

  // Format last workout date
  const lastDate = new Date(history[0].date);
  statLast.textContent = lastDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

  // Render logs list
  container.innerHTML = history.map(log => {
    const d = new Date(log.date);
    const dateFormatted = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const durationFormatted = formatTime(log.durationSeconds);

    return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-date">🗓️ ${dateFormatted} - ${timeFormatted}</span>
          <span class="badge badge-accent">⏱️ ${durationFormatted}</span>
        </div>
        <div class="history-item-body">
          <span class="badge badge-category">Series: ${log.totalSetsCompleted} / 14</span>
        </div>
      </div>
    `;
  }).join('');
}

// Helpers
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
