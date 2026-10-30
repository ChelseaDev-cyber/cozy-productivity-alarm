const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

let browser;
let server;
let baseUrl;
const defaultTime = "2026-10-30T12:00:55-04:00";

before(async () => {
  const root = path.resolve(__dirname, "..");
  server = createServer(async (request, response) => {
    const file = new URL(request.url, "http://localhost").pathname;
    const allowed = { "/": "index.html", "/index.html": "index.html", "/script.js": "script.js", "/style.css": "style.css" };
    if (!allowed[file]) { response.writeHead(404).end(); return; }
    const mime = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
    response.writeHead(200, { "Content-Type": mime });
    response.end(await readFile(path.join(root, allowed[file])));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function openApp(t, { time = defaultTime, realAudio = false, viewport = { width: 1280, height: 1024 }, init } = {}) {
  const context = await browser.newContext({ timezoneId: "America/New_York", viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], "No uncaught page errors");
  });
  // All flows must still work when external fonts and other third-party requests fail.
  await page.route("https://**/*", (route) => route.abort());
  await page.clock.install({ time: new Date(time) });
  await page.clock.pauseAt(new Date(new Date(time).getTime() + 1000));
  await page.addInitScript(({ realAudio }) => {
    window.audioCalls = [];
    window.pendingPlays = [];
    const nativePlay = HTMLMediaElement.prototype.play;
    const nativePause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () {
      window.testAudio = this;
      window.audioCalls.push({ action: "play", src: this.src, loop: this.loop, volume: this.volume });
      if (window.blockPlayback) return Promise.reject(new DOMException("Playback blocked", "NotAllowedError"));
      if (window.deferPlayback) return new Promise((resolve, reject) => window.pendingPlays.push({ resolve, reject }));
      return realAudio ? nativePlay.call(this) : Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.audioCalls.push({ action: "pause" });
      return nativePause.call(this);
    };
  }, { realAudio });
  if (init) await page.addInitScript(init);
  await page.goto(baseUrl);
  return page;
}

async function chooseAlarm(page, { hour = "12", minute = "01", period = "PM", sound = "bell" } = {}) {
  await page.locator("#alarm-hour").selectOption(hour);
  await page.locator("#alarm-minute").selectOption(minute);
  await page.locator("#alarm-period").selectOption(period);
  await page.locator("#alarm-sound").selectOption(sound);
  await page.locator("#set-alarm").click();
}

async function plays(page) {
  return page.evaluate(() => window.audioCalls.filter((call) => call.action === "play"));
}

async function dialogOpen(page) {
  return page.locator("#ringing-overlay").evaluate((dialog) => dialog.open);
}

test("live clock and inline validation focus the missing field without an alert", async (t) => {
  const page = await openApp(t);
  let alerts = 0;
  page.on("dialog", async (dialog) => { alerts++; await dialog.dismiss(); });
  assert.match(await page.locator("h1").textContent(), /^12:00:56 PM$/);
  await page.locator("#set-alarm").click();
  assert.match(await page.locator("#alarm-status").textContent(), /Please choose/);
  assert.equal(await page.locator("#alarm-hour").getAttribute("aria-invalid"), "true");
  assert.equal(await page.evaluate(() => document.activeElement.id), "alarm-hour");
  await page.locator("#alarm-hour").selectOption("01");
  await page.locator("#set-alarm").click();
  assert.equal(await page.evaluate(() => document.activeElement.id), "alarm-minute");
  assert.equal(alerts, 0);
});

test("each sound has its own preview; stop and changing sounds cancel playback", async (t) => {
  const page = await openApp(t);
  const urls = new Set();
  for (const sound of ["chime", "digital", "melody", "bell"]) {
    await page.locator("#alarm-sound").selectOption(sound);
    await page.locator("#preview-sound").click();
    assert.match(await page.locator("#preview-sound").textContent(), /Stop preview/);
    const last = (await plays(page)).at(-1);
    assert.equal(last.loop, false);
    assert.equal(last.volume, 1);
    assert.match(last.src, /^blob:/);
    urls.add(last.src);
    await page.locator("#preview-sound").click();
    assert.match(await page.locator("#preview-sound").textContent(), /Preview sound/);
  }
  assert.equal(urls.size, 4);
  await page.locator("#preview-sound").click();
  await page.locator("#alarm-sound").selectOption("chime");
  assert.match(await page.locator("#preview-sound").textContent(), /Preview sound/);
});

test("set → ring once with the chosen sound → stop → rearm", async (t) => {
  const page = await openApp(t);
  await chooseAlarm(page);
  assert.match(await page.locator("#alarm-status").textContent(), /today at 12:01 PM · Little Bell/);
  assert.match(await page.locator("#alarm-countdown").textContent(), /Rings in/);
  for (const id of ["alarm-hour", "alarm-minute", "alarm-period", "alarm-sound"]) assert.equal(await page.locator(`#${id}`).isDisabled(), true);
  await page.clock.runFor(6000);
  assert.equal(await dialogOpen(page), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), "stop-alarm");
  assert.match(await page.locator("#ringing-time").textContent(), /12:01 PM · Little Bell/);
  const ringCalls = (await plays(page)).filter((call) => call.loop && call.volume === 1);
  assert.equal(ringCalls.length, 1);
  await page.clock.runFor(10000);
  assert.equal((await plays(page)).filter((call) => call.loop && call.volume === 1).length, 1);
  await page.locator("#stop-alarm").click();
  assert.equal(await dialogOpen(page), false);
  assert.match(await page.locator("#alarm-status").textContent(), /Alarm stopped/);
  assert.equal(await page.locator("#alarm-sound").isDisabled(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), "set-alarm");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("flow3r-alarm-v1")), null);
  await chooseAlarm(page, { minute: "02", sound: "melody" });
  assert.match(await page.locator("#alarm-status").textContent(), /12:02 PM · Soft Melody/);
});

