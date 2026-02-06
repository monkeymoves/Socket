const firebaseConfig = {
  apiKey: "AIzaSyD_4SkTMz2kqpuj3c7Fsk_bvHfxxOim5P4",
  authDomain: "hangtime-f001d.firebaseapp.com",
  databaseURL: "https://hangtime-f001d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hangtime-f001d",
  storageBucket: "hangtime-f001d.firebasestorage.app",
  messagingSenderId: "942077853734",
  appId: "1:942077853734:web:d58e8011e940b17ef7e6e7",
};

const presets = [
  {
    id: "repeaters-101",
    name: "Repeaters 101",
    description: "7s hang · 3s rest · 6 reps · 60s between sets · 6 rounds",
    settings: {
      warmup: 13,
      hang: 7,
      rest: 3,
      reps: 6,
      setRest: 60,
      rounds: 6,
    },
  },
  {
    id: "max-hangs",
    name: "Max Hangs",
    description: "10s hang · 3 min rest · 1 rep · 5 rounds",
    settings: {
      warmup: 13,
      hang: 10,
      rest: 0,
      reps: 1,
      setRest: 180,
      rounds: 5,
    },
  },
  {
    id: "emil",
    name: "Emil",
    description: "10s hang · 20s rest · 24 reps · 1 round",
    settings: {
      warmup: 13,
      hang: 10,
      rest: 20,
      reps: 24,
      setRest: 0,
      rounds: 1,
    },
    cues: [
      { start: 1, end: 2, text: "Jugs" },
      { start: 3, end: 5, text: "Four open" },
      { start: 6, end: 8, text: "Four crimp" },
      { start: 9, end: 11, text: "Three open" },
      { start: 12, end: 14, text: "Three crimp" },
      { start: 15, end: 16, text: "Front two open" },
      { start: 17, end: 18, text: "Front two crimp" },
      { start: 19, end: 20, text: "Middle two open" },
      { start: 21, end: 22, text: "Middle two crimp" },
      { start: 23, end: 24, text: "Cool-down" },
    ],
  },
];

const defaultPreset = presets.find((preset) => preset.id === "emil") || presets[0];
const defaults = defaultPreset.settings;
const storageKey = "hangboard-settings-v1";

