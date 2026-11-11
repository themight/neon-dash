"use strict";

const STEP = 1 / 240;
const GRAVITY = 82;
const JUMP_SPEED = 18.2;
const PAD_SPEED = 23.5;
const PLAYER_SIZE = 0.81;
const HALF_HITBOX = 0.29;
const HEIGHT_HITBOX = 0.73;
const CUBE_COLOR = "#d9fa67";
const STORAGE_KEY = "neon-dash-v1";

const spike = (x, count = 1) => Array.from({ length: count }, (_, index) => ({
  type: "spike", x: x + index, width: 0.94, height: 0.89
}));
const block = (x, width, height) => ({ type: "block", x, width, height });
const pit = (x, width) => ({ type: "pit", x, width });
const pad = x => ({ type: "pad", x, width: 0.78 });

const SECTIONS = {
  single: { width: 6.5, items: spike(0) },
  double: { width: 7.5, items: spike(0, 2) },
  triple: { width: 8, items: spike(0, 3) },
  pit: { width: 8, items: [pit(0, 2.65)] },
  widePit: { width: 8.75, items: [pit(0, 3.25)] },
  block: { width: 8, items: [block(0, 2.4, 1)] },
  stairs: { width: 9.5, items: [block(0, 1.8, 0.9), block(1.8, 2.4, 1.6)] },
  platform: { width: 12, items: [block(0, 3, 1), ...spike(6)] },
  bridge: { width: 10.5, items: [pit(0, 3.1), block(3.05, 2.4, 0.85)] },
  boost: { width: 14, items: [pad(0), pit(1.55, 3.9), ...spike(8.4)] },
  rhythm: { width: 16, items: [...spike(0), ...spike(5), ...spike(10.5)] },
  stagger: { width: 17.5, items: [...spike(0, 2), ...spike(5.75), ...spike(11, 2)] },
  tower: { width: 14, items: [block(0, 2, 1.45), block(3.2, 2.2, 0.95), ...spike(8)] },
  rush: { width: 13.5, items: [...spike(0, 3), ...spike(6.4, 2)] }
};

const LEVELS = [
  {
    id: "pulse", title: "Первый импульс", difficulty: "Легко", color: "#b4a0ff",
    sky: ["#1d103b", "#352061"], speed: 10.5, bpm: 132,
    sections: [
      "single", "single", "double", "single", "block", "pit", "double", "rhythm",
      "block", "single", "platform", "pit", "double", "single", "triple", "block",
      "pit", "rhythm", "double"
    ]
  },
  {
    id: "overdrive", title: "Разгон", difficulty: "Средне", color: "#72e4ed",
    sky: ["#0d253d", "#153f60"], speed: 11.35, bpm: 146,
    sections: [
      "double", "pit", "platform", "triple", "rhythm", "stairs", "boost", "stagger",
      "widePit", "block", "double", "platform", "boost", "triple", "pit", "stairs",
      "rush", "rhythm", "triple", "widePit"
    ]
  },
  {
    id: "storm", title: "Неоновый шторм", difficulty: "Сложно", color: "#ff8cc6",
    sky: ["#321037", "#57204e"], speed: 12.25, bpm: 158,
    sections: [
      "triple", "stairs", "bridge", "stagger", "boost", "tower", "rush", "widePit",
      "stagger", "bridge", "triple", "stairs", "rush", "boost", "tower", "widePit",
      "rhythm", "bridge", "rush", "triple", "stagger", "boost", "rush"
    ]
  }
];
const MARATHON = {
  id: "marathon", title: "Марафон", color: "#f4bc77", sky: ["#26112e", "#552646"],
  speed: 12.35, bpm: 154
};
const MARATHON_SECTIONS = [
  "single", "double", "pit", "platform", "rhythm", "triple", "stairs", "bridge",
  "boost", "stagger", "widePit", "tower", "rush"
];

function addSection(track, key) {
  const section = SECTIONS[key];
  for (const item of section.items) {
    track.items.push({ ...item, x: track.edge + item.x });
  }
  track.edge += section.width;
}