test("clear before the deadline cancels the alarm and restores all controls", async (t) => {
  const page = await openApp(t);
  await chooseAlarm(page);
  await page.locator("#set-alarm").click();
  await page.clock.fastForward(120000);
  assert.equal(await dialogOpen(page), false);
  assert.match(await page.locator("#alarm-status").textContent(), /Alarm cleared/);
  assert.equal(await page.locator("#alarm-countdown").isVisible(), false);
  assert.equal((await plays(page)).filter((call) => call.loop && call.volume === 1).length, 0);
});

test("noon and midnight use the correct AM/PM and ring on the next date", async (t) => {
  for (const [time, period] of [["2026-10-30T11:59:55-04:00", "PM"], ["2026-10-30T23:59:55-04:00", "AM"]]) {
    const page = await openApp(t, { time });
    await chooseAlarm(page, { minute: "00", period });
    assert.match(await page.locator("#alarm-status").textContent(), period === "AM" ? /tomorrow/ : /today/);
    await page.clock.runFor(6000);
    assert.equal(await dialogOpen(page), true);
    assert.match(await page.locator("h1").textContent(), new RegExp(`^12:00:02 ${period}$`));
  }
});

test("a time already reached today explicitly schedules tomorrow", async (t) => {
  const page = await openApp(t);
  await chooseAlarm(page, { minute: "00" });
  assert.match(await page.locator("#alarm-status").textContent(), /tomorrow at 12:00 PM/);
  assert.equal(await dialogOpen(page), false);
  await page.clock.fastForward(24 * 60 * 60000);
  assert.equal(await dialogOpen(page), true);
});

test("a paused tab that skips the entire selected minute still rings", async (t) => {
  const page = await openApp(t);
  await chooseAlarm(page);
  await page.clock.fastForward(3 * 60000);
  assert.equal(await dialogOpen(page), true);
  assert.match(await page.locator("#ringing-time").textContent(), /12:01 PM/);
});

test("the next-day summary updates at midnight without changing the deadline", async (t) => {
  const page = await openApp(t, { time: "2026-10-30T23:59:55-04:00" });
  await chooseAlarm(page, { hour: "12", minute: "10", period: "AM" });
  assert.match(await page.locator("#alarm-status").textContent(), /tomorrow at 12:10 AM/);
  await page.clock.runFor(6000);
  assert.match(await page.locator("#alarm-status").textContent(), /today at 12:10 AM/);
  assert.equal(await dialogOpen(page), false);
});

