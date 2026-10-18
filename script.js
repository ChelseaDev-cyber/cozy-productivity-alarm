const currentTime = document.querySelector("h1");
const content = document.querySelector(".content");
const selectMenu = document.querySelectorAll("select");
const setAlarmBtn = document.querySelector("button");
const gyroGif = document.getElementById("gyro-gif");
const mainClockImage = document.getElementById("main-clock-image");

let alarmTime = "";
let isAlarmSet = false;
let hasRung = false;

const ringtone = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3");
ringtone.loop = true;

// Populate the alarm time controls.
for (let i = 12; i >= 1; i--) {
  const value = String(i).padStart(2, "0");
  selectMenu[0].insertAdjacentHTML("beforeend", `<option value="${value}">${value}</option>`);
}

for (let i = 0; i <= 59; i++) {
  const value = String(i).padStart(2, "0");
  selectMenu[1].insertAdjacentHTML("beforeend", `<option value="${value}">${value}</option>`);
}

["AM", "PM"].forEach((period) => {
  selectMenu[2].insertAdjacentHTML("beforeend", `<option value="${period}">${period}</option>`);
});

function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return {
    display: `${String(hours).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} ${period}`,
    alarm: `${String(hours).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ${period}`
  };
}

function updateClock() {
  const time = getCurrentTime();
  currentTime.textContent = time.display;

  // Ring only once when the selected minute arrives; keep the sound looping until cleared.
  if (isAlarmSet && !hasRung && alarmTime === time.alarm) {
    hasRung = true;
    ringtone.currentTime = 0;
    ringtone.play().catch(() => {
      // Keep the alarm armed even if the browser blocks autoplay.
      const note = document.querySelector(".alarm-note");
      if (note) note.textContent = "Your browser blocked alarm audio. Check its sound permissions.";
    });
  }
}

updateClock();
setInterval(updateClock, 1000);

function setAlarm() {
  if (isAlarmSet) {
    alarmTime = "";
    isAlarmSet = false;
    hasRung = false;
    ringtone.pause();
    ringtone.currentTime = 0;
    selectMenu.forEach((select) => { select.disabled = false; });
    content.classList.remove("disable");
    setAlarmBtn.textContent = "Set Alarm ♡";
    return;
  }

  const [hour, minute, period] = Array.from(selectMenu, (select) => select.value);
  if (!hour || !minute || !period || hour === "Hour" || minute === "Minute" || period === "AM/PM") {
    window.alert("Please choose an hour, minute, and AM/PM to set your alarm.");
    return;
  }

  alarmTime = `${hour}:${minute} ${period}`;
  isAlarmSet = true;
  hasRung = false;
  selectMenu.forEach((select) => { select.disabled = true; });
  content.classList.add("disable");
  setAlarmBtn.textContent = "Clear Alarm ♡";
}

setAlarmBtn.addEventListener("click", setAlarm);

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
  window.addEventListener("touchend", endDrag);
  window.addEventListener("touchcancel", endDrag);
}