const ui = {
  timerRing: document.getElementById("timerRing"),
  phaseLabel: document.getElementById("phaseLabel"),
  timerValue: document.getElementById("timerValue"),
  roundLabel: document.getElementById("roundLabel"),
  repLabel: document.getElementById("repLabel"),
  nextLabel: document.getElementById("nextLabel"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  presetList: document.getElementById("presetList"),
  soloModeBtn: document.getElementById("soloModeBtn"),
  collabModeBtn: document.getElementById("collabModeBtn"),
  sessionCard: document.getElementById("sessionCard"),
  syncStatus: document.getElementById("syncStatus"),
  settingsCard: document.querySelector(".settings-card"),
  settingsToggleBtn: document.getElementById("settingsToggleBtn"),
  settingsBody: document.getElementById("settingsBody"),
  createSessionBtn: document.getElementById("createSessionBtn"),
  joinSessionBtn: document.getElementById("joinSessionBtn"),
  sessionCodeInput: document.getElementById("sessionCodeInput"),
  sessionCode: document.getElementById("sessionCode"),
  copySessionBtn: document.getElementById("copySessionBtn"),
  sessionInfo: document.getElementById("sessionInfo"),
  sessionHint: document.getElementById("sessionHint"),
  completionMessage: document.getElementById("completionMessage"),
  emilCue: document.getElementById("emilCue"),
  defaultBadge: document.getElementById("defaultBadge"),
};

const inputPairs = [
  ["warmup", "warmupNum"],
  ["hang", "hangNum"],
  ["rest", "restNum"],
  ["reps", "repsNum"],
  ["setRest", "setRestNum"],
  ["rounds", "roundsNum"],
].map(([rangeId, numberId]) => ({
  range: document.getElementById(rangeId),
  number: document.getElementById(numberId),
  key: rangeId,
}));

const phaseColors = {
  warmup: "var(--warmup)",
  hang: "var(--hang)",
  rest: "var(--rest)",
  setrest: "var(--setrest)",
  done: "var(--done)",
  prestart: "var(--accent)",
};

const phasePulse = {
  warmup: "6s",
  hang: "4.5s",
  rest: "6.5s",
  setrest: "7.5s",
  done: "8s",
  prestart: "5.5s",
};

const clientId = getClientId();
const instanceId = getInstanceId();
const state = {
  settings: loadSettings(),
  timeline: [],
  totalMs: 0,
  running: false,
  paused: false,
  startPerf: 0,
  pausedElapsed: 0,
  rafId: null,
  lastStartAt: null,
  mode: loadMode(),
  settingsCollapsed: loadSettingsCollapsed(),
  activePresetId: loadActivePresetId(),
};

let firebaseReady = false;
let firebaseInitPromise = null;
let serverTimeOffset = 0;
let db = null;
let firebaseApi = null;
let sessionRef = null;
let sessionCode = null;
let sessionUnsub = null;
let sessionActive = false;
let settingsWriteTimer = null;

init();

function init() {
  setMode(state.mode, { force: true });
  setActivePreset(defaultPreset.id, { silent: true });
  state.settings = { ...defaults };
  renderPresets();
  bindInputs();
  bindControls();
  applySettings(state.settings, { skipRemote: true, skipStorage: true });
  setSettingsCollapsed(state.settingsCollapsed, { force: true });
  updateSessionUi();

  const params = new URLSearchParams(window.location.search);
  const code = params.get("session");
  if (code) {
    ui.sessionCodeInput.value = code.toUpperCase();
    joinSession();
  }
}

function renderPresets() {
  ui.presetList.innerHTML = "";
  presets.forEach((preset) => {
    const card = document.createElement("div");
    card.className = "preset";
    card.dataset.presetId = preset.id;
    card.innerHTML = `
      <div class="preset-title">${preset.name}</div>
      <div class="preset-desc">${preset.description}</div>
    `;
    card.addEventListener("click", () => {
      setActivePreset(preset.id);
      applySettings(preset.settings);
    });
    ui.presetList.appendChild(card);
  });
  updatePresetHighlight();
  updateDefaultBadge();
}

function bindInputs() {
  inputPairs.forEach(({ range, number, key }) => {
    const sync = (value) => {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) return;
      range.value = numeric;
      number.value = numeric;
      const updated = { ...state.settings, [key]: numeric };
      applySettings(updated);
    };
    range.addEventListener("input", (event) => sync(event.target.value));
    number.addEventListener("input", (event) => sync(event.target.value));
  });
}

function bindControls() {
  ui.startBtn.addEventListener("click", () => {
    if (state.mode === "collab" && sessionActive) {
      startTogether();
    } else if (state.running) {
      resetTimer();
      startTimer();
    } else {
      startTimer();
    }
  });

  ui.pauseBtn.addEventListener("click", () => {
    if (state.paused) {
      resumeTimer();
    } else {
      pauseTimer();
    }
  });

  ui.resetBtn.addEventListener("click", () => resetTimer());

  ui.createSessionBtn.addEventListener("click", () => createSession());
  ui.joinSessionBtn.addEventListener("click", () => joinSession());
  ui.copySessionBtn.addEventListener("click", () => copySessionLink());

  ui.soloModeBtn.addEventListener("click", () => setMode("solo"));
  ui.collabModeBtn.addEventListener("click", () => setMode("collab"));

  if (ui.settingsToggleBtn) {
    ui.settingsToggleBtn.addEventListener("click", () => {
      setSettingsCollapsed(!state.settingsCollapsed);
    });
  }
}

function applySettings(nextSettings, options = {}) {
  if (!nextSettings) return;
  state.settings = { ...defaults, ...nextSettings };
  inputPairs.forEach(({ range, number, key }) => {
    const value = state.settings[key];
    range.value = value;
    number.value = value;
  });

  if (!options.skipStorage) {
    localStorage.setItem(storageKey, JSON.stringify(state.settings));
  }

  buildTimeline();
  if (!options.keepRunning) {
    resetTimer({ silent: true });
  }
  updatePresetHighlight();
  updateEmilCue();
  if (!options.skipRemote) {
    queueRemoteSettingsUpdate();
  }
}

