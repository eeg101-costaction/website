/*
 * EEG101 Grants: applications and review
 *
 * One Apps Script project, two web-app deployments of the same code:
 *
 *   1. Applications  Execute as: Me · Who has access: Anyone
 *      The step-by-step application form (Apply.html), embedded on
 *      www.eeg101.eu/grants/apply/. Applicants need no account. Each submission
 *      gets an ID, its own Drive folder (uploads plus a PDF of the application),
 *      a row in the "Applications" tab of the grants spreadsheet, and a
 *      confirmation email (cc the EEG101 address, bcc the people in the
 *      GRANTS_BCC script property) with the PDF attached.
 *
 *   2. Review        Execute as: User accessing the web app · Who has access:
 *                    Anyone with a Google account
 *      Open with ?view=review. Reviewers score applications; chairs rank them,
 *      select them for funding and run reports (Review.html). It runs as the
 *      signed-in reviewer, so it only works for people the spreadsheet and
 *      folder are shared with (run shareWithReviewers after editing the
 *      "Reviewers" tab), and every call checks the "Reviewers" tab as well.
 *
 * Set-up and day-to-day use: docs/grants-platform.md in the website repository.
 * Nothing private is in this file: the spreadsheet, folder, signing secret and
 * bcc addresses live in Script properties.
 */

const GRANTS = {
  name: 'EEG101 Grants',
  replyTo: 'eeg101costaction@gmail.com',
  cc: 'eeg101costaction@gmail.com',
  site: 'https://www.eeg101.eu',
  privacyUrl: 'https://www.eeg101.eu/privacy/',
  timezone: 'Europe/Brussels',
  maxFileBytes: 5 * 1024 * 1024,
  // Words, for the longer answers. Short fields have their own limits below.
  words: { summary: 200, workplan: 600, outcomes: 300, relevance: 300, benefit: 300, justification: 400 },
  // Defaults for the "Settings" tab, which the chair edits in the spreadsheet.
  defaults: {
    call_name: 'EEG101 Grant Period 2 call',
    call_open: 'FALSE',
    deadline: '',
    period_end: '2027-09-30',
    id_prefix: 'G2',
    budget_stsm: '',
    budget_vmg: '',
    budget_conference_inperson: '',
    budget_conference_online: ''
  }
};

// The funding mechanisms. Amounts and durations match _data/grants.yml on the
// website (the Grants page); change them in both places.
const SCHEMES = {
  stsm: {
    title: 'Short-Term Scientific Mission (STSM)', short: 'STSM', max: 4000, minDays: 5, maxDays: 90,
    blurb: 'A funded research visit to a host institution in the EEG101 network.',
    budget: ['Travel', 'Accommodation', 'Subsistence (meals, local transport)', 'Other'],
    documents: [
      { id: 'cv', label: 'Your CV (max. 2 pages)', required: true },
      { id: 'host_letter', label: 'Letter of support from the host, confirming the visit and its dates', required: true }
    ]
  },
  vmg: {
    title: 'Virtual Mobility Grant (VMG)', short: 'VMG', max: 1500, minDays: 1, maxDays: 90,
    blurb: 'Support for a virtual research collaboration with EEG101 network members.',
    budget: ['Virtual collaboration costs (e.g. software, data access, services)', 'Personnel time / coordination', 'Other'],
    documents: [
      { id: 'cv', label: 'Your CV (max. 2 pages)', required: true },
      { id: 'collaborator_letter', label: 'Letter of support from the collaborating organisation (required if a third party is involved)', required: false, requiredIf: 'third_party' }
    ]
  },
  conference_inperson: {
    title: 'Conference Grant (in person)', short: 'Conference Grant', max: 2500, minDays: 1, maxDays: 14,
    blurb: 'Support to attend and present at a scientific conference in person.',
    budget: ['Registration fee', 'Travel', 'Accommodation', 'Subsistence (meals, local transport)', 'Other'],
    documents: [
      { id: 'cv', label: 'Your CV (max. 2 pages)', required: true },
      { id: 'acceptance', label: 'Proof of abstract submission or acceptance', required: true }
    ]
  },
  conference_online: {
    title: 'Conference Grant (online)', short: 'Online Conference Grant', max: 500, minDays: 1, maxDays: 14,
    blurb: 'Support to register for and present at an online or hybrid conference.',
    budget: ['Registration fee', 'Other'],
    documents: [
      { id: 'cv', label: 'Your CV (max. 2 pages)', required: true },
      { id: 'acceptance', label: 'Proof of abstract submission or acceptance', required: true }
    ]
  }
};

// Inclusiveness Target Countries, as defined by COST. Check against
// https://www.cost.eu/about/members/ when a new call opens.
const ITC_COUNTRIES = ['Albania', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Estonia', 'Georgia', 'Greece', 'Hungary', 'Latvia', 'Lithuania', 'Malta', 'Moldova', 'Montenegro', 'North Macedonia', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Türkiye', 'Ukraine'];

// What reviewers score, each from 1 (poor) to 5 (excellent).
const CRITERIA = [
  { id: 'quality', label: 'Scientific quality and clarity of the plan' },
  { id: 'relevance', label: 'Relevance to EEG101 and its Working Groups' },
  { id: 'feasibility', label: 'Feasibility and value for money of the budget' },
  { id: 'impact', label: 'Benefit to the applicant and to the network (incl. inclusiveness)' }
];
const RECOMMENDATIONS = ['Fund', 'Fund if budget allows', 'Do not fund'];
const DECISIONS = ['', 'Funded', 'Reserve', 'Not funded', 'Withdrawn'];

