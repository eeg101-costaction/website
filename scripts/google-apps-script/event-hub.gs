/*
 * EEG101 Event Hub Google Apps Script
 *
 * Deploy this script as a web app that executes as the deploying account.
 * The spreadsheet must be shared with that account as an Editor. The script
 * keeps attendee information in the private Registration ledger tab only.
 */
const EEG101_EVENT_HUB = {
  ledgerSheet: 'Registration ledger',
  replyTo: 'eeg101costaction@gmail.com',
  retentionDays: 365
};

function doGet(e) {
  const event = {
    id: String(e.parameter.event_id || ''), title: String(e.parameter.title || ''), start_date: String(e.parameter.start_date || ''),
    end_date: String(e.parameter.end_date || e.parameter.start_date || ''), time: String(e.parameter.time || ''), end_time: String(e.parameter.end_time || ''),
    timezone: String(e.parameter.timezone || 'Europe/London'), location: String(e.parameter.location || ''), capacity: Number(e.parameter.capacity || 0),
    summary: String(e.parameter.summary || ''), privacy_url: String(e.parameter.privacy_url || 'https://www.eeg101.eu/privacy/')
  };
  if (!event.id || !event.title || !event.start_date) return HtmlService.createHtmlOutput('<p>Event details are missing. Please return to the EEG101 Event Hub.</p>');
  return HtmlService.createHtmlOutput(registrationFormHtml(event)).setTitle('EEG101 event registration').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitRegistration(payload) {
  validateRegistration(payload);
  if (payload.website) return { ok: true, status: 'ignored' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const existing = ledger().getDataRange().getValues();
    const email = String(payload.email).trim().toLowerCase();
    const duplicate = existing.some((row, index) => index > 0 && String(row[0]) === String(payload.event.id) && String(row[4]).trim().toLowerCase() === email);
    if (duplicate) throw new Error('This email address is already registered for this event.');
    const status = registrationStatus(payload.event.id, Number(payload.event.capacity || 0), existing);
    appendRegistration(payload, status);
    sendRegistrationEmail(payload, status);
    return { ok: true, status: status, message: status === 'waitlisted' ? 'You have been added to the waiting list. Please check your email for the event confirmation and calendar invitation.' : 'Your registration is confirmed. Please check your email for the calendar invitation.' };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try { return jsonResponse(submitRegistration(JSON.parse(e.postData.contents || '{}'))); }
  catch (error) { return jsonResponse({ ok: false, error: String(error) }); }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('EEG101 Event Hub')
    .addItem('Promote the next waiting-list attendee', 'promptPromotion')
    .addItem('Delete records older than 12 months', 'promptRetentionDeletion')
    .addToUi();
}

function promptPromotion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Promote waiting-list attendee', 'Enter the Event ID exactly as used on www.eeg101.eu.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) promoteNextWaitlisted(response.getResponseText().trim());
}

function promoteNextWaitlisted(eventId) {
  const sheet = ledger();
  const values = sheet.getDataRange().getValues();
  const eventRows = values.filter((row, index) => index > 0 && String(row[0]) === String(eventId));
  const capacityMatch = String((eventRows[0] || [])[14] || '').match(/capacity=(\d+)/);
  const capacity = capacityMatch ? Number(capacityMatch[1]) : 0;
  const confirmed = eventRows.filter(row => row[8] === 'confirmed').length;
  if (capacity > 0 && confirmed >= capacity) { SpreadsheetApp.getUi().alert('No confirmed place is available. Update a cancelled registration before promoting someone from the waiting list.'); return; }
  const nextRowIndex = values.findIndex((row, index) => index > 0 && String(row[0]) === String(eventId) && row[8] === 'waitlisted');
  if (nextRowIndex < 0) { SpreadsheetApp.getUi().alert('No waiting-list registration was found for this event.'); return; }
  const rowNumber = nextRowIndex + 1;
  sheet.getRange(rowNumber, 9).setValue('confirmed');
  sheet.getRange(rowNumber, 13).setValue('Promoted');
  const row = values[nextRowIndex];
  sendPromotionEmail({ event: { id: row[0], title: row[1], start_date: row[2], location: '' }, full_name: row[3], email: row[4] });
  SpreadsheetApp.getUi().alert('The next waiting-list attendee has been promoted and notified.');
}