function buildTimeline() {
  const phases = [];
  const settings = state.settings;
  let total = 0;

  if (settings.warmup > 0) {
    phases.push({
      type: "warmup",
      label: "Warmup",
      duration: settings.warmup * 1000,
      round: 0,
      rep: 0,
    });
  }

  for (let round = 1; round <= settings.rounds; round += 1) {
    for (let rep = 1; rep <= settings.reps; rep += 1) {
      phases.push({
        type: "hang",
        label: "Hang",
        duration: settings.hang * 1000,
        round,
        rep,
      });

      if (settings.rest > 0 && rep < settings.reps) {
        phases.push({
          type: "rest",
          label: "Rest",
          duration: settings.rest * 1000,
          round,
          rep,
        });
      }
    }

    if (
      settings.reps === 1 &&
      settings.rest > 0 &&
      settings.setRest === 0 &&
      round < settings.rounds
    ) {
      phases.push({
        type: "rest",
        label: "Rest",
        duration: settings.rest * 1000,
        round,
        rep: settings.reps,
      });
    }

    if (round < settings.rounds && settings.setRest > 0) {
      phases.push({
        type: "setrest",
        label: "Set Rest",
        duration: settings.setRest * 1000,
        round,
        rep: settings.reps,
      });
    }
  }

  if (phases.length === 0) {
    phases.push({ type: "done", label: "Done", duration: 0, round: 0, rep: 0 });
  }

  state.timeline = phases.map((phase) => {
    const start = total;
    total += phase.duration;
    return { ...phase, start, end: total };
  });
  state.totalMs = total;
  renderIdle();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  state.paused = false;
  state.pausedElapsed = 0;
  state.startPerf = performance.now();
  updateControls();
  tick();
}

function startTimerAt(epochMs) {
  state.running = true;
  state.paused = false;
  state.pausedElapsed = 0;
  const delay = epochMs - serverNow();
  state.startPerf = performance.now() + delay;
  updateControls();
  tick();
}

function pauseTimer() {
  if (!state.running || state.mode === "collab") return;
  state.paused = true;
  state.running = false;
  state.pausedElapsed = performance.now() - state.startPerf;
  cancelAnimationFrame(state.rafId);
  updateControls();
}

function resumeTimer() {
  if (state.running || state.mode === "collab") return;
  state.running = true;
  state.paused = false;
  state.startPerf = performance.now() - state.pausedElapsed;
  updateControls();
  tick();
}

function resetTimer({ silent = false } = {}) {
  state.running = false;
  state.paused = false;
  state.pausedElapsed = 0;
  cancelAnimationFrame(state.rafId);
  if (!silent) {
    renderIdle();
  }
  updateControls();
}

function tick(now = performance.now()) {
  if (!state.running) return;
  const elapsed = now - state.startPerf;

  if (elapsed < 0) {
    renderPrestart(-elapsed);
    state.rafId = requestAnimationFrame(tick);
    return;
  }

  if (elapsed >= state.totalMs) {
    renderDone();
    state.running = false;
    updateControls();
    return;
  }

  renderPhase(elapsed);
  state.rafId = requestAnimationFrame(tick);
}

function renderIdle() {
  ui.phaseLabel.textContent = "Ready";
  ui.timerValue.textContent = formatClock(0);
  ui.roundLabel.textContent = `Round 0/${state.settings.rounds}`;
  ui.repLabel.textContent = `Rep 0/${state.settings.reps}`;
  ui.nextLabel.textContent = "Select a preset or tune settings";
  setRingVisuals(0, phaseColors.prestart, "prestart");
  setCompletionVisible(false);
  updateEmilCue(false, null);
  document.title = "Hangout Time";
}

function renderPrestart(ms) {
  ui.phaseLabel.textContent = "Starting";
  ui.timerValue.textContent = formatClock(Math.ceil(ms / 1000));
  ui.roundLabel.textContent = `Round 1/${state.settings.rounds}`;
  ui.repLabel.textContent = `Rep 1/${state.settings.reps}`;
  ui.nextLabel.textContent = "Get ready";
  setRingVisuals(0, phaseColors.prestart, "prestart");
  setCompletionVisible(false);
  document.title = `Starting in ${Math.ceil(ms / 1000)}s`;
}