const GENDER_OPTIONS = ['Male', 'Female', 'Beyond the binary (e.g. non-binary, intersex, agender, genderfluid)', 'Prefer to self-describe', 'Prefer not to say'];
const CAREER_STAGES = ['PhD student', 'Postdoctoral researcher', 'Lecturer / Assistant Professor / Early-career PI', 'Associate Professor / Mid-career researcher', 'Professor / Senior researcher', 'Industry / practitioner', 'Other'];
const WORKING_GROUPS = ['WG1 Reporting Standards', 'WG2 Curation and Harmonisation', 'WG3 EEG Community Framework', 'WG4 Mobile EEG Harmonisation'];
const YES_NO = ['Yes', 'No'];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Columns of the "Applications" tab, in order. Rows are written and read by
// header name, so the chair may add columns at the end without breaking anything.
const APPLICATION_COLUMNS = [
  'ID', 'Submitted', 'Status', 'Scheme', 'Title', 'First name', 'Last name', 'Email', 'Institution', 'Department',
  'Position', 'Country', 'ITC', 'Gender', 'Under 40 (YRI)', 'Early-career (PhD < 8 years or student)', 'Career stage',
  'EEG101 member', 'Working Groups', 'ORCID', 'Start date', 'End date', 'Days', 'Host / collaborator / conference',
  'Requested (€)', 'Eligibility notes', 'Drive folder', 'Application PDF', 'Documents',
  'Decision', 'Awarded (€)', 'Rank', 'Decision notes', 'Decided by', 'Decided at', 'Data'
];
const REVIEW_COLUMNS = ['Application ID', 'Reviewer', 'Conflict of interest'].concat(CRITERIA.map(c => c.label), ['Mean score', 'Recommendation', 'Comments', 'Updated']);
const REVIEWER_COLUMNS = ['Email', 'Name', 'Role (reviewer or chair)'];

/* ------------------------------------------------------------------ web app */

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.view === 'review') {
    const me = currentReviewer();
    if (!me) {
      return HtmlService.createHtmlOutput(
        '<p style="font-family:sans-serif;padding:24px">This page is for EEG101 grant reviewers. Sign in to Google with the account the grants spreadsheet was shared with. If you think you should have access, contact eeg101costaction@gmail.com.</p>'
      ).setTitle('EEG101 grant review');
    }
    const page = HtmlService.createTemplateFromFile('Review');
    page.boot = JSON.stringify({ me: me, criteria: CRITERIA, recommendations: RECOMMENDATIONS, decisions: DECISIONS, schemes: schemeSummaries() }).replace(/</g, '\\u003c');
    return page.evaluate().setTitle('EEG101 grant review').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const page = HtmlService.createTemplateFromFile('Apply');
  page.boot = JSON.stringify(applyConfig(String(params.scheme || ''))).replace(/</g, '\\u003c');
  return page.evaluate().setTitle('Apply for EEG101 funding').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function schemeSummaries() {
  const out = {};
  Object.keys(SCHEMES).forEach(id => { const s = SCHEMES[id]; out[id] = { title: s.title, short: s.short, max: s.max }; });
  return out;
}

function applyConfig(preselect) {
  const settings = readSettings();
  return {
    callName: settings.call_name,
    open: isCallOpen(settings),
    deadline: settings.deadline,
    deadlineText: settings.deadline ? formatDateTime(parseDeadline(settings.deadline)) : '',
    periodEnd: settings.period_end,
    periodEndText: formatDate(settings.period_end),
    today: Utilities.formatDate(new Date(), GRANTS.timezone, 'yyyy-MM-dd'),
    preselect: SCHEMES[preselect] ? preselect : '',
    schemes: SCHEMES,
    itc: ITC_COUNTRIES,
    countries: COUNTRIES,
    genders: GENDER_OPTIONS,
    careerStages: CAREER_STAGES,
    workingGroups: WORKING_GROUPS,
    words: GRANTS.words,
    maxFileMb: GRANTS.maxFileBytes / 1024 / 1024,
    privacyUrl: GRANTS.privacyUrl,
    contact: GRANTS.replyTo
  };
}

/* ----------------------------------------------------------------- settings */

function readSettings() {
  const sheet = tab('Settings');
  const values = sheet.getDataRange().getValues();
  const settings = Object.assign({}, GRANTS.defaults);
  values.slice(1).forEach(row => {
    const key = String(row[0] || '').trim();
    if (!key) return;
    const value = row[1];
    settings[key] = value instanceof Date ? Utilities.formatDate(value, GRANTS.timezone, key === 'deadline' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd') : String(value == null ? '' : value).trim();
  });
  return settings;
}

function isCallOpen(settings) {
  if (String(settings.call_open).toUpperCase() !== 'TRUE') return false;
  if (!settings.deadline) return true;
  const deadline = parseDeadline(settings.deadline);
  return !deadline || new Date() <= deadline;
}

// "2026-12-15T17:00" (or a date alone, meaning the end of that day), in Brussels time.
function parseDeadline(text) {
  const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const local = Utilities.parseDate(`${m[1]}-${m[2]}-${m[3]} ${m[4] || '23'}:${m[5] || '59'}`, GRANTS.timezone, 'yyyy-MM-dd HH:mm');
  return local;
}

function formatDate(iso) {
  if (!DATE_PATTERN.test(String(iso || ''))) return String(iso || '');
  return Utilities.formatDate(Utilities.parseDate(iso, 'UTC', 'yyyy-MM-dd'), 'UTC', 'd MMMM yyyy');
}

function formatDateTime(date) {
  return date ? Utilities.formatDate(date, GRANTS.timezone, "d MMMM yyyy, HH:mm 'Brussels time'") : '';
}

/* ------------------------------------------------------------------ uploads */

// Each file is uploaded on its own when the applicant picks it, into a staging
// folder. The reply carries a signed token, so a submission can only claim files
// that were uploaded through this form; the files move to the application's
// folder on submission, and leftovers are deleted after two days.
function uploadFile(upload) {
  if (!isCallOpen(readSettings())) throw new Error('This call is closed, so files can no longer be uploaded.');
  const name = String(upload && upload.name || '').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 120) || 'document.pdf';
  const data = String(upload && upload.data || '');
  if (!/\.pdf$/i.test(name)) throw new Error('Please upload a PDF file.');
  const bytes = Utilities.base64Decode(data);
  if (!bytes.length) throw new Error('The file is empty.');
  if (bytes.length > GRANTS.maxFileBytes) throw new Error(`The file is larger than ${GRANTS.maxFileBytes / 1024 / 1024} MB. Please reduce its size and try again.`);
  if (String.fromCharCode.apply(null, bytes.slice(0, 5).map(b => b & 255)) !== '%PDF-') throw new Error('That file is not a PDF. Please save it as PDF and try again.');
  const file = stagingFolder().createFile(Utilities.newBlob(bytes, 'application/pdf', name));
  return { id: file.getId(), name: name, size: bytes.length, token: sign(file.getId()) };
}

function sign(value) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('GRANTS_SIGNING_SECRET');
  if (!secret) { secret = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('GRANTS_SIGNING_SECRET', secret); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(value), secret));
}

