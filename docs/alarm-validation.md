# Alarm flow review — October 30, 2026

Reviewed base commit: `afa1a24df2b16d7ef2e73031f214ab191321c8ac`.

## Findings and fixes

| Finding in the existing implementation | Result |
| --- | --- |
| Sound picker and Preview button had no JavaScript handlers. | All four sounds have distinct, locally generated WAV tones and working start/stop previews. |
| Every alarm played the same remote SoundHelix track. | The chosen tone plays without an external audio request. |
| Ringing overlay and Stop button were disconnected and lacked styles. | A styled native modal shows the scheduled time and sound, with Stop, Snooze, and audio retry controls. |
| Exact minute equality could miss a suspended or throttled tab. | An absolute deadline is checked each second and on focus, visibility, and page restoration. |
| Armed state did not explain when the alarm would ring. | The summary names today/tomorrow, the time, and the sound; a countdown shows the remaining time. |
| Refresh silently lost the active alarm. | Valid state is restored from this tab's session storage. Clear and Stop remove it. |
| Browser audio rejection only changed a small note. | The visible dialog survives failure and offers an explicit user-gesture retry. Late playback rejections cannot corrupt newer state. |
| Missing fields triggered a blocking browser alert. | Inline feedback identifies and focuses the missing field. |

The existing CSS clock illustration, pastel branding, responsive card, AM/PM clock, device tilt, drag interaction, and armed time controls are retained. Sound selection locks while armed; Preview remains available.

## Verification

Seventeen browser tests pass in headless Chromium 153 with Playwright 1.62.1. Tests drive the actual page controls through a local HTTP server. External requests are blocked for every test, including real-audio checks.

- Set → ring once → Stop → rearm, and Clear before the deadline.
- Four distinct sound previews, early stop, switching, and automatic preview completion.
- Actual media decoding of all WAVs, non-silent waveforms, looped ringing, and paused playback after Stop.
- Noon, midnight, tomorrow scheduling, midnight summary changes, and spring/fall daylight-saving behavior in `America/New_York`.
- Catch-up when the clock jumps beyond the entire selected minute.
- Five-minute Snooze and a second ring at the new deadline.
- Refresh while armed and while ringing; cleared alarms stay cleared.
- Simulated playback denial, tap-to-play recovery, late promise rejection, malformed/expired storage, and unavailable storage.
- Keyboard focus entry, forward/reverse Tab containment, Escape, and focus return.
- Layout and touch-target checks at 320px and 390px widths; original clock dragging.

Screenshots were visually inspected for desktop, mobile armed state, and the ringing dialog. The first test run caught a Tab focus escape; an explicit loop now keeps focus within the dialog actions.

## Limits

- Mobile widths are browser viewport tests, not physical iPhone/Android testing. Safari and Firefox were not tested.
- Audio decoding/playback state was verified in Chromium; physical speaker output and device silent-mode behavior were not measured.
- Browser autoplay denial is simulated to exercise recovery. Actual permission behavior varies by browser.
- Closing the tab prevents alarms; a sleeping device can delay them. Returning to an overdue, still-open tab displays its alarm. Refresh recovery requires session storage, and audio may require another preview or a tap to play.
- A nonexistent local minute on a spring-forward date follows the browser's normal forward adjustment. A repeated fall-back minute uses the next occurrence still ahead.