function renderDone() {
  ui.phaseLabel.textContent = "Complete";
  ui.timerValue.textContent = formatClock(0);
  ui.roundLabel.textContent = `Round ${state.settings.rounds}/${state.settings.rounds}`;
  ui.repLabel.textContent = `Rep ${state.settings.reps}/${state.settings.reps}`;
  ui.nextLabel.textContent = "Workout finished";
  setRingVisuals(1, phaseColors.done, "done");
  setCompletionVisible(true);
  updateEmilCue(true, null);
  document.title = "Workout Complete";
}

function renderPhase(elapsed) {
  const phase = findPhase(elapsed);
  if (!phase) return;

  const remaining = Math.max(0, phase.end - elapsed);
  const progress = phase.duration > 0 ? 1 - remaining / phase.duration : 1;
  const displayRound = phase.type === "warmup" ? 0 : phase.round || 1;
  const displayRep = phase.type === "warmup" ? 0 : phase.rep || 1;

  ui.phaseLabel.textContent = phase.label.toUpperCase();
  ui.timerValue.textContent = formatClock(Math.ceil(remaining / 1000));
  ui.roundLabel.textContent = `Round ${displayRound}/${state.settings.rounds}`;
  ui.repLabel.textContent = `Rep ${displayRep}/${state.settings.reps}`;
  ui.nextLabel.textContent = nextLabelForPhase(phase);
  updateEmilCue(false, phase);

  setRingVisuals(
    progress,
    phaseColors[phase.type] || phaseColors.prestart,
    phase.type
  );
  setCompletionVisible(false);
  document.title = `${phase.label} · ${formatClock(Math.ceil(remaining / 1000))}`;
}

function nextLabelForPhase(phase) {
  if (phase.type === "warmup") {
    return "Next: Round 1 · Rep 1";
  }
  if (phase.type === "hang") {
    if (phase.rep === state.settings.reps && phase.round < state.settings.rounds) {
      return "Next: Set Rest";
    }
    if (
      phase.rep === state.settings.reps &&
      phase.round === state.settings.rounds
    ) {
      return "Last rep";
    }
    return "Hold steady";
  }
  if (phase.type === "rest") {
    const nextRep = phase.rep < state.settings.reps ? phase.rep + 1 : 1;
    const nextRound = phase.rep < state.settings.reps ? phase.round : phase.round + 1;
    if (nextRound > state.settings.rounds) {
      return "Last rep done";
    }
    return `Next: Round ${nextRound} · Rep ${nextRep}`;
  }
  if (phase.type === "setrest") {
    return `Next: Round ${phase.round + 1} · Rep 1`;
  }
  return "";
}

function setRingVisuals(progress, color, phaseType) {
  ui.timerRing.style.setProperty("--progress", progress.toFixed(4));
  ui.timerRing.style.setProperty("--phase-color", color);
  const duration = phasePulse[phaseType] || phasePulse.prestart;
  ui.timerRing.style.setProperty("--pulse-duration", duration);
}

function setCompletionVisible(visible) {
  if (!ui.completionMessage) return;
  ui.completionMessage.classList.toggle("show", visible);
}

function findPhase(elapsed) {
  return state.timeline.find((phase) => elapsed >= phase.start && elapsed < phase.end);
}

function formatClock(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updatePresetHighlight() {
  const active = presets.find((preset) =>
    Object.keys(preset.settings).every(
      (key) => preset.settings[key] === state.settings[key]
    )
  );
  document.querySelectorAll(".preset").forEach((card) => {
    card.classList.toggle("active", card.dataset.presetId === active?.id);
  });

  if (active) {
    setActivePreset(active.id, { silent: true });
  }
}

function updateDefaultBadge() {
  if (!ui.defaultBadge) return;
  ui.defaultBadge.textContent = `Default: ${defaultPreset.name}`;
}

function updateControls() {
  if (state.mode === "collab") {
    ui.startBtn.textContent = "Start Together";
    ui.startBtn.disabled = !sessionActive;
    ui.startBtn.title = sessionActive
      ? ""
      : "Create a collab session first";
    ui.pauseBtn.disabled = true;
  } else {
    ui.startBtn.textContent = state.running ? "Restart" : "Start";
    ui.startBtn.disabled = false;
    ui.startBtn.title = "";
    ui.pauseBtn.disabled = !state.running && !state.paused;
  }
  ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
}

function loadSettings() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return { ...defaults };
  try {
    return { ...defaults, ...JSON.parse(stored) };
  } catch (error) {
    return { ...defaults };
  }
}