test("a passed time on spring-forward day keeps the requested hour tomorrow", async (t) => {
  const page = await openApp(t, { time: "2027-03-14T04:00:00-04:00" });
  await chooseAlarm(page, { hour: "02", minute: "30", period: "AM" });
  assert.match(await page.locator("#alarm-status").textContent(), /tomorrow at 02:30 AM/);
});

test("fall-back schedules the second occurrence when that local minute is still ahead", async (t) => {
  for (const time of ["2026-11-01T01:40:00-04:00", "2026-11-01T01:20:00-05:00"]) {
    const page = await openApp(t, { time });
    await chooseAlarm(page, { hour: "01", minute: "30", period: "AM" });
    assert.match(await page.locator("#alarm-status").textContent(), /today at 01:30 AM/);
    const deadline = await page.evaluate(() => JSON.parse(sessionStorage.getItem("flow3r-alarm-v1")).at);
    assert.equal(deadline, new Date("2026-11-01T01:30:00-05:00").getTime());
    await page.clock.fastForward(deadline - new Date(time).getTime());
    assert.equal(await dialogOpen(page), true);
  }
});

test("snooze stops the sound and rings again after five minutes; Escape stops it", async (t) => {
  const page = await openApp(t);
  await chooseAlarm(page);
  await page.clock.runFor(6000);
  await page.locator("#snooze-alarm").click();
  assert.equal(await dialogOpen(page), false);
  assert.match(await page.locator("#alarm-status").textContent(), /Snoozed for 5 minutes/);
  assert.equal(await page.locator("#alarm-minute").inputValue(), "06");
  await page.clock.runFor(299000);
  assert.equal(await dialogOpen(page), false);
  await page.clock.runFor(1000);
  assert.equal(await dialogOpen(page), true);
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest("dialog"))), true);
  }
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest("dialog"))), true);
  }
  await page.keyboard.press("Escape");
  assert.equal(await dialogOpen(page), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), "set-alarm");
});

test("refresh restores the scheduled alarm, and stopping removes the saved state", async (t) => {
  const page = await openApp(t);
  await chooseAlarm(page, { sound: "digital" });
  await page.reload();
  assert.match(await page.locator("#sound-status").textContent(), /Alarm restored/);
  assert.match(await page.locator("#alarm-status").textContent(), /Digital Beeps/);
  await page.clock.runFor(6000);
  assert.equal(await dialogOpen(page), true);
  await page.reload();
  assert.equal(await dialogOpen(page), true);
  await page.locator("#stop-alarm").click();
  await page.reload();
  assert.equal(await dialogOpen(page), false);
  assert.match(await page.locator("#set-alarm").textContent(), /Set Alarm/);
});

test("blocked audio keeps the visual alarm usable and provides a working retry", async (t) => {
  const page = await openApp(t);
  await page.evaluate(() => { window.blockPlayback = true; });
  await chooseAlarm(page);
  assert.match(await page.locator("#sound-status").textContent(), /Sound could not play/);
  assert.match(await page.locator("#set-alarm").textContent(), /Clear Alarm/);
  assert.equal(await page.locator("#alarm-hour").isDisabled(), true);
  await page.clock.runFor(6000);
  assert.equal(await dialogOpen(page), true);
  assert.equal(await page.locator("#retry-sound").isVisible(), true);
  assert.match(await page.locator("#ringing-status").textContent(), /Sound was blocked/);
  await page.evaluate(() => { window.blockPlayback = false; });
  await page.locator("#retry-sound").click();
  assert.equal(await page.locator("#retry-sound").isVisible(), false);
  assert.equal(await page.locator("#ringing-status").textContent(), "");
  await page.locator("#stop-alarm").click();
  assert.equal(await dialogOpen(page), false);
});

test("preview rejection and an old preparation promise cannot corrupt a cleared alarm", async (t) => {
  const page = await openApp(t);
  await page.evaluate(() => { window.blockPlayback = true; });
  await page.locator("#preview-sound").click();
  assert.match(await page.locator("#sound-status").textContent(), /Sound could not play/);
  await page.evaluate(() => { window.blockPlayback = false; window.deferPlayback = true; });
  await chooseAlarm(page);
  await page.locator("#set-alarm").click();
  await page.evaluate(() => window.pendingPlays.forEach(({ reject }) => reject(new DOMException("Late failure", "NotAllowedError"))));
  assert.match(await page.locator("#alarm-status").textContent(), /Alarm cleared/);
  assert.match(await page.locator("#sound-status").textContent(), /Little Bell selected/);
  assert.equal(await page.locator("#alarm-sound").isEnabled(), true);
});

