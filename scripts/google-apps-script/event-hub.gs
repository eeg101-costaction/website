/*
 * EEG101 Event Booking Google Apps Script
 *
 * Deploy this script as a web app that executes as the deploying account.
 * The spreadsheet must be shared with that account as an Editor. The script
 * keeps attendee information in the private Registration ledger tab only.
 *
 * Registration never depends on email delivery. The booking is saved and the
 * attendee sees their confirmation and a calendar download immediately. If the
 * daily email quota is used up, the email is queued in the ledger and sent
 * automatically by an hourly trigger once quota is available again.
 */
const EEG101_EVENT_BOOKING = {
  ledgerSheet: 'Registration ledger',
  replyTo: 'eeg101costaction@gmail.com',
  retentionDays: 365,
  privacyVersion: '2026-09',
  emailSent: 'Email sent',
  emailPending: 'Email pending',
  promotionPending: 'Promotion email pending'
};

const LEDGER_HEADERS = ['Event ID', 'Event title', 'Event date', 'First name', 'Last name', 'Email', 'Institution', 'Country', 'YRI (under 40)', 'Gender', 'Status', 'Registered at', 'Consent', 'Privacy notice version', 'Email status', 'Notes', 'Metadata'];
// Ledger columns (1-based), matching LEDGER_HEADERS.
const COL = { eventId: 1, title: 2, date: 3, firstName: 4, lastName: 5, email: 6, status: 11, emailStatus: 15, meta: 17 };
const YRI_OPTIONS = ['Yes', 'No'];
const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

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
  let status, rowNumber;
  try {
    const existing = ledger().getDataRange().getValues();
    const email = String(payload.email).trim().toLowerCase();
    const duplicate = existing.some((row, index) => index > 0 && String(row[COL.eventId - 1]) === String(payload.event.id) && String(row[COL.email - 1]).trim().toLowerCase() === email);
    if (duplicate) throw new Error('This email address is already registered for this event.');
    status = registrationStatus(payload.event.id, Number(payload.event.capacity || 0), existing);
    rowNumber = appendRegistration(payload, status);
  } finally {
    lock.releaseLock();
  }
  // The booking is saved. Email delivery is attempted but never blocks the confirmation.
  const sent = trySend(() => sendRegistrationEmail(payload.event, payload.first_name, payload.email, status));
  ledger().getRange(rowNumber, COL.emailStatus).setValue(sent ? EEG101_EVENT_BOOKING.emailSent : EEG101_EVENT_BOOKING.emailPending);
  const waitlisted = status === 'waitlisted';
  return {
    ok: true,
    status: status,
    title: payload.event.title,
    when: describeWhen(payload.event),
    location: payload.event.location || '',
    message: waitlisted
      ? 'We will email you if a place becomes available.'
      : 'Your place is confirmed. Add the event to your calendar below. A confirmation email will follow.',
    ics: waitlisted ? '' : makeCalendar(payload.event)
  };
}

function doPost(e) {
  try { return jsonResponse(submitRegistration(JSON.parse(e.postData.contents || '{}'))); }
  catch (error) { return jsonResponse({ ok: false, error: String(error) }); }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('EEG101 Event Booking')
    .addItem('Promote the next waiting-list attendee', 'promptPromotion')
    .addItem('Send pending emails now', 'promptSendPending')
    .addItem('Delete records older than 12 months', 'promptRetentionDeletion')
    .addToUi();
}

// Run once from the Apps Script editor: writes the ledger header row. Only use on an empty ledger.
function setupLedgerHeaders() {
  const sheet = ledger();
  if (sheet.getLastRow() > 1) throw new Error('The ledger already contains registrations. Update headers manually.');
  sheet.getRange(1, 1, 1, sheet.getMaxColumns()).clearContent();
  sheet.getRange(1, 1, 1, LEDGER_HEADERS.length).setValues([LEDGER_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// Run once from the Apps Script editor to send queued emails automatically every hour.
function installPendingEmailTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendPendingEmails').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPendingEmails').timeBased().everyHours(1).create();
}

function trySend(send) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return false;
    send();
    return true;
  } catch (error) {
    console.warn('EEG101 booking email not sent: ' + error);
    return false;
  }
}

function sendPendingEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 0;
  try {
    const sheet = ledger();
    const values = sheet.getDataRange().getValues();
    let sent = 0;
    for (let index = 1; index < values.length; index++) {
      const row = values[index];
      const state = String(row[COL.emailStatus - 1]);
      if (state !== EEG101_EVENT_BOOKING.emailPending && state !== EEG101_EVENT_BOOKING.promotionPending) continue;
      const event = eventFromRow(row);
      const ok = state === EEG101_EVENT_BOOKING.promotionPending
        ? trySend(() => sendPromotionEmail(event, row[COL.firstName - 1], row[COL.email - 1]))
        : trySend(() => sendRegistrationEmail(event, row[COL.firstName - 1], row[COL.email - 1], String(row[COL.status - 1])));
      if (!ok) break;
      sheet.getRange(index + 1, COL.emailStatus).setValue(EEG101_EVENT_BOOKING.emailSent);
      sent++;
    }
    return sent;
  } finally {
    lock.releaseLock();
  }
}

function promptSendPending() {
  const sent = sendPendingEmails();
  SpreadsheetApp.getUi().alert(sent + ' pending email(s) sent. ' + MailApp.getRemainingDailyQuota() + ' email(s) remain in the current daily quota.');
}

function promptPromotion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Promote waiting-list attendee', 'Enter the Event ID exactly as used on www.eeg101.eu.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) promoteNextWaitlisted(response.getResponseText().trim());
}

function promoteNextWaitlisted(eventId) {
  const sheet = ledger();
  const values = sheet.getDataRange().getValues();
  const eventRows = values.filter((row, index) => index > 0 && String(row[COL.eventId - 1]) === String(eventId));
  const capacity = Number(readMeta((eventRows[0] || [])[COL.meta - 1]).capacity || 0);
  const confirmed = eventRows.filter(row => row[COL.status - 1] === 'confirmed').length;
  if (capacity > 0 && confirmed >= capacity) { SpreadsheetApp.getUi().alert('No confirmed place is available. Update a cancelled registration before promoting someone from the waiting list.'); return; }
  const nextRowIndex = values.findIndex((row, index) => index > 0 && String(row[COL.eventId - 1]) === String(eventId) && row[COL.status - 1] === 'waitlisted');
  if (nextRowIndex < 0) { SpreadsheetApp.getUi().alert('No waiting-list registration was found for this event.'); return; }
  const rowNumber = nextRowIndex + 1;
  const row = values[nextRowIndex];
  sheet.getRange(rowNumber, COL.status).setValue('confirmed');
  const sent = trySend(() => sendPromotionEmail(eventFromRow(row), row[COL.firstName - 1], row[COL.email - 1]));
  sheet.getRange(rowNumber, COL.emailStatus).setValue(sent ? EEG101_EVENT_BOOKING.emailSent : EEG101_EVENT_BOOKING.promotionPending);
  SpreadsheetApp.getUi().alert(sent
    ? 'The next waiting-list attendee has been promoted and notified.'
    : 'The next waiting-list attendee has been promoted. The daily email quota is used up, so their email is queued and will be sent automatically.');
}

function promptRetentionDeletion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Delete expired attendee records?', 'This permanently deletes registrations for events completed more than 12 months ago. Ensure that any retention exception has been documented before continuing.', ui.ButtonSet.OK_CANCEL);
  if (response === ui.Button.OK) purgeExpiredRegistrations();
}

function purgeExpiredRegistrations() {
  const sheet = ledger();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - EEG101_EVENT_BOOKING.retentionDays);
  const values = sheet.getDataRange().getValues();
  let deleted = 0;
  for (let index = values.length - 1; index >= 1; index--) {
    const endDate = readMeta(values[index][COL.meta - 1]).end_date;
    const eventDate = new Date(endDate || values[index][COL.date - 1]);
    if (!isNaN(eventDate) && eventDate < cutoff) { sheet.deleteRow(index + 1); deleted++; }
  }
  SpreadsheetApp.getUi().alert(deleted + ' expired attendee record(s) deleted.');
}

