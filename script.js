const currentTime = document.querySelector("h1");
const content = document.querySelector(".content");
const timeControls = ["alarm-hour", "alarm-minute", "alarm-period"].map((id) => document.getElementById(id));
const alarmForm = document.getElementById("alarm-form");
const setAlarmBtn = document.getElementById("set-alarm");
const soundSelect = document.getElementById("alarm-sound");
const previewBtn = document.getElementById("preview-sound");
const alarmNote = document.getElementById("alarm-status");
const soundNote = document.getElementById("sound-status");
const countdown = document.getElementById("alarm-countdown");
const ringingDialog = document.getElementById("ringing-overlay");
const ringingTime = document.getElementById("ringing-time");
const ringingStatus = document.getElementById("ringing-status");
const stopBtn = document.getElementById("stop-alarm");
const snoozeBtn = document.getElementById("snooze-alarm");
const retryBtn = document.getElementById("retry-sound");
const gyroGif = document.getElementById("gyro-gif");
const mainClockImage = document.getElementById("main-clock-image");

const storageKey = "flow3r-alarm-v1";
const originalTitle = document.title;
const minuteMs = 60 * 1000;
let activeAlarm = null;
let isRinging = false;
let playbackId = 0;
let audioMode = "idle";
let calendarDay = new Date().toDateString();

// Original PCM tones are generated locally: no remote music or audio service is needed.
const sounds = {
  chime: { name: "Starlight Chime", duration: 2.4, notes: [[659.25, 0, 1], [830.61, 0.35, 1], [987.77, 0.7, 1.3]] },
  digital: { name: "Digital Beeps", duration: 1.6, notes: [[880, 0, 0.14], [880, 0.22, 0.14], [1174.66, 0.7, 0.14], [1174.66, 0.92, 0.14]] },
  melody: { name: "Soft Melody", duration: 2.4, notes: [[523.25, 0, 0.5], [659.25, 0.45, 0.5], [783.99, 0.9, 0.5], [659.25, 1.35, 0.65]] },
  bell: { name: "Little Bell", duration: 2.8, notes: [[1046.5, 0, 1.5], [783.99, 0.75, 1.5]] }
};
const soundUrls = new Map();
const ringtone = new Audio();
ringtone.preload = "auto";

function soundUrl(key) {
  if (soundUrls.has(key)) return soundUrls.get(key);
  const sound = sounds[key];
  const sampleRate = 22050;
  const samples = Math.ceil(sound.duration * sampleRate);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index++) {
    const time = index / sampleRate;
    let sample = 0;
    for (const [frequency, start, duration] of sound.notes) {
      const elapsed = time - start;
      if (elapsed < 0 || elapsed >= duration) continue;
      const envelope = Math.min(1, elapsed / 0.012) * Math.exp(-4 * elapsed / duration) * Math.min(1, (duration - elapsed) / 0.025);
      sample += 0.24 * envelope * (Math.sin(2 * Math.PI * frequency * elapsed) + 0.2 * Math.sin(2 * Math.PI * frequency * 2.01 * elapsed));
    }
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  soundUrls.set(key, url);
  return url;
}

function stopAudio() {
  // Invalidate old play promises so a late rejection cannot change a cleared alarm.
  playbackId++;
  audioMode = "idle";
  ringtone.pause();
  ringtone.currentTime = 0;
  ringtone.loop = false;
  ringtone.volume = 1;
  previewBtn.textContent = "Preview sound ♫";
}

async function playSound(key, mode) {
  stopAudio();
  const requestId = playbackId;
  audioMode = mode;
  const url = soundUrl(key);
  if (ringtone.src !== url) ringtone.src = url;
  ringtone.loop = mode === "ring" || mode === "prepare";
  // Start the same media element silently during the Set gesture to unlock later playback.
  ringtone.volume = mode === "prepare" ? 0 : 1;
  if (mode === "preview") {
    previewBtn.textContent = "Stop preview ♫";
    soundNote.textContent = `Previewing ${sounds[key].name}…`;
  }
  try {
    await ringtone.play();
    if (requestId !== playbackId) return;
    if (mode === "prepare") {
      stopAudio();
      soundNote.textContent = `${sounds[key].name} is ready.`;
    } else if (mode === "ring") {
      retryBtn.hidden = true;
      ringingStatus.textContent = "";
    }
  } catch {
    if (requestId !== playbackId) return;
    stopAudio();
    if (mode === "ring" && isRinging) {
      retryBtn.hidden = false;
      ringingStatus.textContent = "Sound was blocked. Tap Play alarm sound, or check your browser’s sound permissions.";
    } else {
      soundNote.textContent = "Sound could not play. Check your browser’s sound permissions and try Preview again. Your alarm still shows a visual reminder.";
    }
  }
}

ringtone.addEventListener("ended", () => {
  if (audioMode === "preview") {
    stopAudio();
    soundNote.textContent = "Preview finished. Choose your next little moment.";
  }
});