function makeTrack(level) {
  const track = { ...level, items: [], checkpoints: [], edge: 12, finish: Infinity };
  if (level.id === MARATHON.id) return track;

  level.sections.forEach((key, index) => {
    if (index > 0 && index % 3 === 0) track.checkpoints.push(track.edge - 2.3);
    addSection(track, key);
  });
  track.finish = track.edge + 3;
  return track;
}

function extendMarathon(track, x) {
  while (track.edge < x + 34) {
    const limit = x < 45 ? 6 : MARATHON_SECTIONS.length;
    addSection(track, MARATHON_SECTIONS[Math.floor(Math.random() * limit)]);
  }
  const firstVisible = track.items.findIndex(item => item.x + item.width >= x - 20);
  if (firstVisible > 0) track.items.splice(0, firstVisible);
}

function makePlayer(x = 0) {
  return { x, y: 0, vy: 0, angle: 0, grounded: true };
}

function hitsSpike(player, item) {
  const y = Math.max(0.055, player.y + 0.055);
  if (y >= item.height || player.y + HEIGHT_HITBOX <= 0) return false;
  // Intersect the inset player rectangle with the widest triangle slice it reaches.
  const halfWidth = item.width * 0.45 * (1 - y / item.height);
  const center = item.x + item.width / 2;
  return player.x + HALF_HITBOX > center - halfWidth
    && player.x - HALF_HITBOX < center + halfWidth;
}

function stepPlayer(player, track, wantsJump) {
  const previousX = player.x;
  const previousY = player.y;
  const wasGrounded = player.grounded;
  const nextX = previousX + track.speed * STEP;
  let launch = 0;

  if (wasGrounded) {
    for (const item of track.items) {
      if (item.x > nextX + 1) break;
      if (item.type === "pad" && player.y === 0 && previousX < item.x + item.width
          && nextX >= item.x) {
        launch = PAD_SPEED;
        break;
      }
    }
    if (!launch && wantsJump) launch = JUMP_SPEED;
  }
  if (launch) player.vy = launch;
  player.x = nextX;
  player.vy -= GRAVITY * STEP;
  player.y += player.vy * STEP;
  player.grounded = false;

  let hasGround = true;
  for (const item of track.items) {
    if (item.x > player.x + HALF_HITBOX) break;
    if (item.x + item.width < player.x - HALF_HITBOX) continue;
    if (item.type === "pit" && player.x > item.x + 0.16 && player.x < item.x + item.width - 0.16) {
      hasGround = false;
    }
    if (item.type === "block" && player.x + HALF_HITBOX > item.x
        && player.x - HALF_HITBOX < item.x + item.width && player.y < item.height) {
      if (previousY >= item.height - 0.0001 && player.vy <= 0) {
        player.y = item.height;
        player.grounded = true;
      } else if (player.y + HEIGHT_HITBOX > 0) {
        return { crashed: true, launch };
      }
    }
  }
  if (hasGround && player.y <= 0 && previousY >= -0.13 && player.vy <= 0) {
    player.y = 0;
    player.grounded = true;
  }
  if (player.grounded) {
    player.vy = 0;
    player.angle = Math.round(player.angle / (Math.PI / 2)) * (Math.PI / 2);
  } else {
    player.angle = (player.angle + track.speed * 0.68 * STEP) % (Math.PI * 2);
  }

  if (player.y < -2.4) return { crashed: true, launch };
  for (const item of track.items) {
    if (item.x > player.x + HALF_HITBOX) break;
    if (item.type === "spike" && item.x + item.width >= player.x - HALF_HITBOX
        && hitsSpike(player, item)) return { crashed: true, launch };
  }
  return { crashed: false, launch };
}

function readSave() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const save = readSave();
if (!save.records || typeof save.records !== "object") save.records = {};
let soundOn = save.sound !== false;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // The game remains playable when the browser blocks storage.
  }
}

const byId = id => document.getElementById(id);
const canvas = byId("game");
const ctx = canvas.getContext("2d");
const ui = {
  stage: byId("stage"), overlay: byId("overlay"), title: byId("overlay-title"),
  kicker: byId("overlay-kicker"), note: byId("overlay-note"), action: byId("action"),
  actionLabel: byId("action-label"), secondary: byId("secondary"), pause: byId("pause"),
  progress: byId("progress-value"), fill: byId("progress-fill"), name: byId("track-name"),
  attempt: byId("attempt"), best: byId("best"), notice: byId("notice"),
  levels: byId("levels"), modes: byId("modes"), sound: byId("sound"), soundLabel: byId("sound-label")
};

