/*
 * EEG101 Grants: applications and review
 *
 * One Apps Script project with one web-app deployment
 * (Execute as: Me · Who has access: Anyone) serving two pages:
 *
 *   1. Applications  The step-by-step application form (Apply.html), embedded on
 *      www.eeg101.eu/grants/apply/. Applicants need no account. Each submission
 *      gets an ID, its own Drive folder (uploads plus a PDF of the application),
 *      a row in the "Applications" tab of the grants spreadsheet, and a
 *      confirmation email (cc the EEG101 address, bcc the people in the
 *      GRANTS_BCC script property) with the PDF attached.
 *
 *   2. Review        Opened with ?view=review&key=… .
 *      Each person in the "Reviewers" tab has a personal key; run
 *      sendReviewerLinks to email them their link. Reviewers score
 *      applications; chairs (who may score too) rank them, decide on funding
 *      and run reports (Review.html). Reviewers who are not chairs see
 *      applications without the applicant's identity unless the Settings tab
 *      says blind_review FALSE. Every call checks the key again.
 *
 * Set-up and day-to-day use: docs/grants-platform.md in the website repository.
 * Nothing private is in this file: the spreadsheet, folder, signing secret and
 * bcc addresses live in Script properties, and reviewers' keys in the sheet.
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
    blind_review: 'TRUE',
    web_app_url: '',
    budget_stsm: '',
    budget_vmg: '',
    budget_itc_conference: '',
    budget_yri_conference: '',
    budget_dissemination_conference: ''
  }
};

// The funding mechanisms, following the COST Annotated Rules for COST Actions
// (level C, version 4.0), Annex 2. Amounts and durations match
// _data/grants.yml on the website (the Grants page); change them in both places.
//
// questions: the proposal questions each scheme asks, using the answer fields
// summary, workplan, outcomes, relevance and benefit (word limits in GRANTS.words).
const CV = { id: 'cv', label: 'Your CV (max. 2 pages)', required: true };
const ACCEPTANCE = { id: 'acceptance', label: 'Acceptance or invitation letter from the conference organisers (or proof of submission if you are still waiting)', required: true };
const TRAVEL_BUDGET = ['Travel', 'Accommodation', 'Subsistence (meals, local transport)', 'Other'];
const CONFERENCE_RULES = [
  'The conference must be a high-level one organised entirely by others, not by EEG101 or another COST Action.',
  'Up to €2,500 to attend in person, or €500 to attend online.',
  'You can hold only one type of conference grant in a grant period.'
];
const SCHEMES = {
  stsm: {
    kind: 'stsm', title: 'Short-Term Scientific Mission (STSM)', short: 'STSM', max: 4000, minDays: 5, maxDays: 90,
    blurb: 'A research visit to a host institution in another country, for specific work agreed with the host.',
    who: 'Members at an institution in a COST Full or Cooperating Member country or a Near Neighbour Country.',
    rules: [
      'The host institution must be in a different country from your own institution.',
      'The academic lead at the host must be an EEG101 member.',
      'You can ask for up to 50% of the grant to be paid before the visit.'
    ],
    questions: [
      { id: 'summary', label: 'Goals of the mission', hint: 'What you want to achieve, in a few sentences.' },
      { id: 'workplan', label: 'Work to be carried out', hint: 'What you will do at the host, and when.' },
      { id: 'outcomes', label: 'Expected outcomes', hint: 'Papers, data, code, training, new collaborations…' },
      { id: 'relevance', label: 'Contribution to the EEG101 objectives', hint: 'How the mission helps the Action meet the objectives in its Memorandum of Understanding, and which Working Group it supports.' },
      { id: 'benefit', label: 'Benefit to you, the host and the network', hint: 'For your career, your host and the EEG101 community, including inclusiveness.' }
    ],
    budget: TRAVEL_BUDGET,
    documents: [CV, { id: 'host_letter', label: 'Confirmation from the host institution that it will receive you, with the dates (e-COST has a template)', required: true }]
  },
  vmg: {
    kind: 'vmg', title: 'Virtual Mobility Grant (VMG)', short: 'VMG', max: 1500, minDays: 1, maxDays: 90,
    blurb: 'An online collaboration with EEG101 members: sharing knowledge, harmonising methods, mentoring, shared analysis.',
    who: 'Members at an institution in a COST Full or Cooperating Member country or a Near Neighbour Country.',
    rules: [
      'Not for tasks that are part of a leadership role in EEG101 (for example Grant Awarding Coordinator).',
      'If a third-party organisation is involved, its named lead must be an EEG101 member.'
    ],
    questions: [
      { id: 'summary', label: 'Main objective', hint: 'What the collaboration will achieve, in a few sentences.' },
      { id: 'workplan', label: 'Work to be carried out and plan for participation', hint: 'Activities, who takes part, how you will work together online, and when.' },
      { id: 'outcomes', label: 'Expected outcomes', hint: 'Protocols, surveys, data, code, training, publications…' },
      { id: 'relevance', label: 'Contribution to the EEG101 objectives', hint: 'How the work helps the Action meet the objectives in its Memorandum of Understanding, and which Working Group it supports.' }
    ],
    budget: ['Your own time and effort on the activity', 'Software, data access or services', 'Other'],
    documents: [CV, { id: 'collaborator_letter', label: 'Letter of support from the collaborating organisation (required if a third party is involved)', required: false, requiredIf: 'third_party' }]
  },
  itc_conference: {
    kind: 'conference', title: 'ITC Conference Grant', short: 'ITC Conference Grant', max: 2500, maxOnline: 500, minDays: 1, maxDays: 14,
    blurb: 'An oral presentation of your own work, within the scope of EEG101, at a high-level conference.',
    who: 'Members at an institution in an Inclusiveness Target Country (ITC) or a Near Neighbour Country.',
    rules: ['Oral presentations only.'].concat(CONFERENCE_RULES),
    presentations: ['Oral presentation'],
    questions: [
      { id: 'summary', label: 'Your presentation', hint: 'What you will present, in a few sentences (or paste your abstract).' },
      { id: 'relevance', label: 'Relevance of the conference topic to EEG101', hint: 'Why this conference matters for the Action\'s work.' },
      { id: 'benefit', label: 'Motivation and benefit to your career', hint: 'How presenting here could help your career and your research.' }
    ],
    budget: ['Registration fee'].concat(TRAVEL_BUDGET), budgetOnline: ['Registration fee', 'Other'],
    documents: [CV, ACCEPTANCE]
  },
  yri_conference: {
    kind: 'conference', title: 'YRI Conference Grant', short: 'YRI Conference Grant', max: 2500, maxOnline: 500, minDays: 1, maxDays: 14,
    blurb: 'A poster or oral presentation of your own work, within the scope of EEG101, at a high-level conference.',
    who: 'Young Researchers and Innovators (under 40).',
    rules: ['Posters or oral presentations.'].concat(CONFERENCE_RULES),
    presentations: ['Oral presentation', 'Poster'],
    questions: [
      { id: 'summary', label: 'Your presentation', hint: 'What you will present, in a few sentences (or paste your abstract).' },
      { id: 'relevance', label: 'Relevance of the conference topic to EEG101', hint: 'Why this conference matters for the Action\'s work.' },
      { id: 'benefit', label: 'Motivation and benefit to your career', hint: 'How presenting here could help your career and your research.' }
    ],
    budget: ['Registration fee', 'Printing of the poster'].concat(TRAVEL_BUDGET), budgetOnline: ['Registration fee', 'Other'],
    documents: [CV, ACCEPTANCE]
  },
  dissemination_conference: {
    kind: 'conference', title: 'Dissemination Conference Grant', short: 'Dissemination Conference Grant', max: 2500, maxOnline: 500, minDays: 1, maxDays: 14,
    blurb: 'An oral presentation of the work and results of EEG101 itself at a high-level conference, to reach new audiences.',
    who: 'Any member presenting the Action\'s work, not only their own research.',
    rules: ['Oral presentations of EEG101\'s work only.'].concat(CONFERENCE_RULES, ['While there, you network and promote EEG101 to potential stakeholders.']),
    presentations: ['Oral presentation'],
    questions: [
      { id: 'summary', label: 'What you will present about EEG101', hint: 'The Action\'s work, activities or results you will present.' },
      { id: 'relevance', label: 'Alignment with the EEG101 Science Communication Plan', hint: 'Which audiences this reaches and how it fits the Action\'s plan for communicating its work.' },
      { id: 'benefit', label: 'Expected impact for EEG101', hint: 'New contacts, stakeholders, members or visibility the Action could gain.' }
    ],
    budget: ['Registration fee'].concat(TRAVEL_BUDGET), budgetOnline: ['Registration fee', 'Other'],
    documents: [CV, ACCEPTANCE]
  }
};
const ATTENDANCE = ['Face to face', 'Online'];
const maxFor = (s, attendance) => s.maxOnline && attendance === 'Online' ? s.maxOnline : s.max;
const budgetFor = (s, attendance) => s.budgetOnline && attendance === 'Online' ? s.budgetOnline : s.budget;

// Inclusiveness Target Countries, as defined by COST. Check against
// https://www.cost.eu/about/members/ when a new call opens.
const ITC_COUNTRIES = ['Albania', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Estonia', 'Georgia', 'Greece', 'Hungary', 'Latvia', 'Lithuania', 'Malta', 'Moldova', 'Montenegro', 'North Macedonia', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Türkiye', 'Ukraine'];
// COST Full and Cooperating Members, and Near Neighbour Countries. People at
// institutions there can receive grants (Annotated Rules, Article 6.4); others
// normally cannot, so their applications are flagged for reviewers. ITC
// Conference Grants are limited to ITCs and Near Neighbour Countries.
const COST_MEMBERS = ['Albania', 'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Georgia', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Israel', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Türkiye', 'Ukraine', 'United Kingdom'];
const NNC_COUNTRIES = ['Algeria', 'Armenia', 'Azerbaijan', 'Egypt', 'Faroe Islands', 'Kosovo', 'Lebanon', 'Libya', 'Morocco', 'Palestine', 'Syria', 'Tunisia'];

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
const REVIEWER_COLUMNS = ['Email', 'Name', 'Role (reviewer or chair)', 'Personal key', 'Link sent'];

// When a reviewer must declare a conflict of interest (Annotated Rules, Level A, II).
const CONFLICT_GUIDANCE = [
  'You work, or will soon work, in the same research unit as the applicant.',
  'You have a close family or personal relationship with them (relative, partner, close friend).',
  'You depend on them professionally, or compete with them, now or recently.',
  'You cooperate closely with them, for example through joint publications.',
  'You would benefit directly or indirectly from the grant, or cannot be impartial for any other reason.'
];

/* ------------------------------------------------------------------ web app */

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.view === 'review') {
    const me = reviewerByKey(params.key);
    if (!me) {
      return HtmlService.createHtmlOutput(
        '<p style="font-family:sans-serif;padding:24px">This page is for EEG101 grant reviewers, who each have a personal link. This link is not valid, or no longer valid. If you think you should have access, contact eeg101costaction@gmail.com.</p>'
      ).setTitle('EEG101 grant review');
    }
    const page = HtmlService.createTemplateFromFile('Review');
    page.boot = JSON.stringify({ me: me, key: String(params.key).trim(), blind: isBlind(me, readSettings()), criteria: CRITERIA, recommendations: RECOMMENDATIONS, decisions: DECISIONS, conflictGuidance: CONFLICT_GUIDANCE, schemes: schemeSummaries() }).replace(/</g, '\\u003c');
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
    nnc: NNC_COUNTRIES,
    costMembers: COST_MEMBERS,
    attendance: ATTENDANCE,
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
    if (a.host_country === a.country) fail('An STSM host must be in a different country from your own institution.');
    a.host_member = clean(p.host_member, 3); if (a.host_member !== 'Yes') fail('The academic lead at the host institution must be a member of EEG101. Please ask them to join before you apply.');
    a.activity = `Host: ${a.host_name}, ${a.host_institution} (${a.host_country})`;
  } else if (p.scheme === 'vmg') {
    a.collaborators = clean(p.collaborators, 1000); if (!a.collaborators) fail('Please list the people you will collaborate with and their institutions.');
    a.third_party = clean(p.third_party, 3); if (YES_NO.indexOf(a.third_party) < 0) fail('Please say whether a third-party organisation is involved.');
    a.third_party_member = a.third_party === 'Yes' ? clean(p.third_party_member, 3) : '';
    if (a.third_party === 'Yes' && a.third_party_member !== 'Yes') fail('The named lead at the collaborating organisation must be a member of EEG101. Please ask them to join before you apply.');
    if (p.not_leadership !== true) fail('Please confirm that this work is not part of a leadership role you hold in EEG101.');
    a.not_leadership = 'Yes';
    a.activity = `Collaborators: ${a.collaborators}`.slice(0, 300);
  } else {
    a.attendance = clean(p.attendance, 20); if (ATTENDANCE.indexOf(a.attendance) < 0) fail('Please say whether you will attend the conference face to face or online.');
    ['conference_name', 'contribution_title'].forEach(k => { a[k] = clean(p[k], 250); if (!a[k]) fail('Please give the conference name and the title of your presentation.'); });
    a.conference_url = clean(p.conference_url, 300);
    if (a.conference_url && !/^https?:\/\/\S+$/i.test(a.conference_url)) fail('Please give the conference web address starting with https://, or leave it empty.');
    if (a.attendance === 'Face to face') {
      a.conference_location = clean(p.conference_location, 150);
      a.conference_country = clean(p.conference_country, 100);
      if (!a.conference_location || COUNTRIES.indexOf(a.conference_country) < 0) fail('Please give the city and country of the conference.');
    } else {
      a.conference_location = 'Online'; a.conference_country = '';
    }
    a.third_party_organised = clean(p.third_party_organised, 3);
    if (a.third_party_organised !== 'Yes') fail('Conference grants are only for conferences organised entirely by others, not by EEG101 or another COST Action.');
    a.presentation = clean(p.presentation, 40);
    if (scheme.presentations.indexOf(a.presentation) < 0) fail(scheme.presentations.length === 1 ? `A ${scheme.short} is for an oral presentation.` : 'Please choose the type of presentation.');
    a.abstract_status = clean(p.abstract_status, 40); if (['Accepted', 'Submitted, awaiting decision'].indexOf(a.abstract_status) < 0) fail('Please say whether your abstract has been accepted.');
    if (p.scheme === 'itc_conference' && ITC_COUNTRIES.indexOf(a.country) < 0 && NNC_COUNTRIES.indexOf(a.country) < 0) fail(`ITC Conference Grants are only for people at institutions in Inclusiveness Target Countries or Near Neighbour Countries, and ${a.country} is neither. A YRI or Dissemination Conference Grant may suit you instead.`);
    if (p.scheme === 'yri_conference' && a.yri !== 'Yes') fail('YRI Conference Grants are only for Young Researchers and Innovators (under 40). An ITC or Dissemination Conference Grant may suit you instead.');
    const where = a.attendance === 'Online' ? 'online' : `${a.conference_location}, ${a.conference_country}`;
    a.activity = `${a.conference_name} (${where}): ${a.presentation}, "${a.contribution_title}"`.slice(0, 300);
  }

  // The proposal.
  a.title = clean(p.title, 200); if (!a.title) fail('Please give your application a title.');
  scheme.questions.forEach(q => {
    const what = `"${q.label}"`;
    a[q.id] = clean(p[q.id], 8000);
    if (!a[q.id]) fail(`Please answer ${what}.`);
    if (countWords(a[q.id]) > GRANTS.words[q.id]) fail(`Please shorten ${what} to ${GRANTS.words[q.id]} words or fewer.`);
  });

  // The budget: every line in a category this scheme allows, a positive amount,
  // and a total within the scheme's maximum.
  const lines = Array.isArray(p.budget) ? p.budget : [];
  a.budget = lines.map(l => ({ category: clean(l && l.category, 80), description: clean(l && l.description, 300), amount: Math.round(Number(l && l.amount) * 100) / 100 }))
    .filter(l => l.category || l.description || l.amount);
  if (!a.budget.length) fail('Please add at least one budget line.');
  const max = maxFor(scheme, a.attendance);
  const categories = budgetFor(scheme, a.attendance);
  a.budget.forEach(l => {
    if (categories.indexOf(l.category) < 0) fail('Please choose a category for every budget line.');
    if (!l.description) fail('Please describe every budget line.');
    if (!(l.amount > 0) || l.amount > max) fail('Every budget line needs an amount in euros.');
  });
  a.total = Math.round(a.budget.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  a.max = max;
  if (a.total > max) fail(`The total requested (€${a.total.toFixed(2)}) is more than the maximum for ${a.attendance === 'Online' ? 'attending online with ' : ''}a ${scheme.short} (€${max}).`);
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
  if (COST_MEMBERS.indexOf(a.country) < 0 && NNC_COUNTRIES.indexOf(a.country) < 0) notes.push(`Institution in ${a.country}, which is not a COST Full or Cooperating Member or a Near Neighbour Country: COST grants are normally not available there.`);
  if (scheme.kind === 'conference' && a.abstract_status !== 'Accepted') notes.push('Abstract not yet accepted.');
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
// the applicant's downloadable copy are all made from this. With blind set, as
// reviewers see it when the Settings tab says blind_review TRUE: without the
// applicant's name, contact details, institution, gender, ORCID or signature.
function applicationHtml(a, blind) {
  const s = SCHEMES[a.scheme];
  const row = (k, v) => v === '' || v == null ? '' : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const section = (title, body) => `<h2>${esc(title)}</h2>${body}`;
  const specifics = s.kind === 'stsm'
    ? (blind ? row('Host', a.host_name) : row('Host', `${a.host_name} (${a.host_email})`)) + row('Host institution', `${a.host_institution}, ${a.host_country}`) + row('Host is an EEG101 member', a.host_member)
    : s.kind === 'vmg'
      ? row('Collaborators', a.collaborators) + row('Third-party organisation involved', a.third_party) + row('Third-party lead is an EEG101 member', a.third_party_member) + row('Not part of an EEG101 leadership role', a.not_leadership)
      : row('Conference', a.conference_name) + row('Web address', a.conference_url) + row('Attendance', a.attendance) + row('Location', a.attendance === 'Online' ? 'Online' : [a.conference_location, a.conference_country].filter(Boolean).join(', ')) + row('Organised by a third party', a.third_party_organised) + row('Presentation', `${a.presentation}: ${a.contribution_title}`) + row('Abstract', a.abstract_status);
  const max = a.max || maxFor(s, a.attendance);
  const budget = `<table class="budget"><thead><tr><th>Category</th><th>Description</th><th class="num">€</th></tr></thead><tbody>${a.budget.map(l => `<tr><td>${esc(l.category)}</td><td>${esc(l.description)}</td><td class="num">${l.amount.toFixed(2)}</td></tr>`).join('')}<tr class="total"><td colspan="2">Total requested (maximum €${max})</td><td class="num">${a.total.toFixed(2)}</td></tr></tbody></table>`;
  const docs = Object.keys(a.documents).map(k => `<li>${esc(a.documents[k].label)}${blind ? '' : `: ${esc(a.documents[k].name)}`}</li>`).join('') || '<li>None</li>';
  const questions = (s.questions || []).filter(q => a[q.id]).map(q => `<h3>${esc(q.label)}</h3>${para(a[q.id])}`).join('');
  const applicant = blind
    ? `<table>${row('Position', a.position)}${row('Country of institution', `${a.country}${a.itc === 'Yes' ? ' (ITC)' : ''}`)}${row('Career stage', a.career_stage)}${row('Under 40 (YRI)', a.yri)}${row('Early-career researcher', a.eci)}${row('EEG101 member', a.member)}${row('Working Groups', a.working_groups.join(', '))}</table><p class="meta">Shown without the applicant's name, contact details and institution, for blind review.</p>`
    : `<table>${row('Name', `${a.first_name} ${a.last_name}`)}${row('Email', a.email)}${row('Position', a.position)}${row('Institution', [a.department, a.institution].filter(Boolean).join(', '))}${row('Country', `${a.country}${a.itc === 'Yes' ? ' (ITC)' : ''}`)}${row('ORCID', a.orcid)}${row('Career stage', a.career_stage)}${row('Under 40 (YRI)', a.yri)}${row('Early-career researcher', a.eci)}${row('Gender', a.gender_other ? `${a.gender}: ${a.gender_other}` : a.gender)}${row('EEG101 member', a.member)}${row('Working Groups', a.working_groups.join(', '))}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.id)} – ${esc(a.title)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a2e;line-height:1.45;margin:28px}
h1{color:#000099;font-size:18pt;margin:0 0 4px}h2{color:#000099;font-size:12.5pt;border-bottom:2px solid #FFCC00;padding-bottom:3px;margin:22px 0 8px}
.meta{color:#5a5a7a;margin:0 0 4px}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:4px 8px;border-bottom:1px solid #e0dbd4}
th{width:34%;color:#5a5a7a;font-weight:normal}.budget th{width:auto;font-weight:bold;color:#1a1a2e}.num{text-align:right;white-space:nowrap}.total td{font-weight:bold;border-top:2px solid #1a1a2e}
p{margin:0 0 8px}h3{font-size:11pt;margin:14px 0 4px}</style></head><body>
<h1>${esc(a.title)}</h1>
<p class="meta"><strong>${esc(a.id)}</strong> · ${esc(s.title)} · ${esc(a.call_name)}</p>
<p class="meta">Submitted ${esc(a.submitted_text)}${blind ? '' : ` by ${esc(a.first_name)} ${esc(a.last_name)}`}</p>
${section('Applicant', applicant)}
${section('Activity', `<table>${row('Dates', `${formatDate(a.start_date)} to ${formatDate(a.end_date)} (${a.days} day${a.days === 1 ? '' : 's'})`)}${specifics}</table>`)}
${section('Proposal', questions)}
${section('Budget', budget + `<h3>Justification of costs</h3>${para(a.justification)}`)}
${section('Documents', `<ul>${docs}</ul>`)}
${section('Declaration', `<p>The applicant confirmed that the information is accurate, that they have read the privacy notice, and that they will follow the COST rules for this grant, including applying in e-COST.${blind ? '' : ` Signed: ${esc(a.signature)}.`}</p>`)}
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
    'COST also requires every grant application to be made in e-COST (e-services.cost.eu), with your CV uploaded to your e-COST profile. If you have not done so yet, please submit the same application there too.',
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

// Adds any of these headers that an existing tab lacks, at the end, so a newer
// version of this script works with a spreadsheet made by an older one.
function ensureColumns(sheet, columns) {
  const { headers } = headerMap(sheet);
  const missing = columns.filter(c => headers.indexOf(c) < 0);
  if (missing.length) sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#e8e8ff');
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
    ensureColumns(sheet, columns);
    return sheet;
  };
  const apps = ensure('Applications', APPLICATION_COLUMNS);
  apps.hideColumns(headerMap(apps).map['Data'] + 1);
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
    budget_itc_conference: 'Optional: money available for ITC Conference Grants (€).',
    budget_yri_conference: 'Optional: money available for YRI Conference Grants (€).',
    budget_dissemination_conference: 'Optional: money available for Dissemination Conference Grants (€).',
    blind_review: 'TRUE: reviewers who are not chairs see applications without the applicant\'s name, contact details, institution, gender or documents. FALSE: they see everything. Chairs always see everything.',
    web_app_url: 'The address of the web app deployment (ends in /exec). Used for reviewers\' personal links.'
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

// Optional: gives the chairs edit access to the spreadsheet and the
// applications folder in Google Drive. The review page itself needs no access.
function shareWithChairs() {
  const book = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('GRANTS_SHEET_ID'));
  const folder = rootFolder();
  reviewerList().filter(r => r.chair).forEach(r => {
    try { book.addEditor(r.email); folder.addEditor(r.email); console.log('Shared with ' + r.email); }
    catch (error) { console.warn(`Could not share with ${r.email}: ${error}`); }
  });
}

/* ---------------------------------------------------------- reviewer links */

// Each reviewer opens the review page with their own link, which carries a
// personal key kept in the "Reviewers" tab. The page runs as the account that
// owns the script, so reviewers need no access to the spreadsheet or folder,
// and blind review is real: they only ever see what the page shows them.
//
// sendReviewerLinks emails a link to everyone listed who has not had one yet.
// To withdraw someone's access, delete their row (or clear their key).
function sendReviewerLinks() { reviewerLinks(true); }

// Logs everyone's link without emailing it, e.g. to open your own.
function showReviewerLinks() { reviewerLinks(false); }

function reviewerLinks(send) {
  const url = String(readSettings().web_app_url || '').trim();
  if (!/^https:\/\/script\.google\.com\/\S+\/exec$/.test(url)) throw new Error('Put the web app address (it ends in /exec) in the web_app_url row of the Settings tab first.');
  const sheet = tab('Reviewers');
  ensureColumns(sheet, REVIEWER_COLUMNS);
  const { map } = headerMap(sheet);
  rowsAsObjects(sheet).forEach(r => {
    const email = String(r['Email'] || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return;
    let key = String(r['Personal key'] || '').trim();
    if (key.length < 32) { key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); sheet.getRange(r._row, map['Personal key'] + 1).setValue(key); }
    const link = `${url}?view=review&key=${key}`;
    const chair = /chair/i.test(String(r['Role (reviewer or chair)'] || ''));
    if (send && !r['Link sent']) {
      const text = [
        `Dear ${String(r['Name'] || '').trim() || 'colleague'},`,
        `You have been added as ${chair ? 'a chair' : 'a reviewer'} for EEG101 grant applications. This is your personal link to the review page:\n${link}`,
        'Please keep it to yourself: anyone with the link can act as you. If it is shared by mistake, tell us and we will replace it.',
        'Before you score an application, check whether you have a conflict of interest with the applicant (the page lists the situations). If you do, declare it and do not score.',
        'With thanks,\nThe EEG101 Grants team'
      ];
      MailApp.sendEmail({ to: email, replyTo: GRANTS.replyTo, name: GRANTS.name, subject: 'Your EEG101 grant review link', body: text.join('\n\n') });
      sheet.getRange(r._row, map['Link sent'] + 1).setValue(new Date());
    }
    console.log(`${email}: ${link}`);
  });
}

/* ------------------------------------------------------------------- review */

function reviewerList() {
  return rowsAsObjects(tab('Reviewers')).map(r => ({
    email: String(r['Email'] || '').trim().toLowerCase(),
    name: String(r['Name'] || '').trim(),
    chair: /chair/i.test(String(r['Role (reviewer or chair)'] || '')),
    key: String(r['Personal key'] || '').trim()
  })).filter(r => EMAIL_PATTERN.test(r.email));
}

// The reviewer a personal key belongs to, or null.
function reviewerByKey(key) {
  key = String(key || '').trim();
  if (key.length < 32) return null;
  try {
    const r = reviewerList().filter(x => x.key === key)[0];
    return r ? { email: r.email, name: r.name, chair: r.chair } : null;
  } catch (error) { return null; }
}

function requireReviewer(key, chairOnly) {
  const me = reviewerByKey(key);
  if (!me) throw new Error('This review link is not valid any more. Ask the grants chair for a new one.');
  if (chairOnly && !me.chair) throw new Error('Only a grants chair can do this.');
  return me;
}

// Reviewers who are not chairs see applications without the applicant's
// identity, unless the Settings tab says blind_review FALSE. Chairs see everything.
const isBlind = (me, settings) => !me.chair && String(settings.blind_review).toUpperCase() !== 'FALSE';

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

// COST allows one grant at a time (no overlapping grants in a grant period) and
// only one type of conference grant per grant period. Checked across the
// applications of the same call (same ID prefix), leaving out those not funded
// or withdrawn.
function overlapWarnings(rows) {
  const byShort = {};
  Object.keys(SCHEMES).forEach(id => { byShort[SCHEMES[id].short] = SCHEMES[id]; });
  const live = rows.filter(r => ['Not funded', 'Withdrawn'].indexOf(String(r['Decision'])) < 0).map(r => ({
    id: String(r['ID']), call: String(r['ID']).replace(/-\d+$/, ''), email: String(r['Email']).toLowerCase(),
    scheme: String(r['Scheme']), kind: (byShort[String(r['Scheme'])] || {}).kind, start: iso(r['Start date']), end: iso(r['End date'])
  }));
  const out = {};
  const add = (id, text) => { (out[id] = out[id] || []).push(text); };
  live.forEach((x, i) => live.slice(i + 1).forEach(y => {
    if (x.email !== y.email || x.call !== y.call) return;
    if (x.start <= y.end && y.start <= x.end) { add(x.id, `Dates overlap with ${y.id} (${y.scheme}) by the same applicant.`); add(y.id, `Dates overlap with ${x.id} (${x.scheme}) by the same applicant.`); }
    if (x.kind === 'conference' && y.kind === 'conference' && x.scheme !== y.scheme) { add(x.id, `The applicant also applied for a ${y.scheme} (${y.id}); only one type of conference grant is allowed per grant period.`); add(y.id, `The applicant also applied for a ${x.scheme} (${x.id}); only one type of conference grant is allowed per grant period.`); }
  }));
  return out;
}

// Everything the dashboard lists. A reviewer sees others' scores for an
// application only after scoring it themselves; chairs see them at once. Anyone
// who declared a conflict of interest, or who is the applicant, sees no scores
// for that application and cannot score or decide on it.
function listApplications(key) {
  const me = requireReviewer(key, false);
  const settings = readSettings();
  const blind = isBlind(me, settings);
  const reviews = reviewsByApplication();
  const rows = rowsAsObjects(tab('Applications'));
  const warnings = overlapWarnings(rows);
  const apps = rows.map(r => {
    const id = String(r['ID']);
    const all = reviews[id] || [];
    const mine = all.filter(x => x.reviewer === me.email)[0] || null;
    const own = String(r['Email']).toLowerCase() === me.email;
    const conflicted = own || !!(mine && mine.conflict);
    const scored = all.filter(x => !x.conflict && x.mean != null);
    const canSee = !conflicted && (me.chair || !!mine);
    return {
      id: id, submitted: iso(r['Submitted']), scheme: String(r['Scheme']), title: String(r['Title']),
      applicant: blind ? '' : `${r['First name']} ${r['Last name']}`, institution: blind ? '' : String(r['Institution']), country: String(r['Country']), itc: String(r['ITC']),
      gender: blind ? '' : String(r['Gender']), yri: String(r['Under 40 (YRI)']), eci: String(r['Early-career (PhD < 8 years or student)']), career: String(r['Career stage']),
      start: iso(r['Start date']), end: iso(r['End date']), days: asNumber(r['Days']),
      requested: asNumber(r['Requested (€)']), notes: [String(r['Eligibility notes'] || '')].concat(warnings[id] || []).filter(Boolean).join(' '),
      folder: blind ? '' : String(r['Drive folder']),
      decision: String(r['Decision'] || ''), awarded: asNumber(r['Awarded (€)']), rank: asNumber(r['Rank']), decisionNotes: String(r['Decision notes'] || ''),
      reviewCount: scored.length,
      mean: canSee && scored.length ? Math.round(scored.reduce((s, x) => s + x.mean, 0) / scored.length * 100) / 100 : null,
      own: own, conflicted: conflicted,
      mine: mine, others: canSee ? all.filter(x => x.reviewer !== me.email) : []
    };
  });
  return { me: me, blind: blind, applications: apps, settings: settings };
}

function applicationRecord(id) {
  const r = rowsAsObjects(tab('Applications')).filter(x => String(x['ID']) === String(id))[0];
  if (!r) throw new Error('Application not found.');
  const data = JSON.parse(String(r['Data'] || '{}'));
  data.submitted_text = data.submitted_text || iso(r['Submitted']);
  return { row: r, data: data };
}

function getApplication(key, id) {
  const me = requireReviewer(key, false);
  const blind = isBlind(me, readSettings());
  const { row, data } = applicationRecord(id);
  const documents = {};
  if (!blind) Object.keys(data.documents || {}).forEach(k => { documents[k] = { label: data.documents[k].label, name: data.documents[k].name }; });
  return { id: String(id), blind: blind, html: applicationHtml(data, blind), folder: blind ? '' : String(row['Drive folder']), documents: documents };
}

// A copy of the application PDF (doc "application") or one of its uploaded
// documents, for people allowed to see the applicant's identity.
function getDocument(key, id, doc) {
  const me = requireReviewer(key, false);
  if (isBlind(me, readSettings())) throw new Error('Documents are not shown in blind review.');
  const { data } = applicationRecord(id);
  let blob;
  if (doc === 'application') blob = applicationPdf(data);
  else if (data.documents && data.documents[doc]) blob = DriveApp.getFileById(data.documents[doc].id).getBlob();
  else throw new Error('Document not found.');
  return { name: doc === 'application' ? `${id} application.pdf` : `${id} ${data.documents[doc].name}`, data: Utilities.base64Encode(blob.getBytes()) };
}

function saveReview(key, input) {
  const me = requireReviewer(key, false);
  const id = String(input && input.id || '');
  const { row } = applicationRecord(id);
  if (String(row['Email']).toLowerCase() === me.email) throw new Error('You cannot review your own application.');
  const conflict = !!input.conflict;
  const scores = CRITERIA.map((c, i) => conflict ? '' : Number(input.scores && input.scores[i]));
  if (!conflict && scores.some(s => !(s >= 1 && s <= 5 && Math.round(s) === s))) throw new Error('Please give every criterion a score from 1 to 5.');
  const recommendation = conflict ? '' : String(input.recommendation || '');
  if (!conflict && RECOMMENDATIONS.indexOf(recommendation) < 0) throw new Error('Please choose a recommendation.');
  const mean = conflict ? '' : Math.round(scores.reduce((s, x) => s + x, 0) / scores.length * 100) / 100;
  const values = { 'Application ID': id, 'Reviewer': me.email, 'Conflict of interest': conflict ? 'Yes' : 'No', 'Mean score': mean, 'Recommendation': recommendation, 'Comments': conflict ? '' : String(input.comments || '').slice(0, 5000), 'Updated': new Date() };
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
  return listApplications(key);
}

function markStatus(id, status) {
  const sheet = tab('Applications');
  const { map } = headerMap(sheet);
  const r = rowsAsObjects(sheet).filter(x => String(x['ID']) === id)[0];
  if (r && String(r['Status']) === 'Submitted') sheet.getRange(r._row, map['Status'] + 1).setValue(status);
}

// Chair only: decision, amount awarded and rank for one or more applications,
// from the ranking page or straight from an application. A chair who declared a
// conflict of interest, or who applied, cannot decide on that application.
function saveDecisions(key, changes) {
  const me = requireReviewer(key, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = tab('Applications');
    const { map } = headerMap(sheet);
    const rows = rowsAsObjects(sheet);
    const reviews = reviewsByApplication();
    const list = Array.isArray(changes) ? changes : [];
    // Check everything first, so a refused change saves nothing.
    const checked = list.map(change => {
      const r = rows.filter(x => String(x['ID']) === String(change.id))[0];
      if (!r) throw new Error(`Application ${change.id} not found.`);
      if (String(r['Email']).toLowerCase() === me.email) throw new Error(`${change.id} is your own application, so another chair must decide on it.`);
      if ((reviews[String(change.id)] || []).some(x => x.reviewer === me.email && x.conflict)) throw new Error(`You declared a conflict of interest for ${change.id}, so another chair must decide on it.`);
      const decision = String(change.decision || '');
      if (DECISIONS.indexOf(decision) < 0) throw new Error('Unknown decision.');
      const requested = asNumber(r['Requested (€)']) || 0;
      let awarded = change.awarded === '' || change.awarded == null ? '' : Math.round(Number(change.awarded) * 100) / 100;
      if (decision === 'Funded' && awarded === '') awarded = requested;
      if (awarded !== '' && (!(awarded >= 0) || awarded > requested)) throw new Error(`The amount awarded to ${change.id} must be between €0 and the €${requested} requested.`);
      const rank = change.rank === '' || change.rank == null ? '' : Math.max(1, Math.round(Number(change.rank)));
      return { r: r, decision: decision, awarded: awarded, rank: rank, notes: String(change.notes || '').slice(0, 2000) };
    });
    checked.forEach(c => {
      const set = (header, value) => sheet.getRange(c.r._row, map[header] + 1).setValue(value);
      set('Decision', c.decision);
      set('Awarded (€)', c.decision === 'Funded' ? c.awarded : '');
      set('Rank', c.rank);
      set('Decision notes', c.notes);
      set('Decided by', me.email);
      set('Decided at', new Date());
      set('Status', c.decision || (String(c.r['Status']) === 'Submitted' ? 'Submitted' : 'Under review'));
    });
  } finally {
    lock.releaseLock();
  }
  return listApplications(key);
}

// Totals for the reports page: by scheme, month, gender, ITC, YRI, career stage
// and country, for everything submitted and for what was funded. Chairs only
// when review is blind, as the funded list names people.
function getReport(key) {
  const me = requireReviewer(key, false);
  const settings = readSettings();
  if (isBlind(me, settings)) throw new Error('Reports are for chairs while review is blind.');
  const apps = rowsAsObjects(tab('Applications'));
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