function cleanStaging() {
  const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
  const files = stagingFolder().getFiles();
  while (files.hasNext()) { const f = files.next(); if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true); }
}

/* --------------------------------------------------------------- submission */

const clean = (value, max) => String(value == null ? '' : value).replace(/\s+$/g, '').trim().slice(0, max || 200);
const countWords = text => (String(text || '').trim().match(/\S+/g) || []).length;
const daysBetween = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000) + 1;

// Checks everything the form checks, again, on the server: the form can be
// bypassed, this cannot. Returns the cleaned application or throws a message
// written for the applicant.
function validateApplication(p, settings, today) {
  const fail = message => { throw new Error(message); };
  if (!p || typeof p !== 'object') fail('The application could not be read. Please try again.');
  if (p.website) fail('Your application could not be submitted.');
  const scheme = SCHEMES[p.scheme];
  if (!scheme) fail('Please choose a funding scheme.');
  const a = { scheme: p.scheme };

  ['first_name', 'last_name', 'institution', 'position'].forEach(key => { a[key] = clean(p[key], 150); if (!a[key]) fail('Please complete all the fields about you.'); });
  a.department = clean(p.department, 150);
  a.email = clean(p.email, 200).toLowerCase();
  if (!EMAIL_PATTERN.test(a.email)) fail('Please enter a valid email address.');
  a.country = clean(p.country, 100);
  if (COUNTRIES.indexOf(a.country) < 0) fail('Please choose the country of your institution from the list.');
  a.itc = ITC_COUNTRIES.indexOf(a.country) >= 0 ? 'Yes' : 'No';
  a.gender = clean(p.gender, 120);
  if (GENDER_OPTIONS.indexOf(a.gender) < 0) fail('Please choose a gender option (you can choose "Prefer not to say").');
  a.gender_other = a.gender === 'Prefer to self-describe' ? clean(p.gender_other, 100) : '';
  a.yri = clean(p.yri, 3); if (YES_NO.indexOf(a.yri) < 0) fail('Please say whether you are under 40.');
  a.eci = clean(p.eci, 3); if (YES_NO.indexOf(a.eci) < 0) fail('Please say whether you are an early-career researcher.');
  a.career_stage = clean(p.career_stage, 80); if (CAREER_STAGES.indexOf(a.career_stage) < 0) fail('Please choose your career stage.');
  a.member = clean(p.member, 3); if (a.member !== 'Yes') fail('Applicants must be members of the EEG101 COST Action. Please join through e-COST first (www.eeg101.eu/join/).');
  a.working_groups = (Array.isArray(p.working_groups) ? p.working_groups : []).map(String).filter(w => WORKING_GROUPS.indexOf(w) >= 0);
  a.orcid = clean(p.orcid, 40);
  if (a.orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(a.orcid.replace(/^https?:\/\/orcid\.org\//, ''))) fail('Please check your ORCID iD (it looks like 0000-0002-1825-0097), or leave it empty.');

  // Dates: inside the grant period, and the right length for the scheme.
  a.start_date = clean(p.start_date, 10); a.end_date = clean(p.end_date, 10);
  if (!DATE_PATTERN.test(a.start_date) || !DATE_PATTERN.test(a.end_date)) fail('Please give a start and end date.');
  if (a.start_date < today) fail('The start date cannot be in the past.');
  if (a.end_date < a.start_date) fail('The end date is before the start date.');
  if (a.end_date > settings.period_end) fail(`All activities must be completed by ${formatDate(settings.period_end)}. Please choose an end date on or before then.`);
  a.days = daysBetween(a.start_date, a.end_date);
  if (a.days < scheme.minDays || a.days > scheme.maxDays) fail(`A ${scheme.short} must last between ${scheme.minDays} and ${scheme.maxDays} days; yours is ${a.days}.`);

  // What the money is for.
  if (p.scheme === 'stsm') {
    ['host_institution', 'host_name', 'host_country'].forEach(k => { a[k] = clean(p[k], 150); if (!a[k]) fail('Please give the host institution, the host\'s name and the host country.'); });
    a.host_email = clean(p.host_email, 200).toLowerCase(); if (!EMAIL_PATTERN.test(a.host_email)) fail('Please give a valid email address for your host.');
    if (COUNTRIES.indexOf(a.host_country) < 0) fail('Please choose the host country from the list.');
    a.host_member = clean(p.host_member, 3); if (a.host_member !== 'Yes') fail('The academic lead at the host institution must be a member of EEG101. Please ask them to join before you apply.');
    a.activity = `Host: ${a.host_name}, ${a.host_institution} (${a.host_country})`;
  } else if (p.scheme === 'vmg') {
    a.collaborators = clean(p.collaborators, 1000); if (!a.collaborators) fail('Please list the people you will collaborate with and their institutions.');
    a.third_party = clean(p.third_party, 3); if (YES_NO.indexOf(a.third_party) < 0) fail('Please say whether a third-party organisation is involved.');
    a.third_party_member = a.third_party === 'Yes' ? clean(p.third_party_member, 3) : '';
    if (a.third_party === 'Yes' && a.third_party_member !== 'Yes') fail('The named lead at the collaborating organisation must be a member of EEG101. Please ask them to join before you apply.');
    a.activity = `Collaborators: ${a.collaborators}`.slice(0, 300);
  } else {
    ['conference_name', 'contribution_title'].forEach(k => { a[k] = clean(p[k], 250); if (!a[k]) fail('Please give the conference name and the title of your contribution.'); });
    a.conference_url = clean(p.conference_url, 300);
    if (a.conference_url && !/^https?:\/\/\S+$/i.test(a.conference_url)) fail('Please give the conference web address starting with https://, or leave it empty.');
    a.conference_location = p.scheme === 'conference_inperson' ? clean(p.conference_location, 150) : 'Online';
    if (!a.conference_location) fail('Please give the conference location.');
    a.presentation = clean(p.presentation, 40); if (['Oral presentation', 'Poster', 'Other contribution'].indexOf(a.presentation) < 0) fail('Please choose the type of contribution.');
    a.abstract_status = clean(p.abstract_status, 40); if (['Accepted', 'Submitted, awaiting decision'].indexOf(a.abstract_status) < 0) fail('Please say whether your abstract has been accepted.');
    a.activity = `${a.conference_name} (${a.conference_location}): ${a.presentation}, "${a.contribution_title}"`.slice(0, 300);
  }

  // The proposal.
  a.title = clean(p.title, 200); if (!a.title) fail('Please give your application a title.');
  [['summary', 'a short summary'], ['workplan', 'the work plan'], ['outcomes', 'the expected outcomes'], ['relevance', 'the relevance to EEG101'], ['benefit', 'the benefit to you and the network']].forEach(([k, what]) => {
    a[k] = clean(p[k], 8000);
    if (!a[k]) fail(`Please describe ${what}.`);
    if (countWords(a[k]) > GRANTS.words[k]) fail(`Please shorten ${what} to ${GRANTS.words[k]} words or fewer.`);
  });

  // The budget: every line in a category this scheme allows, a positive amount,
  // and a total within the scheme's maximum.
  const lines = Array.isArray(p.budget) ? p.budget : [];
  a.budget = lines.map(l => ({ category: clean(l && l.category, 80), description: clean(l && l.description, 300), amount: Math.round(Number(l && l.amount) * 100) / 100 }))
    .filter(l => l.category || l.description || l.amount);
  if (!a.budget.length) fail('Please add at least one budget line.');
  a.budget.forEach(l => {
    if (scheme.budget.indexOf(l.category) < 0) fail('Please choose a category for every budget line.');
    if (!l.description) fail('Please describe every budget line.');
    if (!(l.amount > 0) || l.amount > scheme.max) fail('Every budget line needs an amount in euros.');
  });
  a.total = Math.round(a.budget.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  if (a.total > scheme.max) fail(`The total requested (€${a.total.toFixed(2)}) is more than the maximum for a ${scheme.short} (€${scheme.max}).`);
  a.justification = clean(p.justification, 8000);
  if (!a.justification) fail('Please justify the costs you are asking for.');
  if (countWords(a.justification) > GRANTS.words.justification) fail(`Please shorten the cost justification to ${GRANTS.words.justification} words or fewer.`);

  // Documents: each one uploaded through this form (signed token), and every
  // required one present.
  a.documents = {};
  const docs = (p.documents && typeof p.documents === 'object') ? p.documents : {};
  scheme.documents.forEach(d => {
    const doc = docs[d.id];
    const needed = d.required || (d.requiredIf && a[d.requiredIf] === 'Yes');
    if (doc && doc.id) {
      if (doc.token !== sign(doc.id)) fail('One of the uploaded files could not be verified. Please upload it again.');
      a.documents[d.id] = { id: String(doc.id), name: clean(doc.name, 120), label: d.label };
    } else if (needed) {
      fail(`Please upload: ${d.label}.`);
    }
  });

  if (!p.confirm_accurate || !p.confirm_privacy || !p.confirm_rules) fail('Please tick all three declarations before submitting.');
  a.signature = clean(p.signature, 150);
  if (!a.signature) fail('Please type your full name as your signature.');

  // Things reviewers should know, but that do not block an application.
  const notes = [];
  if (p.scheme.indexOf('conference') === 0 && a.eci !== 'Yes' && a.itc !== 'Yes') notes.push('Conference grants are for early-career researchers and researchers based in ITC countries; the applicant reports neither.');
  if (p.scheme.indexOf('conference') === 0 && a.abstract_status !== 'Accepted') notes.push('Abstract not yet accepted.');
  a.eligibility_notes = notes.join(' ');
  return a;
}

function submitApplication(payload) {
  const settings = readSettings();
  if (!isCallOpen(settings)) throw new Error('This call is closed, so applications can no longer be submitted.');
  const today = Utilities.formatDate(new Date(), GRANTS.timezone, 'yyyy-MM-dd');
  const a = validateApplication(payload, settings, today);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let id, folder, pdfBlob;
  try {
    const sheet = tab('Applications');
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const prefix = `EEG101-${settings.id_prefix || 'G'}-`;
    const next = ids.filter(x => x.indexOf(prefix) === 0).map(x => Number(x.slice(prefix.length)) || 0).reduce((m, n) => Math.max(m, n), 0) + 1;
    id = prefix + String(next).padStart(3, '0');
    a.id = id;
    a.submitted = new Date();
    a.submitted_text = formatDateTime(a.submitted);
    a.call_name = settings.call_name;

    folder = rootFolder().createFolder(`${id} – ${a.last_name}, ${a.first_name} – ${SCHEMES[a.scheme].short}`);
    Object.keys(a.documents).forEach(key => {
      const doc = a.documents[key];
      const file = DriveApp.getFileById(doc.id);
      file.moveTo(folder);
      file.setName(`${id} – ${doc.label.split(' (')[0].split(',')[0]} – ${doc.name}`.slice(0, 200));
      doc.url = file.getUrl();
    });
    pdfBlob = applicationPdf(a);
    const pdf = folder.createFile(pdfBlob.copyBlob()).setName(`${id} – Application.pdf`);
    a.pdf_url = pdf.getUrl();
    a.folder_url = folder.getUrl();
    appendRow(sheet, APPLICATION_COLUMNS, applicationRow(a));
  } finally {
    lock.releaseLock();
  }

  // The application is saved. The email is attempted but never undoes that.
  let emailed = false;
  try { sendConfirmation(a, pdfBlob.copyBlob()); emailed = true; }
  catch (error) { console.warn(`Confirmation email for ${id} not sent: ${error}`); }

  return {
    ok: true, id: id, emailed: emailed, email: a.email, submitted: a.submitted_text,
    pdf: Utilities.base64Encode(pdfBlob.getBytes()),
    html: applicationHtml(a)
  };
}

function applicationRow(a) {
  const scheme = SCHEMES[a.scheme];
  const data = Object.assign({}, a);
  delete data.submitted;
  return {
    'ID': a.id, 'Submitted': a.submitted, 'Status': 'Submitted', 'Scheme': scheme.short, 'Title': a.title,
    'First name': a.first_name, 'Last name': a.last_name, 'Email': a.email, 'Institution': a.institution, 'Department': a.department,
    'Position': a.position, 'Country': a.country, 'ITC': a.itc, 'Gender': a.gender_other ? `${a.gender}: ${a.gender_other}` : a.gender,
    'Under 40 (YRI)': a.yri, 'Early-career (PhD < 8 years or student)': a.eci, 'Career stage': a.career_stage,
    'EEG101 member': a.member, 'Working Groups': a.working_groups.join(', '), 'ORCID': a.orcid,
    'Start date': a.start_date, 'End date': a.end_date, 'Days': a.days, 'Host / collaborator / conference': a.activity,
    'Requested (€)': a.total, 'Eligibility notes': a.eligibility_notes, 'Drive folder': a.folder_url, 'Application PDF': a.pdf_url,
    'Documents': Object.keys(a.documents).map(k => `${a.documents[k].label.split(' (')[0]}: ${a.documents[k].url}`).join('\n'),
    'Data': JSON.stringify(data)
  };
}

/* ------------------------------------------------------- PDF, copy and email */

function esc(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const para = text => esc(text).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

// The application as one self-contained HTML document: the PDF, the email and
// the applicant's downloadable copy are all made from this.
function applicationHtml(a) {
  const s = SCHEMES[a.scheme];
  const row = (k, v) => v === '' || v == null ? '' : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const section = (title, body) => `<h2>${esc(title)}</h2>${body}`;
  const specifics = a.scheme === 'stsm'
    ? row('Host', `${a.host_name} (${a.host_email})`) + row('Host institution', `${a.host_institution}, ${a.host_country}`) + row('Host is an EEG101 member', a.host_member)
    : a.scheme === 'vmg'
      ? row('Collaborators', a.collaborators) + row('Third-party organisation involved', a.third_party) + row('Third-party lead is an EEG101 member', a.third_party_member)
      : row('Conference', a.conference_name) + row('Web address', a.conference_url) + row('Location', a.conference_location) + row('Contribution', `${a.presentation}: ${a.contribution_title}`) + row('Abstract', a.abstract_status);
  const budget = `<table class="budget"><thead><tr><th>Category</th><th>Description</th><th class="num">€</th></tr></thead><tbody>${a.budget.map(l => `<tr><td>${esc(l.category)}</td><td>${esc(l.description)}</td><td class="num">${l.amount.toFixed(2)}</td></tr>`).join('')}<tr class="total"><td colspan="2">Total requested (maximum €${s.max})</td><td class="num">${a.total.toFixed(2)}</td></tr></tbody></table>`;
  const docs = Object.keys(a.documents).map(k => `<li>${esc(a.documents[k].label)}: ${esc(a.documents[k].name)}</li>`).join('') || '<li>None</li>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.id)} – ${esc(a.title)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a2e;line-height:1.45;margin:28px}
h1{color:#000099;font-size:18pt;margin:0 0 4px}h2{color:#000099;font-size:12.5pt;border-bottom:2px solid #FFCC00;padding-bottom:3px;margin:22px 0 8px}
.meta{color:#5a5a7a;margin:0 0 4px}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:4px 8px;border-bottom:1px solid #e0dbd4}
th{width:34%;color:#5a5a7a;font-weight:normal}.budget th{width:auto;font-weight:bold;color:#1a1a2e}.num{text-align:right;white-space:nowrap}.total td{font-weight:bold;border-top:2px solid #1a1a2e}
p{margin:0 0 8px}h3{font-size:11pt;margin:14px 0 4px}</style></head><body>
<h1>${esc(a.title)}</h1>
<p class="meta"><strong>${esc(a.id)}</strong> · ${esc(s.title)} · ${esc(a.call_name)}</p>
<p class="meta">Submitted ${esc(a.submitted_text)} by ${esc(a.first_name)} ${esc(a.last_name)}</p>
${section('Applicant', `<table>${row('Name', `${a.first_name} ${a.last_name}`)}${row('Email', a.email)}${row('Position', a.position)}${row('Institution', [a.department, a.institution].filter(Boolean).join(', '))}${row('Country', `${a.country}${a.itc === 'Yes' ? ' (ITC)' : ''}`)}${row('ORCID', a.orcid)}${row('Career stage', a.career_stage)}${row('Under 40 (YRI)', a.yri)}${row('Early-career researcher', a.eci)}${row('Gender', a.gender_other ? `${a.gender}: ${a.gender_other}` : a.gender)}${row('EEG101 member', a.member)}${row('Working Groups', a.working_groups.join(', '))}</table>`)}
${section('Activity', `<table>${row('Dates', `${formatDate(a.start_date)} to ${formatDate(a.end_date)} (${a.days} day${a.days === 1 ? '' : 's'})`)}${specifics}</table>`)}
${section('Proposal', `<h3>Summary</h3>${para(a.summary)}<h3>Work plan</h3>${para(a.workplan)}<h3>Expected outcomes</h3>${para(a.outcomes)}<h3>Relevance to EEG101</h3>${para(a.relevance)}<h3>Benefit to the applicant and the network</h3>${para(a.benefit)}`)}
${section('Budget', budget + `<h3>Justification of costs</h3>${para(a.justification)}`)}
${section('Documents', `<ul>${docs}</ul>`)}
${section('Declaration', `<p>The applicant confirmed that the information is accurate, that they have read the privacy notice, and that they will follow the COST rules for this grant. Signed: ${esc(a.signature)}.</p>`)}
</body></html>`;
}

function applicationPdf(a) {
  return Utilities.newBlob(applicationHtml(a), 'text/html', `${a.id}.html`).getAs('application/pdf').setName(`${a.id} – Application.pdf`);
}

function sendConfirmation(a, pdf) {
  const s = SCHEMES[a.scheme];
  const bcc = String(PropertiesService.getScriptProperties().getProperty('GRANTS_BCC') || '').split(',').map(x => x.trim()).filter(x => EMAIL_PATTERN.test(x));
  const text = [
    `Dear ${a.first_name},`,
    `Thank you for applying for EEG101 funding. We have received your application.`,
    `Reference: ${a.id}\nScheme: ${s.title}\nTitle: ${a.title}\nDates: ${formatDate(a.start_date)} to ${formatDate(a.end_date)}\nAmount requested: €${a.total.toFixed(2)}\nSubmitted: ${a.submitted_text}`,
    'A PDF copy of your application is attached. Please quote your reference if you contact us about it.',
    'Your application will be reviewed after the call closes, and we will let you know the outcome by email. If you need to correct anything, reply to this email.',
    'With best wishes,\nThe EEG101 Grants team\nCOST Action CA24148'
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a2e">${text.map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
  MailApp.sendEmail({
    to: a.email, cc: GRANTS.cc, bcc: bcc.join(','), replyTo: GRANTS.replyTo, name: GRANTS.name,
    subject: `EEG101 application received: ${a.id} – ${a.title}`.slice(0, 250),
    body: text.join('\n\n'), htmlBody: html, attachments: [pdf || applicationPdf(a)]
  });
}

/* ------------------------------------------------------------------ storage */

function tab(name) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('GRANTS_SHEET_ID');
  if (!id) throw new Error('The grants spreadsheet is not set up yet. Run setUpGrants in the Apps Script editor.');
  const book = SpreadsheetApp.openById(id);
  const sheet = book.getSheetByName(name);
  if (!sheet) throw new Error(`The grants spreadsheet has no "${name}" tab. Run setUpGrants again to add it.`);
  return sheet;
}

function rootFolder() {
  const id = PropertiesService.getScriptProperties().getProperty('GRANTS_FOLDER_ID');
  if (!id) throw new Error('The grants folder is not set up yet. Run setUpGrants in the Apps Script editor.');
  return DriveApp.getFolderById(id);
}

function stagingFolder() {
  const root = rootFolder();
  const found = root.getFoldersByName('_uploads in progress');
  return found.hasNext() ? found.next() : root.createFolder('_uploads in progress');
}

function headerMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return { headers: headers, map: map };
}

function appendRow(sheet, columns, values) {
  const { headers } = headerMap(sheet);
  sheet.appendRow(headers.map(h => values[h] === undefined ? '' : values[h]));
}

function rowsAsObjects(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const { headers } = headerMap(sheet);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map((row, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = row[j]; });
    return o;
  });
}

// Run once from the Apps Script editor (choose setUpGrants, press Run). Creates
// the spreadsheet and Drive folder, or adds anything missing to existing ones.
function setUpGrants() {
  const props = PropertiesService.getScriptProperties();
  let book;
  if (props.getProperty('GRANTS_SHEET_ID')) book = SpreadsheetApp.openById(props.getProperty('GRANTS_SHEET_ID'));
  else { book = SpreadsheetApp.create('EEG101 Grant Applications'); props.setProperty('GRANTS_SHEET_ID', book.getId()); }
  if (!props.getProperty('GRANTS_FOLDER_ID')) props.setProperty('GRANTS_FOLDER_ID', DriveApp.createFolder('EEG101 Grant Applications').getId());

  const ensure = (name, columns) => {
    let sheet = book.getSheetByName(name);
    if (!sheet) sheet = book.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold').setBackground('#e8e8ff');
      sheet.setFrozenRows(1);
    }
    return sheet;
  };
  const apps = ensure('Applications', APPLICATION_COLUMNS);
  apps.hideColumns(APPLICATION_COLUMNS.indexOf('Data') + 1);
  ensure('Reviews', REVIEW_COLUMNS);
  const reviewers = ensure('Reviewers', REVIEWER_COLUMNS);
  if (reviewers.getLastRow() === 1) reviewers.appendRow([Session.getEffectiveUser().getEmail(), 'Grants chair', 'chair']);
  const settings = ensure('Settings', ['Setting', 'Value', 'What it means']);
  const help = {
    call_name: 'Shown on the form and in emails.',
    call_open: 'TRUE to accept applications, FALSE to close the form.',
    deadline: 'Closing time in Brussels time, e.g. 2026-12-15T17:00. The form closes by itself after it. Empty: open until call_open is FALSE.',
    period_end: 'Every activity must end on or before this date (YYYY-MM-DD).',
    id_prefix: 'Middle part of application IDs, e.g. G2 gives EEG101-G2-001.',
    budget_stsm: 'Optional: money available for STSMs in this call, for the budget tracker (€).',
    budget_vmg: 'Optional: money available for VMGs (€).',
    budget_conference_inperson: 'Optional: money available for in-person Conference Grants (€).',
    budget_conference_online: 'Optional: money available for online Conference Grants (€).'
  };
  const existing = settings.getDataRange().getValues().map(r => String(r[0]));
  Object.keys(GRANTS.defaults).forEach(key => { if (existing.indexOf(key) < 0) settings.appendRow([key, GRANTS.defaults[key], help[key] || '']); });
  settings.getRange('B:B').setNumberFormat('@');
  const blank = book.getSheetByName('Sheet1');
  if (blank && book.getSheets().length > 1) book.deleteSheet(blank);

  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'cleanStaging').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('cleanStaging').timeBased().everyDays(1).create();
  console.log('Spreadsheet: ' + book.getUrl());
  console.log('Folder: ' + rootFolder().getUrl());
}

// Run after adding people to the "Reviewers" tab: gives them edit access to the
// spreadsheet and view access to the applications folder, which the review page
// needs because it runs as the reviewer.
function shareWithReviewers() {
  const book = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('GRANTS_SHEET_ID'));
  const folder = rootFolder();
  reviewerList().forEach(r => {
    try { book.addEditor(r.email); folder.addViewer(r.email); console.log('Shared with ' + r.email); }
    catch (error) { console.warn(`Could not share with ${r.email}: ${error}`); }
  });
}

/* ------------------------------------------------------------------- review */

function reviewerList() {
  return rowsAsObjects(tab('Reviewers')).map(r => ({
    email: String(r['Email'] || '').trim().toLowerCase(),
    name: String(r['Name'] || '').trim(),
    chair: /chair/i.test(String(r['Role (reviewer or chair)'] || ''))
  })).filter(r => EMAIL_PATTERN.test(r.email));
}

// The signed-in reviewer, or null. In the review deployment the script runs as
// the person using it, so this is their own account.
function currentReviewer() {
  let email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (error) { email = ''; }
  if (!email) return null;
  try { return reviewerList().filter(r => r.email === email)[0] || null; } catch (error) { return null; }
}

function requireReviewer(chairOnly) {
  const me = currentReviewer();
  if (!me) throw new Error('You are not on the list of EEG101 grant reviewers.');
  if (chairOnly && !me.chair) throw new Error('Only a grants chair can do this.');
  return me;
}

const asNumber = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const iso = v => v instanceof Date ? Utilities.formatDate(v, GRANTS.timezone, 'yyyy-MM-dd') : String(v || '');

function reviewsByApplication() {
  const out = {};
  rowsAsObjects(tab('Reviews')).forEach(r => {
    const id = String(r['Application ID']);
    (out[id] = out[id] || []).push({
      row: r._row, reviewer: String(r['Reviewer']).toLowerCase(), conflict: String(r['Conflict of interest']) === 'Yes',
      scores: CRITERIA.map(c => asNumber(r[c.label])), mean: asNumber(r['Mean score']),
      recommendation: String(r['Recommendation'] || ''), comments: String(r['Comments'] || ''), updated: iso(r['Updated'])
    });
  });
  return out;
}

// Everything the dashboard lists. A reviewer sees others' scores for an
// application only after scoring it (or declaring a conflict) themselves; chairs
// see everything.
function listApplications() {
  const me = requireReviewer(false);
  const reviews = reviewsByApplication();
  const apps = rowsAsObjects(tab('Applications')).map(r => {
    const id = String(r['ID']);
    const all = reviews[id] || [];
    const mine = all.filter(x => x.reviewer === me.email)[0] || null;
    const scored = all.filter(x => !x.conflict && x.mean != null);
    const canSee = me.chair || !!mine;
    return {
      id: id, submitted: iso(r['Submitted']), scheme: String(r['Scheme']), title: String(r['Title']),
      applicant: `${r['First name']} ${r['Last name']}`, institution: String(r['Institution']), country: String(r['Country']), itc: String(r['ITC']),
      gender: String(r['Gender']), yri: String(r['Under 40 (YRI)']), eci: String(r['Early-career (PhD < 8 years or student)']), career: String(r['Career stage']),
      start: iso(r['Start date']), end: iso(r['End date']), days: asNumber(r['Days']),
      requested: asNumber(r['Requested (€)']), notes: String(r['Eligibility notes'] || ''),
      folder: String(r['Drive folder']), pdf: String(r['Application PDF']),
      decision: String(r['Decision'] || ''), awarded: asNumber(r['Awarded (€)']), rank: asNumber(r['Rank']), decisionNotes: String(r['Decision notes'] || ''),
      reviewCount: scored.length,
      mean: canSee && scored.length ? Math.round(scored.reduce((s, x) => s + x.mean, 0) / scored.length * 100) / 100 : null,
      mine: mine, others: canSee ? all.filter(x => x.reviewer !== me.email) : []
    };
  });
  return { me: me, applications: apps, settings: readSettings() };
}

function getApplication(id) {
  requireReviewer(false);
  const r = rowsAsObjects(tab('Applications')).filter(x => String(x['ID']) === String(id))[0];
  if (!r) throw new Error('Application not found.');
  const data = JSON.parse(String(r['Data'] || '{}'));
  return { id: String(id), html: applicationHtml(Object.assign(data, { submitted_text: data.submitted_text || iso(r['Submitted']) })), folder: String(r['Drive folder']), pdf: String(r['Application PDF']), documents: data.documents || {} };
}

function saveReview(input) {
  const me = requireReviewer(false);
  const id = String(input && input.id || '');
  if (!rowsAsObjects(tab('Applications')).some(r => String(r['ID']) === id)) throw new Error('Application not found.');
  const conflict = !!input.conflict;
  const scores = CRITERIA.map((c, i) => conflict ? '' : Number(input.scores && input.scores[i]));
  if (!conflict && scores.some(s => !(s >= 1 && s <= 5 && Math.round(s) === s))) throw new Error('Please give every criterion a score from 1 to 5.');
  const recommendation = conflict ? '' : String(input.recommendation || '');
  if (!conflict && RECOMMENDATIONS.indexOf(recommendation) < 0) throw new Error('Please choose a recommendation.');
  const mean = conflict ? '' : Math.round(scores.reduce((s, x) => s + x, 0) / scores.length * 100) / 100;
  const values = { 'Application ID': id, 'Reviewer': me.email, 'Conflict of interest': conflict ? 'Yes' : 'No', 'Mean score': mean, 'Recommendation': recommendation, 'Comments': String(input.comments || '').slice(0, 5000), 'Updated': new Date() };
  CRITERIA.forEach((c, i) => { values[c.label] = scores[i]; });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = tab('Reviews');
    const existing = (reviewsByApplication()[id] || []).filter(x => x.reviewer === me.email)[0];
    if (existing) {
      const { headers } = headerMap(sheet);
      sheet.getRange(existing.row, 1, 1, headers.length).setValues([headers.map(h => values[h] === undefined ? '' : values[h])]);
    } else {
      appendRow(sheet, REVIEW_COLUMNS, values);
    }
    if (!conflict) markStatus(id, 'Under review');
  } finally {
    lock.releaseLock();
  }
  return listApplications();
}

function markStatus(id, status) {
  const sheet = tab('Applications');
  const { map } = headerMap(sheet);
  const r = rowsAsObjects(sheet).filter(x => String(x['ID']) === id)[0];
  if (r && String(r['Status']) === 'Submitted') sheet.getRange(r._row, map['Status'] + 1).setValue(status);
}

// Chair only: decision, amount awarded and rank for one or more applications.
function saveDecisions(changes) {
  const me = requireReviewer(true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = tab('Applications');
    const { map } = headerMap(sheet);
    const rows = rowsAsObjects(sheet);
    (Array.isArray(changes) ? changes : []).forEach(change => {
      const r = rows.filter(x => String(x['ID']) === String(change.id))[0];
      if (!r) throw new Error(`Application ${change.id} not found.`);
      const decision = String(change.decision || '');
      if (DECISIONS.indexOf(decision) < 0) throw new Error('Unknown decision.');
      const requested = asNumber(r['Requested (€)']) || 0;
      let awarded = change.awarded === '' || change.awarded == null ? '' : Math.round(Number(change.awarded) * 100) / 100;
      if (decision === 'Funded' && awarded === '') awarded = requested;
      if (awarded !== '' && (!(awarded >= 0) || awarded > requested)) throw new Error(`The amount awarded to ${change.id} must be between €0 and the €${requested} requested.`);
      const rank = change.rank === '' || change.rank == null ? '' : Math.max(1, Math.round(Number(change.rank)));
      const set = (header, value) => sheet.getRange(r._row, map[header] + 1).setValue(value);
      set('Decision', decision);
      set('Awarded (€)', decision === 'Funded' ? awarded : '');
      set('Rank', rank);
      set('Decision notes', String(change.notes || '').slice(0, 2000));
      set('Decided by', me.email);
      set('Decided at', new Date());
      set('Status', decision || (String(r['Status']) === 'Submitted' ? 'Submitted' : 'Under review'));
    });
  } finally {
    lock.releaseLock();
  }
  return listApplications();
}

// Totals for the reports page: by scheme, month, gender, ITC, YRI, career stage
// and country, for everything submitted and for what was funded.
function getReport() {
  requireReviewer(false);
  const apps = rowsAsObjects(tab('Applications'));
  const settings = readSettings();
  const funded = apps.filter(r => String(r['Decision']) === 'Funded');
  const group = (rows, keyFn, valueFn) => {
    const out = {};
    rows.forEach(r => { const k = keyFn(r) || 'Not stated'; out[k] = out[k] || { count: 0, amount: 0 }; out[k].count += 1; out[k].amount += valueFn ? (valueFn(r) || 0) : 0; });
    return Object.keys(out).sort().map(k => ({ key: k, count: out[k].count, amount: Math.round(out[k].amount * 100) / 100 }));
  };
  const awarded = r => asNumber(r['Awarded (€)']) || 0;
  const requested = r => asNumber(r['Requested (€)']) || 0;
  const month = r => iso(r['Start date']).slice(0, 7);
  const schemeBudget = {};
  Object.keys(SCHEMES).forEach(id => { schemeBudget[SCHEMES[id].short] = asNumber(settings['budget_' + id]); });
  return {
    generated: formatDateTime(new Date()), callName: settings.call_name,
    totals: { submitted: apps.length, requested: Math.round(apps.reduce((s, r) => s + requested(r), 0) * 100) / 100, funded: funded.length, awarded: Math.round(funded.reduce((s, r) => s + awarded(r), 0) * 100) / 100 },
    byScheme: { submitted: group(apps, r => String(r['Scheme']), requested), funded: group(funded, r => String(r['Scheme']), awarded), budget: schemeBudget },
    byMonth: group(funded, month, awarded),
    byGender: { submitted: group(apps, r => String(r['Gender'])), funded: group(funded, r => String(r['Gender']), awarded) },
    byItc: { submitted: group(apps, r => String(r['ITC'])), funded: group(funded, r => String(r['ITC']), awarded) },
    byYri: { submitted: group(apps, r => String(r['Under 40 (YRI)'])), funded: group(funded, r => String(r['Under 40 (YRI)']), awarded) },
    byCareer: { submitted: group(apps, r => String(r['Career stage'])), funded: group(funded, r => String(r['Career stage']), awarded) },
    byCountry: { submitted: group(apps, r => String(r['Country'])), funded: group(funded, r => String(r['Country']), awarded) },
    fundedList: funded.map(r => ({ id: String(r['ID']), applicant: `${r['First name']} ${r['Last name']}`, scheme: String(r['Scheme']), title: String(r['Title']), start: iso(r['Start date']), end: iso(r['End date']), awarded: awarded(r), country: String(r['Country']) }))
      .sort((x, y) => x.start < y.start ? -1 : 1)
  };
}

/* ------------------------------------------------------------- shared lists */

// Country and territory names in British English, as in the event booking form.
const COUNTRIES = ["Afghanistan", "Åland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "British Virgin Islands", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Caribbean Netherlands", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Cook Islands", "Costa Rica", "Côte d’Ivoire", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Falkland Islands", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard and McDonald Islands", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "North Korea", "North Macedonia", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn Islands", "Poland", "Portugal", "Puerto Rico", "Qatar", "Réunion", "Romania", "Russia", "Rwanda", "Saint Barthélemy", "Saint Helena", "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Sint Maarten", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and South Sandwich Islands", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands", "Uruguay", "US Virgin Islands", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"];
