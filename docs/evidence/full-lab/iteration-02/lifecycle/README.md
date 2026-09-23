# Live lifecycle verification

Executed on 2026-09-24 (Asia/Shanghai) against the full project served at http://127.0.0.1:5177/. Browser session: `rnc-live-lifecycle`.

31 browser assertions passed. See `results.json` for the complete check list and observed states, and `parked.png` for the real zero-speed result.

## Scope

The fixture imports the real `mountLab`, renderer, AudioContext, source/path/FxLMS calculation, stream and field sampler. Ports return real engine results while controlled promises reproduce calculation/start/field completion races. Native `AudioContext.resume()` can be delayed until a chosen point. The visibility scenario overrides the document hidden getter and dispatches `visibilitychange`; it verifies the application lifecycle handlers deterministically and does not claim to reproduce operating-system or real-tab throttling.

Covered: background during initial start and during resume; no automatic restart when visible; no time advance or new chunk requests while paused; pending calculate success and cancellation rejection after dispose; pending field success after dispose; pending stream start plus audio resume after dispose; real zero-speed result after a complete 16-second calculation. A MutationObserver verifies no DOM writes after disposal. Browser script errors and unhandled rejections are recorded across cases.

## Read-only source review

The background handler covers active startup/busy states, startup/resume completion checks visibility again, disposal invalidates both async generations before canceling work, and completed zero-energy analysis/field windows have explicit energy-floor messaging.

One minor remaining status-label mismatch was reported to the parent: when hidden during initial startup and no chunk has arrived, the player reports idle. The app status fallback labels that state as running although playback is paused (button says play, time is zero, no stream samples or pulls). This does not invalidate the lifecycle checks; the check suite did not assert that status label. Suggested fix: map idle/nonplaying live state to paused.

## Reproduction

With the repository Vite server already running on port 5177, open `http://127.0.0.1:5177/output/playwright/live-lifecycle/fixture.html` using an independent Playwright CLI session, then run `browser-check.js` with the CLI run-code command. The fixture and script contain the complete controlled scenarios; no application source is replaced. The script saves its screenshot and returns JSON results.

Example (from repository root):

```powershell
npx --yes --package @playwright/cli playwright-cli -s=rnc-live-lifecycle open http://127.0.0.1:5177/output/playwright/live-lifecycle/fixture.html
npx --yes --package @playwright/cli playwright-cli -s=rnc-live-lifecycle run-code --filename output/playwright/live-lifecycle/browser-check.js --raw > output/playwright/live-lifecycle/results.json
npx --yes --package @playwright/cli playwright-cli -s=rnc-live-lifecycle close
```

This verification only wrote files under `output/playwright/live-lifecycle/`; application sources and root development records were unchanged.

## Status-label follow-up

After the source owner corrected the initial idle-state label, `status-check.js` performed a targeted real-browser regression. All 4 assertions passed (`status-results.json`): before the first chunk, background now displays `实时已暂停`, with zero pulls, zero samples, time 0.00 s and the play button showing `播放`. Returning to visible retains the paused label and does not request a chunk. No script errors or unhandled rejections occurred. The earlier minor status finding is resolved. The original 31-check evidence is retained unchanged.

The dedicated browser session was closed after verification; no application source was changed by this fixture task. All fixture files are frozen after this follow-up.