let levelIndex = 0;
let mode = "normal";
let state = "menu";
let track = makeTrack(LEVELS[levelIndex]);
let player = makePlayer();
let attempt = 1;
let best = 0;
let checkpoint = 0;
let checkpointIndex = 0;
let respawnAt = 0;
let noticeUntil = 0;
let lastHudValue = -1;
let held = false;
let jumpBuffer = 0;
let particles = [];
let trailClock = 0;
let viewWidth = 0;
let viewHeight = 0;
let pixelRatio = 1;
let previousTime = performance.now();
let accumulator = 0;
let nextNote = 0;
let audio;
let master;

function unlockAudio() {
  if (!soundOn) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    if (!audio) {
      audio = new Audio();
      master = audio.createGain();
      master.gain.value = 0.42;
      master.connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    audio = undefined;
  }
}

function tone(from, to, duration, volume, type = "sine") {
  if (!soundOn || !audio || audio.state !== "running") return;
  const start = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playBeat() {
  const eighth = 30 / track.bpm;
  const note = Math.floor(player.x / track.speed / eighth);
  if (note < nextNote) return;
  nextNote = note + 1;
  const bass = [55, 55, 65.41, 49][Math.floor(note / 8) % 4];
  if (note % 2 === 0) tone(115, 38, 0.15, 0.20);
  if (note % 4 === 0 || note % 4 === 3) tone(bass, bass, 0.15, 0.085, "triangle");
  if (note % 2 === 1) tone(1150, 690, 0.043, 0.035, "triangle");
}

const levelButtons = LEVELS.map((level, index) => {
  const button = document.createElement("button");
  button.className = "level";
  button.type = "button";
  button.style.setProperty("--level-color", level.color);
  button.innerHTML = `<span class="level-icon" aria-hidden="true">0${index + 1}</span>
    <span><strong>${level.title}</strong><small>${level.difficulty}</small></span>`;
  button.addEventListener("click", () => {
    if (mode !== "endless" && levelIndex === index) return;
    updateRecord();
    levelIndex = index;
    if (mode === "endless") mode = "normal";
    showMenu();
  });
  ui.levels.append(button);
  return button;
});

const modeButtons = [...ui.modes.querySelectorAll("button")];
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (mode === button.dataset.mode) return;
    updateRecord();
    mode = button.dataset.mode;
    showMenu();
  });
}

function recordKey() {
  return mode === "endless" ? track.id : `${track.id}:${mode}`;
}

function runValue() {
  return mode === "endless" ? Math.floor(player.x) : Math.min(100, Math.floor(player.x / track.finish * 100));
}

function formatValue(value) {
  return mode === "endless" ? `${value} м` : `${value}%`;
}

function updateHud(force = false) {
  const value = runValue();
  if (force || value !== lastHudValue) {
    ui.progress.textContent = formatValue(value);
    ui.fill.style.width = mode === "endless" ? "0" : `${value}%`;
    lastHudValue = value;
  }
  const attemptText = String(attempt).padStart(2, "0");
  const bestText = formatValue(best);
  if (ui.attempt.textContent !== attemptText) ui.attempt.textContent = attemptText;
  if (ui.best.textContent !== bestText) ui.best.textContent = bestText;
}

function updateRecord() {
  if (runValue() <= best) return;
  best = runValue();
  save.records[recordKey()] = best;
  persist();
}