function promptRetentionDeletion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Delete expired attendee records?', 'This permanently deletes registrations for events completed more than 12 months ago. Ensure that any retention exception has been documented before continuing.', ui.ButtonSet.OK_CANCEL);
  if (response === ui.Button.OK) purgeExpiredRegistrations();
}

function purgeExpiredRegistrations() {
  const sheet = ledger();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - EEG101_EVENT_HUB.retentionDays);
  const values = sheet.getDataRange().getValues();
  let deleted = 0;
  for (let index = values.length - 1; index >= 1; index--) {
    const endDateMatch = String(values[index][14] || '').match(/end_date=([0-9-]+)/);
    const eventDate = new Date(endDateMatch ? endDateMatch[1] : values[index][2]);
    if (!isNaN(eventDate) && eventDate < cutoff) { sheet.deleteRow(index + 1); deleted++; }
  }
  SpreadsheetApp.getUi().alert(deleted + ' expired attendee record(s) deleted.');
}

function ledger() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('EEG101_EVENT_HUB_SHEET_ID');
  if (!spreadsheetId) throw new Error('The EEG101 Event Hub spreadsheet ID has not been set in the Apps Script project properties.');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(EEG101_EVENT_HUB.ledgerSheet);
  if (!sheet) throw new Error('Registration ledger sheet not found.');
  return sheet;
}

function validateRegistration(payload) {
  ['full_name', 'email', 'institution', 'country'].forEach(key => { if (!String(payload[key] || '').trim()) throw new Error('Missing required registration field.'); });
  if (!payload.privacy_consent || !payload.event || !payload.event.id || !payload.event.title || !payload.event.start_date) throw new Error('Registration consent or event details are missing.');
}

function registrationStatus(eventId, capacity, values) {
  if (!capacity || capacity < 1) return 'confirmed';
  const rows = values || ledger().getDataRange().getValues();
  const confirmed = rows.filter((row, index) => index > 0 && String(row[0]) === String(eventId) && row[8] === 'confirmed').length;
  return confirmed >= capacity ? 'waitlisted' : 'confirmed';
}

function appendRegistration(payload, status) {
  const event = payload.event;
  ledger().appendRow([event.id, event.title, event.start_date, String(payload.full_name).trim(), String(payload.email).trim().toLowerCase(), String(payload.institution).trim(), String(payload.country).trim(), payload.working_group || '', status, new Date(), 'Yes', '2026-08', 'Synced', '', `Submitted through www.eeg101.eu; capacity=${Number(event.capacity || 0)}; end_date=${event.end_date || event.start_date}`]);
}

function sendRegistrationEmail(payload, status) {
  const event = payload.event;
  const waitlisted = status === 'waitlisted';
  const subject = waitlisted ? `Waiting list: ${event.title}` : `Registration confirmed: ${event.title}`;
  const lead = waitlisted ? 'You have been added to the waiting list. We will contact you if a place becomes available.' : 'Your registration is confirmed.';
  const body = [`Hello ${payload.full_name},`, '', lead, '', `Event: ${event.title}`, `When: ${event.start_date}${event.time ? ', ' + event.time : ''}`, `Where: ${event.location || 'EEG101 event details to follow'}`, '', 'An EEG101 calendar invitation is attached.', '', 'EEG101 COST Action CA24148'].join('\n');
  MailApp.sendEmail({ to: payload.email, subject: subject, body: body, attachments: [Utilities.newBlob(makeCalendar(event), 'text/calendar', 'eeg101-event.ics')], replyTo: EEG101_EVENT_HUB.replyTo, name: 'EEG101 Event Hub' });
}

