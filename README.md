# Alarm Clock+ by Chelsea Griffin

A cozy, pastel alarm clock experience created by **Flow3rChildStudios** — Chelsea's creative technologist persona.

## Features

- Live digital clock with AM/PM
- Set and clear an alarm
- Four original local alarm tones with start/stop previews
- Ringing dialog with Stop, five-minute Snooze, and keyboard controls
- Visible scheduled time and live countdown
- Recovery after a delayed tab or a refresh in the same tab
- Audio-permission feedback with a tap-to-play retry
- Responsive layout for desktop and mobile
- Interactive clock tilt and drag effects
- Original CSS-built clock artwork and decorative details
- Soft blush, lavender, cream, and mint color palette

## Built With

- HTML5
- CSS3
- JavaScript

## Run Locally

1. Clone or download this repository.
2. Open `index.html` in a modern browser.
3. Choose an hour, minute, AM/PM, and an alarm sound. Use **Preview sound ♫** to listen.
4. Select **Set Alarm ♡**. The scheduled day, time, and countdown appear below it.
5. Use **Clear Alarm ♡** to cancel or change the time and sound.
6. When it rings, select **Stop alarm ♡** or **Snooze 5 minutes**. Escape also stops the alarm.

## Alarm Behavior

- Times use your device's local time zone. A minute that has already passed schedules its next occurrence, usually tomorrow; the summary makes the day explicit.
- A delayed or throttled tab checks the deadline when it resumes, so skipping the selected minute does not lose the alarm.
- With browser storage available, the alarm survives a refresh in the same tab. After refreshing, preview the sound to enable audio again. Saved alarms over a day late are discarded.
- All four tones are generated in the browser as WAV audio. They do not depend on a remote music host. External fonts are optional; system fonts provide a fallback.
- If audio is blocked, the visual dialog remains usable and offers **Play alarm sound ♫**. Stop and Snooze still work.

Keep the tab open, browser sound enabled, and your device awake. A website cannot guarantee an on-time alarm while the device sleeps or after the tab closes. This app does not install a background service or send notifications.

## Browser Tests

Node.js 20 or later is needed only for development tests; the app itself has no runtime dependencies or build step.

```sh
npm ci
npm run test:install
npm test
```

The tests start their own local server and exercise the UI in Chromium. They cover previews, real audio decoding and looping, validation, set/clear/ring/stop/snooze, blocked audio, refresh recovery, late tabs, noon/midnight, daylight-saving transitions, keyboard focus, and mobile layouts. See [the validation notes](docs/alarm-validation.md) for findings and limits.

## Creative Direction

Designed to feel sweet, calm, and polished while remaining practical. The clock illustration and ambient decorations are made with CSS and text symbols; no character art or copied logos are used.

## Creator

**Chelsea Griffin**  
*Flow3rChildStudios — creative technologist*

*Kawaii Co. is a separate stationery brand and is not the brand for this app.*