function setState(next) {
  state = next;
  ui.pause.disabled = !["playing", "paused"].includes(state);
  ui.pause.setAttribute("aria-label", state === "paused" ? "Продолжить" : "Пауза");
  ui.pause.title = state === "paused" ? "Продолжить (Esc)" : "Пауза (Esc)";
  ui.pause.firstElementChild.textContent = state === "paused" ? "▶" : "Ⅱ";
  ui.overlay.hidden = state === "playing" || state === "respawning";
  ui.overlay.dataset.state = state;
  ui.secondary.hidden = state === "menu";
  if (ui.overlay.hidden) return;

  const copy = {
    menu: [
      "РИТМ-ПЛАТФОРМЕР", "NEON <em>DASH</em>",
      mode === "practice" ? "После падения кубик возвращается к последней контрольной точке."
        : mode === "endless" ? "Трасса без финиша. Как далеко ты доберёшься?"
          : "Перепрыгивай шипы и держи ритм.",
      "Играть"
    ],
    dead: ["СТОЛКНОВЕНИЕ", "Ещё попытка?", `Результат — ${formatValue(runValue())}`, "Ещё раз"],
    paused: ["ПАУЗА", "Передышка", "Нажми Esc, чтобы продолжить.", "Продолжить"],
    won: [
      "ФИНИШ", mode === "practice" ? "Тренировка пройдена!" : "Уровень пройден!",
      `${track.title} · попытка ${attempt}`,
      levelIndex < LEVELS.length - 1 ? "Следующий уровень" : "Сыграть снова"
    ]
  };
  const [kicker, title, note, action] = copy[state];
  ui.kicker.innerHTML = `<span></span> ${kicker} <span></span>`;
  ui.title.innerHTML = title;
  ui.note.textContent = note;
  ui.actionLabel.textContent = action;
}

function refreshSelection() {
  levelButtons.forEach((button, index) => button.setAttribute(
    "aria-pressed", mode !== "endless" && index === levelIndex
  ));
  modeButtons.forEach(button => button.setAttribute("aria-pressed", mode === button.dataset.mode));
  ui.name.textContent = track.title;
  ui.fill.parentElement.classList.toggle("endless", mode === "endless");
}

function resetPlayer(x) {
  player = makePlayer(x);
  particles = [];
  trailClock = 0;
  held = false;
  jumpBuffer = 0;
  nextNote = Math.floor(x / track.speed / (30 / track.bpm));
  ui.notice.hidden = true;
  updateHud(true);
}

function rebuildTrack() {
  track = makeTrack(mode === "endless" ? MARATHON : LEVELS[levelIndex]);
  if (mode === "endless") extendMarathon(track, 0);
  best = Math.max(0, Number(save.records[recordKey()]) || 0);
  refreshSelection();
}

function showMenu() {
  attempt = 1;
  rebuildTrack();
  resetPlayer(0);
  setState("menu");
}

function startRun(newSession) {
  if (newSession) {
    attempt = 1;
  } else {
    attempt += 1;
  }
  checkpoint = 0;
  checkpointIndex = 0;
  if (mode === "endless") rebuildTrack();
  resetPlayer(0);
  setState("playing");
}

function togglePause() {
  if (state === "playing") {
    held = false;
    jumpBuffer = 0;
    setState("paused");
  } else if (state === "paused") {
    unlockAudio();
    setState("playing");
  }
}

function primaryAction() {
  unlockAudio();
  if (state === "menu") startRun(true);
  else if (state === "dead") startRun(false);
  else if (state === "paused") togglePause();
  else if (state === "won") {
    if (levelIndex < LEVELS.length - 1) {
      levelIndex += 1;
      rebuildTrack();
    }
    startRun(true);
  }
}

function refreshSound() {
  ui.sound.setAttribute("aria-pressed", soundOn);
  ui.soundLabel.textContent = soundOn ? "Звук вкл." : "Звук выкл.";
}

ui.sound.addEventListener("click", () => {
  soundOn = !soundOn;
  save.sound = soundOn;
  persist();
  refreshSound();
  if (soundOn) {
    unlockAudio();
    if (master) master.gain.value = 0.42;
  } else if (master) {
    master.gain.value = 0;
  }
});
ui.action.addEventListener("click", primaryAction);
ui.secondary.addEventListener("click", () => {
  updateRecord();
  showMenu();
});
ui.pause.addEventListener("click", togglePause);

