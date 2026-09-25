/*
 * EEG101 Event Booking Google Apps Script
 *
 * Deploy this script as a web app that executes as the deploying account.
 * The spreadsheet must be shared with that account as an Editor. Each event
 * gets its own private tab, named "<short name> (<date>)" and created
 * automatically when the first person registers.
 *
 * Registration never depends on email delivery. The booking is saved and the
 * attendee sees their confirmation and a calendar download immediately. If the
 * daily email quota is used up, the email is queued in the ledger and sent
 * automatically by an hourly trigger once quota is available again.
 *
 * Online joining links can be entered in either of two places. A private link
 * on the "Joining links" tab of the workbook, or a public `joining_link` in the
 * website's _data/events.yml, which the hourly trigger reads from the published
 * site and emails automatically to everyone already booked. A private link takes
 * precedence. When a link is present it is included in confirmation emails and
 * calendar files; otherwise attendees are told it will follow.
 */
const EEG101_EVENT_BOOKING = {
  replyTo: 'eeg101costaction@gmail.com',
  retentionDays: 365,
  privacyVersion: '2026-09',
  emailSent: 'Email sent',
  emailPending: 'Email pending',
  promotionPending: 'Promotion email pending',
  linksSheet: 'Joining links',
  websiteLinks: 'https://www.eeg101.eu/assets/data/joining-links.json'
};

