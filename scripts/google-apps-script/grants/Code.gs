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
 *      applications without the applicant's identity, unless blind review
 *      is switched off for that call. Every call checks the key again.
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
  words: { summary: 200, workplan: 600, outcomes: 300, relevance: 300, benefit: 300, contribution: 250, justification: 400 },
  // Defaults for the "Settings" tab, which the chair edits in the spreadsheet.
  // Each call (name, schemes, deadline, dates…) is a row of the "Calls" tab,
  // managed on the portal's Calls page. The first call is made from these.
  firstCall: { name: 'EEG101 Grant Period 2 call', period_end: '2027-09-30', id_prefix: 'G2' },
  defaults: {
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
// A Word template for the host's confirmation, on the website. (COST's own is
// only inside e-COST, which applicants reach only once their grant is accepted.)
const HOST_TEMPLATE = 'https://www.eeg101.eu/assets/docs/eeg101-stsm-host-confirmation-template.docx';
const ACCEPTANCE = { id: 'acceptance', label: 'Acceptance or invitation letter from the conference organisers (or proof of submission if you are still waiting)', required: true };
// Asked in every scheme, and scored by reviewers (see CRITERIA).
const CONTRIBUTION = { id: 'contribution', label: 'Your contribution to EEG101 to date', hint: 'What you have done in the Action so far: Working Group activity, meetings, training schools, shared data, tools or protocols, roles you hold. If you joined recently, say how you have started to take part and plan to. This is one of the evaluation criteria: reviewers score it.' };
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
      'The grant is normally paid after the visit, once your report is approved. Once it is approved, you can ask the Grant Holder for up to 50% in advance; this depends on funds being available and the Grant Holder agreeing.'
    ],
    questions: [
      { id: 'summary', label: 'Goals of the mission', hint: 'What you want to achieve, in a few sentences.' },
      { id: 'workplan', label: 'Work to be carried out', hint: 'What you will do at the host, and when.' },
      { id: 'outcomes', label: 'Expected outcomes', hint: 'Papers, data, code, training, new collaborations…' },
      { id: 'relevance', label: 'Contribution to the EEG101 objectives', hint: 'How the mission helps the Action meet the objectives in its Memorandum of Understanding, and which Working Group it supports.' },
      { id: 'benefit', label: 'Benefit to you, the host and the network', hint: 'For your career, your host and the EEG101 community, including inclusiveness.' },
      CONTRIBUTION
    ],
    budget: TRAVEL_BUDGET,
    documents: [CV, { id: 'host_letter', label: 'Confirmation from the host institution that it will receive you, with the dates', required: true, template: HOST_TEMPLATE }]
  },
  // A special call: an STSM hosted by a company or other industry organisation.
  // The same COST rules as any STSM, plus the host's sector.
  stsm_industry: {
    kind: 'stsm', industry: true, title: 'Industry STSM', short: 'Industry STSM', max: 4000, minDays: 5, maxDays: 90,
    blurb: 'A research visit to a company or other industry organisation in another country, for specific work agreed with the host.',
    who: 'Members at an institution in a COST Full or Cooperating Member country or a Near Neighbour Country, with an industry host.',
    rules: [
      'The host must be a company, SME, start-up or other industry organisation, in a different country from your own institution.',
      'The named lead at the host must be an EEG101 member.',
      'The grant is normally paid after the visit, once your report is approved. Once it is approved, you can ask the Grant Holder for up to 50% in advance; this depends on funds being available and the Grant Holder agreeing.'
    ],
    questions: [
      { id: 'summary', label: 'Goals of the mission', hint: 'What you want to achieve, in a few sentences.' },
      { id: 'workplan', label: 'Work to be carried out', hint: 'What you will do at the host, and when.' },
      { id: 'outcomes', label: 'Expected outcomes', hint: 'Methods, tools, data, products, publications, training, a continuing partnership…' },
      { id: 'relevance', label: 'Contribution to the EEG101 objectives', hint: 'How the mission helps the Action meet the objectives in its Memorandum of Understanding, and which Working Group it supports.' },
      { id: 'benefit', label: 'Benefit to academia–industry collaboration', hint: 'What you, the host company and the EEG101 community gain, and how the collaboration could continue.' },
      CONTRIBUTION
    ],
    budget: TRAVEL_BUDGET,
    documents: [CV, { id: 'host_letter', label: 'Confirmation from the host organisation that it will receive you, with the dates', required: true, template: HOST_TEMPLATE }]
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
      { id: 'relevance', label: 'Contribution to the EEG101 objectives', hint: 'How the work helps the Action meet the objectives in its Memorandum of Understanding, and which Working Group it supports.' },
      CONTRIBUTION
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
      { id: 'benefit', label: 'Motivation and benefit to your career', hint: 'How presenting here could help your career and your research.' },
      CONTRIBUTION
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
      { id: 'benefit', label: 'Motivation and benefit to your career', hint: 'How presenting here could help your career and your research.' },
      CONTRIBUTION
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
      { id: 'benefit', label: 'Expected impact for EEG101', hint: 'New contacts, stakeholders, members or visibility the Action could gain.' },
      CONTRIBUTION
    ],
    budget: ['Registration fee'].concat(TRAVEL_BUDGET), budgetOnline: ['Registration fee', 'Other'],
    documents: [CV, ACCEPTANCE]
  }
};
const ATTENDANCE = ['Face to face', 'Online'];

// Against spam. Always on: a hidden field people never fill in, a minimum time
// between opening the form and submitting it, and hourly limits. A CAPTCHA
// (Cloudflare Turnstile, shown on www.eeg101.eu/grants/apply/) is added once the
// TURNSTILE_SECRET script property is set; see docs/grants-platform.md.
const LIMITS = { minSeconds: 20, perEmailPerHour: 3, perHour: 60, uploadsPerHour: 150 };
const APPLY_PAGE = 'https://www.eeg101.eu/grants/apply/';
const INDUSTRY_TYPES = ['Large company', 'SME (small or medium-sized company)', 'Start-up', 'Other industry organisation'];
// The schemes a call offers when nothing else is set: all but the special
// industry call, which runs on its own.
const DEFAULT_CALL_SCHEMES = Object.keys(SCHEMES).filter(id => !SCHEMES[id].industry);

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
  { id: 'contribution', label: 'Contribution to EEG101 to date' },
  { id: 'relevance', label: 'Relevance to EEG101 and its Working Groups' },
  { id: 'feasibility', label: 'Feasibility and value for money of the budget' },
  { id: 'impact', label: 'Benefit to the applicant and to the network (incl. inclusiveness)' }
];
const RECOMMENDATIONS = ['Fund', 'Fund if budget allows', 'Do not fund'];

// Where a funded grant is, from the funding decision to payment. Chairs and the
// grants administrator set it by hand on the Funded grants page.
const GRANT_STATUSES = ['Awaiting e-COST application', 'Grant letter issued', 'Activity under way', 'Report due', 'Report submitted in e-COST', 'Report approved', 'Paid', 'Cancelled'];
const GRANT_DONE = ['Report submitted in e-COST', 'Report approved', 'Paid', 'Cancelled'];
const ROLES = ['reviewer', 'chair', 'administrator'];
const roleOf = text => /chair/i.test(text) ? 'chair' : /admin/i.test(text) ? 'administrator' : 'reviewer';
const ROLE_NAMES = { reviewer: 'a reviewer', chair: 'a chair', administrator: 'the grants administrator' };
const DECISIONS = ['', 'Funded', 'Reserve', 'Not funded', 'Withdrawn'];

