/**
 * EEG101 internal calendar bridge.
 *
 * The website is a static site on GitHub Pages: anything it is built with is
 * public, so internal events cannot be synced into the repository and then
 * hidden with JavaScript. Instead they stay in Google Calendar and are read
 * here, by a web app that only returns them once the caller has supplied the
 * shared passphrase. Nothing internal is ever written to the site.
 *
 * The page embeds this web app in an iframe and the passphrase is typed inside
 * that iframe, so it is sent to Google and never passes through eeg101.eu. On
 * success the iframe hands the events to the page with postMessage, and the
 * page draws them in the month grid alongside the public ones.
 *
 * Deployment, and the two Script Properties this needs, are documented in
 * docs/internal-calendar.md.
 */

const INTERNAL_CALENDAR = {
  passphraseProperty: 'EEG101_CALENDAR_PASSPHRASE',
  calendarProperty: 'EEG101_INTERNAL_CALENDAR_ID',
  monthsBack: 12,
  monthsForward: 24,
  // A shared passphrase can be guessed, so wrong answers are slowed down and
  // then stopped for a while. The window is deliberately short: a locked-out
  // committee member should only ever wait minutes.
  failureWindow: 900,
  maxFailures: 10,
  descriptionLimit: 600
};

function doGet(e) {
  const parentOrigin = String((e && e.parameter && e.parameter.origin) || '');
  return HtmlService.createHtmlOutput(unlockFormHtml(parentOrigin))
    .setTitle('EEG101 internal calendar')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Called from the iframe. Returns the internal events, or throws a message the
 * form shows as-is. It never reveals whether the calendar exists before the
 * passphrase has been accepted.
 */
function unlockInternalCalendar(passphrase) {
  const expected = String(PropertiesService.getScriptProperties().getProperty(INTERNAL_CALENDAR.passphraseProperty) || '').trim();
  if (!expected) throw new Error('The internal calendar has not been set up yet. Please contact the EEG101 coordination team.');
  if (failureCount() >= INTERNAL_CALENDAR.maxFailures) throw new Error('Too many incorrect attempts. Please wait a few minutes and try again.');
  if (!matches(String(passphrase || '').trim(), expected)) {
    recordFailure();
    Utilities.sleep(1500); // slow enough that guessing in bulk is not worth it
    throw new Error('That passphrase was not recognised.');
  }
  clearFailures();
  return { ok: true, events: readInternalEvents() };
}

// Compares every character whatever happens, so a wrong answer does not take
// less time the earlier it goes wrong.
function matches(given, expected) {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function failureKey() { return 'eeg101-calendar-failures'; }
function failureCount() { return Number(CacheService.getScriptCache().get(failureKey()) || 0); }
function recordFailure() { CacheService.getScriptCache().put(failureKey(), String(failureCount() + 1), INTERNAL_CALENDAR.failureWindow); }
function clearFailures() { CacheService.getScriptCache().remove(failureKey()); }

function internalCalendar() {
  const id = String(PropertiesService.getScriptProperties().getProperty(INTERNAL_CALENDAR.calendarProperty) || '').trim();
  const calendar = id ? CalendarApp.getCalendarById(id) : null;
  if (!calendar) throw new Error('The internal calendar could not be opened. Check EEG101_INTERNAL_CALENDAR_ID, and that the calendar is shared with the account this script runs as.');
  return calendar;
}

function readInternalEvents() {
  const calendar = internalCalendar();
  const zone = calendar.getTimeZone();
  const from = shiftMonths(new Date(), -INTERNAL_CALENDAR.monthsBack);
  const to = shiftMonths(new Date(), INTERNAL_CALENDAR.monthsForward);
  return calendar.getEvents(from, to).map(event => {
    const allDay = event.isAllDayEvent();
    const start = event.getStartTime();
    // An all-day event ends at midnight on the following day, which would put a
    // one-day event on two squares of the grid.
    const end = allDay ? new Date(event.getEndTime().getTime() - 86400000) : event.getEndTime();
    return {
      id: 'internal-' + String(event.getId()).replace(/[^A-Za-z0-9-]+/g, ''),
      title: event.getTitle() || 'Untitled',
      start_date: Utilities.formatDate(start, zone, 'yyyy-MM-dd'),
      end_date: Utilities.formatDate(end < start ? start : end, zone, 'yyyy-MM-dd'),
      time: allDay ? '' : Utilities.formatDate(start, zone, 'HH:mm'),
      end_time: allDay ? '' : Utilities.formatDate(event.getEndTime(), zone, 'HH:mm'),
      timezone_label: allDay ? '' : Utilities.formatDate(start, zone, 'zzz'),
      all_day: allDay,
      location: event.getLocation() || '',
      summary: trimText(stripTags(event.getDescription() || ''), INTERNAL_CALENDAR.descriptionLimit),
      internal: true
    };
  });
}

function shiftMonths(date, months) {
  const shifted = new Date(date.getTime());
  shifted.setMonth(shifted.getMonth() + months);
  return shifted;
}

function stripTags(text) { return String(text).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function trimText(text, limit) { return text.length > limit ? text.slice(0, limit - 1).trim() + '…' : text; }
function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function unlockFormHtml(parentOrigin) {
  // The page tells us its own origin, and we only talk back to that one.
  const target = /^https:\/\/[a-z0-9.-]+$/i.test(parentOrigin) ? parentOrigin : 'https://www.eeg101.eu';
  return `<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--primary:#000099;--primary-dark:#00007a;--primary-light:#e8e8ff;--text:#1a1a2e;--muted:#5a5a7a;--bg:#faf8f5;--border:#e0dbd4;--ui:'Lato',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font:400 15px/1.6 var(--ui);margin:0;padding:2px}
label{display:block;font:700 14px var(--ui);margin:0 0 6px}
input{background:#fff;border:1px solid var(--border);border-radius:6px;color:var(--text);font:400 15px var(--ui);padding:10px 12px;width:100%}
input:focus{border-color:var(--primary);outline:2px solid var(--primary-light)}
.row{align-items:flex-end;display:flex;gap:10px}
.row>div{flex:1}
button{background:var(--primary);border:2px solid var(--primary);border-radius:6px;color:#fff;cursor:pointer;font:600 14.4px var(--ui);padding:.6rem 1.4rem;white-space:nowrap}
button:hover{background:var(--primary-dark);border-color:var(--primary-dark)}
button[disabled]{opacity:.55;cursor:default}
.hint{color:var(--muted);font-size:13px;margin:8px 0 0}
.message{font:700 13px/1.5 var(--ui);margin:8px 0 0;min-height:1.2em}
.error{color:#991b1b}
.ok{color:#15803d}
@media(max-width:420px){.row{display:block}button{margin-top:10px;width:100%}}
</style></head><body>
<form id="unlock">
  <div class="row">
    <div>
      <label for="pass">Passphrase</label>
      <input id="pass" name="pass" type="password" autocomplete="current-password" required>
    </div>
    <button id="go" type="submit">Show internal events</button>
  </div>
  <p class="hint">For core group and Management Committee members. The internal calendar is not published on the website.</p>
  <p class="message" id="message" aria-live="polite"></p>
</form>
<script>
var TARGET = ${JSON.stringify(target)};
var form = document.getElementById('unlock'), pass = document.getElementById('pass'),
    go = document.getElementById('go'), message = document.getElementById('message');
function tell(payload){ try { window.parent.postMessage(Object.assign({ type: 'eeg101-internal-calendar' }, payload), TARGET); } catch (e) {} }
function reset(){ go.disabled = false; go.textContent = 'Show internal events'; }
form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (!pass.value) return;
  go.disabled = true; go.textContent = 'Checking…';
  message.textContent = ''; message.className = 'message';
  google.script.run
    .withSuccessHandler(function (result) {
      pass.value = '';
      message.textContent = (result.events.length || 0) + ' internal event' + (result.events.length === 1 ? '' : 's') + ' loaded.';
      message.className = 'message ok';
      reset();
      tell({ ok: true, events: result.events });
    })
    .withFailureHandler(function (error) {
      message.textContent = error && error.message ? error.message : 'We could not read the internal calendar.';
      message.className = 'message error';
      reset();
      tell({ ok: false, message: message.textContent });
    })
    .unlockInternalCalendar(pass.value);
});
tell({ ok: false, ready: true });
</script></body></html>`;
}