function getClientId() {
  const key = "hangboard-client-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `client-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, id);
  return id;
}

function getInstanceId() {
  const key = "hangboard-instance-id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = `tab-${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(key, id);
  return id;
}

function updateSessionUi() {
  const enabled = isFirebaseConfigured();
  ui.createSessionBtn.disabled = !enabled;
  ui.joinSessionBtn.disabled = !enabled;
  ui.copySessionBtn.disabled = !enabled || !sessionCode;
  ui.sessionCard.style.display = state.mode === "collab" ? "grid" : "none";
  ui.sessionHint.textContent = enabled
    ? "Sessions sync the start time via Firebase."
    : "Add your Firebase config in app.js to enable real-time sync.";
  ui.sessionCode.textContent = sessionCode ?? "—";
  if (state.mode !== "collab") {
    setSyncStatus("Solo", "idle");
  } else if (!sessionActive) {
    setSyncStatus("Not connected", "idle");
  } else {
    setSyncStatus("Synced", "good");
  }
  updateControls();
}

function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (value) => value && !String(value).includes("YOUR_")
  );
}

async function initFirebase() {
  if (firebaseReady) return firebaseApi;
  if (!isFirebaseConfigured()) return false;
  if (firebaseInitPromise) return firebaseInitPromise;

  firebaseInitPromise = (async () => {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
    );
    const {
      getDatabase,
      ref,
      onValue,
      set,
      update,
      get,
      child,
      serverTimestamp,
    } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"
    );

    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);

    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snapshot) => {
      serverTimeOffset = snapshot.val() || 0;
    });

    firebaseApi = { ref, onValue, set, update, get, child, serverTimestamp };
    firebaseReady = true;
    return firebaseApi;
  })();

  return firebaseInitPromise;
}

function serverNow() {
  return Date.now() + serverTimeOffset;
}

async function createSession() {
  if (state.mode !== "collab") setMode("collab");
  const firebase = await initFirebase();
  if (!firebase) return;

  sessionCode = generateSessionCode();
  sessionRef = firebase.ref(db, `sessions/${sessionCode}`);

  const timestamp = serverTimestampValue(firebase);
  await firebase.set(sessionRef, {
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedBy: instanceId,
    settings: { ...state.settings },
    startAt: null,
  });

  watchSession(firebase);
  sessionActive = true;
  updateSessionUi();
}

async function joinSession() {
  if (state.mode !== "collab") setMode("collab");
  const firebase = await initFirebase();
  if (!firebase) return;

  const code = ui.sessionCodeInput.value.trim().toUpperCase();
  if (!code) return;
  sessionCode = code;
  sessionRef = firebase.ref(db, `sessions/${sessionCode}`);

  const snapshot = await firebase.get(sessionRef);
  if (!snapshot.exists()) {
    alert("Session not found. Check the code and try again.");
    sessionCode = null;
    sessionRef = null;
    updateSessionUi();
    return;
  }

  watchSession(firebase);
  sessionActive = true;
  updateSessionUi();
}

function watchSession(firebase) {
  if (sessionUnsub) sessionUnsub();
  sessionUnsub = firebase.onValue(sessionRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.settings && data.updatedBy !== instanceId) {
      applySettings(data.settings, { skipRemote: true, keepRunning: false });
      setSyncStatus("Synced", "good");
    }

    if (data.startAt && data.startAt !== state.lastStartAt) {
      state.lastStartAt = data.startAt;
      resetTimer({ silent: true });
      startTimerAt(data.startAt);
    }
  });
}

function queueRemoteSettingsUpdate() {
  if (!sessionActive || !sessionRef) return;
  if (settingsWriteTimer) clearTimeout(settingsWriteTimer);
  setSyncStatus("Syncing…", "pending");

  settingsWriteTimer = setTimeout(async () => {
    const firebase = await initFirebase();
    if (!firebase) return;
    try {
      await firebase.update(sessionRef, {
        settings: { ...state.settings },
        updatedBy: instanceId,
        updatedAt: serverTimestampValue(firebase),
      });
      setSyncStatus("Synced", "good");
    } catch (error) {
      setSyncStatus("Sync error", "error");
    }
  }, 300);
}