const GENDER_OPTIONS = ['Male', 'Female', 'Beyond the binary (e.g. non-binary, intersex, agender, genderfluid)', 'Prefer to self-describe', 'Prefer not to say'];
const CAREER_STAGES = ['PhD student', 'Postdoctoral researcher', 'Lecturer / Assistant Professor / Early-career PI', 'Associate Professor / Mid-career researcher', 'Professor / Senior researcher', 'Industry / practitioner', 'Other'];
const WORKING_GROUPS = ['Reporting Standards', 'Curation and Harmonisation', 'EEG Community Framework', 'Mobile EEG Harmonisation'];
const YES_NO = ['Yes', 'No'];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Columns of the "Applications" tab, in order. Rows are written and read by
// header name, so the chair may add columns at the end without breaking anything.
const APPLICATION_COLUMNS = [
  'ID', 'Submitted', 'Status', 'Call', 'Scheme', 'Title', 'First name', 'Last name', 'Email', 'Institution', 'Department',
  'Position', 'Country', 'ITC', 'Gender', 'Under 40 (YRI)', 'Early-career (PhD < 8 years or student)', 'Career stage',
  'EEG101 member', 'Working Groups', 'ORCID', 'Start date', 'End date', 'Days', 'Host / collaborator / conference',
  'Requested (€)', 'Eligibility notes', 'Drive folder', 'Application PDF', 'Documents',
  'Decision', 'Awarded (€)', 'Rank', 'Decision notes', 'Decided by', 'Decided at', 'Decision emailed', 'Decision emailed as', 'Decision emailed by', 'Assigned reviewers',
  'Grant status', 'Grant status updated', 'Grant status by', 'Last reminder', 'Reminders sent', 'Grant notes', 'Data'
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

/* -------------------------------------------------------------------- calls */

// Calls run side by side, each with its own schemes, deadline, end date and ID
// prefix: the main call, and special calls such as one per company for
// industry STSMs. A call can preset the host (for a company call) and add its
// own questions and documents to the form.
const CALL_COLUMNS = ['Call ID', 'Name', 'Schemes', 'Open', 'Deadline', 'Period end', 'ID prefix', 'Description',
  'Host organisation', 'Host country', 'Host type', 'Host lead', 'Questions', 'Documents', 'Budget (€)', 'Created', 'Blind review'];

function callFromRow(r) {
  const text = (v, pattern) => v instanceof Date ? Utilities.formatDate(v, GRANTS.timezone, pattern || 'yyyy-MM-dd') : String(v == null ? '' : v).trim();
  const list = v => { try { const x = JSON.parse(String(v || '[]')); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
  const host = text(r['Host organisation']);
  return {
    id: text(r['Call ID']), name: text(r['Name']), schemes: String(r['Schemes'] || '').split(/[,\s]+/).filter(id => SCHEMES[id]),
    open: String(r['Open']).toUpperCase() === 'TRUE', deadline: text(r['Deadline'], "yyyy-MM-dd'T'HH:mm"), periodEnd: text(r['Period end']),
    prefix: text(r['ID prefix']), description: text(r['Description']),
    host: host ? { institution: host, country: text(r['Host country']), type: text(r['Host type']), name: text(r['Host lead']) } : null,
    questions: list(r['Questions']), documents: list(r['Documents']), budget: asNumber(r['Budget (€)']), row: r._row,
    // On unless switched off for the call (older calls follow the old setting).
    blind: String(r['Blind review'] || legacyBlind()).toUpperCase() !== 'FALSE'
  };
}

function legacyBlind() { try { return readSettings().blind_review || 'TRUE'; } catch (e) { return 'TRUE'; } }

function readCalls() { return rowsAsObjects(tab('Calls')).map(callFromRow).filter(c => c.id); }

function callIsOpen(c) {
  if (!c.open || !c.schemes.length) return false;
  if (!c.deadline) return true;
  const deadline = parseDeadline(c.deadline);
  return !deadline || new Date() <= deadline;
}

const openCalls = () => readCalls().filter(callIsOpen);

// What the application form needs to know about a call.
function callForForm(c) {
  return {
    id: c.id, name: c.name, description: c.description, schemes: c.schemes, host: c.host,
    deadlineText: c.deadline ? formatDateTime(parseDeadline(c.deadline)) : '', periodEnd: c.periodEnd, periodEndText: formatDate(c.periodEnd),
    questions: c.questions, documents: c.documents
  };
}

/* ------------------------------------------------------------------ web app */

// The website's "Grants portal" page asks for a person's link by email. The
// reply is the same whether or not the address is on the list, so it reveals
// nothing; a listed person gets their link by email, at most once every 10
// minutes.
function doPost(e) {
  let email = '';
  try { email = String(JSON.parse(e.postData.contents).email || '').trim().toLowerCase(); } catch (error) { email = ''; }
  const reply = ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'If that address belongs to an EEG101 grant reviewer, chair or administrator, we have emailed their portal link to it. It can take a few minutes to arrive.' })).setMimeType(ContentService.MimeType.JSON);
  if (!EMAIL_PATTERN.test(email)) return reply;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return reply;
  try {
    const sheet = reviewersTab();
    const r = rowsAsObjects(sheet).filter(x => String(x['Email'] || '').trim().toLowerCase() === email)[0];
    const last = r && r['Link sent'] ? new Date(r['Link sent']).getTime() : 0;
    if (r && !(Date.now() - last < 10 * 60 * 1000)) sendInvite(sheet, r, false, true);
  } catch (error) {
    console.warn('Portal link request failed: ' + error);
  } finally {
    lock.releaseLock();
  }
  return reply;
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  rememberAppUrl();
  if (params.view === 'status') return ContentService.createTextOutput(JSON.stringify(publicStatus())).setMimeType(ContentService.MimeType.JSON);
  if (params.view === 'review') {
    const me = reviewerByKey(params.key);
    if (!me) {
      return HtmlService.createHtmlOutput(
        '<p style="font-family:sans-serif;padding:24px">This page is for EEG101 grant reviewers, who each have a personal link. This link is not valid, or no longer valid. If you think you should have access, contact eeg101costaction@gmail.com.</p>'
      ).setTitle('EEG101 grants portal');
    }
    const page = HtmlService.createTemplateFromFile('Review');
    page.boot = JSON.stringify({ me: me, key: String(params.key).trim(), blind: !me.chair && !me.admin && readCalls().some(c => c.blind), criteria: CRITERIA, recommendations: RECOMMENDATIONS, decisions: DECISIONS, conflictGuidance: CONFLICT_GUIDANCE, schemes: schemeSummaries() }).replace(/</g, '\\u003c');
    return page.evaluate().setTitle('EEG101 grants portal').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const page = HtmlService.createTemplateFromFile('Apply');
  page.boot = JSON.stringify(applyConfig(String(params.scheme || ''), String(params.call || ''))).replace(/</g, '\\u003c');
  return page.evaluate().setTitle('Apply for EEG101 funding').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// What the website's Grants page shows: whether the call is open, until when,
// and which schemes it offers. Nothing private.
function publicStatus() {
  const calls = openCalls();
  return {
    open: calls.length > 0,
    schemes: calls.reduce((all, c) => all.concat(c.schemes.filter(id => all.indexOf(id) < 0)), []),
    calls: calls.map(c => ({ id: c.id, name: c.name, schemes: c.schemes, host: c.host ? c.host.institution : '', deadlineText: c.deadline ? formatDateTime(parseDeadline(c.deadline)) : '', periodEndText: formatDate(c.periodEnd) }))
  };
}

function schemeSummaries() {
  const out = {};
  Object.keys(SCHEMES).forEach(id => { const s = SCHEMES[id]; out[id] = { title: s.title, short: s.short, max: s.max }; });
  return out;
}

function applyConfig(preselect, preselectCall) {
  const calls = openCalls();
  const started = String(Date.now());
  const offered = calls.reduce((all, c) => all.concat(c.schemes.filter(id => all.indexOf(id) < 0)), []);
  return {
    open: calls.length > 0,
    calls: calls.map(callForForm),
    today: Utilities.formatDate(new Date(), GRANTS.timezone, 'yyyy-MM-dd'),
    preselect: offered.indexOf(preselect) >= 0 ? preselect : '',
    preselectCall: calls.some(c => c.id === String(preselectCall || '')) ? String(preselectCall) : '',
    schemes: offered.reduce((o, id) => { o[id] = SCHEMES[id]; return o; }, {}),
    industryTypes: INDUSTRY_TYPES,
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
    started: started, startedSig: sign('started:' + started),
    captcha: !!PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET'),
    applyPage: APPLY_PAGE,
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
  if (!openCalls().length) throw new Error('This call is closed, so files can no longer be uploaded.');
  if (!underLimit('uploads', LIMITS.uploadsPerHour)) throw new Error('A great many files are being uploaded just now. Please try again in an hour, or email eeg101costaction@gmail.com.');
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
function validateApplication(p, call, today) {
  const fail = message => { throw new Error(message); };
  if (!p || typeof p !== 'object') fail('The application could not be read. Please try again.');
  if (p.website) fail('Your application could not be submitted.');
  const scheme = SCHEMES[p.scheme];
  if (!scheme) fail('Please choose a funding scheme.');
  if (call.schemes.indexOf(p.scheme) < 0) fail(`${scheme.title} is not part of ${call.name}. Please choose another scheme.`);
  // A company call fixes the host: the form shows it, and it is set here too.
  if (call.host && scheme.kind === 'stsm') {
    const h = call.host;
    p = Object.assign({}, p, { host_institution: h.institution }, h.country ? { host_country: h.country } : {}, h.type ? { host_type: h.type } : {}, h.name ? { host_name: h.name } : {});
  }
  const a = { scheme: p.scheme, call_id: call.id, call_name: call.name, call_deadline: call.deadline };

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
  if (a.end_date > call.periodEnd) fail(`All activities must be completed by ${formatDate(call.periodEnd)}. Please choose an end date on or before then.`);
  a.days = daysBetween(a.start_date, a.end_date);
  if (a.days < scheme.minDays || a.days > scheme.maxDays) fail(`A ${scheme.short} must last between ${scheme.minDays} and ${scheme.maxDays} days; yours is ${a.days}.`);

  // What the money is for.
  if (scheme.kind === 'stsm') {
    ['host_institution', 'host_name', 'host_country'].forEach(k => { a[k] = clean(p[k], 150); if (!a[k]) fail('Please give the host institution, the host\'s name and the host country.'); });
    if (scheme.industry) { a.host_type = clean(p.host_type, 60); if (INDUSTRY_TYPES.indexOf(a.host_type) < 0) fail('Please say what kind of industry organisation your host is.'); }
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
  // The call's own questions.
  a.call_answers = (call.questions || []).map(q => {
    const answer = clean(p['q_' + q.id], 8000);
    const limit = Number(q.words) || 300;
    if (!answer && q.required) fail(`Please answer "${q.label}".`);
    if (countWords(answer) > limit) fail(`Please shorten "${q.label}" to ${limit} words or fewer.`);
    return { id: q.id, label: q.label, answer: answer };
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
  scheme.documents.concat((call.documents || []).map(d => ({ id: 'call_' + d.id, label: d.label, required: !!d.required }))).forEach(d => {
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

// Counts something for the current hour; false once the limit is reached.
function underLimit(what, limit) {
  const cache = CacheService.getScriptCache();
  const key = `limit:${what}:${Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH')}`;
  const n = Number(cache.get(key) || 0);
  if (n >= limit) return false;
  cache.put(key, String(n + 1), 3700);
  return true;
}

// The CAPTCHA, when TURNSTILE_SECRET is set: the token the website's page got
// from Cloudflare must check out.
function verifyCaptcha(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) return;
  if (!token) throw new Error(`Please confirm you are not a robot, then submit again. If you opened this form from a direct link, open it from ${APPLY_PAGE} instead; your answers are kept.`);
  let ok = false;
  try {
    const reply = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'post', payload: { secret: secret, response: String(token) }, muteHttpExceptions: true });
    ok = JSON.parse(reply.getContentText()).success === true;
  } catch (error) { ok = false; }
  if (!ok) throw new Error('The check that you are not a robot did not work. Please submit again.');
}

function submitApplication(payload) {
  const calls = openCalls();
  const asked = String(payload && payload.call || '');
  let call = calls.filter(c => c.id === asked)[0];
  if (!call && !asked) { const offering = calls.filter(c => c.schemes.indexOf(String(payload && payload.scheme)) >= 0); if (offering.length === 1) call = offering[0]; }
  if (!call) throw new Error(asked || !calls.length ? 'This call is closed, so applications can no longer be submitted.' : 'Please choose the call you are applying to.');
  const started = Number(payload.started);
  if (!started || payload.startedSig !== sign('started:' + payload.started)) throw new Error('Please reload the page and submit again. Your answers are kept.');
  if (Date.now() - started < LIMITS.minSeconds * 1000) throw new Error('Please check your answers, then submit again.');
  const today = Utilities.formatDate(new Date(), GRANTS.timezone, 'yyyy-MM-dd');
  const a = validateApplication(payload, call, today);
  verifyCaptcha(payload.captcha);
  if (!underLimit('email:' + a.email, LIMITS.perEmailPerHour)) throw new Error('You have submitted several applications in the last hour. Please wait an hour, or email eeg101costaction@gmail.com.');
  if (!underLimit('all', LIMITS.perHour)) throw new Error('We are receiving a great many applications just now. Please try again in an hour; your answers are kept.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let id, folder, pdfBlob;
  try {
    const sheet = tab('Applications');
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const prefix = `EEG101-${call.prefix || 'G'}-`;
    const next = ids.filter(x => x.indexOf(prefix) === 0).map(x => Number(x.slice(prefix.length)) || 0).reduce((m, n) => Math.max(m, n), 0) + 1;
    id = prefix + String(next).padStart(3, '0');
    a.id = id;
    a.submitted = new Date();
    a.submitted_text = formatDateTime(a.submitted);

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
    ok: true, id: id, emailed: emailed, email: a.email, submitted: a.submitted_text, timing: decisionTiming(a),
    pdf: Utilities.base64Encode(pdfBlob.getBytes()),
    html: applicationHtml(a)
  };
}

function applicationRow(a) {
  const scheme = SCHEMES[a.scheme];
  const data = Object.assign({}, a);
  delete data.submitted;
  return {
    'ID': a.id, 'Submitted': a.submitted, 'Status': 'Submitted', 'Call': a.call_id, 'Scheme': scheme.short, 'Title': a.title,
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
// reviewers see it in a call with blind review (the default): without the
// applicant's name, contact details, institution, gender, ORCID or signature.
function applicationHtml(a, blind) {
  const s = SCHEMES[a.scheme];
  const row = (k, v) => v === '' || v == null ? '' : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const section = (title, body) => `<h2>${esc(title)}</h2>${body}`;
  const specifics = s.kind === 'stsm'
    ? (blind ? row('Host', a.host_name) : row('Host', `${a.host_name} (${a.host_email})`)) + row(s.industry ? 'Host organisation' : 'Host institution', `${a.host_institution}, ${a.host_country}`) + row('Type of organisation', a.host_type) + row('Host is an EEG101 member', a.host_member)
    : s.kind === 'vmg'
      ? row('Collaborators', a.collaborators) + row('Third-party organisation involved', a.third_party) + row('Third-party lead is an EEG101 member', a.third_party_member) + row('Not part of an EEG101 leadership role', a.not_leadership)
      : row('Conference', a.conference_name) + row('Web address', a.conference_url) + row('Attendance', a.attendance) + row('Location', a.attendance === 'Online' ? 'Online' : [a.conference_location, a.conference_country].filter(Boolean).join(', ')) + row('Organised by a third party', a.third_party_organised) + row('Presentation', `${a.presentation}: ${a.contribution_title}`) + row('Abstract', a.abstract_status);
  const max = a.max || maxFor(s, a.attendance);
  const budget = `<table class="budget"><thead><tr><th>Category</th><th>Description</th><th class="num">€</th></tr></thead><tbody>${a.budget.map(l => `<tr><td>${esc(l.category)}</td><td>${esc(l.description)}</td><td class="num">${l.amount.toFixed(2)}</td></tr>`).join('')}<tr class="total"><td colspan="2">Total requested (maximum €${max})</td><td class="num">${a.total.toFixed(2)}</td></tr></tbody></table>`;
  const docs = Object.keys(a.documents).map(k => `<li>${esc(a.documents[k].label)}${blind ? '' : `: ${esc(a.documents[k].name)}`}</li>`).join('') || '<li>None</li>';
  const questions = (s.questions || []).filter(q => a[q.id]).map(q => `<h3>${esc(q.label)}</h3>${para(a[q.id])}`).join('')
    + (a.call_answers || []).filter(x => x.answer).map(x => `<h3>${esc(x.label)}</h3>${para(x.answer)}`).join('');
  const applicant = blind
    ? `<table>${row('Position', a.position)}${row('Country of institution', `${a.country}${a.itc === 'Yes' ? ' (ITC)' : ''}`)}${row('Career stage', a.career_stage)}${row('Under 40 (YRI)', a.yri)}${row('Early-career researcher', a.eci)}${row('EEG101 member', a.member)}${row('Working Groups', a.working_groups.join(', '))}</table><p class="meta">Shown without the applicant's name, contact details and institution, for blind review.</p>`
    : `<table>${row('Name', `${a.first_name} ${a.last_name}`)}${row('Email', a.email)}${row('Position', a.position)}${row('Institution', [a.department, a.institution].filter(Boolean).join(', '))}${row('Country', `${a.country}${a.itc === 'Yes' ? ' (ITC)' : ''}`)}${row('ORCID', a.orcid)}${row('Career stage', a.career_stage)}${row('Under 40 (YRI)', a.yri)}${row('Early-career researcher', a.eci)}${row('Gender', a.gender_other ? `${a.gender}: ${a.gender_other}` : a.gender)}${row('EEG101 member', a.member)}${row('Working Groups', a.working_groups.join(', '))}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.id)} – ${esc(a.title)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a2e;line-height:1.45;margin:28px}
h1{color:#000099;font-size:18pt;margin:0 0 4px}h2{color:#000099;font-size:12.5pt;border-bottom:2px solid #FFCC00;padding-bottom:3px;margin:22px 0 8px}
.meta{color:#5a5a7a;margin:0 0 4px}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:4px 8px;border-bottom:1px solid #e0dbd4}
th{width:34%;color:#5a5a7a;font-weight:normal}.budget th{width:auto;font-weight:bold;color:#1a1a2e}.num{text-align:right;white-space:nowrap}.total td{font-weight:bold;border-top:2px solid #1a1a2e}
p{margin:0 0 8px}h3{font-size:11pt;margin:14px 0 4px}
.band{background:#000099;color:#fff;padding:10px 14px;margin:0 0 18px;border-bottom:4px solid #FFCC00;font-size:10pt;line-height:1.5}.band b{font-size:12pt}</style></head><body>
<div class="band"><b>EEG101 · Fundamentals of Open &amp; Rigorous EEG Science</b><br>COST Action CA24148 · Grant application · ${esc(a.call_name)}</div>
<h1>${esc(a.title)}</h1>
<p class="meta"><strong>${esc(a.id)}</strong> · ${esc(s.title)} · ${esc(a.call_name)}</p>
<p class="meta">Submitted ${esc(a.submitted_text)}${blind ? '' : ` by ${esc(a.first_name)} ${esc(a.last_name)}`}</p>
${section('Applicant', applicant)}
${section('Activity', `<table>${row('Dates', `${formatDate(a.start_date)} to ${formatDate(a.end_date)} (${a.days} day${a.days === 1 ? '' : 's'})`)}${specifics}</table>`)}
${section('Proposal', questions)}
${section('Budget', budget + `<h3>Justification of costs</h3>${para(a.justification)}`)}
${section('Documents', `<ul>${docs}</ul>`)}
${section('Declaration', `<p>The applicant confirmed that the information is accurate, that they have read the privacy notice, and that they will follow the COST rules for this grant, including applying through e-COST if accepted.${blind ? '' : ` Signed: ${esc(a.signature)}.`}</p>`)}
</body></html>`;
}

function applicationPdf(a) {
  return Utilities.newBlob(applicationHtml(a), 'text/html', `${a.id}.html`).getAs('application/pdf').setName(`${a.id} – Application.pdf`);
}

// When the applicant will hear: within 8 weeks of the call's deadline, or of
// their submission for a rolling call (one with no deadline). Usually sooner.
function decisionTiming(a) {
  const deadline = a.call_deadline ? parseDeadline(a.call_deadline) : null;
  return deadline
    ? `We will let you know the outcome by email within 8 weeks of the call's deadline (${formatDate(Utilities.formatDate(deadline, GRANTS.timezone, 'yyyy-MM-dd'))}), and in practice usually much sooner.`
    : 'This call is open on a rolling basis, so we will let you know the outcome by email within 8 weeks of your submission, and in practice usually much sooner.';
}

// To the applicant only. A free Gmail account can email about 100 recipients a
// day, so instead of copying the team in on each one, the people in GRANTS_BCC
// get one daily digest (sendDailyDigest), and every email sent is in the
// account's Sent folder.
function sendConfirmation(a, pdf) {
  const s = SCHEMES[a.scheme];
  const text = [
    `Dear ${a.first_name},`,
    `Thank you for applying for EEG101 funding. We have received your application.`,
    `Reference: ${a.id}\nScheme: ${s.title}\nTitle: ${a.title}\nDates: ${formatDate(a.start_date)} to ${formatDate(a.end_date)}\nAmount requested: €${a.total.toFixed(2)}\nSubmitted: ${a.submitted_text}`,
    'A PDF copy of your application is attached. Please quote your reference if you contact us about it.',
    decisionTiming(a),
    'You do not need to do anything in e-COST yet. If your application is accepted, we will ask you to apply through COST\'s online platform, e-COST (e-services.cost.eu), with the same details and your CV in your e-COST profile. COST then issues your grant letter.',
    'With best wishes,\nThe EEG101 Grants team\nCOST Action CA24148'
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a2e">${text.map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
  MailApp.sendEmail({
    to: a.email, replyTo: GRANTS.replyTo, name: GRANTS.name,
    subject: `EEG101 application received: ${a.id} – ${a.title}`.slice(0, 250),
    body: text.join('\n\n'), htmlBody: html, attachments: [pdf || applicationPdf(a)]
  });
}

/* ------------------------------------------------------------- daily digest */

// Every morning (about 08:00 Brussels time), one email to the people in the
// GRANTS_BCC script property listing the applications received since the last
// digest, with their PDFs when there are up to 10. Nothing is sent on a day
// with no new applications.
function sendDailyDigest() {
  const props = PropertiesService.getScriptProperties();
  const to = String(props.getProperty('GRANTS_BCC') || '').split(',').map(x => x.trim()).filter(x => EMAIL_PATTERN.test(x));
  const since = props.getProperty('GRANTS_LAST_DIGEST') ? new Date(props.getProperty('GRANTS_LAST_DIGEST')) : new Date(Date.now() - 24 * 3600 * 1000);
  const now = new Date();
  if (!to.length) return 0;
  const calls = readCalls();
  const fresh = rowsAsObjects(tab('Applications')).filter(r => r['Submitted'] && new Date(r['Submitted']) > since && new Date(r['Submitted']) <= now);
  if (!fresh.length) { props.setProperty('GRANTS_LAST_DIGEST', now.toISOString()); return 0; }
  const callName = r => (calls.filter(c => c.id === String(r['Call']))[0] || {}).name || '';
  const byCall = {};
  fresh.forEach(r => { const k = callName(r) || 'Other'; byCall[k] = (byCall[k] || 0) + 1; });
  const lines = fresh.map(r => `• ${r['ID']} · ${r['Scheme']} · ${r['First name']} ${r['Last name']} (${r['Country']}) · "${r['Title']}" · €${(asNumber(r['Requested (€)']) || 0).toFixed(2)}${r['Eligibility notes'] ? `\n   ⚠ ${r['Eligibility notes']}` : ''}`);
  const attach = fresh.length <= 10;
  const attachments = attach ? fresh.map(r => { try { return applicationPdf(JSON.parse(String(r['Data'] || '{}'))); } catch (e) { return null; } }).filter(Boolean) : [];
  const text = [
    `${fresh.length} new EEG101 grant application${fresh.length === 1 ? '' : 's'} since ${formatDateTime(since)}:`,
    lines.join('\n'),
    Object.keys(byCall).map(k => `${k}: ${byCall[k]}`).join('\n'),
    attach ? 'Their PDFs are attached.' : 'Read them in the grants portal.',
    'This is the daily digest of the EEG101 grants platform, sent to the addresses in its GRANTS_BCC setting.'
  ];
  MailApp.sendEmail({ to: to.join(','), replyTo: GRANTS.replyTo, name: GRANTS.name, subject: `EEG101 grants: ${fresh.length} new application${fresh.length === 1 ? '' : 's'}`, body: text.join('\n\n'), attachments: attachments });
  props.setProperty('GRANTS_LAST_DIGEST', now.toISOString());
  return fresh.length;
}

/* -------------------------------------------------------- decision emails */

const DECISION_EMAILS = ['Funded', 'Reserve', 'Not funded'];
const ACKNOWLEDGEMENT = 'This publication is based on work supported by the European COST Action CA24148: ‘EEG101 - Fundamentals of Open & Rigorous EEG Science’.';

// The email telling an applicant the chairs' decision, from the templates
// below, with an optional note from the chair.
function decisionEmail(r, call, note) {
  const s = Object.keys(SCHEMES).map(id => SCHEMES[id]).filter(x => x.short === String(r['Scheme']))[0] || {};
  const decision = String(r['Decision']);
  const id = String(r['ID']), title = String(r['Title']), callName = call ? call.name : 'EEG101 funding';
  const awarded = asNumber(r['Awarded (€)']) || 0;
  const start = iso(r['Start date']), end = iso(r['End date']);
  const due = reportDue(end, call ? call.periodEnd : GRANTS.firstCall.period_end);
  const lines = [`Dear ${r['First name']},`];
  let subject;
  if (decision === 'Funded') {
    subject = `EEG101 grant awarded: ${id} – ${title}`;
    lines.push(
      `I am delighted to tell you that your application ${id}, "${title}", for a ${s.title || r['Scheme']} under ${callName}, has been selected for funding by EEG101, with a grant of up to €${awarded.toFixed(2)}.`,
      'What happens next:',
      `1. Apply through COST's online platform, e-COST (https://e-services.cost.eu/), with the same details as your application, and make sure your CV is uploaded to your e-COST profile. Please do this as soon as you can: COST issues your grant letter once your e-COST application is approved.`,
      `2. Carry out your activity as approved, from ${formatDate(start)} to ${formatDate(end)}. Please acknowledge EEG101 and COST in anything that comes out of it, for example: "${ACKNOWLEDGEMENT}"`,
      `3. Submit your report in e-COST by ${formatDate(due)} (30 days after the end of your activity, or 15 days after the end of the grant period if sooner).${s.kind === 'conference' ? ' Include your certificate of attendance and the programme or book of abstracts showing your presentation.' : ''} The grant is paid once your report is approved.`
    );
    if (s.kind === 'stsm') lines.push('Once your grant is approved in e-COST, you can ask the Grant Holder for up to 50% of it in advance; this depends on funds being available and the Grant Holder agreeing.');
    lines.push('Congratulations, and please tell us if your plans change.');
  } else if (decision === 'Reserve') {
    subject = `EEG101 grant application ${id}: reserve list`;
    lines.push(
      `Thank you for applying for EEG101 funding. Your application ${id}, "${title}", under ${callName}, has been placed on our reserve list. The reviewers rated it as fundable, but the budget for this call is committed for now.`,
      'If funds become available, we will contact you. Please let us know if your plans change in the meantime, and do not apply in e-COST unless we ask you to.'
    );
  } else {
    subject = `EEG101 grant application ${id}: outcome`;
    lines.push(
      `Thank you for applying for EEG101 funding. We are sorry to tell you that your application ${id}, "${title}", under ${callName}, has not been selected for funding on this occasion. We received many strong applications, and the funding available is limited.`,
      'We hope you will apply again: new calls are announced on www.eeg101.eu/grants/.'
    );
  }
  if (String(note || '').trim()) lines.push(`A note from the grants committee:\n${String(note).trim().slice(0, 3000)}`);
  lines.push('With best wishes,\nThe EEG101 Grants team\nCOST Action CA24148');
  return { to: String(r['Email']), subject: subject.slice(0, 250), body: lines.join('\n\n') };
}

function decisionContext(key, id) {
  const me = requireReviewer(key, true);
  const r = rowsAsObjects(tab('Applications')).filter(x => String(x['ID']) === String(id))[0];
  if (!r) throw new Error(`Application ${id} not found.`);
  if (DECISION_EMAILS.indexOf(String(r['Decision'])) < 0) throw new Error(`${id} has no decision to email yet (Funded, Reserve or Not funded).`);
  if (String(r['Email']).toLowerCase() === me.email) throw new Error(`${id} is your own application, so another chair must email the decision.`);
  if ((reviewsByApplication()[String(id)] || []).some(x => x.reviewer === me.email && x.conflict)) throw new Error(`You declared a conflict of interest for ${id}, so another chair must email the decision.`);
  return { me: me, r: r, call: readCalls().filter(c => c.id === String(r['Call']))[0] || null };
}

// Chair only: the email as it would be sent.
function previewDecisionEmail(key, id, note) {
  const { r, call } = decisionContext(key, id);
  const mail = decisionEmail(r, call, note);
  mail.alreadySent = r['Decision emailed'] ? `${formatDateTime(new Date(r['Decision emailed']))}, as ${r['Decision emailed as']}` : '';
  return mail;
}

// Chair only: items = [{ id, note }]. Sends each decision email, records when
// and by whom, and stops before the account's daily email allowance runs out.
function sendDecisionEmails(key, items) {
  requireReviewer(key, true);
  const sheet = tab('Applications');
  ensureColumns(sheet, APPLICATION_COLUMNS);
  const { map } = headerMap(sheet);
  let sent = 0; const problems = [];
  (Array.isArray(items) ? items : []).forEach(item => {
    try {
      if (MailApp.getRemainingDailyQuota() < 2) throw new Error(`${item.id}: not sent, because the account's email allowance for today is used up. Send it again tomorrow.`);
      const { me, r, call } = decisionContext(key, item.id);
      const mail = decisionEmail(r, call, item.note);
      MailApp.sendEmail({ to: mail.to, replyTo: GRANTS.replyTo, name: GRANTS.name, subject: mail.subject, body: mail.body });
      sheet.getRange(r._row, map['Decision emailed'] + 1).setValue(new Date());
      sheet.getRange(r._row, map['Decision emailed as'] + 1).setValue(String(r['Decision']));
      sheet.getRange(r._row, map['Decision emailed by'] + 1).setValue(me.email);
      sent++;
    } catch (error) { problems.push(error.message); }
  });
  const out = listApplications(key);
  out.notice = [`${sent} decision email${sent === 1 ? '' : 's'} sent.`].concat(problems).join(' ');
  return out;
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
  const callsTab = ensure('Calls', CALL_COLUMNS);
  callsTab.getRange('E:F').setNumberFormat('@');
  if (callsTab.getLastRow() === 1) {
    // The first call, from the call settings of an earlier version if there are any.
    let old = {};
    try { old = readSettings(); } catch (error) { old = {}; }
    const f = GRANTS.firstCall;
    appendRow(callsTab, CALL_COLUMNS, {
      'Call ID': 'main', 'Name': old.call_name || f.name, 'Schemes': old.call_schemes || DEFAULT_CALL_SCHEMES.join(', '),
      'Open': String(old.call_open).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE', 'Deadline': old.deadline || '', 'Period end': old.period_end || f.period_end,
      'ID prefix': old.id_prefix || f.id_prefix, 'Questions': '[]', 'Documents': '[]', 'Created': new Date(), 'Blind review': 'TRUE'
    });
  }
  const settings = ensure('Settings', ['Setting', 'Value', 'What it means']);
  const help = {
    budget_stsm: 'Optional: money available for STSMs in this call, for the budget tracker (€).',
    budget_vmg: 'Optional: money available for VMGs (€).',
    budget_itc_conference: 'Optional: money available for ITC Conference Grants (€).',
    budget_yri_conference: 'Optional: money available for YRI Conference Grants (€).',
    budget_dissemination_conference: 'Optional: money available for Dissemination Conference Grants (€).',
    web_app_url: 'The address of the web app deployment (ends in /exec). Used for reviewers\' personal links.'
  };
  const existing = settings.getDataRange().getValues().map(r => String(r[0]));
  Object.keys(GRANTS.defaults).forEach(key => { if (existing.indexOf(key) < 0) settings.appendRow([key, GRANTS.defaults[key], help[key] || '']); });
  settings.getRange('B:B').setNumberFormat('@');
  const blank = book.getSheetByName('Sheet1');
  if (blank && book.getSheets().length > 1) book.deleteSheet(blank);

  ScriptApp.getProjectTriggers().filter(t => ['cleanStaging', 'sendDailyDigest'].indexOf(t.getHandlerFunction()) >= 0).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('cleanStaging').timeBased().everyDays(1).create();
  ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(8).inTimezone(GRANTS.timezone).create();
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
// Chairs add, invite and remove reviewers on the "Reviewers" page of the
// portal. From the editor, sendReviewerLinks emails everyone listed who has not
// had a link yet, and showReviewerLinks logs everyone's link (e.g. your own).
function sendReviewerLinks() { reviewerLinks(true); }
function showReviewerLinks() { reviewerLinks(false); }

function reviewerLinks(send) {
  const sheet = reviewersTab();
  rowsAsObjects(sheet).forEach(r => {
    const email = String(r['Email'] || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return;
    const link = send && !r['Link sent'] ? sendInvite(sheet, r, false) : reviewLink(sheet, r, false);
    console.log(`${email}: ${link}`);
  });
}

// The web app's own address, kept in Settings (web_app_url) the first time the
// deployed app is opened, so links can be made from the editor too.
function rememberAppUrl() {
  try {
    const url = String(ScriptApp.getService().getUrl() || '');
    if (/^https:\/\/script\.google\.com\/\S+\/exec$/.test(url) && readSettings().web_app_url !== url) setSetting('web_app_url', url);
  } catch (error) { /* not set up yet, or not deployed: nothing to remember */ }
}

function appUrl() {
  const saved = String(readSettings().web_app_url || '').trim();
  if (/^https:\/\/script\.google\.com\/\S+\/exec$/.test(saved)) return saved;
  let url = '';
  try { url = String(ScriptApp.getService().getUrl() || ''); } catch (error) { url = ''; }
  if (/^https:\/\/script\.google\.com\/\S+\/exec$/.test(url)) return url;
  throw new Error('The review links need the web app address. Open the deployed web app once (or put its address, ending in /exec, in the web_app_url setting) and try again.');
}

function reviewersTab() {
  const sheet = tab('Reviewers');
  ensureColumns(sheet, REVIEWER_COLUMNS);
  return sheet;
}

// The personal link for a row of the Reviewers tab, making a key if it has
// none (or a new one, which stops the old link working).
function reviewLink(sheet, r, renew) {
  const { map } = headerMap(sheet);
  let key = String(r['Personal key'] || '').trim();
  if (renew || key.length < 32) {
    key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    sheet.getRange(r._row, map['Personal key'] + 1).setValue(key);
    r['Personal key'] = key;
  }
  return `${appUrl()}?view=review&key=${key}`;
}

function sendInvite(sheet, r, renew, requested) {
  const link = reviewLink(sheet, r, renew);
  const role = roleOf(String(r['Role (reviewer or chair)'] || ''));
  const text = [
    `Dear ${String(r['Name'] || '').trim() || 'colleague'},`,
    requested ? `Here is your personal link to the EEG101 grants portal, as requested on the website:\n${link}\n\nIf you did not ask for it, you can ignore this email.` : `You have been added as ${ROLE_NAMES[role]} for EEG101 grants. This is your personal link to the grants portal:\n${link}`,
    renew ? 'This link replaces any earlier one, which no longer works.' : '',
    'Please keep it to yourself: anyone with the link can act as you. If it is shared by mistake, tell us and we will replace it.',
    role === 'administrator' ? 'The Funded grants page shows each funded grant, its dates and report deadline, and lets you update its status and send reminders.' : 'Before you score an application, check whether you have a conflict of interest with the applicant (the portal lists the situations). If you do, declare it and do not score.',
    'With thanks,\nThe EEG101 Grants team'
  ].filter(Boolean);
  MailApp.sendEmail({ to: String(r['Email']).trim().toLowerCase(), replyTo: GRANTS.replyTo, name: GRANTS.name, subject: 'Your EEG101 grants portal link', body: text.join('\n\n') });
  sheet.getRange(r._row, headerMap(sheet).map['Link sent'] + 1).setValue(new Date());
  return link;
}

function setSetting(key, value) {
  const sheet = tab('Settings');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (String(rows[i][0]).trim() === key) { sheet.getRange(i + 1, 2).setValue(value); return; }
  sheet.appendRow([key, value, '']);
}

/* ------------------------------------------------------- portal: reviewers */

// Chair only. Everyone who can open the portal, with how far they have got.
function listReviewers(key) {
  const me = requireReviewer(key, true);
  const reviews = reviewsByApplication();
  const apps = rowsAsObjects(tab('Applications'));
  return rowsAsObjects(reviewersTab()).map(r => {
    const email = String(r['Email'] || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return null;
    const assigned = apps.filter(a => assignedTo(a).indexOf(email) >= 0).map(a => String(a['ID']));
    const mine = Object.keys(reviews).map(id => (reviews[id].filter(x => x.reviewer === email)[0] || null) && { id: id, conflict: reviews[id].filter(x => x.reviewer === email)[0].conflict }).filter(Boolean);
    return {
      email: email, name: String(r['Name'] || '').trim(), role: roleOf(String(r['Role (reviewer or chair)'] || '')), chair: roleOf(String(r['Role (reviewer or chair)'] || '')) === 'chair',
      invited: r['Link sent'] ? formatDateTime(r['Link sent'] instanceof Date ? r['Link sent'] : new Date(r['Link sent'])) : '',
      assigned: assigned.length, scored: mine.filter(x => !x.conflict).length, conflicts: mine.filter(x => x.conflict).length,
      assignedDone: assigned.filter(id => mine.some(x => x.id === id)).length, self: email === me.email
    };
  }).filter(Boolean);
}

// Chair only: add someone, or change a name or role. invite emails their link.
function saveReviewer(key, input) {
  const me = requireReviewer(key, true);
  const email = clean(input && input.email, 200).toLowerCase();
  const name = clean(input && input.name, 150);
  const role = input && ROLES.indexOf(input.role) >= 0 ? input.role : 'reviewer';
  if (!EMAIL_PATTERN.test(email)) throw new Error('Please enter a valid email address.');
  if (email === me.email && role !== 'chair') throw new Error('You cannot remove your own chair role. Ask another chair to do it.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = reviewersTab();
    const { map } = headerMap(sheet);
    let r = rowsAsObjects(sheet).filter(x => String(x['Email'] || '').trim().toLowerCase() === email)[0];
    if (r) {
      if (name) sheet.getRange(r._row, map['Name'] + 1).setValue(name);
      sheet.getRange(r._row, map['Role (reviewer or chair)'] + 1).setValue(role);
    } else {
      appendRow(sheet, REVIEWER_COLUMNS, { 'Email': email, 'Name': name, 'Role (reviewer or chair)': role });
      r = rowsAsObjects(sheet).filter(x => String(x['Email'] || '').trim().toLowerCase() === email)[0];
    }
    r = rowsAsObjects(sheet).filter(x => x._row === r._row)[0];
    if (input && input.invite) sendInvite(sheet, r, false);
  } finally {
    lock.releaseLock();
  }
  return listReviewers(key);
}

// Chair only: email someone their link again; renew makes a new link and
// stops the old one working.
function inviteReviewer(key, email, renew) {
  requireReviewer(key, true);
  const sheet = reviewersTab();
  const r = rowsAsObjects(sheet).filter(x => String(x['Email'] || '').trim().toLowerCase() === String(email).toLowerCase())[0];
  if (!r) throw new Error('That person is not on the list.');
  sendInvite(sheet, r, !!renew);
  return listReviewers(key);
}

// Chair only: their link stops working at once, and they are taken off any
// applications assigned to them. Their reviews so far are kept.
function removeReviewer(key, email) {
  const me = requireReviewer(key, true);
  email = String(email || '').toLowerCase();
  if (email === me.email) throw new Error('You cannot remove yourself.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = reviewersTab();
    const r = rowsAsObjects(sheet).filter(x => String(x['Email'] || '').trim().toLowerCase() === email)[0];
    if (!r) throw new Error('That person is not on the list.');
    sheet.deleteRow(r._row);
    const apps = tab('Applications');
    ensureColumns(apps, APPLICATION_COLUMNS);
    const col = headerMap(apps).map['Assigned reviewers'] + 1;
    rowsAsObjects(apps).forEach(a => { const list = assignedTo(a); if (list.indexOf(email) >= 0) apps.getRange(a._row, col).setValue(list.filter(x => x !== email).join(', ')); });
  } finally {
    lock.releaseLock();
  }
  return listReviewers(key);
}

/* ----------------------------------------------------- portal: assignments */

const assignedTo = r => String(r['Assigned reviewers'] || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => EMAIL_PATTERN.test(x));

// Reviewers see only the applications a chair has assigned to them. An
// application with no one assigned is seen by the chairs alone.
// The grants administrator sees funded applications only.
const canAccess = (me, r) => me.chair || (me.admin ? String(r['Decision']) === 'Funded' : assignedTo(r).indexOf(me.email) >= 0);

function requireAccess(me, r) {
  if (!canAccess(me, r)) throw new Error('This application is not assigned to you.');
}

// Chair only: input { ids, add: [emails], remove: [emails], notify }. Applicants
// are never assigned their own application. notify emails each newly assigned
// reviewer the list of what is new for them.
function assignReviewers(key, input) {
  requireReviewer(key, true);
  const ids = (input && Array.isArray(input.ids) ? input.ids : []).map(String);
  const add = (input && Array.isArray(input.add) ? input.add : []).map(x => String(x).toLowerCase());
  const remove = (input && Array.isArray(input.remove) ? input.remove : []).map(x => String(x).toLowerCase());
  if (!ids.length) throw new Error('Choose at least one application.');
  const people = reviewerList();
  add.forEach(e => { if (!people.some(p => p.email === e && !p.admin)) throw new Error(`${e} is not on the reviewer list.`); });
  const skipped = [], fresh = {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = tab('Applications');
    ensureColumns(sheet, APPLICATION_COLUMNS);
    const col = headerMap(sheet).map['Assigned reviewers'] + 1;
    const rows = rowsAsObjects(sheet);
    ids.forEach(id => {
      const r = rows.filter(x => String(x['ID']) === id)[0];
      if (!r) throw new Error(`Application ${id} not found.`);
      const before = assignedTo(r);
      let list = before.filter(e => remove.indexOf(e) < 0);
      add.forEach(e => {
        if (e === String(r['Email']).toLowerCase()) { skipped.push(`${id} is ${e}'s own application, so they were not assigned to it.`); return; }
        if (list.indexOf(e) < 0) list.push(e);
        if (before.indexOf(e) < 0) (fresh[e] = fresh[e] || []).push(`${id}: ${r['Title']} (${r['Scheme']})`);
      });
      sheet.getRange(r._row, col).setValue(list.join(', '));
    });
  } finally {
    lock.releaseLock();
  }
  let notified = 0;
  if (input.notify) {
    const reviewersSheet = reviewersTab();
    rowsAsObjects(reviewersSheet).forEach(r => {
      const email = String(r['Email'] || '').trim().toLowerCase();
      if (!fresh[email]) return;
      const link = reviewLink(reviewersSheet, r, false);
      MailApp.sendEmail({
        to: email, replyTo: GRANTS.replyTo, name: GRANTS.name, subject: `EEG101 grants: ${fresh[email].length} application${fresh[email].length === 1 ? '' : 's'} to review`,
        body: [`Dear ${String(r['Name'] || '').trim() || 'colleague'},`, `These applications have been assigned to you for review:\n${fresh[email].map(x => '• ' + x).join('\n')}`, `Open the grants portal with your personal link:\n${link}`, 'With thanks,\nThe EEG101 Grants team'].join('\n\n')
      });
      notified++;
    });
  }
  const out = listApplications(key);
  out.notice = [`Saved.${input.notify ? ` ${notified} reviewer${notified === 1 ? '' : 's'} emailed.` : ''}`].concat(skipped).join(' ');
  return out;
}

/* -------------------------------------------------- portal: funded grants */

const addDays = (isoDate, n) => { const d = new Date(Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };

// COST: the report is due 30 days after the activity ends, or 15 days after the
// end of the grant period, whichever comes first.
function reportDue(end, periodEnd) {
  if (!DATE_PATTERN.test(end)) return '';
  const a = addDays(end, 30);
  return DATE_PATTERN.test(periodEnd) && addDays(periodEnd, 15) < a ? addDays(periodEnd, 15) : a;
}

// The end of the grant period for an application: its call's.
function periodEnds() {
  const byCall = {};
  readCalls().forEach(c => { byCall[c.id] = c.periodEnd; });
  return r => byCall[String(r['Call'])] || GRANTS.firstCall.period_end;
}

// Chairs and the grants administrator: every funded application, with where it
// is and what is due.
function listFunded(key) {
  const me = requireReviewer(key, true, true);
  const ends = periodEnds();
  const calls = readCalls();
  const today = Utilities.formatDate(new Date(), GRANTS.timezone, 'yyyy-MM-dd');
  const grants = rowsAsObjects(tab('Applications')).filter(r => String(r['Decision']) === 'Funded').map(r => {
    const start = iso(r['Start date']), end = iso(r['End date']);
    const status = String(r['Grant status'] || '') || GRANT_STATUSES[0];
    const due = reportDue(end, ends(r));
    return {
      id: String(r['ID']), applicant: `${r['First name']} ${r['Last name']}`, email: String(r['Email']), scheme: String(r['Scheme']), title: String(r['Title']),
      callName: (calls.filter(c => c.id === String(r['Call']))[0] || {}).name || '',
      country: String(r['Country']), awarded: asNumber(r['Awarded (€)']), start: start, end: end, reportDue: due,
      daysToReport: due ? daysBetween(today, due) - 1 : null, started: !!start && start <= today, ended: !!end && end < today,
      status: status, done: GRANT_DONE.indexOf(status) >= 0,
      statusUpdated: r['Grant status updated'] ? formatDateTime(r['Grant status updated'] instanceof Date ? r['Grant status updated'] : new Date(r['Grant status updated'])) : '',
      statusBy: String(r['Grant status by'] || ''),
      lastReminder: r['Last reminder'] ? formatDateTime(r['Last reminder'] instanceof Date ? r['Last reminder'] : new Date(r['Last reminder'])) : '',
      reminders: asNumber(r['Reminders sent']) || 0, notes: String(r['Grant notes'] || '')
    };
  }).sort((x, y) => (x.done - y.done) || (x.reportDue < y.reportDue ? -1 : 1));
  return { me: me, today: today, statuses: GRANT_STATUSES, grants: grants };
}

// Chairs and the grants administrator: changes = [{ id, status?, notes? }].
function updateGrants(key, changes) {
  const me = requireReviewer(key, true, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = tab('Applications');
    ensureColumns(sheet, APPLICATION_COLUMNS);
    const { map } = headerMap(sheet);
    const rows = rowsAsObjects(sheet);
    (Array.isArray(changes) ? changes : []).forEach(c => {
      const r = rows.filter(x => String(x['ID']) === String(c.id) && String(x['Decision']) === 'Funded')[0];
      if (!r) throw new Error(`${c.id} is not a funded grant.`);
      const set = (h, v) => sheet.getRange(r._row, map[h] + 1).setValue(v);
      if (c.status !== undefined) {
        if (GRANT_STATUSES.indexOf(c.status) < 0) throw new Error('Unknown grant status.');
        set('Grant status', c.status); set('Grant status updated', new Date()); set('Grant status by', me.email);
      }
      if (c.notes !== undefined) set('Grant notes', String(c.notes).slice(0, 2000));
    });
  } finally {
    lock.releaseLock();
  }
  return listFunded(key);
}

// Chairs and the grants administrator: email grantees a reminder of what is
// next for them: applying in e-COST (until the grant letter is issued), or
// their report in e-COST. Grants whose report is in, or that are paid or
// cancelled, are skipped. Copied to the EEG101 address, for the record.
function sendGrantReminders(key, ids) {
  requireReviewer(key, true, true);
  const ends = periodEnds();
  const sheet = tab('Applications');
  ensureColumns(sheet, APPLICATION_COLUMNS);
  const { map } = headerMap(sheet);
  const rows = rowsAsObjects(sheet);
  let sent = 0; const skipped = [];
  (Array.isArray(ids) ? ids : []).map(String).forEach(id => {
    const r = rows.filter(x => String(x['ID']) === id && String(x['Decision']) === 'Funded')[0];
    if (!r) { skipped.push(`${id} is not a funded grant.`); return; }
    const status = String(r['Grant status'] || '') || GRANT_STATUSES[0];
    if (GRANT_DONE.indexOf(status) >= 0) { skipped.push(`${id}: ${status}, so no reminder is needed.`); return; }
    const due = reportDue(iso(r['End date']), ends(r));
    const ecost = status === 'Awaiting e-COST application';
    const awarded = asNumber(r['Awarded (€)']) || 0;
    const text = [
      `Dear ${r['First name']},`,
      ecost
        ? `Congratulations again on your EEG101 ${r['Scheme']} (${id}, "${r['Title']}", €${awarded.toFixed(2)}). To receive the grant, please now apply through COST's online platform, e-COST (https://e-services.cost.eu/), with the same details as your application, and make sure your CV is uploaded to your e-COST profile. COST issues your grant letter once this is approved.`
        : `This is a reminder about the report for your EEG101 ${r['Scheme']} (${id}, "${r['Title']}", ${formatDate(iso(r['Start date']))} to ${formatDate(iso(r['End date']))}).`,
      ecost ? '' : `Please submit your report through e-COST (https://e-services.cost.eu/) by ${formatDate(due)}. That is 30 days after the end of your activity, or 15 days after the end of the grant period if sooner. ${String(r['Scheme']).indexOf('Conference') >= 0 ? 'Include your certificate of attendance and the programme or book of abstracts showing your presentation. ' : ''}The grant is paid once your report is approved.`,
      'If you have already done this, thank you, and please ignore this email. If anything has changed, reply to this email.',
      'With best wishes,\nThe EEG101 Grants team\nCOST Action CA24148'
    ].filter(Boolean);
    MailApp.sendEmail({
      to: String(r['Email']), replyTo: GRANTS.replyTo, name: GRANTS.name,
      subject: ecost ? `EEG101 grant ${id}: please apply in e-COST` : `EEG101 grant ${id}: report due ${formatDate(due)}`,
      body: text.join('\n\n')
    });
    sheet.getRange(r._row, map['Last reminder'] + 1).setValue(new Date());
    // (Not copied to anyone: the EEG101 account's Sent folder keeps a copy.)
    sheet.getRange(r._row, map['Reminders sent'] + 1).setValue((asNumber(r['Reminders sent']) || 0) + 1);
    sent++;
  });
  const out = listFunded(key);
  out.notice = [`${sent} reminder${sent === 1 ? '' : 's'} sent.`].concat(skipped).join(' ');
  return out;
}

/* ------------------------------------------------------------ portal: calls */

// Chair only: every call, with its applications so far, and the settings that
// apply to all calls (blind review, money per scheme).
function listCalls(key) {
  requireReviewer(key, true);
  const settings = readSettings();
  const apps = rowsAsObjects(tab('Applications'));
  const calls = readCalls().map(c => {
    const mine = apps.filter(r => String(r['Call']) === c.id);
    const funded = mine.filter(r => String(r['Decision']) === 'Funded');
    return Object.assign(callForForm(c), {
      open: c.open, accepting: callIsOpen(c), deadline: c.deadline, prefix: c.prefix, budget: c.budget, blind: c.blind,
      applications: mine.length, funded: funded.length, awarded: Math.round(funded.reduce((t, r) => t + (asNumber(r['Awarded (€)']) || 0), 0) * 100) / 100
    });
  });
  const budgets = {};
  Object.keys(SCHEMES).forEach(id => { budgets[id] = String(settings['budget_' + id] || ''); });
  let formUrl = '';
  try { formUrl = appUrl(); } catch (e) { formUrl = ''; }
  return {
    calls: calls, budgets: budgets, formUrl: formUrl, applyPage: APPLY_PAGE,
    schemes: Object.keys(SCHEMES).map(id => ({ id: id, title: SCHEMES[id].title, kind: SCHEMES[id].kind })),
    countries: COUNTRIES, industryTypes: INDUSTRY_TYPES
  };
}

const slug = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'call';

// Chair only: create a call (no id) or change one.
function saveCall(key, input) {
  requireReviewer(key, true);
  input = input || {};
  const name = clean(input.name, 150);
  if (!name) throw new Error('Please give the call a name.');
  const schemes = (Array.isArray(input.schemes) ? input.schemes : []).map(String).filter(id => SCHEMES[id]);
  if (!schemes.length) throw new Error('Choose at least one scheme for the call.');
  const deadline = clean(input.deadline, 20);
  if (deadline && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) throw new Error('Please give the deadline as a date and time.');
  const periodEnd = clean(input.periodEnd, 10);
  if (!DATE_PATTERN.test(periodEnd)) throw new Error('Please give the date activities must end by.');
  const prefix = clean(input.prefix, 8).toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(prefix)) throw new Error('The ID prefix should be up to 8 letters or numbers, e.g. G2 or IND1.');
  const budget = clean(input.budget, 20);
  if (budget && !(Number(budget) >= 0)) throw new Error('The budget should be an amount in euros, or empty.');
  const host = input.host && clean(input.host.institution, 150) ? input.host : null;
  if (host && host.country && COUNTRIES.indexOf(host.country) < 0) throw new Error('Please choose the host country from the list.');
  if (host && host.type && INDUSTRY_TYPES.indexOf(host.type) < 0) throw new Error('Please choose the type of host organisation from the list.');
  const ids = {};
  const items = (list, kind) => (Array.isArray(list) ? list : []).map((x, i) => {
    const label = clean(x && x.label, 200);
    if (!label) return null;
    let id = String(x.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || `${kind}${i + 1}`;
    while (ids[kind + ':' + id]) id += 'x';
    ids[kind + ':' + id] = true;
    const out = { id: id, label: label, required: !!x.required };
    if (kind === 'q') { out.hint = clean(x.hint, 300); out.words = Math.max(20, Math.min(1000, Math.round(Number(x.words) || 300))); }
    return out;
  }).filter(Boolean);
  const questions = items(input.questions, 'q'), documents = items(input.documents, 'd');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let id;
  try {
    const sheet = tab('Calls');
    ensureColumns(sheet, CALL_COLUMNS);
    const calls = readCalls();
    const existing = input.id ? calls.filter(c => c.id === String(input.id))[0] : null;
    if (input.id && !existing) throw new Error('That call no longer exists.');
    if (calls.some(c => c !== existing && c.prefix.toUpperCase() === prefix)) throw new Error(`Another call already uses the ID prefix ${prefix}.`);
    if (existing && existing.prefix !== prefix && rowsAsObjects(tab('Applications')).some(r => String(r['Call']) === existing.id)) throw new Error('This call already has applications, so its ID prefix cannot change.');
    id = existing ? existing.id : slug(name);
    if (!existing) { let n = 2; const base = id; while (calls.some(c => c.id === id)) id = `${base}-${n++}`; }
    const values = {
      'Call ID': id, 'Name': name, 'Schemes': schemes.join(', '), 'Open': input.open ? 'TRUE' : 'FALSE', 'Deadline': deadline, 'Period end': periodEnd,
      'ID prefix': prefix, 'Description': clean(input.description, 1000),
      'Host organisation': host ? clean(host.institution, 150) : '', 'Host country': host ? clean(host.country, 100) : '', 'Host type': host ? clean(host.type, 60) : '', 'Host lead': host ? clean(host.name, 150) : '',
      'Questions': JSON.stringify(questions), 'Documents': JSON.stringify(documents), 'Budget (€)': budget,
      'Blind review': input.blind === false ? 'FALSE' : 'TRUE'
    };
    if (existing) {
      const { map } = headerMap(sheet);
      Object.keys(values).forEach(h => sheet.getRange(existing.row, map[h] + 1).setValue(values[h]));
    } else {
      values['Created'] = new Date();
      appendRow(sheet, CALL_COLUMNS, values);
    }
  } finally {
    lock.releaseLock();
  }
  const out = listCalls(key);
  out.saved = id;
  return out;
}

// Chair only: a call with no applications can be deleted; otherwise close it.
function deleteCall(key, id) {
  requireReviewer(key, true);
  const call = readCalls().filter(c => c.id === String(id))[0];
  if (!call) throw new Error('That call no longer exists.');
  if (rowsAsObjects(tab('Applications')).some(r => String(r['Call']) === call.id)) throw new Error('This call has applications, so it cannot be deleted. Close it instead.');
  tab('Calls').deleteRow(call.row);
  return listCalls(key);
}

// Chair only: blind review and the money available per scheme, for all calls.
function saveGrantSettings(key, input) {
  requireReviewer(key, true);
  input = input || {};
  Object.keys(input.budgets || {}).forEach(id => {
    if (!SCHEMES[id]) return;
    const v = clean(input.budgets[id], 20);
    if (v && !(Number(v) >= 0)) throw new Error(`The budget for ${SCHEMES[id].short} should be an amount in euros, or empty.`);
    setSetting('budget_' + id, v);
  });
  return listCalls(key);
}

/* ------------------------------------------------------------------- review */

function reviewerList() {
  return rowsAsObjects(tab('Reviewers')).map(r => ({
    email: String(r['Email'] || '').trim().toLowerCase(),
    name: String(r['Name'] || '').trim(),
    chair: roleOf(String(r['Role (reviewer or chair)'] || '')) === 'chair',
    admin: roleOf(String(r['Role (reviewer or chair)'] || '')) === 'administrator',
    key: String(r['Personal key'] || '').trim()
  })).filter(r => EMAIL_PATTERN.test(r.email));
}

// The reviewer a personal key belongs to, or null.
function reviewerByKey(key) {
  key = String(key || '').trim();
  if (key.length < 32) return null;
  try {
    const r = reviewerList().filter(x => x.key === key)[0];
    return r ? { email: r.email, name: r.name, chair: r.chair, admin: r.admin } : null;
  } catch (error) { return null; }
}

// chairOnly: chairs only (and the grants administrator, with allowAdmin).
// Otherwise reviewers and chairs; the grants administrator, who does not
// review, only where allowAdmin says so.
function requireReviewer(key, chairOnly, allowAdmin) {
  const me = reviewerByKey(key);
  if (!me) throw new Error('This review link is not valid any more. Ask the grants chair for a new one.');
  if (me.admin && !allowAdmin) throw new Error('As grants administrator you have the Funded grants page, not reviewing.');
  if (chairOnly && !me.chair && !me.admin) throw new Error('Only a grants chair can do this.');
  return me;
}

// Reviewers who are not chairs see applications without the applicant's
// identity, unless blind review is switched off for the call.
// Blind review is set per call (on by default). Chairs and the grants
// administrator are never blinded.
const isBlind = (me, call) => !me.chair && !me.admin && (!call || call.blind !== false);
const callOf = (calls, r) => calls.filter(c => c.id === String(r['Call'] || ''))[0] || null;

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
  const period = periodEnds();
  const live = rows.filter(r => ['Not funded', 'Withdrawn'].indexOf(String(r['Decision'])) < 0).map(r => ({
    id: String(r['ID']), period: period(r), email: String(r['Email']).toLowerCase(),
    scheme: String(r['Scheme']), kind: (byShort[String(r['Scheme'])] || {}).kind, start: iso(r['Start date']), end: iso(r['End date'])
  }));
  const out = {};
  const add = (id, text) => { (out[id] = out[id] || []).push(text); };
  live.forEach((x, i) => live.slice(i + 1).forEach(y => {
    if (x.email !== y.email) return;
    if (x.start <= y.end && y.start <= x.end) { add(x.id, `Dates overlap with ${y.id} (${y.scheme}) by the same applicant.`); add(y.id, `Dates overlap with ${x.id} (${x.scheme}) by the same applicant.`); }
    if (x.period === y.period && x.kind === 'conference' && y.kind === 'conference' && x.scheme !== y.scheme) { add(x.id, `The applicant also applied for a ${y.scheme} (${y.id}); only one type of conference grant is allowed per grant period.`); add(y.id, `The applicant also applied for a ${x.scheme} (${x.id}); only one type of conference grant is allowed per grant period.`); }
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
  const reviews = reviewsByApplication();
  const rows = rowsAsObjects(tab('Applications'));
  const warnings = overlapWarnings(rows);
  const people = reviewerList();
  const nameOf = e => (people.filter(p => p.email === e)[0] || {}).name || e;
  const calls = readCalls();
  const callNameOf = id => (calls.filter(c => c.id === id)[0] || {}).name || '';
  const apps = rows.filter(r => canAccess(me, r)).map(r => {
    const id = String(r['ID']);
    const blind = isBlind(me, callOf(calls, r));
    const all = reviews[id] || [];
    const mine = all.filter(x => x.reviewer === me.email)[0] || null;
    const own = String(r['Email']).toLowerCase() === me.email;
    const conflicted = own || !!(mine && mine.conflict);
    const scored = all.filter(x => !x.conflict && x.mean != null);
    const canSee = !conflicted && (me.chair || !!mine);
    return {
      id: id, submitted: iso(r['Submitted']), call: String(r['Call'] || ''), callName: callNameOf(String(r['Call'] || '')), scheme: String(r['Scheme']), title: String(r['Title']),
      applicant: blind ? '' : `${r['First name']} ${r['Last name']}`, institution: blind ? '' : String(r['Institution']), country: String(r['Country']), itc: String(r['ITC']),
      gender: blind ? '' : String(r['Gender']), yri: String(r['Under 40 (YRI)']), eci: String(r['Early-career (PhD < 8 years or student)']), career: String(r['Career stage']),
      start: iso(r['Start date']), end: iso(r['End date']), days: asNumber(r['Days']),
      requested: asNumber(r['Requested (€)']), notes: [String(r['Eligibility notes'] || '')].concat(warnings[id] || []).filter(Boolean).join(' '),
      folder: blind ? '' : String(r['Drive folder']),
      decision: String(r['Decision'] || ''), awarded: asNumber(r['Awarded (€)']), rank: asNumber(r['Rank']), decisionNotes: String(r['Decision notes'] || ''),
      decisionEmailed: me.chair && r['Decision emailed'] ? formatDateTime(new Date(r['Decision emailed'])) : '', decisionEmailedAs: me.chair ? String(r['Decision emailed as'] || '') : '',
      reviewCount: scored.length,
      mean: canSee && scored.length ? Math.round(scored.reduce((s, x) => s + x.mean, 0) / scored.length * 100) / 100 : null,
      blind: blind, own: own, conflicted: conflicted, assignedToMe: assignedTo(r).indexOf(me.email) >= 0,
      assigned: me.chair ? assignedTo(r).map(e => { const x = all.filter(y => y.reviewer === e)[0]; return { email: e, name: nameOf(e), status: !x ? 'todo' : x.conflict ? 'conflict' : 'scored' }; }) : [],
      mine: mine, others: canSee ? all.filter(x => x.reviewer !== me.email) : []
    };
  });
  return { me: me, blind: apps.some(a => a.blind), applications: apps, settings: settings, calls: calls.map(c => ({ id: c.id, name: c.name, budget: c.budget })), reviewers: me.chair ? people.filter(p => !p.admin).map(p => ({ email: p.email, name: p.name, chair: p.chair })) : [] };
}

function applicationRecord(id) {
  const r = rowsAsObjects(tab('Applications')).filter(x => String(x['ID']) === String(id))[0];
  if (!r) throw new Error('Application not found.');
  const data = JSON.parse(String(r['Data'] || '{}'));
  data.submitted_text = data.submitted_text || iso(r['Submitted']);
  return { row: r, data: data };
}

function getApplication(key, id) {
  const me = requireReviewer(key, false, true);
  const { row, data } = applicationRecord(id);
  requireAccess(me, row);
  const blind = isBlind(me, callOf(readCalls(), row));
  const documents = {};
  if (!blind) Object.keys(data.documents || {}).forEach(k => { documents[k] = { label: data.documents[k].label, name: data.documents[k].name }; });
  return { id: String(id), blind: blind, html: applicationHtml(data, blind), folder: blind ? '' : String(row['Drive folder']), documents: documents };
}

// A copy of the application PDF (doc "application") or one of its uploaded
// documents, for people allowed to see the applicant's identity.
function getDocument(key, id, doc) {
  const me = requireReviewer(key, false, true);
  const { row, data } = applicationRecord(id);
  requireAccess(me, row);
  if (isBlind(me, callOf(readCalls(), row))) throw new Error('Documents are not shown in blind review.');
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
  requireAccess(me, row);
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
    ensureColumns(sheet, APPLICATION_COLUMNS);
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
      if (c.decision === 'Funded' && !String(c.r['Grant status'] || '')) { set('Grant status', GRANT_STATUSES[0]); set('Grant status updated', new Date()); set('Grant status by', me.email); }
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
  const me = requireReviewer(key, false, true);
  const settings = readSettings();
  if (isBlind(me, null) && readCalls().some(c => c.blind)) throw new Error('Reports are for chairs while review is blind.');
  const apps = rowsAsObjects(tab('Applications'));
  const funded = apps.filter(r => String(r['Decision']) === 'Funded');
  const names = {}; readCalls().forEach(c => { names[c.id] = c.name; });
  const callName = r => names[String(r['Call'])] || String(r['Call'] || '');
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
    generated: formatDateTime(new Date()), callName: readCalls().map(c => c.name).join(', '),
    byCall: { submitted: group(apps, r => callName(r), requested), funded: group(funded, r => callName(r), awarded) },
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