function ledger() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('EEG101_EVENT_BOOKING_SHEET_ID');
  if (!spreadsheetId) throw new Error('The EEG101 Event Booking spreadsheet ID has not been set in the Apps Script project properties.');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(EEG101_EVENT_BOOKING.ledgerSheet);
  if (!sheet) throw new Error('Registration ledger sheet not found.');
  return sheet;
}

function validateRegistration(payload) {
  ['first_name', 'last_name', 'institution', 'country', 'email'].forEach(key => { if (!String(payload[key] || '').trim()) throw new Error('Please complete all required fields.'); });
  if (YRI_OPTIONS.indexOf(String(payload.yri || '')) < 0) throw new Error('Please tell us whether you are under 40.');
  if (GENDER_OPTIONS.indexOf(String(payload.gender || '')) < 0) throw new Error('Please select a gender option.');
  if (!payload.privacy_consent || !payload.event || !payload.event.id || !payload.event.title || !payload.event.start_date) throw new Error('Registration consent or event details are missing.');
}

function registrationStatus(eventId, capacity, values) {
  if (!capacity || capacity < 1) return 'confirmed';
  const rows = values || ledger().getDataRange().getValues();
  const confirmed = rows.filter((row, index) => index > 0 && String(row[COL.eventId - 1]) === String(eventId) && row[COL.status - 1] === 'confirmed').length;
  return confirmed >= capacity ? 'waitlisted' : 'confirmed';
}

function appendRegistration(payload, status) {
  const event = payload.event;
  const clean = value => String(value || '').trim();
  const sheet = ledger();
  sheet.appendRow([event.id, event.title, event.start_date, clean(payload.first_name), clean(payload.last_name), clean(payload.email).toLowerCase(), clean(payload.institution), clean(payload.country), clean(payload.yri), clean(payload.gender), status, new Date(), 'Yes', EEG101_EVENT_BOOKING.privacyVersion, EEG101_EVENT_BOOKING.emailPending, '', writeMeta(event)]);
  return sheet.getLastRow();
}

// Metadata column: "Submitted through www.eeg101.eu; key=value; ..." with URI-encoded values.
function writeMeta(event) {
  const fields = { capacity: Number(event.capacity || 0), end_date: event.end_date || event.start_date, time: event.time || '', end_time: event.end_time || '', timezone: event.timezone || 'Europe/London', location: event.location || '' };
  return ['Submitted through www.eeg101.eu'].concat(Object.keys(fields).map(key => key + '=' + encodeURIComponent(fields[key]))).join('; ');
}

function readMeta(text) {
  const meta = {};
  String(text || '').split(';').forEach(part => {
    const match = part.trim().match(/^([a-z_]+)=(.*)$/);
    if (match) { try { meta[match[1]] = decodeURIComponent(match[2]); } catch (error) { meta[match[1]] = match[2]; } }
  });
  return meta;
}

function eventFromRow(row) {
  const meta = readMeta(row[COL.meta - 1]);
  const rawDate = row[COL.date - 1];
  const startDate = rawDate instanceof Date ? Utilities.formatDate(rawDate, 'Europe/London', 'yyyy-MM-dd') : String(rawDate);
  return { id: String(row[COL.eventId - 1]), title: String(row[COL.title - 1]), start_date: startDate, end_date: meta.end_date || startDate, time: meta.time || '', end_time: meta.end_time || '', timezone: meta.timezone || 'Europe/London', location: meta.location || '' };
}

function describeWhen(event) {
  const dates = event.end_date && event.end_date !== event.start_date ? event.start_date + ' to ' + event.end_date : event.start_date;
  const times = event.time ? ', ' + event.time + (event.end_time ? '–' + event.end_time : '') + ' (' + (event.timezone || 'Europe/London') + ')' : '';
  return dates + times;
}

function sendRegistrationEmail(event, firstName, email, status) {
  const waitlisted = status === 'waitlisted';
  const subject = waitlisted ? `Waiting list: ${event.title}` : `Registration confirmed: ${event.title}`;
  const lead = waitlisted ? 'You have been added to the waiting list. We will contact you if a place becomes available.' : 'Your registration is confirmed.';
  const lines = [`Hello ${firstName},`, '', lead, '', `Event: ${event.title}`, `When: ${describeWhen(event)}`, `Where: ${event.location || 'EEG101 event details to follow'}`, ''];
  if (!waitlisted) lines.push('An EEG101 calendar invitation is attached.', '');
  lines.push('EEG101 COST Action CA24148');
  const options = { to: email, subject: subject, body: lines.join('\n'), replyTo: EEG101_EVENT_BOOKING.replyTo, name: 'EEG101 Event Booking' };
  if (!waitlisted) options.attachments = [Utilities.newBlob(makeCalendar(event), 'text/calendar', 'eeg101-event.ics')];
  MailApp.sendEmail(options);
}