async function startTogether() {
  if (!sessionActive || !sessionRef) return;
  const firebase = await initFirebase();
  if (!firebase) return;

  const leadInMs = 3000;
  const startAt = serverNow() + leadInMs;
  state.lastStartAt = startAt;
  await firebase.update(sessionRef, {
    startAt,
    updatedBy: instanceId,
  });

  resetTimer({ silent: true });
  startTimerAt(startAt);
}

function copySessionLink() {
  if (!sessionCode) return;
  const url = `${window.location.origin}${window.location.pathname}?session=${sessionCode}`;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).catch(() => {
      alert("Copy failed. You can share the code instead.");
    });
    return;
  }
  window.prompt("Copy this link:", url);
}

function generateSessionCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function serverTimestampValue(firebase) {
  if (firebase?.serverTimestamp && typeof firebase.serverTimestamp === "function") {
    return firebase.serverTimestamp();
  }
  return { ".sv": "timestamp" };
}

function setMode(nextMode, options = {}) {
  const changed = nextMode !== state.mode;
  state.mode = nextMode;
  localStorage.setItem("hangboard-mode", nextMode);
  document.body.dataset.mode = nextMode;
  ui.soloModeBtn.classList.toggle("active", nextMode === "solo");
  ui.collabModeBtn.classList.toggle("active", nextMode === "collab");

  if (nextMode === "solo" && (changed || options.force)) {
    leaveSession();
  }
  updateSessionUi();
}

function loadMode() {
  const stored = localStorage.getItem("hangboard-mode");
  return stored === "collab" ? "collab" : "solo";
}

function leaveSession() {
  if (sessionUnsub) sessionUnsub();
  sessionUnsub = null;
  sessionActive = false;
  sessionCode = null;
  sessionRef = null;
  state.lastStartAt = null;
}

function setSettingsCollapsed(collapsed, options = {}) {
  state.settingsCollapsed = collapsed;
  if (ui.settingsCard) {
    ui.settingsCard.classList.toggle("collapsed", collapsed);
  }
  if (ui.settingsToggleBtn) {
    ui.settingsToggleBtn.setAttribute("aria-expanded", String(!collapsed));
    ui.settingsToggleBtn.textContent = collapsed ? "Show" : "Hide";
  }
  if (!options.force) {
    localStorage.setItem("hangboard-settings-collapsed", String(collapsed));
  }
}

function loadSettingsCollapsed() {
  const stored = localStorage.getItem("hangboard-settings-collapsed");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(max-width: 600px)").matches;
}

function setSyncStatus(text, tone) {
  if (!ui.syncStatus) return;
  ui.syncStatus.textContent = text;
  ui.syncStatus.classList.remove("good", "pending", "error");
  if (tone === "good") ui.syncStatus.classList.add("good");
  if (tone === "pending") ui.syncStatus.classList.add("pending");
  if (tone === "error") ui.syncStatus.classList.add("error");
}

function setActivePreset(presetId, options = {}) {
  state.activePresetId = presetId;
  if (!options.silent) {
    localStorage.setItem("hangboard-active-preset", presetId);
  }
}

function loadActivePresetId() {
  return localStorage.getItem("hangboard-active-preset") || defaultPreset.id;
}

function getActivePreset() {
  return presets.find((preset) => preset.id === state.activePresetId) || null;
}

function getEmilCue(repIndex) {
  const preset = getActivePreset();
  if (!preset || preset.id !== "emil" || !Array.isArray(preset.cues)) return null;
  return preset.cues.find((cue) => repIndex >= cue.start && repIndex <= cue.end) || null;
}

function updateEmilCue(isComplete = false, phase = null) {
  if (!ui.emilCue) return;
  const preset = getActivePreset();
  if (!preset || preset.id !== "emil") {
    ui.emilCue.textContent = "";
    ui.emilCue.classList.remove("show");
    return;
  }

  if (isComplete) {
    ui.emilCue.textContent = "Session complete";
    ui.emilCue.classList.add("show");
    return;
  }

  if (!phase || phase.type !== "hang") {
    ui.emilCue.textContent = "";
    ui.emilCue.classList.remove("show");
    return;
  }

  const cue = getEmilCue(phase.rep || 0);
  ui.emilCue.textContent = cue ? cue.text : "";
  ui.emilCue.classList.toggle("show", Boolean(cue));
}