function sendPromotionEmail(record) {
  const body = [`Hello ${record.full_name},`, '', 'A place has become available and your registration is now confirmed.', '', `Event: ${record.event.title}`, `When: ${record.event.start_date}`, '', 'EEG101 COST Action CA24148'].join('\n');
  MailApp.sendEmail({ to: record.email, subject: `A place is available: ${record.event.title}`, body: body, replyTo: EEG101_EVENT_HUB.replyTo, name: 'EEG101 Event Hub' });
}

function makeCalendar(event) {
  const date = String(event.start_date || '').replace(/-/g, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EEG101//Event Hub//EN', 'BEGIN:VEVENT', `UID:${event.id}@eeg101.eu`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${date}`, `SUMMARY:${event.title}`, `LOCATION:${event.location || 'EEG101'}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }

function registrationFormHtml(event) {
  const serialisedEvent = JSON.stringify(event).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{color:#17172f;font:16px Lato,Arial,sans-serif;margin:0;padding:2px}label{display:block;font-size:14px;font-weight:700;margin:0 0 14px}input,select{border:1px solid #d8d8df;border-radius:5px;box-sizing:border-box;font:inherit;margin-top:6px;padding:10px;width:100%}.grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}.consent{align-items:flex-start;background:#f5f3e9;border-radius:6px;display:flex;gap:8px;font-weight:400;line-height:1.5;padding:10px}.consent input{margin-top:4px;width:auto}.consent span{font-size:13px}.trap{display:none}.notice{color:#636578;font-size:13px;line-height:1.5}.button{background:#000099;border:1px solid #000099;border-radius:4px;color:#fff;cursor:pointer;font:700 14px Lato,Arial,sans-serif;padding:11px 15px}.button[disabled]{opacity:.55}.message{font-size:14px;font-weight:700;line-height:1.5}.success{color:#166534}.error{color:#991b1b}@media(max-width:540px){.grid{grid-template-columns:1fr}}</style></head><body><form id="registrationForm"><div class="trap"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="grid"><label>Full name<input name="full_name" required autocomplete="name"></label><label>Email address<input name="email" type="email" required autocomplete="email"></label><label>Institution<input name="institution" required autocomplete="organization"></label><label>Country<input name="country" required autocomplete="country-name"></label></div><label>Working Group <span style="font-weight:400">(optional)</span><select name="working_group"><option value="">Select Working Group</option><option value="WG1">WG1</option><option value="WG2">WG2</option><option value="WG3">WG3</option></select></label><label class="consent"><input name="privacy_consent" type="checkbox" required><span>I consent to EEG101 using these details to manage this event, communicate registration updates, and retain the record for up to 12 months after the event. I understand the <a id="privacyLink" target="_blank" rel="noopener">privacy notice</a>.</span></label><p class="notice">No participant account is required. A confirmation or waiting-list email and calendar invitation will be sent after registration.</p><p class="message" id="message" aria-live="polite"></p><button class="button" id="submit" type="submit">Submit registration</button></form><script>const EEG101_EVENT=${serialisedEvent};const form=document.getElementById('registrationForm'),message=document.getElementById('message'),submit=document.getElementById('submit');document.getElementById('privacyLink').href=EEG101_EVENT.privacy_url;function tellParent(result){window.parent.postMessage({type:'eeg101-event-registration',ok:result.ok,message:result.message||result.error||''},'*')}form.addEventListener('submit',function(e){e.preventDefault();if(!form.reportValidity())return;const payload=Object.fromEntries(new FormData(form).entries());payload.event=EEG101_EVENT;submit.disabled=true;submit.textContent='Submitting…';message.textContent='';google.script.run.withSuccessHandler(function(result){message.textContent=result.message||'';message.className='message success';submit.disabled=false;submit.textContent='Registration submitted';tellParent(result)}).withFailureHandler(function(error){const text=error&&error.message?error.message:'We could not submit the registration. Please try again.';message.textContent=text;message.className='message error';submit.disabled=false;submit.textContent='Submit registration';tellParent({ok:false,message:text})}).submitRegistration(payload)})</script></body></html>`;
}