previewBtn.addEventListener("click", () => {
  if (audioMode === "preview") {
    stopAudio();
    soundNote.textContent = "Preview stopped.";
  } else {
    playSound(soundSelect.value, "preview");
  }
});

soundSelect.addEventListener("change", () => {
  stopAudio();
  soundNote.textContent = `${sounds[soundSelect.value].name} selected.`;
});

// Populate the alarm time controls.
for (let i = 12; i >= 1; i--) {
  const value = String(i).padStart(2, "0");
  timeControls[0].add(new Option(value, value));
}

for (let i = 0; i <= 59; i++) {
  const value = String(i).padStart(2, "0");
  timeControls[1].add(new Option(value, value));
}

["AM", "PM"].forEach((period) => {
  timeControls[2].add(new Option(period, period));
});

function formatTime(date, seconds = false) {
  const hour = String(date.getHours() % 12 || 12).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = seconds ? `:${String(date.getSeconds()).padStart(2, "0")}` : "";
  return `${hour}:${minute}${second} ${date.getHours() >= 12 ? "PM" : "AM"}`;
}

function scheduledTime() {
  const date = new Date(activeAlarm.at);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = date.toDateString() === now.toDateString() ? "today" : date.toDateString() === tomorrow.toDateString() ? "tomorrow" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} at ${formatTime(date)}`;
}

function saveAlarm() {
  try {
    if (activeAlarm) sessionStorage.setItem(storageKey, JSON.stringify(activeAlarm));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be unavailable in private browsing; the current alarm still works.
  }
}

function renderAlarm() {
  const armed = Boolean(activeAlarm);
  timeControls.forEach((select) => { select.disabled = armed; });
  soundSelect.disabled = armed;
  content.classList.toggle("disable", armed);
  setAlarmBtn.textContent = armed ? "Clear Alarm ♡" : "Set Alarm ♡";
  countdown.hidden = !armed;
  if (armed) {
    const date = new Date(activeAlarm.at);
    timeControls[0].value = String(date.getHours() % 12 || 12).padStart(2, "0");
    timeControls[1].value = String(date.getMinutes()).padStart(2, "0");
    timeControls[2].value = date.getHours() >= 12 ? "PM" : "AM";
    soundSelect.value = activeAlarm.sound;
    alarmNote.textContent = `Alarm set for ${scheduledTime()} · ${sounds[activeAlarm.sound].name}.`;
  }
}

function finishAlarm(message) {
  stopAudio();
  activeAlarm = null;
  isRinging = false;
  if (ringingDialog.open) ringingDialog.close();
  document.title = originalTitle;
  retryBtn.hidden = true;
  saveAlarm();
  renderAlarm();
  alarmNote.textContent = message;
  soundNote.textContent = `${sounds[soundSelect.value].name} selected.`;
  setAlarmBtn.focus();
}

function ringAlarm() {
  isRinging = true;
  ringingTime.textContent = `${formatTime(new Date(activeAlarm.at))} · ${sounds[activeAlarm.sound].name}`;
  ringingStatus.textContent = "";
  retryBtn.hidden = true;
  alarmNote.textContent = "Your alarm is ringing.";
  document.title = "♡ Alarm ringing | Alarm Clock+";
  ringingDialog.showModal();
  stopBtn.focus();
  playSound(activeAlarm.sound, "ring");
}

function updateClock() {
  const now = new Date();
  currentTime.textContent = formatTime(now, true);
  if (calendarDay !== now.toDateString()) {
    calendarDay = now.toDateString();
    if (activeAlarm && !isRinging) renderAlarm();
  }
  if (!activeAlarm) return;
  // An absolute deadline also catches an alarm when a throttled tab resumes late.
  if (!isRinging && now.getTime() >= activeAlarm.at) ringAlarm();
  if (isRinging) {
    countdown.textContent = "Time for your little moment ♡";
    return;
  }
  const remaining = Math.max(0, Math.ceil((activeAlarm.at - now.getTime()) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  countdown.textContent = `Rings in ${hours ? `${hours}h ` : ""}${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

alarmForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeAlarm) {
    finishAlarm("Alarm cleared. Choose your next little moment.");
    return;
  }
  const firstInvalid = timeControls.find((select) => !/^(\d{2}|AM|PM)$/.test(select.value));
  timeControls.forEach((select) => select.removeAttribute("aria-invalid"));
  if (firstInvalid) {
    firstInvalid.setAttribute("aria-invalid", "true");
    alarmNote.textContent = "Please choose an hour, minute, and AM/PM.";
    firstInvalid.focus();
    return;
  }
  const [hour, minute, period] = timeControls.map((select) => select.value);
  const hour24 = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour24, Number(minute), 0, 0);
  if (next.getTime() <= now.getTime()) {
    // During fall-back, the same local minute may still occur a second time today.
    const dayAfter = new Date(next);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const offsetChange = Math.max(0, dayAfter.getTimezoneOffset() - next.getTimezoneOffset());
    const repeated = new Date(next.getTime() + offsetChange * minuteMs);
    if (repeated > now && repeated.toDateString() === now.toDateString() && repeated.getHours() === hour24 && repeated.getMinutes() === Number(minute)) {
      next.setTime(repeated.getTime());
    } else {
      next.setDate(next.getDate() + 1);
      // Reapply the requested time if today's spring-forward normalized it.
      next.setHours(hour24, Number(minute), 0, 0);
    }
  }
  activeAlarm = { at: next.getTime(), sound: soundSelect.value };
  isRinging = false;
  saveAlarm();
  renderAlarm();
  updateClock();
  playSound(activeAlarm.sound, "prepare");
});