const jumpKeys = new Set(["Space", "ArrowUp", "KeyW"]);
window.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (jumpKeys.has(event.code)) {
    if (state !== "playing" && event.code === "Space" && document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (state === "playing") {
      unlockAudio();
      held = true;
      jumpBuffer = 0.075;
    } else if (state !== "respawning") {
      primaryAction();
    }
  }
  if (event.repeat) return;
  if (event.code === "Escape" || event.code === "KeyP") togglePause();
  if (event.code === "KeyR" && state !== "menu") {
    updateRecord();
    unlockAudio();
    startRun(false);
  }
});
window.addEventListener("keyup", event => {
  if (jumpKeys.has(event.code)) held = false;
});
canvas.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  if (state === "playing") {
    unlockAudio();
    held = true;
    jumpBuffer = 0.075;
    canvas.setPointerCapture(event.pointerId);
  } else if (state !== "respawning") {
    primaryAction();
  }
});
for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(eventName, () => { held = false; });
}
window.addEventListener("blur", () => {
  held = false;
  if (state === "playing") togglePause();
});

function emitParticles(x, y, count, color, force) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.35 + Math.random() * 0.65) * force;
    const lifetime = 0.2 + Math.random() * 0.28;
    particles.push({
      x, y, vx: Math.cos(angle) * speed - 1.5, vy: Math.sin(angle) * speed,
      size: 0.055 + Math.random() * 0.11, lifetime, remaining: lifetime, color
    });
  }
}

function tick(now) {
  if (state !== "paused") {
    for (const particle of particles) {
      particle.x += particle.vx * STEP;
      particle.y += particle.vy * STEP;
      particle.vy -= 8 * STEP;
      particle.remaining -= STEP;
    }
    particles = particles.filter(particle => particle.remaining > 0);
  }
  if (state === "respawning" && now >= respawnAt) {
    attempt += 1;
    resetPlayer(checkpoint);
    setState("playing");
    return;
  }
  if (state !== "playing") return;

  if (mode === "endless") extendMarathon(track, player.x);
  const result = stepPlayer(player, track, held || jumpBuffer > 0);
  jumpBuffer = result.launch ? 0 : Math.max(0, jumpBuffer - STEP);
  if (result.launch) {
    const boosted = result.launch === PAD_SPEED;
    tone(boosted ? 210 : 180, boosted ? 620 : 340, 0.11, 0.09, "triangle");
    emitParticles(player.x, player.y + 0.12, boosted ? 11 : 5, CUBE_COLOR, 3);
  }

  if (result.crashed) {
    updateRecord();
    updateHud(true);
    emitParticles(player.x, player.y + PLAYER_SIZE / 2, 29, CUBE_COLOR, 6);
    tone(145, 40, 0.26, 0.27, "sawtooth");
    held = false;
    ui.notice.hidden = true;
    if (mode === "practice") {
      respawnAt = now + 560;
      setState("respawning");
    } else {
      setState("dead");
    }
    return;
  }

  if (player.x >= track.finish) {
    updateRecord();
    updateHud(true);
    emitParticles(player.x, player.y + PLAYER_SIZE / 2, 22, CUBE_COLOR, 6);
    tone(261.63, 523.25, 0.35, 0.19, "triangle");
    setState("won");
    return;
  }

  if (mode === "practice" && player.grounded && player.y === 0
      && player.x >= track.checkpoints[checkpointIndex]) {
    const target = track.checkpoints[checkpointIndex];
    checkpointIndex += 1;
    if (player.x <= target + 0.5) {
      checkpoint = target;
      ui.notice.textContent = "Контрольная точка";
      ui.notice.hidden = false;
      noticeUntil = now + 1350;
      tone(420, 660, 0.17, 0.1, "triangle");
    }
  }
  if (now >= noticeUntil) ui.notice.hidden = true;

  trailClock += STEP;
  if (trailClock > 0.042) {
    trailClock -= 0.042;
    emitParticles(player.x - 0.32, player.y + 0.13, 1, CUBE_COLOR, 1);
  }
  playBeat();
}

function fractional(value) {
  return value - Math.floor(value);
}

const stars = Array.from({ length: 80 }, (_, index) => ({
  x: fractional(Math.sin(index * 37.57 + 1) * 1726.28),
  y: fractional(Math.sin(index * 19.31 + 4) * 2737.87) * 0.77,
  size: index % 6 === 0 ? 2 : 1,
  opacity: 0.17 + (index % 7) * 0.063
}));