const LEDGER_HEADERS = ['Event ID', 'Event title', 'Event date', 'First name', 'Last name', 'Email', 'Institution', 'Country', 'YRI (under 40)', 'Gender', 'Status', 'Registered at', 'Consent', 'Privacy notice version', 'Email status', 'Notes', 'Metadata', 'Recording consent', 'EEG101 member', 'Joining link emailed'];
// Columns (1-based) of every event tab, matching LEDGER_HEADERS.
const COL = { eventId: 1, title: 2, date: 3, firstName: 4, lastName: 5, email: 6, status: 11, emailStatus: 15, meta: 17, recordingConsent: 18, member: 19, linkEmailed: 20 };
const LINK_HEADERS = ['Event ID', 'Event tab', 'Joining link (private)', 'Link emailed to attendees', 'Joining link from website', 'Link last sent'];
// Columns (1-based) of the "Joining links" tab.
const LINK_COL = { eventId: 1, tab: 2, privateLink: 3, emailed: 4, websiteLink: 5, lastSent: 6 };
const MEMBER_OPTIONS = ['Yes', 'No'];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
// Country and territory names in British English, alphabetical.
const COUNTRIES = ["Afghanistan", "Åland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "British Virgin Islands", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Caribbean Netherlands", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Cook Islands", "Costa Rica", "Côte d’Ivoire", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Falkland Islands", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard and McDonald Islands", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "North Korea", "North Macedonia", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn Islands", "Poland", "Portugal", "Puerto Rico", "Qatar", "Réunion", "Romania", "Russia", "Rwanda", "Saint Barthélemy", "Saint Helena", "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Sint Maarten", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and South Sandwich Islands", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands", "Uruguay", "US Virgin Islands", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"];
const YRI_OPTIONS = ['Yes', 'No'];
const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const GENDER_OPTIONS_EXTENDED = ['Male', 'Female', 'Beyond the binary (e.g. non-binary, agender, genderfluid, bigender)', 'Prefer to self-describe', 'Prefer not to say'];
const CAREER_STAGE_OPTIONS = ['PhD student', 'Postdoctoral researcher', 'Lecturer / Assistant Professor / Early-career PI', 'Associate Professor / Mid-career researcher', 'Professor / Senior researcher', 'Industry / practitioner', 'Other'];

// Extra registration questions for specific events, keyed by event ID. Leave an event out of
// this object to use the standard registration form. Answers are stored, question-by-question,
// in the "Notes" column of that event's tab, so no changes to LEDGER_HEADERS are needed.
const EVENT_EXTRA_QUESTIONS = {
  'diversity-eeg-populations-2026-11': {
    genderExtended: true,
    careerStage: true,
    memberQuestion: 'Are you currently a member of EEG101 COST Action Working Group 3 (the Community Framework)?',
    memberHint: 'If you are not sure, you can check the <a href="https://www.eeg101.eu/working-groups/" target="_blank" rel="noopener">Working Groups page</a>.',
    communityFrameworkPrompt: true,
    panelQuestions: [
      { id: 'panel_topics', label: 'For our panel discussion on increasing diversity in EEG research: which topics would you consider important or of interest to discuss? Do you have a specific question for the panel?' },
      { id: 'motivation', label: 'What motivates you to increase the diversity of studied populations in EEG research?' },
      { id: 'barriers', label: 'What barriers do you encounter or expect when trying to increase diversity in your studied populations?' },
      { id: 'strategies', label: 'What are key concepts or strategies you consider important to increase diversity in studied populations?' },
      { id: 'future_seminar', label: 'Considering EEG and diversity, what topics would you like to see developed in a future seminar?' },
      { id: 'initiatives', label: 'Do you have any initiatives, networks, or contributions you’d like to share with the community?' },
      { id: 'other_remarks', label: 'Any other remarks or suggestions?' }
    ]
  }
};

function extraQuestionsFor(eventId) { return EVENT_EXTRA_QUESTIONS[String(eventId || '')] || null; }
function genderOptionsFor(eventId) { const extra = extraQuestionsFor(eventId); return extra && extra.genderExtended ? GENDER_OPTIONS_EXTENDED : GENDER_OPTIONS; }

function doGet(e) {
  const event = {
    id: String(e.parameter.event_id || ''), title: String(e.parameter.title || ''), start_date: String(e.parameter.start_date || ''),
    end_date: String(e.parameter.end_date || e.parameter.start_date || ''), time: String(e.parameter.time || ''), end_time: String(e.parameter.end_time || ''),
    timezone: String(e.parameter.timezone || 'Europe/London'), timezone_label: String(e.parameter.timezone_label || ''), joining_link: String(e.parameter.joining_link || ''), location: String(e.parameter.location || ''), capacity: Number(e.parameter.capacity || 0),
    short_name: String(e.parameter.short_name || ''), format: String(e.parameter.format || ''), audience: String(e.parameter.audience || 'open'), summary: String(e.parameter.summary || ''), privacy_url: String(e.parameter.privacy_url || 'https://www.eeg101.eu/privacy/')
  };
  if (!event.id || !event.title || !event.start_date) return HtmlService.createHtmlOutput('<p>Event details are missing. Please return to the EEG101 Event Hub.</p>');
  return HtmlService.createHtmlOutput(registrationFormHtml(event)).setTitle('EEG101 event registration').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitRegistration(payload) {
  validateRegistration(payload);
  if (payload.website) return { ok: true, status: 'ignored' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let status, rowNumber, sheet;
  try {
    sheet = ledgerFor(payload.event, true);
    const existing = sheet.getDataRange().getValues();
    const email = String(payload.email).trim().toLowerCase();
    const duplicate = existing.some((row, index) => index > 0 && String(row[COL.eventId - 1]) === String(payload.event.id) && String(row[COL.email - 1]).trim().toLowerCase() === email);
    if (duplicate) throw new Error('You are already booked for this event with this email address, so there is no need to register again. Your confirmation email was sent when you first registered.');
    status = registrationStatus(payload.event.id, Number(payload.event.capacity || 0), existing);
    rowNumber = appendRegistration(sheet, payload, status);
  } finally {
    lock.releaseLock();
  }
  // The booking is saved. Email delivery is attempted but never blocks the confirmation.
  const event = withJoiningLink(payload.event);
  const waitlisted = status === 'waitlisted';
  const sent = trySend(() => sendRegistrationEmail(event, payload.first_name, payload.email, status));
  sheet.getRange(rowNumber, COL.emailStatus).setValue(sent ? EEG101_EVENT_BOOKING.emailSent : EEG101_EVENT_BOOKING.emailPending);
  if (sent && event.joining_link && !waitlisted) sheet.getRange(rowNumber, COL.linkEmailed).setValue(new Date());
  return {
    ok: true,
    status: status,
    title: payload.event.title,
    when: describeWhen(payload.event),
    location: event.location || '',
    joining_link: waitlisted ? '' : event.joining_link || '',
    link_note: !waitlisted && isOnline(event) && !event.joining_link ? 'The joining link will be emailed to you nearer the time.' : '',
    message: waitlisted
      ? 'We will email you if a place becomes available.'
      : 'Your place is confirmed. You can add the event to your calendar below.',
    ics: waitlisted ? '' : makeCalendar(event)
  };
}

function doPost(e) {
  try { return jsonResponse(submitRegistration(JSON.parse(e.postData.contents || '{}'))); }
  catch (error) { return jsonResponse({ ok: false, error: String(error) }); }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('EEG101 Event Booking')
    .addItem('Promote the next waiting-list attendee', 'promptPromotion')
    .addItem('Email the joining link to everyone booked', 'promptSendJoiningLink')
    .addItem('Send pending emails now', 'promptSendPending')
    .addItem('Delete records older than 12 months', 'promptRetentionDeletion')
    .addToUi();
}

// Run from the Apps Script editor after adding columns to LEDGER_HEADERS: appends any new
// header cells to every event tab (refusing if a tab's existing headers differ) and makes
// sure every event has a row on the "Joining links" tab.
function updateLedgerHeaders() {
  bookingSheets().forEach(sheet => {
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].filter(String);
    if (current.some((header, i) => header !== LEDGER_HEADERS[i])) throw new Error('The headers on tab "' + sheet.getName() + '" differ from the script. Update them manually.');
    writeHeaders(sheet);
    if (sheet.getLastRow() > 1) ensureLinkRow({ id: String(sheet.getRange(2, COL.eventId).getValue()) }, sheet.getName());
  });
}

function writeHeaders(sheet) {
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
    const queue = [];
    bookingSheets().forEach(sheet => sheet.getDataRange().getValues().forEach((row, index) => {
      const state = String(row[COL.emailStatus - 1]);
      if (index > 0 && (state === EEG101_EVENT_BOOKING.emailPending || state === EEG101_EVENT_BOOKING.promotionPending)) queue.push({ sheet: sheet, rowNumber: index + 1, row: row, state: state });
    }));
    // Oldest registrations first, across all events.
    queue.sort((a, b) => new Date(a.row[11]) - new Date(b.row[11]));
    let sent = 0;
    for (const item of queue) {
      const row = item.row;
      const event = withJoiningLink(eventFromRow(row));
      const ok = item.state === EEG101_EVENT_BOOKING.promotionPending
        ? trySend(() => sendPromotionEmail(event, row[COL.firstName - 1], row[COL.email - 1]))
        : trySend(() => sendRegistrationEmail(event, row[COL.firstName - 1], row[COL.email - 1], String(row[COL.status - 1])));
      if (!ok) return sent;
      item.sheet.getRange(item.rowNumber, COL.emailStatus).setValue(EEG101_EVENT_BOOKING.emailSent);
      if (event.joining_link && String(row[COL.status - 1]) === 'confirmed') item.sheet.getRange(item.rowNumber, COL.linkEmailed).setValue(new Date());
      sent++;
    }
    return sent + sendQueuedJoiningLinks();
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
  const active = SpreadsheetApp.getActiveSheet();
  const activeEventId = isBookingSheet(active) && active.getLastRow() > 1 ? String(active.getRange(2, COL.eventId).getValue()) : '';
  if (activeEventId) {
    if (ui.alert('Promote waiting-list attendee', 'Promote the next waiting-list attendee for "' + active.getName() + '"?', ui.ButtonSet.OK_CANCEL) === ui.Button.OK) promoteNextWaitlisted(activeEventId);
    return;
  }
  const response = ui.prompt('Promote waiting-list attendee', 'Enter the Event ID exactly as used on www.eeg101.eu.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) promoteNextWaitlisted(response.getResponseText().trim());
}

function promoteNextWaitlisted(eventId) {
  const sheet = ledgerFor({ id: eventId }, false);
  if (!sheet) { SpreadsheetApp.getUi().alert('No registrations were found for this Event ID.'); return; }
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
  const event = withJoiningLink(eventFromRow(row));
  const sent = trySend(() => sendPromotionEmail(event, row[COL.firstName - 1], row[COL.email - 1]));
  sheet.getRange(rowNumber, COL.emailStatus).setValue(sent ? EEG101_EVENT_BOOKING.emailSent : EEG101_EVENT_BOOKING.promotionPending);
  if (sent && event.joining_link) sheet.getRange(rowNumber, COL.linkEmailed).setValue(new Date());
  SpreadsheetApp.getUi().alert(sent
    ? 'The next waiting-list attendee has been promoted and notified.'
    : 'The next waiting-list attendee has been promoted. The daily email quota is used up, so their email is queued and will be sent automatically.');
}

// ---- Joining links ("Joining links" tab, or joining_link in the website's event data) ----

const isLink = value => /^https?:\/\/\S+$/i.test(String(value || '').trim());

function linksSheet() {
  const book = workbook();
  let sheet = book.getSheetByName(EEG101_EVENT_BOOKING.linksSheet);
  if (!sheet) {
    sheet = book.insertSheet(EEG101_EVENT_BOOKING.linksSheet, 0);
    sheet.setFrozenRows(1);
    [260, 300, 380, 200, 380, 380].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  }
  if (sheet.getRange(1, LINK_HEADERS.length).getValue() !== LINK_HEADERS[LINK_HEADERS.length - 1]) {
    sheet.getRange(1, 1, 1, LINK_HEADERS.length).setValues([LINK_HEADERS]).setFontWeight('bold');
    sheet.getRange(1, LINK_COL.privateLink).setNote('Optional private link. It takes precedence over a link added on the website. Use the menu EEG101 Event Booking > Email the joining link to everyone booked to send it.');
    sheet.getRange(1, LINK_COL.websiteLink).setNote('Filled in automatically from joining_link in the website event data. Attendees are emailed automatically, within the hour, when it appears or changes.');
  }
  return sheet;
}

// Adds a row for the event on the "Joining links" tab if it is not already there.
function ensureLinkRow(event, tabName) {
  const sheet = linksSheet();
  const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  if (ids.indexOf(String(event.id)) < 0) sheet.appendRow([event.id, tabName || '', '', '', '', '']);
}

function linkRowFor(eventId) {
  const sheet = linksSheet();
  const values = sheet.getDataRange().getValues();
  const index = values.findIndex((row, i) => i > 0 && String(row[0]) === String(eventId));
  if (index < 0) return null;
  const row = values[index];
  const privateLink = String(row[LINK_COL.privateLink - 1] || '').trim();
  const websiteLink = String(row[LINK_COL.websiteLink - 1] || '').trim();
  return {
    sheet: sheet, rowNumber: index + 1, emailed: row[LINK_COL.emailed - 1],
    privateLink: privateLink, websiteLink: websiteLink, lastSent: String(row[LINK_COL.lastSent - 1] || '').trim(),
    link: isLink(privateLink) ? privateLink : isLink(websiteLink) ? websiteLink : '',
    source: isLink(privateLink) ? 'private' : isLink(websiteLink) ? 'website' : ''
  };
}

// The private link wins, then the website link held on the tab, then a link passed from the website form.
function withJoiningLink(event) {
  const row = linkRowFor(event.id);
  const link = row && row.link ? row.link : isLink(event.joining_link) ? String(event.joining_link).trim() : '';
  return Object.assign({}, event, { joining_link: link });
}

function isOnline(event) {
  return /online|hybrid/i.test(String(event.format || '') + ' ' + String(event.location || ''));
}

// Starts (or restarts, if the link has changed) the joining-link mailing for one event.
function startJoiningLinkMailing(row, eventId) {
  if (row.lastSent && row.lastSent !== row.link) {
    const sheet = ledgerFor({ id: eventId }, false);
    if (sheet && sheet.getLastRow() > 1) sheet.getRange(2, COL.linkEmailed, sheet.getLastRow() - 1, 1).clearContent();
  }
  row.sheet.getRange(row.rowNumber, LINK_COL.emailed).setValue(new Date());
  row.sheet.getRange(row.rowNumber, LINK_COL.lastSent).setValue(row.link);
  return sendJoiningLinks(eventId);
}

function promptSendJoiningLink() {
  const ui = SpreadsheetApp.getUi();
  const active = SpreadsheetApp.getActiveSheet();
  let eventId = '';
  if (isBookingSheet(active) && active.getLastRow() > 1) eventId = String(active.getRange(2, COL.eventId).getValue());
  else if (active.getName() === EEG101_EVENT_BOOKING.linksSheet && active.getActiveRange().getRow() > 1) eventId = String(active.getRange(active.getActiveRange().getRow(), 1).getValue());
  if (!eventId) {
    const response = ui.prompt('Email the joining link', 'Open the event\'s tab first, or enter its Event ID.', ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return;
    eventId = response.getResponseText().trim();
  }
  const row = linkRowFor(eventId);
  if (!row || !row.link) { ui.alert('No joining link has been entered for this event. Add it on the "Joining links" tab or as joining_link on the website (it must start with https://).'); return; }
  const changed = row.lastSent && row.lastSent !== row.link;
  const sheet = ledgerFor({ id: eventId }, false);
  const values = sheet ? sheet.getDataRange().getValues().filter((r, i) => i > 0 && r[COL.status - 1] === 'confirmed') : [];
  const waiting = changed ? values.length : values.filter(r => !r[COL.linkEmailed - 1]).length;
  if (!waiting) { ui.alert('Everyone booked on this event has already been sent the joining link.'); return; }
  const question = changed
    ? 'The joining link has changed. Send the new link to all ' + waiting + ' confirmed attendee(s)?'
    : 'Send the joining link to ' + waiting + ' confirmed attendee(s) who have not yet received it?';
  if (ui.alert('Email the joining link', question, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  const sent = startJoiningLinkMailing(row, eventId);
  const left = waiting - sent;
  ui.alert(sent + ' joining link email(s) sent.' + (left > 0 ? ' The daily email quota is used up, so the remaining ' + left + ' will be sent automatically once quota is available.' : ''));
}

// Sends the joining link to confirmed attendees of one event who have not received it yet.
function sendJoiningLinks(eventId) {
  const sheet = ledgerFor({ id: eventId }, false);
  if (!sheet) return 0;
  const values = sheet.getDataRange().getValues();
  let sent = 0;
  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    if (row[COL.status - 1] !== 'confirmed' || row[COL.linkEmailed - 1]) continue;
    const event = withJoiningLink(eventFromRow(row));
    if (!event.joining_link) return sent;
    if (!trySend(() => sendJoiningLinkEmail(event, row[COL.firstName - 1], row[COL.email - 1]))) return sent;
    sheet.getRange(index + 1, COL.linkEmailed).setValue(new Date());
    sent++;
  }
  return sent;
}

// Reads joining_link values published by the website into the "Joining links" tab.
function syncWebsiteLinks() {
  let published;
  try {
    const response = UrlFetchApp.fetch(EEG101_EVENT_BOOKING.websiteLinks + '?t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (response.getResponseCode() !== 200) return;
    published = JSON.parse(response.getContentText());
  } catch (error) {
    console.warn('Could not read joining links from the website: ' + error);
    return;
  }
  const byId = {};
  (published || []).forEach(item => { if (item && item.id) byId[String(item.id)] = isLink(item.joining_link) ? String(item.joining_link).trim() : ''; });
  Object.keys(byId).forEach(id => ensureLinkRow({ id: id }, ''));
  const sheet = linksSheet();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0]);
    const website = byId[id] || '';
    if (String(values[i][LINK_COL.websiteLink - 1] || '') !== website) sheet.getRange(i + 1, LINK_COL.websiteLink).setValue(website);
  }
}

// Runs hourly: picks up website links, emails them automatically when they appear or change,
// and continues any mailing that the daily quota interrupted.
function sendQueuedJoiningLinks() {
  syncWebsiteLinks();
  const values = linksSheet().getDataRange().getValues();
  let sent = 0;
  for (let i = 1; i < values.length; i++) {
    if (MailApp.getRemainingDailyQuota() < 1) break;
    const eventId = String(values[i][0]);
    const row = linkRowFor(eventId);
    if (!row || !row.link) continue;
    if (row.source === 'website' && row.link !== row.lastSent) sent += startJoiningLinkMailing(row, eventId);
    else if (row.emailed && row.link === row.lastSent) sent += sendJoiningLinks(eventId);
  }
  return sent;
}

function promptRetentionDeletion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Delete expired attendee records?', 'This permanently deletes registrations for events completed more than 12 months ago. Ensure that any retention exception has been documented before continuing.', ui.ButtonSet.OK_CANCEL);
  if (response === ui.Button.OK) purgeExpiredRegistrations();
}

function purgeExpiredRegistrations() {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - EEG101_EVENT_BOOKING.retentionDays);
  let deleted = 0;
  bookingSheets().forEach(sheet => {
    const values = sheet.getDataRange().getValues();
    for (let index = values.length - 1; index >= 1; index--) {
      const endDate = readMeta(values[index][COL.meta - 1]).end_date;
      const eventDate = new Date(endDate || values[index][COL.date - 1]);
      if (!isNaN(eventDate) && eventDate < cutoff) { sheet.deleteRow(index + 1); deleted++; }
    }
  });
  SpreadsheetApp.getUi().alert(deleted + ' expired attendee record(s) deleted.');
}

function workbook() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('EEG101_EVENT_BOOKING_SHEET_ID');
  if (!spreadsheetId) throw new Error('The EEG101 Event Booking spreadsheet ID has not been set in the Apps Script project properties.');
  return SpreadsheetApp.openById(spreadsheetId);
}