timeControls.forEach((select) => select.addEventListener("change", () => select.removeAttribute("aria-invalid")));
stopBtn.addEventListener("click", () => finishAlarm("Alarm stopped. A fresh moment is yours ♡"));
ringingDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  finishAlarm("Alarm stopped. A fresh moment is yours ♡");
});
document.addEventListener("keydown", (event) => {
  if (!ringingDialog.open || event.key !== "Tab") return;
  const actions = [...ringingDialog.querySelectorAll("button:not([hidden]):not(:disabled)")];
  const first = actions[0];
  const last = actions[actions.length - 1];
  if (!ringingDialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
});
snoozeBtn.addEventListener("click", () => {
  stopAudio();
  activeAlarm.at = Date.now() + 5 * minuteMs;
  isRinging = false;
  ringingDialog.close();
  document.title = originalTitle;
  retryBtn.hidden = true;
  saveAlarm();
  renderAlarm();
  alarmNote.textContent = `Snoozed for 5 minutes. Rings ${scheduledTime()}.`;
  updateClock();
  setAlarmBtn.focus();
});
retryBtn.addEventListener("click", () => {
  if (isRinging && activeAlarm) playSound(activeAlarm.sound, "ring");
});

// Recover this tab's alarm after refresh; do not ring alarms abandoned over a day ago.
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey));
  if (saved && Number.isFinite(saved.at) && saved.at > Date.now() - 24 * 60 * minuteMs && saved.at < Date.now() + 48 * 60 * minuteMs && Object.hasOwn(sounds, saved.sound)) {
    activeAlarm = { at: saved.at, sound: saved.sound };
    renderAlarm();
    soundNote.textContent = "Alarm restored. Preview the sound to enable audio after refreshing.";
  } else {
    saveAlarm();
  }
} catch {
  saveAlarm();
}

updateClock();
setInterval(updateClock, 1000);
window.addEventListener("focus", updateClock);
window.addEventListener("pageshow", updateClock);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateClock();
});

// Device tilt adds a subtle movement to the ambient decorations where supported.
if (window.DeviceOrientationEvent && gyroGif) {
  window.addEventListener("deviceorientation", (event) => {
    if (event.beta == null || event.gamma == null) return;
    const beta = Math.max(-10, Math.min(10, event.beta));
    const gamma = Math.max(-10, Math.min(10, event.gamma));
    gyroGif.style.transform = `rotateX(${beta}deg) rotateY(${gamma}deg)`;
  });
}

// Drag or touch the illustrated clock to tilt it.
let isDraggingClock = false;
let startX = 0;
let startY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
const rotationSensitivity = 0.2;

function pointerPosition(event) {
  return event.touches ? event.touches[0] : event;
}

function startDrag(event) {
  isDraggingClock = true;
  const pointer = pointerPosition(event);
  startX = pointer.clientX;
  startY = pointer.clientY;
  if (event.cancelable) event.preventDefault();
}

function drag(event) {
  if (!isDraggingClock) return;
  const pointer = pointerPosition(event);
  currentRotationY = Math.max(-35, Math.min(35, currentRotationY + (pointer.clientX - startX) * rotationSensitivity));
  currentRotationX = Math.max(-35, Math.min(35, currentRotationX - (pointer.clientY - startY) * rotationSensitivity));
  mainClockImage.style.transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;
  startX = pointer.clientX;
  startY = pointer.clientY;
  if (event.cancelable) event.preventDefault();
}

function endDrag() {
  isDraggingClock = false;
}

if (mainClockImage) {
  mainClockImage.addEventListener("mousedown", startDrag);
  mainClockImage.addEventListener("touchstart", startDrag, { passive: false });
  window.addEventListener("mousemove", drag);
  window.addEventListener("touchmove", drag, { passive: false });
  window.addEventListener("mouseup", endDrag);
  window.addEventListener("blur", endDrag);
  window.addEventListener("touchend", endDrag);
  window.addEventListener("touchcancel", endDrag);
}
