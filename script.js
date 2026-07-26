const currentTime = document.querySelector("h1"),
  content = document.querySelector(".content"),
  selectMenu = document.querySelectorAll("select"),
  setAlarmBtn = document.querySelector("button"),
  gyroGif = document.getElementById("gyro-gif"), // Get the GIF element
  mainClockImage = document.getElementById("main-clock-image"); // Get the main clock image

let alarmTime,
  isAlarmSet,
  ringtone = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3");

// Variables for 3D image animation on touch/mouse
let isDraggingClock = false;
let startX, startY;
let currentRotationX = 0;
let currentRotationY = 0;
const rotationSensitivity = 0.2; // Adjust for more or less sensitive rotation

for (let i = 12; i > 0; i--) {
  i = i < 10 ? `0${i}` : i;
  let option = `<option value="${i}">${i}</option>`;
  selectMenu[0].firstElementChild.insertAdjacentHTML("afterend", option);
}

for (let i = 59; i >= 0; i--) {
  i = i < 10 ? `0${i}` : i;
  let option = `<option value="${i}">${i}</option>`;
  selectMenu[1].firstElementChild.insertAdjacentHTML("afterend", option);
}

for (let i = 2; i > 0; i--) {
  let ampm = i == 1 ? "AM" : "PM";
  let option = `<option value="${ampm}">${ampm}</option>`;
  selectMenu[2].firstElementChild.insertAdjacentHTML("afterend", option);
}

setInterval(() => {
  let date = new Date(),
    h = date.getHours(),
    m = date.getMinutes(),
    s = date.getSeconds(),
    ampm = "AM";
  if (h >= 12) {
    h = h - 12;
    ampm = "PM";
  }
  h = h == 0 ? 12 : h;
  h = h < 10 ? "0" + h : h;
  m = m < 10 ? "0" + m : m;
  s = s < 10 ? "0" + s : s;
  currentTime.innerText = `${h}:${m}:${s} ${ampm}`;

  if (alarmTime === `${h}:${m} ${ampm}`) {
    ringtone.play();
    ringtone.loop = true;
  }
}, 1000);

function setAlarm() {
  if (isAlarmSet) {
    alarmTime = "";
    ringtone.pause();
    content.classList.remove("disable");
    setAlarmBtn.innerText = "Set Alarm";
    return (isAlarmSet = false);
  }

  let time = `${selectMenu[0].value}:${selectMenu[1].value} ${selectMenu[2].value}`;
  if (
    time.includes("Hour") ||
    time.includes("Minute") ||
    time.includes("AM/PM")
  ) {
    return alert("Please, select a valid time to set Alarm!");
  }
  alarmTime = time;
  isAlarmSet = true;
  content.classList.add("disable");
  setAlarmBtn.innerText = "Clear Alarm";
}

setAlarmBtn.addEventListener("click", setAlarm);

// Gyro animation for the background GIF
if (window.DeviceOrientationEvent) {
  window.addEventListener("deviceorientation", handleOrientation);
} else {
  console.log("DeviceOrientationEvent is not supported on this device.");
}

function handleOrientation(event) {
  let beta = event.beta;   // X-axis (front-back tilt)
  let gamma = event.gamma; // Y-axis (left-right tilt)

  const maxTilt = 10; // degrees

  let rotateY = gamma;
  if (rotateY > maxTilt) rotateY = maxTilt;
  if (rotateY < -maxTilt) rotateY = -maxTilt;

  let rotateX = beta;
  if (rotateX > maxTilt) rotateX = maxTilt;
  if (rotateX < -maxTilt) rotateX = -maxTilt;

  if (gyroGif) {
    gyroGif.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }
}

// 3D animation for the main clock image on touch/mouse interaction
if (mainClockImage) {
  mainClockImage.addEventListener("mousedown", startDrag);
  mainClockImage.addEventListener("touchstart", startDrag);

  window.addEventListener("mousemove", drag);
  window.addEventListener("touchmove", drag);

  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchend", endDrag);
  window.addEventListener("touchcancel", endDrag); // For touch events ending unexpectedly
}

function getPointerPosition(event) {
  return event.touches ? event.touches[0] : event;
}

function startDrag(event) {
  isDraggingClock = true;
  const pointer = getPointerPosition(event);
  startX = pointer.clientX;
  startY = pointer.clientY;
  event.preventDefault(); // Prevent default browser actions like scrolling for touch
}

function drag(event) {
  if (!isDraggingClock) return;

  const pointer = getPointerPosition(event);
  const deltaX = (pointer.clientX - startX) * rotationSensitivity;
  const deltaY = (pointer.clientY - startY) * rotationSensitivity;

  // Apply rotation
  currentRotationY += deltaX;
  currentRotationX -= deltaY; // Invert Y-axis for natural feel

  // Limit rotation to avoid extreme distortions
  const maxRotation = 60;
  if (currentRotationX > maxRotation) currentRotationX = maxRotation;
  if (currentRotationX < -maxRotation) currentRotationX = -maxRotation;
  if (currentRotationY > maxRotation) currentRotationY = maxRotation;
  if (currentRotationY < -maxRotation) currentRotationY = -maxRotation;

  mainClockImage.style.transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;

  startX = pointer.clientX;
  startY = pointer.clientY;
  event.preventDefault();
}

function endDrag() {
  isDraggingClock = false;
  // Optional: ease back to original position or keep the last rotation
  // For now, it will smoothly stay in the last rotated position due to CSS transition.
  // To reset: mainClockImage.style.transform = 'rotateX(0deg) rotateY(0deg)';
}