function isBookingSheet(sheet) {
  return sheet.getLastRow() >= 1 && sheet.getRange(1, 1).getValue() === LEDGER_HEADERS[0];
}

function bookingSheets() {
  return workbook().getSheets().filter(isBookingSheet);
}

function eventSheetName(event) {
  const base = String(event.short_name || event.title || event.id).replace(/[\[\]*?\/\\:']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return base + ' (' + event.start_date + ')';
}

// Returns the event's tab. The tab is remembered by its internal ID, so organisers can rename or reorder tabs freely.
function ledgerFor(event, create) {
  const book = workbook();
  const properties = PropertiesService.getScriptProperties();
  const key = 'EEG101_EVENT_SHEET_' + event.id;
  const savedId = properties.getProperty(key);
  let sheet = savedId ? book.getSheets().find(candidate => String(candidate.getSheetId()) === savedId) : null;
  if (!sheet) sheet = bookingSheets().find(candidate => candidate.getLastRow() > 1 && String(candidate.getRange(2, COL.eventId).getValue()) === String(event.id)) || null;
  if (!sheet && create) {
    let name = eventSheetName(event);
    if (book.getSheetByName(name)) name = (name.slice(0, 80) + ' ' + String(event.id).slice(0, 18)).trim();
    sheet = book.insertSheet(name, book.getSheets().length);
    writeHeaders(sheet);
  }
  if (sheet && create) ensureLinkRow(event, sheet.getName());
  if (sheet) {
    properties.setProperty(key, String(sheet.getSheetId()));
    // Tabs from the original single-ledger layout are given their event name.
    if (sheet.getName() === 'Registration ledger' && event.start_date && !book.getSheetByName(eventSheetName(event))) sheet.setName(eventSheetName(event));
  }
  return sheet;
}

function validateRegistration(payload) {
  ['first_name', 'last_name', 'institution', 'country', 'email'].forEach(key => { if (!String(payload[key] || '').trim()) throw new Error('Please complete all required fields.'); });
  if (!EMAIL_PATTERN.test(String(payload.email).trim())) throw new Error('Please enter a valid email address.');
  if (COUNTRIES.indexOf(String(payload.country || '')) < 0) throw new Error('Please select your country from the list.');
  if (YRI_OPTIONS.indexOf(String(payload.yri || '')) < 0) throw new Error('Please tell us whether you are under 40.');
  const eventId = payload.event && payload.event.id;
  if (genderOptionsFor(eventId).indexOf(String(payload.gender || '')) < 0) throw new Error('Please select a gender option.');
  if (MEMBER_OPTIONS.indexOf(String(payload.member || '')) < 0) throw new Error('Please tell us whether you are a member of the EEG101 COST Action.');
  const extra = extraQuestionsFor(eventId);
  if (extra && extra.careerStage && CAREER_STAGE_OPTIONS.indexOf(String(payload.career_stage || '')) < 0) throw new Error('Please select your career stage.');
  if (!payload.recording_consent) throw new Error('Please agree to the recording consent to complete your booking.');
  if (!payload.privacy_consent || !payload.event || !payload.event.id || !payload.event.title || !payload.event.start_date) throw new Error('Registration consent or event details are missing.');
}

// Extra, event-specific answers (career stage, self-described gender, open panel questions),
// packed into one readable line for the "Notes" column. Every part is optional, so people are
// never blocked from registering by these questions.
function extraAnswersNote(payload) {
  const extra = extraQuestionsFor(payload.event && payload.event.id);
  if (!extra) return '';
  const parts = [];
  const clean = value => String(value || '').trim();
  if (extra.careerStage && clean(payload.career_stage)) parts.push('Career stage: ' + clean(payload.career_stage) + (clean(payload.career_stage) === 'Other' && clean(payload.career_stage_other) ? ' (' + clean(payload.career_stage_other) + ')' : ''));
  if (extra.genderExtended && clean(payload.gender) === 'Prefer to self-describe' && clean(payload.gender_other)) parts.push('Gender (self-described): ' + clean(payload.gender_other));
  (extra.panelQuestions || []).forEach(q => { if (clean(payload[q.id])) parts.push(q.label + ' — ' + clean(payload[q.id])); });
  return parts.join(' | ');
}

function registrationStatus(eventId, capacity, values) {
  if (!capacity || capacity < 1) return 'confirmed';
  const confirmed = values.filter((row, index) => index > 0 && String(row[COL.eventId - 1]) === String(eventId) && row[COL.status - 1] === 'confirmed').length;
  return confirmed >= capacity ? 'waitlisted' : 'confirmed';
}

function appendRegistration(sheet, payload, status) {
  const event = payload.event;
  const clean = value => String(value || '').trim();
  sheet.appendRow([event.id, event.title, event.start_date, clean(payload.first_name), clean(payload.last_name), clean(payload.email).toLowerCase(), clean(payload.institution), clean(payload.country), clean(payload.yri), clean(payload.gender), status, new Date(), 'Yes', EEG101_EVENT_BOOKING.privacyVersion, EEG101_EVENT_BOOKING.emailPending, extraAnswersNote(payload), writeMeta(event), 'Yes', clean(payload.member), '']);
  return sheet.getLastRow();
}

// Metadata column: "Submitted through www.eeg101.eu; key=value; ..." with URI-encoded values.
function writeMeta(event) {
  const fields = { capacity: Number(event.capacity || 0), end_date: event.end_date || event.start_date, time: event.time || '', end_time: event.end_time || '', timezone: event.timezone || 'Europe/London', timezone_label: event.timezone_label || '', location: event.location || '', format: event.format || '' };
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
  return { id: String(row[COL.eventId - 1]), title: String(row[COL.title - 1]), start_date: startDate, end_date: meta.end_date || startDate, time: meta.time || '', end_time: meta.end_time || '', timezone: meta.timezone || 'Europe/London', timezone_label: meta.timezone_label || '', location: meta.location || '', format: meta.format || '' };
}

// "Friday 20 November 2026, 12:00–14:30 CET"
function describeWhen(event) {
  const timezone = event.timezone || 'Europe/London';
  const day = date => Utilities.formatDate(Utilities.parseDate(date, 'UTC', 'yyyy-MM-dd'), 'UTC', 'EEEE d MMMM yyyy');
  const dates = event.end_date && event.end_date !== event.start_date ? day(event.start_date) + ' to ' + day(event.end_date) : day(event.start_date);
  if (!/^\d{1,2}:\d{2}$/.test(String(event.time || ''))) return dates;
  const label = event.timezone_label || Utilities.formatDate(Utilities.parseDate(event.start_date + ' ' + event.time, timezone, 'yyyy-MM-dd HH:mm'), timezone, 'z');
  return dates + ', ' + event.time + (event.end_time ? '–' + event.end_time : '') + ' ' + label;
}

const EMAIL_BRAND = {
  signOff: 'The EEG101 Community Engagement Team',
  contact: 'eeg101costaction@gmail.com',
  website: 'https://www.eeg101.eu',
  websiteLabel: 'www.eeg101.eu',
  logo: 'https://www.eeg101.eu/assets/images/logo/EEG101_logo_horizontal_transp_noborder.png',
  tagline: 'Fundamentals of Open & Rigorous EEG Science',
  acknowledgement: 'EEG101 (CA24148) is supported by COST (European Cooperation in Science and Technology), a funding agency for research and innovation networks. COST is funded by the Horizon Europe programme of the European Union.'
};

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Builds a branded HTML email plus a plain-text alternative from the same content.
function buildEmail(firstName, heading, paragraphs, event, closing, showLink) {
  const details = [['Event', event.title], ['Date and time', describeWhen(event)], ['Location', event.location || 'Details to follow']];
  if (event.joining_link && showLink) details.push(['Join online', event.joining_link, event.joining_link]);
  const text = [`Dear ${firstName},`, '']
    .concat(paragraphs.map(p => p + '\n'))
    .concat(details.map(d => `${d[0]}: ${d[1]}`), '', closing.map(p => p + '\n'))
    .concat(['Kind regards,', '', EMAIL_BRAND.signOff, 'EEG101 COST Action CA24148', `Contact: ${EMAIL_BRAND.contact}`, EMAIL_BRAND.websiteLabel, '', '--', EMAIL_BRAND.acknowledgement])
    .join('\n');
  const font = "Georgia,'Times New Roman',serif";
  const ui = "Lato,Helvetica,Arial,sans-serif";
  const para = p => `<p style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:1.6;color:#1a1a2e;">${escapeHtml(p)}</p>`;
  const rows = details.map(d => `<tr><td style="padding:10px 16px 10px 0;font-family:${ui};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5a5a7a;vertical-align:top;white-space:nowrap;">${escapeHtml(d[0])}</td><td style="padding:10px 0;font-family:${font};font-size:16px;line-height:1.5;color:#1a1a2e;">${d[2] ? `<a href="${escapeHtml(d[2])}" style="color:#000099;font-weight:700;word-break:break-all;">${escapeHtml(d[1])}</a>` : escapeHtml(d[1])}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f0ede8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#faf8f5;border:1px solid #e0dbd4;border-radius:12px;overflow:hidden;">
<tr><td style="background:#000099;height:6px;line-height:6px;font-size:0;border-bottom:3px solid #FFCC00;">&nbsp;</td></tr>
<tr><td style="padding:26px 32px 8px;"><a href="${EMAIL_BRAND.website}" style="text-decoration:none;"><img src="${EMAIL_BRAND.logo}" width="190" alt="EEG101" style="display:block;border:0;width:190px;height:auto;"></a></td></tr>
<tr><td style="padding:14px 32px 0;"><p style="margin:0 0 6px;font-family:${ui};font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#d4a800;">EEG101 event registration</p>
<h1 style="margin:0 0 20px;font-family:${font};font-size:26px;line-height:1.25;font-weight:700;color:#000099;">${escapeHtml(heading)}</h1>
${para('Dear ' + firstName + ',')}${paragraphs.map(para).join('')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;background:#ffffff;border:1px solid #e0dbd4;border-left:4px solid #000099;border-radius:8px;"><tr><td style="padding:8px 18px;"><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>
${closing.map(para).join('')}
<p style="margin:24px 0 4px;font-family:${font};font-size:16px;color:#1a1a2e;">Kind regards,</p>
<p style="margin:0 0 22px;font-family:${font};font-size:16px;font-weight:700;color:#1a1a2e;">${escapeHtml(EMAIL_BRAND.signOff)}</p></td></tr>
<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e0dbd4;"><tr><td style="padding-top:16px;font-family:${ui};font-size:13px;line-height:1.7;color:#5a5a7a;">
<strong style="color:#000099;">EEG101</strong> &middot; COST Action CA24148<br>${escapeHtml(EMAIL_BRAND.tagline)}<br>
Contact: <a href="mailto:${EMAIL_BRAND.contact}" style="color:#000099;">${EMAIL_BRAND.contact}</a><br>
<a href="${EMAIL_BRAND.website}" style="color:#000099;">${EMAIL_BRAND.websiteLabel}</a></td></tr></table></td></tr>
<tr><td style="background:#0d0d2b;padding:18px 32px;font-family:${ui};font-size:11px;line-height:1.6;color:#c9c9dc;">${escapeHtml(EMAIL_BRAND.acknowledgement)}<br><br>You are receiving this email because you registered for an EEG101 event at ${EMAIL_BRAND.websiteLabel}.</td></tr>
</table></td></tr></table></body></html>`;
  return { text: text, html: html };
}

// Closing sentences about the joining link and calendar invitation for confirmed attendees.
function linkSentence(event) {
  if (event.joining_link) return ['A calendar invitation, including the joining link, is attached so you can add the event to your calendar.'];
  return (isOnline(event) ? ['The joining link will be emailed to you nearer the time.'] : []).concat(['A calendar invitation is attached so you can add the event to your calendar.']);
}

function sendRegistrationEmail(event, firstName, email, status) {
  const waitlisted = status === 'waitlisted';
  const message = waitlisted
    ? buildEmail(firstName, 'You are on the waiting list',
        ['Thank you for your interest in this EEG101 event. It is currently fully booked, so we have added you to the waiting list.', 'If a place becomes available we will email you straight away to confirm it.'],
        event, ['If you no longer wish to attend, simply reply to this email and we will remove you from the waiting list.'], false)
    : buildEmail(firstName, 'Your registration is confirmed',
        ['Thank you for registering. We are delighted to confirm your place at the following EEG101 event.'],
        event, linkSentence(event).concat(['If you have any questions, or can no longer attend, simply reply to this email so that we can offer your place to someone else.']), true);
  const options = { to: email, subject: (waitlisted ? 'Waiting list: ' : 'Registration confirmed: ') + event.title, body: message.text, htmlBody: message.html, replyTo: EEG101_EVENT_BOOKING.replyTo, name: 'EEG101 Event Booking' };
  if (!waitlisted) options.attachments = [Utilities.newBlob(makeCalendar(event), 'text/calendar', 'eeg101-event.ics')];
  MailApp.sendEmail(options);
}

function sendPromotionEmail(event, firstName, email) {
  const message = buildEmail(firstName, 'A place is now available',
    ['Good news: a place has become available at the following EEG101 event, and your registration is now confirmed.'],
    event, linkSentence(event).concat(['If you can no longer attend, simply reply to this email so that we can offer your place to someone else.']), true);
  MailApp.sendEmail({ to: email, subject: 'A place is available: ' + event.title, body: message.text, htmlBody: message.html, attachments: [Utilities.newBlob(makeCalendar(event), 'text/calendar', 'eeg101-event.ics')], replyTo: EEG101_EVENT_BOOKING.replyTo, name: 'EEG101 Event Booking' });
}

function sendJoiningLinkEmail(event, firstName, email) {
  const message = buildEmail(firstName, 'Your joining link',
    ['Thank you for registering for the following EEG101 event. Here is your link to join online.'],
    event, ['An updated calendar invitation with the joining link is attached. Adding it will update the event already in your calendar.', 'Please do not share this link. If you can no longer attend, simply reply to this email so that we can offer your place to someone else.'], true);
  MailApp.sendEmail({ to: email, subject: 'Joining link: ' + event.title, body: message.text, htmlBody: message.html, attachments: [Utilities.newBlob(makeCalendar(event), 'text/calendar', 'eeg101-event.ics')], replyTo: EEG101_EVENT_BOOKING.replyTo, name: 'EEG101 Event Booking' });
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
    `UID:${icsText(event.id)}@eeg101.eu`, 'DTSTAMP:' + utc(new Date()), 'SEQUENCE:' + (event.joining_link ? 1 : 0), start, end,
    icsFold('SUMMARY:' + icsText(event.title)), icsFold('LOCATION:' + icsText(event.joining_link || event.location || 'EEG101'))]
    .concat(event.joining_link ? [icsFold('URL:' + event.joining_link)] : [])
    .concat([icsFold('DESCRIPTION:' + icsText((event.joining_link ? 'Join online: ' + event.joining_link + '\n\n' : isOnline(event) ? 'The joining link will be emailed to you nearer the time.\n\n' : '') + 'EEG101 COST Action CA24148. Event details: https://www.eeg101.eu/events/')),
    'END:VEVENT', 'END:VCALENDAR']).join('\r\n');
}

function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }

function registrationFormHtml(event) {
  const serialisedEvent = JSON.stringify(event).replace(/</g, '\\u003c');
  const radios = (name, options, labels) => options.map((value, i) => `<label class="choice"><input type="radio" name="${name}" value="${value}" required> ${labels[i]}</label>`).join('');
  const extra = extraQuestionsFor(event.id);
  const genderOptions = genderOptionsFor(event.id);
  const careerStageHtml = extra && extra.careerStage ? `<fieldset><legend>Career stage</legend><div class="choices">${radios('career_stage', CAREER_STAGE_OPTIONS, CAREER_STAGE_OPTIONS)}</div><div class="subfield" id="careerStageOtherWrap" hidden><label>If other, please specify<input name="career_stage_other" autocomplete="off"></label></div></fieldset>` : '';
  const memberLegend = extra && extra.memberQuestion ? extra.memberQuestion : 'Are you a member of the EEG101 COST Action?';
  const memberHintHtml = extra && extra.memberHint ? `<p class="hint">${extra.memberHint}</p>` : (event.audience === 'members' ? '' : '<p class="hint">Membership is not required. This event is open to everyone.</p>');
  const genderSelfDescribeHtml = extra && extra.genderExtended ? `<div class="subfield" id="genderOtherWrap" hidden><label>Please self-describe<input name="gender_other" autocomplete="off"></label></div>` : '';
  const panelQuestionsHtml = extra && extra.panelQuestions ? `<fieldset><legend>About this event: strategies and barriers to increase diversity</legend><p class="hint">These questions are optional and help us shape the panel discussion.</p>${extra.panelQuestions.map(q => `<label>${escapeHtml(q.label)}<textarea name="${q.id}" rows="2"></textarea></label>`).join('')}</fieldset>` : '';
  const communityFrameworkHtml = extra && extra.communityFrameworkPrompt ? `<div class="cf-note">Explore the <a href="https://sign-cf.eeg101.eu/" target="_blank" rel="noopener">EEG101 Community Framework</a> and consider signing it to support our collective efforts.</div>` : '';
  return `<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Lora:wght@400;600&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"><style>:root{--primary:#000099;--primary-dark:#00007a;--primary-light:#e8e8ff;--gold:#FFCC00;--gold-dark:#d4a800;--gold-light:#fff8d6;--text:#1a1a2e;--muted:#5a5a7a;--bg:#faf8f5;--bg-alt:#f0ede8;--border:#e0dbd4;--heading:'Playfair Display',Georgia,'Times New Roman',serif;--body:'Lora',Georgia,'Times New Roman',serif;--ui:'Lato',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}body{background:var(--bg);color:var(--text);font:16px/1.6 var(--body);margin:0;padding:2px}label{display:block;font:700 14px var(--ui);margin:0 0 14px}input,select{background:#fff;border:1px solid var(--border);border-radius:6px;box-sizing:border-box;color:var(--text);font:400 15px var(--ui);margin-top:6px;padding:10px 12px;width:100%}select{appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235a5a7a' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 12px center;padding-right:34px}input:focus,select:focus{border-color:var(--primary);outline:2px solid var(--primary-light)}form.tried input:invalid,form.tried select:invalid{border-color:#991b1b;background-color:#fef2f2}form.tried fieldset:has(input:invalid) legend,form.tried .consent:has(input:invalid){color:#991b1b}form.tried .consent:has(input:invalid){outline:1px solid #991b1b}.grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}fieldset{border:0;margin:0 0 14px;padding:0}legend{font:700 14px var(--ui);margin-bottom:6px;padding:0}.choices{display:flex;flex-wrap:wrap;gap:8px 18px}.choice{align-items:center;display:flex;font:400 15px var(--ui);gap:6px;margin:0}.choice input,.consent input{accent-color:var(--primary);margin:0;width:auto}.consent{align-items:flex-start;background:var(--bg-alt);border-radius:6px;display:flex;gap:10px;font-weight:400;line-height:1.55;margin-bottom:10px;padding:12px}.consent input{margin-top:4px}.consent span{font:400 13px/1.55 var(--ui)}.trap{display:none}.notice{color:var(--muted);font:400 13px/1.55 var(--ui)}.button{background:var(--primary);border:2px solid var(--primary);border-radius:6px;color:#fff;cursor:pointer;display:inline-flex;font:600 14.4px var(--ui);letter-spacing:.01em;padding:.6rem 1.4rem;text-decoration:none}.button:hover{background:var(--primary-dark);border-color:var(--primary-dark)}.button[disabled]{opacity:.55}.message{font:700 14px/1.5 var(--ui)}.error{color:#991b1b}.done{background:#fff;border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:12px;box-shadow:0 1px 4px rgba(0,0,100,.08);padding:20px 22px}.done.wait{border-left-color:var(--gold-dark)}.done h3{color:var(--primary);font:700 24px/1.2 var(--heading);margin:0 0 10px}.done p{margin:0 0 10px}.done .meta{font-weight:600}.hint{color:var(--muted);font:400 13px var(--ui);margin:6px 0 0}textarea{background:#fff;border:1px solid var(--border);border-radius:6px;box-sizing:border-box;color:var(--text);font:400 15px var(--ui);margin-top:6px;min-height:70px;padding:10px 12px;resize:vertical;width:100%}.subfield{margin-top:8px}.cf-note{background:var(--gold-light);border:1px solid var(--gold-dark);border-radius:8px;font:400 14px/1.5 var(--ui);margin:4px 0 14px;padding:12px 14px}.cf-note a{color:var(--primary);font-weight:700}.done .join a{color:var(--primary);font-weight:700;word-break:break-all}.done .when{color:var(--muted);font:400 14px var(--ui)}@media(max-width:540px){.grid{grid-template-columns:1fr}}</style></head><body><form id="registrationForm" novalidate><div class="trap"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="grid"><label>First name<input name="first_name" required autocomplete="given-name"></label><label>Last name<input name="last_name" required autocomplete="family-name"></label><label>Institution<input name="institution" required autocomplete="organization"></label><label>Country<select name="country" required autocomplete="country-name"><option value="">Select your country</option>${COUNTRIES.map(c => `<option>${c}</option>`).join('')}</select></label></div><label>Email address<input name="email" type="email" required autocomplete="email" pattern="[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}" title="Please enter a valid email address, for example name@university.eu"></label>${careerStageHtml}<fieldset><legend>Young Researcher and Innovator (YRI): are you under 40?</legend><div class="choices">${radios('yri', YRI_OPTIONS, ['Yes, I am under 40', 'No'])}</div></fieldset><fieldset><legend>${memberLegend}</legend><div class="choices">${radios('member', MEMBER_OPTIONS, MEMBER_OPTIONS)}</div>${memberHintHtml}</fieldset><fieldset><legend>Gender</legend><div class="choices">${radios('gender', genderOptions, genderOptions)}</div>${genderSelfDescribeHtml}</fieldset>${panelQuestionsHtml}${communityFrameworkHtml}<label class="consent"><input name="recording_consent" type="checkbox" required><span>I understand that this event may be recorded. I consent to being recorded and to EEG101 publishing the recording online, for example in the EEG101 Library and on the EEG101 YouTube channel.</span></label><label class="consent"><input name="privacy_consent" type="checkbox" required><span>I consent to EEG101 using these details to manage this event, communicate registration updates, and retain the record for up to 12 months after the event. I understand the <a id="privacyLink" target="_blank" rel="noopener">privacy notice</a>.</span></label><p class="notice">No participant account is required. After registering you can add the event straight to your calendar.</p><p class="message" id="message" aria-live="polite"></p><button class="button" id="submit" type="submit">Submit registration</button></form><div id="confirmation" class="done" hidden aria-live="polite"><h3 id="doneTitle"></h3><p class="meta" id="doneEvent"></p><p class="when" id="doneWhen"></p><p id="doneText"></p><p class="join" id="doneJoin" hidden></p><p><a class="button" id="calendarLink" hidden>Add to calendar (.ics)</a></p></div><script>const EEG101_EVENT=${serialisedEvent};const form=document.getElementById('registrationForm'),message=document.getElementById('message'),submit=document.getElementById('submit');document.getElementById('privacyLink').href=EEG101_EVENT.privacy_url;(function(){function toggle(radioName,triggerValue,wrapId){var wrap=document.getElementById(wrapId);if(!wrap)return;var radios=form.querySelectorAll('input[name="'+radioName+'"]');function update(){var checked=form.querySelector('input[name="'+radioName+'"]:checked');wrap.hidden=!checked||checked.value!==triggerValue}radios.forEach(function(r){r.addEventListener('change',update)});update()}toggle('career_stage','Other','careerStageOtherWrap');toggle('gender','Prefer to self-describe','genderOtherWrap')})();function tellParent(result){try{window.top.postMessage({type:'eeg101-event-registration',ok:!!result.ok,status:result.status||'',message:result.message||result.error||''},'*')}catch(e){}}function showConfirmation(result){const waitlisted=result.status==='waitlisted';const box=document.getElementById('confirmation');box.className='done'+(waitlisted?' wait':'');document.getElementById('doneTitle').textContent=waitlisted?'You are on the waiting list':'You are booked';document.getElementById('doneEvent').textContent=result.title||EEG101_EVENT.title;document.getElementById('doneWhen').textContent=[result.when,result.location].filter(Boolean).join(' · ');document.getElementById('doneText').textContent=result.message||'';const join=document.getElementById('doneJoin');if(result.joining_link){join.textContent='Join online: ';const a=document.createElement('a');a.href=result.joining_link;a.textContent=result.joining_link;a.target='_blank';a.rel='noopener';join.appendChild(a);join.hidden=false}else if(result.link_note){join.textContent=result.link_note;join.hidden=false}const link=document.getElementById('calendarLink');if(result.ics){link.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(result.ics);link.download='eeg101-'+String(EEG101_EVENT.id).replace(/[^a-z0-9-]+/gi,'-')+'.ics';link.target='_self';link.hidden=false}form.hidden=true;box.hidden=false}form.addEventListener('submit',function(e){e.preventDefault();form.classList.add('tried');if(!form.checkValidity()){message.textContent='Please complete every field, and tick both consent boxes, before registering.';message.className='message error';form.reportValidity();return}const payload=Object.fromEntries(new FormData(form).entries());payload.event=EEG101_EVENT;submit.disabled=true;submit.textContent='Submitting…';message.textContent='';google.script.run.withSuccessHandler(function(result){result=result||{ok:true};showConfirmation(result);tellParent(result)}).withFailureHandler(function(error){const text=error&&error.message?error.message:'We could not submit the registration. Please try again.';message.textContent=text;message.className='message error';submit.disabled=false;submit.textContent='Submit registration';tellParent({ok:false,message:text})}).submitRegistration(payload)})</script></body></html>`;
}