function resize() {
  const bounds = ui.stage.getBoundingClientRect();
  viewWidth = bounds.width;
  viewHeight = bounds.height;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewWidth * pixelRatio);
  canvas.height = Math.round(viewHeight * pixelRatio);
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawSky(camera, unit, floor, now) {
  const sky = ctx.createLinearGradient(0, 0, 0, floor);
  sky.addColorStop(0, track.sky[0]);
  sky.addColorStop(1, track.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const sunX = viewWidth * 0.77;
  const sunY = floor * 0.53;
  const radius = Math.min(viewWidth * 0.16, floor * 0.48);
  const halo = ctx.createRadialGradient(sunX, sunY, radius * 0.2, sunX, sunY, radius * 1.6);
  halo.addColorStop(0, track.color + "3d");
  halo.addColorStop(1, track.color + "00");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, viewWidth, floor);

  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, sunY - radius, 0, sunY + radius);
  sun.addColorStop(0, track.color + "75");
  sun.addColorStop(1, track.color + "0d");
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - radius, sunY - radius, radius * 2, radius * 2);
  ctx.fillStyle = track.sky[1];
  for (let y = 0; y < radius; y += 9) {
    ctx.fillRect(sunX - radius, sunY + y, radius * 2, 1 + y / radius * 3);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = track.color;
  const drift = camera * unit * 0.08;
  for (const star of stars) {
    const x = fractional(star.x - drift / viewWidth) * viewWidth;
    ctx.globalAlpha = star.opacity * (0.86 + Math.sin(now * 0.002 + star.x * 14) * 0.14);
    ctx.fillRect(x, star.y * floor, star.size, star.size);
  }
  ctx.restore();

  const cell = Math.max(34, unit * 0.86);
  ctx.lineWidth = 1;
  ctx.strokeStyle = track.color + "18";
  const gridOffset = -(camera * unit * 0.22) % cell;
  for (let x = gridOffset - cell; x < viewWidth; x += cell) line(x, 0, x, floor);
  for (let y = floor - cell; y >= 0; y -= cell) line(0, y, viewWidth, y);

  for (let layer = 0; layer < 2; layer += 1) {
    const tile = unit * (layer ? 1.75 : 2.35);
    const offset = camera * unit * (layer ? 0.43 : 0.26);
    const first = Math.floor(offset / tile) - 1;
    ctx.fillStyle = track.sky[0] + (layer ? "df" : "aa");
    ctx.strokeStyle = track.color + (layer ? "25" : "1b");
    for (let index = first; (index * tile - offset) < viewWidth; index += 1) {
      const seed = fractional(Math.sin(index * 21.31 + layer * 7.6) * 1736.78);
      const height = unit * (0.65 + seed * (layer ? 1.45 : 2.3));
      const x = index * tile - offset;
      const width = tile * (0.58 + seed * 0.27);
      ctx.fillRect(x, floor - height, width, height);
      ctx.strokeRect(x + 0.5, floor - height + 0.5, width, height);
      if (seed > 0.54) {
        ctx.fillStyle = track.color + "48";
        ctx.fillRect(x + width - 10, floor - height + 8, 3, 3);
        ctx.fillStyle = track.sky[0] + (layer ? "df" : "aa");
      }
    }
  }
}

function drawFloor(x1, x2, floor, unit, offset) {
  if (x2 <= x1) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x1, floor - 1, x2 - x1, viewHeight - floor + 1);
  ctx.clip();

  const ground = ctx.createLinearGradient(0, floor, 0, viewHeight);
  ground.addColorStop(0, track.sky[0]);
  ground.addColorStop(1, "#100b20");
  ctx.fillStyle = ground;
  ctx.fillRect(x1, floor, x2 - x1, viewHeight - floor);
  ctx.strokeStyle = track.color + "25";
  const tile = unit * 0.73;
  for (let x = Math.floor((x1 - offset) / tile) * tile + offset; x < x2; x += tile) {
    line(x, floor, x, viewHeight);
  }
  for (let y = floor + tile / 2; y < viewHeight; y += tile / 2) line(x1, y, x2, y);
  ctx.strokeStyle = track.color + "e0";
  ctx.shadowColor = track.color;
  ctx.shadowBlur = 11;
  ctx.lineWidth = 2;
  line(x1, floor, x2, floor);
  ctx.restore();
}

