/**
 * EEG101 Members — automatic weekly sync
 *
 * Add this code to the same Apps Script project as members-publish.gs
 * (open the script editor from Extensions → Apps Script inside the
 * "EEG101 Members: eCOST Export" Google Sheet).
 *
 * HOW IT WORKS
 * ─────────────
 * Every Monday at 05:17 UTC the GitHub Action (ecost-network-map-sync.yml)
 * logs in to eCOST, downloads the latest Working Group member export, and
 * writes every row directly into the "Raw eCOST export" tab of this sheet.
 *
 * A few hours later the weekly trigger installed by setupWeeklyAutoSyncTrigger()
 * fires autoSync_(), which reads those fresh rows and calls validateAndPublish()
 * — the same function the "EEG101 Members → Validate and publish" menu item
 * runs manually.  Geocoding, validation, GitHub publishing, and the Publishing
 * log tab all work exactly as before.
 *
 * ONE-TIME SETUP
 * ─────────────
 * 1. Paste this file into the Apps Script project (or add it as a new file).
 * 2. Run setupWeeklyAutoSyncTrigger() once from the editor.
 *    You will be prompted to authorise the trigger.
 * 3. Confirm the trigger appears under Triggers (clock icon, left sidebar).
 *
 * That is all.  You do not need to touch this file again unless you want to
 * change the day or hour the trigger fires.
 */

// ─── Auto-sync ────────────────────────────────────────────────────────────────

/**
 * Validate and publish the data the GitHub Action placed in "Raw eCOST export".
 *
 * Called automatically by the weekly time trigger.  Safe to run manually too:
 * open the editor and choose Run → autoSync_.
 */
function autoSync_() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = workbook.getSheetByName(EEG101_MEMBERS.logSheet);
  const rawSheet = workbook.getSheetByName(EEG101_MEMBERS.rawSheet);

  // Guard: skip silently if the tab is empty (Action may not have run yet).
  if (!rawSheet || rawSheet.getLastRow() < 2) {
    const note = 'Raw eCOST export tab is empty — GitHub Action may not have deposited data yet.';
    console.warn(note);
    if (logSheet) {
      appendLog_(logSheet, 'Skipped', '', '', '', '', '', '', note);
    }
    return;
  }

  // Delegate to the existing validate-and-publish pipeline.
  validateAndPublish();
}

// ─── Trigger management ───────────────────────────────────────────────────────

/**
 * Install a weekly time-based trigger that calls autoSync_() every Monday
 * at 09:00–10:00 UTC — a few hours after the GitHub Action deposits fresh data.
 *
 * Run this function ONCE from the Apps Script editor after pasting this file.
 * It is safe to run again: any existing autoSync_ triggers are removed first.
 */
function setupWeeklyAutoSyncTrigger() {
  _removeAutoSyncTriggers_();

  ScriptApp.newTrigger('autoSync_')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)  // Apps Script fires within the hour, so 09:00–10:00 UTC.
    .create();

  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Weekly auto-sync trigger installed.\n\n' +
    'autoSync_() will run every Monday at ~09:00 UTC, a few hours after ' +
    'the GitHub Action deposits fresh eCOST data into the Raw eCOST export tab.'
  );
}

/**
 * Remove all autoSync_ triggers for this script project.
 * Useful if you want to pause automatic publishing or change the schedule.
 */
function removeWeeklyAutoSyncTrigger() {
  const removed = _removeAutoSyncTriggers_();
  SpreadsheetApp.getUi().alert(
    removed > 0
      ? `Removed ${removed} autoSync_ trigger${removed > 1 ? 's' : ''}.`
      : 'No autoSync_ triggers were found.'
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _removeAutoSyncTriggers_() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'autoSync_');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  return triggers.length;
}