test("missing, malformed, and expired saved data do not break a new alarm", async (t) => {
  for (const init of [
    () => sessionStorage.setItem("flow3r-alarm-v1", "{broken json"),
    () => sessionStorage.setItem("flow3r-alarm-v1", JSON.stringify({ at: Date.now() - 2 * 86400000, sound: "bell" })),
    () => sessionStorage.setItem("flow3r-alarm-v1", JSON.stringify({ at: Date.now() + 60000, sound: "unknown" })),
    () => Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("Storage disabled", "SecurityError"); } })
  ]) {
    const page = await openApp(t, { init });
    assert.equal(await dialogOpen(page), false);
    await chooseAlarm(page);
    await page.clock.runFor(6000);
    assert.equal(await dialogOpen(page), true);
    await page.locator("#stop-alarm").click();
  }
});

test("real browser audio decodes all four local WAVs, finishes preview, loops, and stops", async (t) => {
  const page = await openApp(t, { realAudio: true });
  const waveHashes = new Set();
  for (const sound of ["chime", "digital", "melody", "bell"]) {
    await page.locator("#alarm-sound").selectOption(sound);
    await page.locator("#preview-sound").click();
    await page.waitForFunction(() => window.testAudio && !window.testAudio.paused && window.testAudio.readyState >= 2);
    const wav = await page.evaluate(async () => {
      const buffer = await (await fetch(window.testAudio.src)).arrayBuffer();
      const view = new DataView(buffer);
      let sum = 0;
      for (let offset = 44; offset < buffer.byteLength; offset += 2) sum += (view.getInt16(offset, true) / 32768) ** 2;
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      return { duration: window.testAudio.duration, rms: Math.sqrt(sum / ((buffer.byteLength - 44) / 2)), hash: [...new Uint8Array(digest)].join(",") };
    });
    assert.ok(wav.duration >= 1.5 && wav.duration <= 3);
    assert.ok(wav.rms > 0.01 && wav.rms < 0.5, "Audible, unclipped waveform");
    waveHashes.add(wav.hash);
    await page.locator("#preview-sound").click();
    assert.equal(await page.evaluate(() => window.testAudio.paused), true);
  }
  assert.equal(waveHashes.size, 4);
  await page.locator("#preview-sound").click();
  await page.waitForFunction(() => document.getElementById("preview-sound").textContent.includes("Preview sound"));
  assert.match(await page.locator("#sound-status").textContent(), /Preview finished/);
  await chooseAlarm(page);
  await page.waitForFunction(() => document.getElementById("sound-status").textContent.includes("is ready"));
  await page.clock.runFor(6000);
  await page.waitForFunction(() => !window.testAudio.paused && window.testAudio.loop);
  await page.locator("#stop-alarm").click();
  assert.equal(await page.evaluate(() => window.testAudio.paused), true);
});

test("mobile layouts and ringing controls fit the screen, and clock dragging still works", async (t) => {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }]) {
    const page = await openApp(t, { viewport });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const id of ["alarm-sound", "preview-sound", "set-alarm"]) {
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(box.height >= 44, "Touch target is at least 44px high");
    }
    const clock = await page.locator("#main-clock-image").boundingBox();
    await page.mouse.move(clock.x + clock.width / 2, clock.y + clock.height / 2);
    await page.mouse.down();
    await page.mouse.move(clock.x + clock.width / 2 + 30, clock.y + clock.height / 2 + 20);
    await page.mouse.up();
    assert.match(await page.locator("#main-clock-image").getAttribute("style"), /rotateX\(-4deg\) rotateY\(6deg\)/);
    await chooseAlarm(page);
    await page.clock.runFor(6000);
    const dialog = await page.locator("#ringing-overlay").boundingBox();
    assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= viewport.width);
    assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= viewport.height);
    await page.locator("#stop-alarm").click();
  }
});