function drawGround(items, toScreen, floor, unit) {
  let segment = 0;
  for (const item of items) {
    if (item.type !== "pit") continue;
    const start = Math.max(0, toScreen(item.x));
    const end = Math.min(viewWidth, toScreen(item.x + item.width));
    if (end <= 0 || start >= viewWidth) continue;
    drawFloor(segment, start, floor, unit, toScreen(0));
    segment = end;
  }
  drawFloor(segment, viewWidth, floor, unit, toScreen(0));
}

function drawItem(item, x, floor, unit) {
  const width = item.width * unit;
  const height = item.height * unit;
  ctx.save();
  ctx.lineWidth = Math.max(1.3, unit * 0.041);
  ctx.strokeStyle = track.color;
  ctx.fillStyle = track.sky[0];
  ctx.shadowColor = track.color;
  ctx.shadowBlur = 8;

  if (item.type === "spike") {
    ctx.beginPath();
    ctx.moveTo(x, floor);
    ctx.lineTo(x + width / 2, floor - height);
    ctx.lineTo(x + width, floor);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = track.color + "46";
    ctx.beginPath();
    ctx.moveTo(x + width * 0.19, floor - unit * 0.075);
    ctx.lineTo(x + width * 0.5, floor - height * 0.73);
    ctx.lineTo(x + width * 0.81, floor - unit * 0.075);
    ctx.fill();
  } else if (item.type === "block") {
    ctx.fillRect(x, floor - height, width, height);
    ctx.strokeRect(x, floor - height, width, height);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = track.color + "55";
    ctx.lineWidth = 1;
    for (let offset = 0; offset < width; offset += unit) {
      const size = Math.min(unit, width - offset);
      const inset = unit * 0.13;
      if (size < inset * 3) break;
      ctx.strokeRect(x + offset + inset, floor - height + inset, size - inset * 2, height - inset * 2);
    }
  } else if (item.type === "pad") {
    ctx.fillStyle = "#ffcf72";
    ctx.shadowColor = "#ffcf72";
    ctx.fillRect(x, floor - unit * 0.1, width, unit * 0.1);
    ctx.strokeStyle = "#ffec9e";
    for (let offset = 0.18; offset < 0.7; offset += 0.22) {
      const at = x + offset * unit;
      ctx.beginPath();
      ctx.moveTo(at - unit * 0.07, floor - unit * 0.15);
      ctx.lineTo(at, floor - unit * 0.24);
      ctx.lineTo(at + unit * 0.07, floor - unit * 0.15);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFinish(x, floor, unit) {
  const y = floor - unit * 3.3;
  const width = unit * 0.55;
  ctx.save();
  ctx.strokeStyle = CUBE_COLOR;
  ctx.shadowColor = CUBE_COLOR;
  ctx.shadowBlur = 15;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - width / 2, y, width, floor - y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#d9fa6720";
  ctx.fillRect(x - width / 2, y, width, floor - y);
  ctx.fillStyle = "#d9fa67bb";
  const square = width / 3;
  for (let row = 0; row < 5; row += 1) {
    for (let column = row % 2; column < 3; column += 2) {
      ctx.fillRect(x - width / 2 + column * square, y + row * square, square, square);
    }
  }
  ctx.restore();
}

function drawCheckpoint(x, floor, unit, lit) {
  ctx.save();
  ctx.strokeStyle = lit ? CUBE_COLOR : track.color + "a5";
  ctx.fillStyle = lit ? CUBE_COLOR : track.color + "a5";
  ctx.lineWidth = 1.5;
  if (lit) {
    ctx.shadowColor = CUBE_COLOR;
    ctx.shadowBlur = 10;
  }
  const y = floor - unit * 0.86;
  line(x, floor, x, y);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + unit * 0.34, y + unit * 0.10);
  ctx.lineTo(x, y + unit * 0.22);
  ctx.fill();
  ctx.restore();
}

function drawCube(x, y, unit, angle) {
  const size = unit * PLAYER_SIZE;
  ctx.save();
  ctx.translate(x, y - size / 2);
  ctx.rotate(angle);
  ctx.lineWidth = Math.max(1.4, unit * 0.04);
  ctx.shadowColor = CUBE_COLOR;
  ctx.shadowBlur = 19;
  ctx.fillStyle = "#829e37";
  ctx.strokeStyle = "#edffa4";
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = CUBE_COLOR;
  ctx.beginPath();
  ctx.roundRect(-size * 0.39, -size * 0.39, size * 0.78, size * 0.78, size * 0.07);
  ctx.fill();
  ctx.fillStyle = "#26233a";
  ctx.fillRect(-size * 0.25, -size * 0.19, size * 0.14, size * 0.17);
  ctx.fillRect(size * 0.11, -size * 0.19, size * 0.14, size * 0.17);
  ctx.fillRect(-size * 0.15, size * 0.13, size * 0.30, size * 0.09);
  ctx.restore();
}

function draw(now) {
  if (!viewWidth || !viewHeight) return;
  const menu = state === "menu";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const time = reducedMotion ? 0 : now;
  const floor = Math.round(viewHeight * 0.82);
  const unit = Math.min(49, Math.max(27, viewWidth / 22));
  const lead = menu ? viewWidth * 0.15 : Math.min(viewWidth * 0.19, 203);
  const camera = menu ? 0 : player.x - lead / unit;
  const toScreen = x => (x - camera) * unit;
  const preview = viewWidth >= 550
    ? [...spike(viewWidth / unit * 0.27), ...spike(viewWidth / unit * 0.68, 2),
        block(viewWidth / unit * 0.88, 1.4, 0.9)]
    : [...spike(viewWidth / unit * 0.63, 2)];
  const items = menu ? preview : track.items;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawSky(camera, unit, floor, time);
  drawGround(items, toScreen, floor, unit);
  for (const item of items) {
    const x = toScreen(item.x);
    if (x > viewWidth + unit) break;
    if (x + item.width * unit < -unit || item.type === "pit") continue;
    drawItem(item, x, floor, unit);
  }

  if (mode === "practice" && !menu) {
    for (const point of track.checkpoints) {
      const x = toScreen(point);
      if (x > -unit && x < viewWidth + unit) drawCheckpoint(x, floor, unit, point === checkpoint);
    }
  }
  const finish = toScreen(track.finish);
  if (!menu && finish < viewWidth + unit && finish > -unit) drawFinish(finish, floor, unit);

  ctx.save();
  for (const particle of particles) {
    ctx.globalAlpha = Math.min(0.95, particle.remaining / particle.lifetime);
    ctx.fillStyle = particle.color;
    ctx.fillRect(toScreen(particle.x), floor - particle.y * unit, particle.size * unit, particle.size * unit);
  }
  ctx.restore();

  if (menu) {
    const hover = Math.sin(time / 560) * unit * 0.13;
    const menuUnit = viewWidth > 550 ? unit * 1.29 : unit;
    ctx.fillStyle = "#d9fa6745";
    for (let index = 0; index < 5; index += 1) {
      const offset = (index + 2) * menuUnit * 0.17;
      const size = (5 - index) * menuUnit * 0.026;
      ctx.fillRect(lead - offset - menuUnit * 0.3, floor - menuUnit * 0.98 + index * 3, size, size);
    }
    drawCube(lead, floor - menuUnit * 0.74 + hover, menuUnit, -0.39);
  } else if (state !== "dead" && state !== "respawning") {
    drawCube(lead, floor - player.y * unit, unit, player.angle);
  }
}

function frame(now) {
  accumulator += Math.min(0.055, (now - previousTime) / 1000);
  previousTime = now;
  while (accumulator >= STEP) {
    tick(now);
    accumulator -= STEP;
  }
  updateHud();
  draw(now);
  requestAnimationFrame(frame);
}

showMenu();
refreshSound();
resize();
new ResizeObserver(resize).observe(ui.stage);
requestAnimationFrame(frame);