function sendPromotionEmail(event, firstName, email) {
  const body = [`Hello ${firstName},`, '', 'A place has become available and your registration is now confirmed.', '', `Event: ${event.title}`, `When: ${describeWhen(event)}`, `Where: ${event.location || 'EEG101 event details to follow'}`, '', 'An EEG101 calendar invitation is attached.', '', 'EEG101 COST Action CA24148'].join('\n');
  MailApp.sendEmail({ to: email, subject: `A place is available: ${event.title}`, body: body, attachments: [Utilities.newBlob(makeCalendar(event), 'text/calendar', 'eeg101-event.ics')], replyTo: EEG101_EVENT_BOOKING.replyTo, name: 'EEG101 Event Booking' });
}

function icsText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsFold(line) {
  const parts = [];
  while (line.length > 74) { parts.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  parts.push(line);
  return parts.join('\r\n');
}

function makeCalendar(event) {
  const timezone = event.timezone || 'Europe/London';
  const endDateText = event.end_date || event.start_date;
  const utc = date => Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const isTime = value => /^\d{1,2}:\d{2}$/.test(String(value || ''));
  let start, end;
  if (isTime(event.time)) {
    const startDate = Utilities.parseDate(`${event.start_date} ${event.time}`, timezone, 'yyyy-MM-dd HH:mm');
    const endDate = isTime(event.end_time)
      ? Utilities.parseDate(`${endDateText} ${event.end_time}`, timezone, 'yyyy-MM-dd HH:mm')
      : new Date(startDate.getTime() + 60 * 60 * 1000);
    start = 'DTSTART:' + utc(startDate);
    end = 'DTEND:' + utc(endDate);
  } else {
    const lastDay = Utilities.parseDate(endDateText, 'UTC', 'yyyy-MM-dd');
    start = 'DTSTART;VALUE=DATE:' + String(event.start_date).replace(/-/g, '');
    end = 'DTEND;VALUE=DATE:' + Utilities.formatDate(new Date(lastDay.getTime() + 24 * 60 * 60 * 1000), 'UTC', 'yyyyMMdd');
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EEG101//Event Hub//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${icsText(event.id)}@eeg101.eu`, 'DTSTAMP:' + utc(new Date()), start, end,
    icsFold('SUMMARY:' + icsText(event.title)), icsFold('LOCATION:' + icsText(event.location || 'EEG101')),
    icsFold('DESCRIPTION:' + icsText('EEG101 COST Action CA24148. Event details: https://www.eeg101.eu/news/')),
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }

function registrationFormHtml(event) {
  const serialisedEvent = JSON.stringify(event).replace(/</g, '\\u003c');
  const radios = (name, options, labels) => options.map((value, i) => `<label class="choice"><input type="radio" name="${name}" value="${value}" required> ${labels[i]}</label>`).join('');
  return `<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{color:#17172f;font:16px Lato,Arial,sans-serif;margin:0;padding:2px}label{display:block;font-size:14px;font-weight:700;margin:0 0 14px}input,select{border:1px solid #d8d8df;border-radius:5px;box-sizing:border-box;font:inherit;margin-top:6px;padding:10px;width:100%}.grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}fieldset{border:0;margin:0 0 14px;padding:0}legend{font-size:14px;font-weight:700;margin-bottom:6px;padding:0}.choices{display:flex;flex-wrap:wrap;gap:8px 18px}.choice{align-items:center;display:flex;font-weight:400;gap:6px;margin:0}.choice input{margin:0;width:auto}.consent{align-items:flex-start;background:#f5f3e9;border-radius:6px;display:flex;gap:8px;font-weight:400;line-height:1.5;padding:10px}.consent input{margin-top:4px;width:auto}.consent span{font-size:13px}.trap{display:none}.notice{color:#636578;font-size:13px;line-height:1.5}.button{background:#000099;border:1px solid #000099;border-radius:4px;color:#fff;cursor:pointer;display:inline-block;font:700 14px Lato,Arial,sans-serif;padding:11px 15px;text-decoration:none}.button[disabled]{opacity:.55}.message{font-size:14px;font-weight:700;line-height:1.5}.error{color:#991b1b}.done{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:18px}.done.wait{background:#fffbeb;border-color:#fde68a}.done h3{color:#166534;font-size:20px;margin:0 0 8px}.done.wait h3{color:#92400e}.done p{line-height:1.5;margin:0 0 12px}.done .meta{font-weight:700}@media(max-width:540px){.grid{grid-template-columns:1fr}}</style></head><body><form id="registrationForm"><div class="trap"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="grid"><label>First name<input name="first_name" required autocomplete="given-name"></label><label>Last name<input name="last_name" required autocomplete="family-name"></label><label>Institution<input name="institution" required autocomplete="organization"></label><label>Country<input name="country" required autocomplete="country-name"></label></div><label>Email address<input name="email" type="email" required autocomplete="email"></label><fieldset><legend>Young Researcher and Innovator (YRI): are you under 40?</legend><div class="choices">${radios('yri', YRI_OPTIONS, ['Yes, I am under 40', 'No'])}</div></fieldset><fieldset><legend>Gender</legend><div class="choices">${radios('gender', GENDER_OPTIONS, GENDER_OPTIONS)}</div></fieldset><label class="consent"><input name="privacy_consent" type="checkbox" required><span>I consent to EEG101 using these details to manage this event, communicate registration updates, and retain the record for up to 12 months after the event. I understand the <a id="privacyLink" target="_blank" rel="noopener">privacy notice</a>.</span></label><p class="notice">No participant account is required. After registering you can add the event straight to your calendar.</p><p class="message" id="message" aria-live="polite"></p><button class="button" id="submit" type="submit">Submit registration</button></form><div id="confirmation" class="done" hidden aria-live="polite"><h3 id="doneTitle"></h3><p class="meta" id="doneEvent"></p><p id="doneWhen"></p><p id="doneText"></p><p><a class="button" id="calendarLink" hidden>Add to calendar (.ics)</a></p></div><script>const EEG101_EVENT=${serialisedEvent};const form=document.getElementById('registrationForm'),message=document.getElementById('message'),submit=document.getElementById('submit');document.getElementById('privacyLink').href=EEG101_EVENT.privacy_url;function tellParent(result){try{window.top.postMessage({type:'eeg101-event-registration',ok:!!result.ok,status:result.status||'',message:result.message||result.error||''},'*')}catch(e){}}function showConfirmation(result){const waitlisted=result.status==='waitlisted';const box=document.getElementById('confirmation');box.className='done'+(waitlisted?' wait':'');document.getElementById('doneTitle').textContent=waitlisted?'You are on the waiting list':'You are booked';document.getElementById('doneEvent').textContent=result.title||EEG101_EVENT.title;document.getElementById('doneWhen').textContent=[result.when,result.location].filter(Boolean).join(' · ');document.getElementById('doneText').textContent=result.message||'';const link=document.getElementById('calendarLink');if(result.ics){link.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(result.ics);link.download='eeg101-'+String(EEG101_EVENT.id).replace(/[^a-z0-9-]+/gi,'-')+'.ics';link.target='_self';link.hidden=false}form.hidden=true;box.hidden=false}form.addEventListener('submit',function(e){e.preventDefault();if(!form.reportValidity())return;const payload=Object.fromEntries(new FormData(form).entries());payload.event=EEG101_EVENT;submit.disabled=true;submit.textContent='Submitting…';message.textContent='';google.script.run.withSuccessHandler(function(result){result=result||{ok:true};showConfirmation(result);tellParent(result)}).withFailureHandler(function(error){const text=error&&error.message?error.message:'We could not submit the registration. Please try again.';message.textContent=text;message.className='message error';submit.disabled=false;submit.textContent='Submit registration';tellParent({ok:false,message:text})}).submitRegistration(payload)})</script></body></html>`;
}
