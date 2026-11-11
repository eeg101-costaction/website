/*
 * Tests for the grants Apps Script, run against fake-google.cjs:
 *   node scripts/google-apps-script/grants/test/run.cjs
 */
const assert = require('assert');
const vm = require('vm');
const { makeGoogle } = require('./fake-google.cjs');

const PDF = Buffer.from('%PDF-1.4\n% test file\n').toString('base64');
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : e); process.exitCode = 1; } };
const same = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const throwsLike = (fn, re) => assert.throws(fn, err => re.test(String(err && err.message)), `expected an error matching ${re}`);

function ready(opts) {
  const g = makeGoogle(opts);
  g.setUpGrants();
  g.tab('Settings').rows.forEach(r => { if (r[0] === 'web_app_url') r[1] = 'https://script.google.com/macros/s/ABC/exec'; });
  setCall(g, 'main', { 'Open': 'TRUE', 'Deadline': '2026-12-15T17:00' });
  g.state.props.GRANTS_BCC = 'amy@example.org, faisal@example.org, not-an-email';
  return g;
}

// Changes cells of a call's row in the Calls tab, by header.
function setCall(g, id, values) {
  const tab = g.tab('Calls');
  const headers = tab.rows[0];
  const row = tab.rows.filter(r => r[headers.indexOf('Call ID')] === id)[0];
  Object.keys(values).forEach(h => { row[headers.indexOf(h)] = values[h]; });
}

// Sets the Reviewers tab, gives everyone a key, and returns email → key.
function reviewers(g, list) {
  const tab = g.tab('Reviewers');
  tab.rows = [tab.rows[0]].concat(list);
  g.showReviewerLinks();
  const keys = {};
  g.rowsAsObjects(tab).forEach(r => { keys[r['Email']] = r['Personal key']; });
  return keys;
}

function conference(g, overrides) {
  return stsm(g, Object.assign({
    scheme: 'yri_conference', start_date: '2027-05-10', end_date: '2027-05-12', country: 'Germany',
    attendance: 'Online', conference_name: 'OHBM', contribution_title: 'Open EEG pipelines', presentation: 'Poster', abstract_status: 'Submitted, awaiting decision',
    third_party_organised: 'Yes', budget: [{ category: 'Registration fee', description: 'Fee', amount: 450 }],
    documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }), acceptance: g.uploadFile({ name: 'abs.pdf', data: PDF }) }
  }, overrides || {}));
}

// A form opened a minute ago, as a person would; tests submit many
// applications from one address, so the hourly limits start afresh here
// (their own test checks them).
function opened(g) {
  const started = String(Number(g.applyConfig('').started) - 60000);
  g.state.cache = {};
  return { started: started, startedSig: g.sign('started:' + started) };
}

function stsm(g, overrides) {
  const cv = g.uploadFile({ name: 'cv.pdf', data: PDF });
  const letter = g.uploadFile({ name: 'host letter.pdf', data: PDF });
  return Object.assign({
    scheme: 'stsm', first_name: 'Ada', last_name: 'Lovelace', email: 'Ada@Example.org', position: 'Postdoc', career_stage: 'Postdoctoral researcher',
    institution: 'University of Lisbon', department: 'Psychology', country: 'Portugal', orcid: '', yri: 'Yes', eci: 'Yes', gender: 'Female', member: 'Yes',
    working_groups: ['Curation and Harmonisation', 'WG2 Curation and Harmonisation'], start_date: '2027-03-01', end_date: '2027-03-14',
    host_name: 'Prof Host', host_email: 'host@leeds.ac.uk', host_institution: 'University of Leeds', host_country: 'United Kingdom', host_member: 'Yes',
    title: 'Harmonising resting-state EEG', summary: 'A short summary.', contribution: 'WG2 meetings.', workplan: 'Plan.', outcomes: 'Outcomes.', relevance: 'Relevant.', benefit: 'Benefit.',
    budget: [{ category: 'Travel', description: 'Flights', amount: '450' }, { category: 'Accommodation', description: '13 nights', amount: 1300 }],
    justification: 'Quotes from airline and university housing.',
    documents: { cv: cv, host_letter: letter },
    confirm_accurate: true, confirm_rules: true, confirm_privacy: true, signature: 'Ada Lovelace'
  }, opened(g), overrides || {});
}

test('set-up creates the tabs, defaults and a staging clean-up trigger, closed by default', () => {
  const g = makeGoogle();
  g.setUpGrants();
  const book = g.state.sheets[g.state.props.GRANTS_SHEET_ID];
  same(book.tabs.map(t => t.name), ['Applications', 'Reviews', 'Reviewers', 'Calls', 'Settings']);
  assert.strictEqual(g.applyConfig('').open, false);
  same(g.state.triggers.map(t => [t.getHandlerFunction(), t.hour]), [['cleanStaging', undefined], ['sendDailyDigest', 8]]);
  g.setUpGrants(); // running again adds nothing twice
  assert.strictEqual(g.state.triggers.length, 2);
  assert.strictEqual(g.tab('Calls').rows.length, 2, 'one first call, made once');
  assert.strictEqual(g.tab('Reviewers').rows.length, 2);
});

test('the call opens and closes with its row in the Calls tab and its deadline', () => {
  const g = ready();
  assert.strictEqual(g.applyConfig('stsm').open, true);
  assert.strictEqual(g.applyConfig('stsm').preselect, 'stsm');
  assert.strictEqual(g.applyConfig('nonsense').preselect, '');
  assert.match(g.applyConfig('').calls[0].deadlineText, /15 December 2026, 17:00 Brussels time/);
  assert.strictEqual(g.applyConfig('').calls[0].name, 'EEG101 Grant Period 2 call');
  g.setNow('2026-12-15T15:59:00Z'); assert.strictEqual(g.applyConfig('').open, true);   // 16:59 in Brussels
  g.setNow('2026-12-15T16:01:00Z'); assert.strictEqual(g.applyConfig('').open, false);  // 17:01 in Brussels
  throwsLike(() => g.uploadFile({ name: 'cv.pdf', data: PDF }), /closed/);
});

test('uploads: PDF only, size-limited, signed', () => {
  const g = ready();
  throwsLike(() => g.uploadFile({ name: 'cv.docx', data: PDF }), /PDF/);
  throwsLike(() => g.uploadFile({ name: 'cv.pdf', data: Buffer.from('not a pdf').toString('base64') }), /not a PDF/);
  throwsLike(() => g.uploadFile({ name: 'cv.pdf', data: Buffer.alloc(6 * 1024 * 1024, 37).toString('base64') }), /larger than 5 MB/);
  const r = g.uploadFile({ name: '../../cv.pdf', data: PDF });
  assert.ok(r.id && r.token && !/[\/]/.test(r.name));
});

test('a complete STSM application is stored, filed, emailed and returned as a PDF', () => {
  const g = ready();
  const result = g.submitApplication(stsm(g));
  assert.strictEqual(result.id, 'EEG101-G2-001');
  assert.ok(result.pdf.length > 10 && /Harmonising resting-state EEG/.test(result.html));
  const rows = g.rowsAsObjects(g.tab('Applications'));
  assert.strictEqual(rows.length, 1);
  const row = rows[0];
  assert.strictEqual(row['Email'], 'ada@example.org');
  assert.strictEqual(row['ITC'], 'Yes');
  assert.strictEqual(row['Requested (€)'], 1750);
  assert.strictEqual(row['Days'], 14);
  assert.strictEqual(row['Working Groups'], 'Curation and Harmonisation');
  assert.match(result.html, /EEG101 · Fundamentals of Open &amp; Rigorous EEG Science[\s\S]*COST Action CA24148 · Grant application · EEG101 Grant Period 2 call/);
  assert.match(row['Drive folder'], /drive\.google\.com\/drive\/folders/);
  const folder = Object.values(g.state.folders).filter(f => f.name.indexOf('EEG101-G2-001') === 0)[0];
  const inFolder = Object.values(g.state.files).filter(f => f.folder === folder).map(f => f.name).sort();
  assert.deepStrictEqual(inFolder.length, 3, inFolder);
  assert.ok(inFolder.some(n => /Application\.pdf$/.test(n)));
  const mail = g.state.mail[0];
  assert.strictEqual(mail.to, 'ada@example.org');
  assert.ok(!mail.cc && !mail.bcc, 'the team gets the daily digest instead of a copy of each');
  assert.strictEqual(mail.attachments.length, 1);
  assert.match(mail.body, /within 8 weeks of the call's deadline \(15 December 2026\), and in practice usually much sooner/);
  assert.ok(!/correct anything/.test(mail.body));
  assert.match(result.timing, /8 weeks/);
  assert.match(mail.subject, /EEG101-G2-001/);
  assert.match(mail.body, /do not need to do anything in e-COST yet\. If your application is accepted/);
  assert.match(result.html, /Your contribution to EEG101 to date[\s\S]*WG2 meetings/);
  assert.strictEqual(g.submitApplication(stsm(g)).id, 'EEG101-G2-002');
});

test('the rules are enforced on the server', () => {
  const g = ready();
  const cases = [
    [{ end_date: '2027-10-01' }, /completed by 30 September 2027/],
    [{ start_date: '2026-11-01' }, /past/],
    [{ end_date: '2027-03-03' }, /between 5 and 90 days/],
    [{ budget: [{ category: 'Travel', description: 'x', amount: 4100 }] }, /more than the maximum|needs an amount/],
    [{ budget: [{ category: 'Travel', description: 'x', amount: 2500 }, { category: 'Other', description: 'y', amount: 1600 }] }, /more than the maximum for a STSM \(€4000\)/],
    [{ budget: [{ category: 'Registration fee', description: 'x', amount: 10 }] }, /category/],
    [{ host_member: 'No' }, /host institution must be a member/],
    [{ host_country: 'Portugal' }, /different country from your own institution/],
    [{ contribution: '' }, /Your contribution to EEG101 to date/],
    [{ contribution: 'word '.repeat(251) }, /250 words/],
    [{ budget: [{ category: 'Travel', description: 'x', amount: 10 }], summary: '' }, /answer "Goals of the mission"/],
    [{ member: 'No' }, /must be members/],
    [{ confirm_privacy: false }, /declarations/],
    [{ summary: 'word '.repeat(201) }, /200 words/],
    [{ email: 'nope' }, /valid email/],
    [{ country: 'Atlantis' }, /country/]
  ];
  cases.forEach(([o, re]) => throwsLike(() => g.submitApplication(stsm(g, o)), re));
  const p = stsm(g); delete p.documents.host_letter;
  throwsLike(() => g.submitApplication(p), /Upload: Confirmation from the host/i);
  const forged = stsm(g); forged.documents.cv = { id: forged.documents.cv.id, name: 'cv.pdf', token: 'forged' };
  throwsLike(() => g.submitApplication(forged), /could not be verified/);
  assert.strictEqual(g.rowsAsObjects(g.tab('Applications')).length, 0);
  assert.strictEqual(g.state.mail.length, 0);
});

test('conference grants: ITC, YRI and Dissemination rules, attendance and eligibility notes', () => {
  const g = ready();
  // YRI, online, poster: allowed, capped at €500, flagged while the abstract is pending.
  const r = g.submitApplication(conference(g));
  const row = g.rowsAsObjects(g.tab('Applications')).filter(x => x['ID'] === r.id)[0];
  assert.strictEqual(row['Scheme'], 'YRI Conference Grant');
  assert.match(row['Eligibility notes'], /not yet accepted/);
  assert.match(r.html, /Relevance of the conference topic to EEG101/);
  throwsLike(() => g.submitApplication(conference(g, { budget: [{ category: 'Registration fee', description: 'Fee', amount: 501 }] })), /maximum|amount/);
  throwsLike(() => g.submitApplication(conference(g, { budget: [{ category: 'Travel', description: 'Train', amount: 50 }] })), /category/);
  throwsLike(() => g.submitApplication(conference(g, { yri: 'No' })), /only for Young Researchers/);
  throwsLike(() => g.submitApplication(conference(g, { third_party_organised: 'No' })), /organised entirely by others/);
  // In person: up to €2,500, needs a city and country.
  const inPerson = { attendance: 'Face to face', conference_location: 'Brisbane', conference_country: 'Australia', budget: [{ category: 'Travel', description: 'Flights', amount: 1800 }, { category: 'Printing of the poster', description: 'A0', amount: 60 }] };
  assert.ok(g.submitApplication(conference(g, inPerson)).id);
  throwsLike(() => g.submitApplication(conference(g, Object.assign({}, inPerson, { conference_country: '' }))), /city and country/);
  // ITC: only ITC or Near Neighbour Country institutions, oral only.
  throwsLike(() => g.submitApplication(conference(g, { scheme: 'itc_conference', presentation: 'Oral presentation' })), /Germany is neither/);
  throwsLike(() => g.submitApplication(conference(g, { scheme: 'itc_conference', country: 'Portugal' })), /oral presentation/);
  assert.ok(g.submitApplication(conference(g, { scheme: 'itc_conference', country: 'Portugal', presentation: 'Oral presentation' })).id);
  assert.ok(g.submitApplication(conference(g, { scheme: 'itc_conference', country: 'Tunisia', presentation: 'Oral presentation', yri: 'No' })).id);
  // Dissemination: anyone, oral only, asks about the Science Communication Plan.
  const d = g.submitApplication(conference(g, { scheme: 'dissemination_conference', presentation: 'Oral presentation', yri: 'No' }));
  assert.match(d.html, /Science Communication Plan/);
  // Outside COST and Near Neighbour Countries: allowed, but flagged.
  const far = g.submitApplication(conference(g, { country: 'Australia' }));
  assert.match(g.rowsAsObjects(g.tab('Applications')).filter(x => x['ID'] === far.id)[0]['Eligibility notes'], /not a COST Full or Cooperating Member/);
});

test('VMG rules: third-party letter and the leadership-role declaration', () => {
  const g = ready();
  const vmg = stsm(g, { scheme: 'vmg', collaborators: 'Dr X, Uni Y', third_party: 'Yes', third_party_member: 'Yes', not_leadership: true, budget: [{ category: 'Software, data access or services', description: 'Licence', amount: 300 }], documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }) } });
  throwsLike(() => g.submitApplication(vmg), /Upload: Letter of support from the collaborating/i);
  vmg.third_party = 'No';
  throwsLike(() => g.submitApplication(Object.assign({}, vmg, { not_leadership: false })), /leadership role/);
  throwsLike(() => g.submitApplication(Object.assign({}, vmg, { budget: [{ category: 'Personnel', description: 'Salary', amount: 300 }] })), /category/);
  assert.ok(g.submitApplication(vmg).id);
});

test('the confirmation email failing does not lose the application', () => {
  const g = ready();
  vm.runInContext('MailApp.sendEmail = () => { throw new Error("quota"); }', g);
  const r = g.submitApplication(stsm(g));
  assert.strictEqual(r.emailed, false);
  assert.strictEqual(g.rowsAsObjects(g.tab('Applications')).length, 1);
});

test('review: personal links, blind reviewers, open chairs, conflicts, quick decisions, reports', () => {
  const g = ready();
  const a = g.submitApplication(stsm(g)).id;
  const b = g.submitApplication(stsm(g, { scheme: 'vmg', collaborators: 'Dr X', third_party: 'No', not_leadership: true, budget: [{ category: 'Other', description: 'x', amount: 1000 }], documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }) }, gender: 'Male', country: 'Germany', email: 'bob@example.org', first_name: 'Bob' })).id;
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['chair2@example.org', 'Second chair', 'chair'], ['r1@example.org', 'Rev One', 'reviewer'], ['r2@example.org', 'Rev Two', 'reviewer'], ['bob@example.org', 'Bob', 'reviewer']]);
  assert.ok(Object.values(keys).every(k => k.length >= 32) && new Set(Object.values(keys)).size === 5);
  g.assignReviewers(keys['chair@example.org'], { ids: [a, b], add: ['r1@example.org', 'r2@example.org', 'bob@example.org'] });

  // Links: emailed once each, and only a listed key opens the page.
  g.sendReviewerLinks();
  assert.strictEqual(g.state.mail.filter(m => m.subject === 'Your EEG101 grants portal link').length, 5);
  assert.match(g.state.mail.filter(m => m.to === 'r1@example.org')[0].body, new RegExp('exec\\?view=review&key=' + keys['r1@example.org']));
  g.sendReviewerLinks();
  assert.strictEqual(g.state.mail.filter(m => m.subject === 'Your EEG101 grants portal link').length, 5);
  assert.match(g.doGet({ parameter: { view: 'review', key: 'x'.repeat(40) } }).getContent(), /not valid/);
  assert.match(g.doGet({ parameter: { view: 'review' } }).getContent(), /not valid/);
  throwsLike(() => g.listApplications('nope'), /not valid/);
  const page = g.doGet({ parameter: { view: 'review', key: keys['r1@example.org'] } }).getContent();
  assert.match(page, /EEG101 grants portal/);
  assert.strictEqual(JSON.parse(page.match(/const BOOT = (.*);\n/)[1]).blind, true);

  // A blind reviewer sees no names, documents or reports; scores stay hidden until they score.
  const r1 = keys['r1@example.org'];
  let list = g.listApplications(r1).applications;
  assert.ok(list.every(x => x.applicant === '' && x.institution === '' && x.gender === '' && x.folder === ''));
  const blindView = g.getApplication(r1, a);
  assert.ok(blindView.blind && !/Lovelace|ada@example\.org|University of Lisbon/.test(blindView.html) && /Harmonising resting-state EEG/.test(blindView.html));
  same(blindView.documents, {});
  throwsLike(() => g.getDocument(r1, a, 'cv'), /not shown in blind review/);
  throwsLike(() => g.getReport(r1), /for chairs/);
  g.saveReview(r1, { id: a, scores: [5, 5, 4, 4, 5], recommendation: 'Fund', comments: 'Strong' });
  throwsLike(() => g.saveReview(r1, { id: a, scores: [5, 5, 4, 9, 5], recommendation: 'Fund' }), /1 to 5/);
  g.saveReview(r1, { id: a, scores: [5, 5, 5, 5, 5], recommendation: 'Fund', comments: 'Updated' }); // edits, not duplicates
  assert.strictEqual(g.tab('Reviews').rows.length, 2);

  const r2 = keys['r2@example.org'];
  assert.strictEqual(g.listApplications(r2).applications.filter(x => x.id === a)[0].mean, null, 'r2 must not see scores before scoring');
  g.saveReview(r2, { id: a, conflict: true });
  list = g.listApplications(r2).applications;
  assert.strictEqual(list.filter(x => x.id === a)[0].mean, null, 'a conflicted reviewer sees no scores');
  same(list.filter(x => x.id === a)[0].others, []);
  assert.strictEqual(g.listApplications(keys['chair@example.org']).applications.filter(x => x.id === a)[0].reviewCount, 1, 'a conflict is not a score');
  throwsLike(() => g.saveDecisions(r2, [{ id: a, decision: 'Funded' }]), /Only a grants chair/);

  // Applicants who review cannot review or see the scores of their own application.
  const bob = keys['bob@example.org'];
  throwsLike(() => g.saveReview(bob, { id: b, scores: [5, 5, 5, 5, 5], recommendation: 'Fund' }), /not assigned to you/);
  same(g.listApplications(bob).applications.map(x => x.id), [a], 'never assigned their own');

  // Chairs see everything at once, score too, and decide straight away.
  const chair = keys['chair@example.org'];
  const open = g.listApplications(chair);
  assert.strictEqual(open.blind, false);
  assert.strictEqual(open.applications.filter(x => x.id === a)[0].applicant, 'Ada Lovelace');
  assert.strictEqual(open.applications.filter(x => x.id === a)[0].mean, 5, 'chairs see scores before scoring');
  const full = g.getApplication(chair, a);
  assert.ok(/Lovelace/.test(full.html) && full.documents.cv && !full.documents.cv.id);
  assert.strictEqual(Buffer.from(g.getDocument(chair, a, 'cv').data, 'base64').toString().slice(0, 5), '%PDF-');
  assert.match(g.getDocument(chair, a, 'application').name, /EEG101-G2-001 application\.pdf/);
  g.saveReview(chair, { id: b, scores: [3, 3, 3, 3, 3], recommendation: 'Fund if budget allows' });
  throwsLike(() => g.saveDecisions(chair, [{ id: a, decision: 'Funded', awarded: 99999 }]), /between €0 and the €1750 requested/);
  g.saveDecisions(chair, [{ id: a, decision: 'Funded', awarded: '', rank: 1, notes: 'Top' }, { id: b, decision: 'Funded', awarded: 800, rank: 1 }]);
  let rows = g.rowsAsObjects(g.tab('Applications'));
  assert.strictEqual(rows.filter(r => r['ID'] === a)[0]['Awarded (€)'], 1750);
  assert.strictEqual(rows.filter(r => r['ID'] === a)[0]['Status'], 'Funded');
  assert.strictEqual(rows.filter(r => r['ID'] === a)[0]['Decided by'], 'chair@example.org');

  // A chair with a conflict cannot decide; nothing in that batch is saved.
  const chair2 = keys['chair2@example.org'];
  g.saveReview(chair2, { id: b, conflict: true });
  throwsLike(() => g.saveDecisions(chair2, [{ id: a, decision: 'Reserve' }, { id: b, decision: 'Not funded' }]), /conflict of interest for EEG101-G2-002/);
  rows = g.rowsAsObjects(g.tab('Applications'));
  assert.strictEqual(rows.filter(r => r['ID'] === a)[0]['Decision'], 'Funded');

  const rep = g.getReport(chair);
  same(rep.totals, { submitted: 2, requested: 2750, funded: 2, awarded: 2550 });
  same(rep.byScheme.funded.map(x => [x.key, x.amount]), [['STSM', 1750], ['VMG', 800]]);
  same(rep.byMonth, [{ key: '2027-03', count: 2, amount: 2550 }]);
  same(rep.byItc.funded.map(x => [x.key, x.count]), [['No', 1], ['Yes', 1]]);

  // With blind review switched off for the call, reviewers see names, and reports too.
  const main = g.listCalls(keys['chair@example.org']).calls[0];
  assert.strictEqual(main.blind, true, 'blind review is on by default');
  g.saveCall(keys['chair@example.org'], Object.assign({}, main, { blind: false }));
  assert.strictEqual(g.listApplications(r1).applications.filter(x => x.id === a)[0].applicant, 'Ada Lovelace');
  assert.ok(g.getReport(r1).totals);
});

test('overlapping grants and two types of conference grant are flagged', () => {
  const g = ready();
  const a = g.submitApplication(stsm(g)).id;
  const b = g.submitApplication(conference(g, { start_date: '2027-03-10', end_date: '2027-03-12' })).id;
  const c = g.submitApplication(conference(g, { scheme: 'dissemination_conference', presentation: 'Oral presentation', start_date: '2027-06-01', end_date: '2027-06-03' })).id;
  const other = g.submitApplication(stsm(g, { email: 'someone@example.org' })).id;
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair']]);
  const list = g.listApplications(keys['chair@example.org']).applications;
  const notes = id => list.filter(x => x.id === id)[0].notes;
  assert.match(notes(a), new RegExp(`overlap with ${b}`));
  assert.match(notes(b), new RegExp(`overlap with ${a}`));
  assert.match(notes(b), new RegExp(`Dissemination Conference Grant \\(${c}\\)`));
  assert.match(notes(c), /only one type of conference grant/);
  assert.ok(!/overlap/.test(notes(other)));
  g.saveDecisions(keys['chair@example.org'], [{ id: b, decision: 'Withdrawn' }]);
  assert.ok(!/overlap|conference grant/.test(g.listApplications(keys['chair@example.org']).applications.filter(x => x.id === a)[0].notes));
});

test('set-up adds new columns to a spreadsheet made by an older version', () => {
  const g = makeGoogle();
  g.setUpGrants();
  const tab = g.tab('Reviewers');
  tab.rows[0] = ['Email', 'Name', 'Role (reviewer or chair)'];
  g.setUpGrants();
  same(tab.rows[0], ['Email', 'Name', 'Role (reviewer or chair)', 'Personal key', 'Link sent']);
  throwsLike(() => g.showReviewerLinks(), /web_app_url/);
});

test('portal: chairs add, invite, re-key and remove reviewers', () => {
  const g = ready();
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['r1@example.org', 'Rev One', 'reviewer']]);
  const chair = keys['chair@example.org'];
  throwsLike(() => g.listReviewers(keys['r1@example.org']), /Only a grants chair/);
  throwsLike(() => g.saveReviewer(keys['r1@example.org'], { email: 'x@example.org' }), /Only a grants chair/);
  let list = g.saveReviewer(chair, { email: 'New@Example.org', name: 'New Person', role: 'reviewer', invite: true });
  assert.ok(list.some(r => r.email === 'new@example.org' && r.name === 'New Person' && !r.chair && r.invited));
  const mail = g.state.mail.filter(m => m.to === 'new@example.org');
  assert.strictEqual(mail.length, 1);
  const link = mail[0].body.match(/key=(\w+)/)[1];
  assert.ok(g.listApplications(link));
  throwsLike(() => g.saveReviewer(chair, { email: 'nope' }), /valid email/);
  throwsLike(() => g.saveReviewer(chair, { email: 'chair@example.org', role: 'reviewer' }), /your own chair role/);
  list = g.saveReviewer(chair, { email: 'new@example.org', role: 'chair' });
  assert.ok(list.filter(r => r.email === 'new@example.org')[0].chair);
  assert.ok(g.listApplications(link).me.chair);
  // A new link replaces the old one.
  g.inviteReviewer(chair, 'new@example.org', true);
  const newLink = g.state.mail.filter(m => m.to === 'new@example.org').pop().body.match(/key=(\w+)/)[1];
  assert.notStrictEqual(newLink, link);
  throwsLike(() => g.listApplications(link), /not valid/);
  assert.ok(g.listApplications(newLink));
  // Removing stops the link working.
  throwsLike(() => g.removeReviewer(chair, 'chair@example.org'), /yourself/);
  list = g.removeReviewer(chair, 'new@example.org');
  assert.ok(!list.some(r => r.email === 'new@example.org'));
  throwsLike(() => g.listApplications(newLink), /not valid/);
});

test('portal: assigned applications are only open to their reviewers', () => {
  const g = ready();
  const a = g.submitApplication(stsm(g)).id;
  const b = g.submitApplication(stsm(g, { email: 'r2@example.org', title: 'Second' })).id;
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['r1@example.org', 'Rev One', 'reviewer'], ['r2@example.org', 'Rev Two', 'reviewer']]);
  const chair = keys['chair@example.org'], r1 = keys['r1@example.org'], r2 = keys['r2@example.org'];
  // Nothing assigned yet: reviewers see nothing, chairs see everything.
  assert.strictEqual(g.listApplications(r1).applications.length, 0);
  assert.strictEqual(g.listApplications(chair).applications.length, 2);
  throwsLike(() => g.getApplication(r1, b), /not assigned to you/);
  throwsLike(() => g.assignReviewers(r1, { ids: [a], add: ['r1@example.org'] }), /Only a grants chair/);
  throwsLike(() => g.assignReviewers(chair, { ids: [a], add: ['stranger@example.org'] }), /not on the reviewer list/);
  g.state.mail = [];
  const out = g.assignReviewers(chair, { ids: [a, b], add: ['r2@example.org'], notify: true });
  assert.match(out.notice, /own application/);
  same(out.applications.filter(x => x.id === a)[0].assigned.map(x => [x.email, x.status]), [['r2@example.org', 'todo']]);
  same(out.applications.filter(x => x.id === b)[0].assigned, []);
  assert.strictEqual(g.state.mail.length, 1);
  assert.match(g.state.mail[0].body, new RegExp(`${a}: Harmonising`));
  assert.ok(!new RegExp(b).test(g.state.mail[0].body));
  // r1 is not assigned to a, so cannot see, open or score it; b has no one assigned, so only chairs see it.
  same(g.listApplications(r1).applications.map(x => x.id), []);
  same(g.listApplications(r2).applications.map(x => x.id), [a]);
  throwsLike(() => g.getApplication(r1, a), /not assigned to you/);
  throwsLike(() => g.saveReview(r1, { id: a, scores: [5, 5, 5, 5, 5], recommendation: 'Fund' }), /not assigned to you/);
  assert.ok(g.listApplications(r2).applications.filter(x => x.id === a)[0].assignedToMe);
  g.saveReview(r2, { id: a, scores: [4, 4, 4, 4, 4], recommendation: 'Fund' });
  assert.strictEqual(g.listApplications(chair).applications.filter(x => x.id === a)[0].assigned[0].status, 'scored');
  const people = g.listReviewers(chair);
  same(people.filter(p => p.email === 'r2@example.org').map(p => [p.assigned, p.assignedDone, p.scored]), [[1, 1, 1]]);
  // Unassigning takes it away; removing a reviewer takes them off.
  g.assignReviewers(chair, { ids: [a], add: ['r1@example.org'], remove: ['r2@example.org'] });
  same(g.listApplications(r1).applications.map(x => x.id), [a]);
  same(g.listApplications(r2).applications, []);
  g.removeReviewer(chair, 'r1@example.org');
  same(g.listApplications(chair).applications.filter(x => x.id === a)[0].assigned, []);
});

test('portal: chairs run calls side by side, each with its own deadline, questions and documents', () => {
  const g = ready();
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['r1@example.org', 'Rev One', 'reviewer']]);
  const chair = keys['chair@example.org'];
  throwsLike(() => g.listCalls(keys['r1@example.org']), /Only a grants chair/);
  let calls = g.listCalls(chair);
  same(calls.calls.map(c => [c.id, c.prefix, c.accepting]), [['main', 'G2', true]]);
  const company = { name: 'Industry STSM: NeuroTech GmbH', schemes: ['stsm_industry'], open: true, deadline: '2027-02-28T17:00', periodEnd: '2027-08-31', prefix: 'ind1',
    host: { institution: 'NeuroTech GmbH', country: 'Germany', type: 'SME (small or medium-sized company)', name: 'Dr Lena Fischer' },
    questions: [{ label: 'Which NeuroTech product line would you work with?', hint: 'See their website', words: 100, required: true }, { label: '' }],
    documents: [{ label: 'NDA signed with NeuroTech', required: true }], budget: '8000' };
  throwsLike(() => g.saveCall(chair, Object.assign({}, company, { prefix: 'g2' })), /already uses the ID prefix G2/);
  throwsLike(() => g.saveCall(chair, Object.assign({}, company, { schemes: [] })), /at least one scheme/);
  throwsLike(() => g.saveCall(chair, Object.assign({}, company, { deadline: 'soon' })), /date and time/);
  throwsLike(() => g.saveCall(chair, Object.assign({}, company, { periodEnd: '' })), /must end by/);
  calls = g.saveCall(chair, company);
  const ind = calls.calls.filter(c => c.id === calls.saved)[0];
  assert.strictEqual(ind.id, 'industry-stsm-neurotech-gmbh');
  assert.strictEqual(ind.prefix, 'IND1');
  assert.strictEqual(ind.questions.length, 1, 'empty questions are dropped');
  calls = g.saveCall(chair, Object.assign({}, company, { name: 'Industry STSM: BrainCo', prefix: 'IND2', deadline: '2027-03-31T12:00', host: { institution: 'BrainCo', country: 'Spain', type: 'Start-up' }, questions: [], documents: [] }));
  assert.strictEqual(calls.calls.length, 3);

  // All three are open at once; the form offers each.
  const cfg = g.applyConfig('stsm_industry');
  same(cfg.calls.map(c => c.id), ['main', 'industry-stsm-neurotech-gmbh', 'industry-stsm-brainco']);
  assert.strictEqual(cfg.preselect, 'stsm_industry');
  assert.strictEqual(g.applyConfig('', 'industry-stsm-brainco').preselectCall, 'industry-stsm-brainco');
  const status = JSON.parse(g.doGet({ parameter: { view: 'status' } }).getContent());
  same(status.schemes, ['stsm', 'vmg', 'itc_conference', 'yri_conference', 'dissemination_conference', 'stsm_industry']);
  same(status.calls.map(c => [c.name, c.host]), [['EEG101 Grant Period 2 call', ''], ['Industry STSM: NeuroTech GmbH', 'NeuroTech GmbH'], ['Industry STSM: BrainCo', 'BrainCo']]);
  assert.ok(!/Fischer|@/.test(JSON.stringify(status)), 'nothing private in the public status');

  // A NeuroTech application: the host comes from the call, its question and document are required,
  // and its own end date applies.
  const base = { scheme: 'stsm_industry', call: ind.id, host_institution: 'Somewhere else', host_country: 'France', host_type: 'Start-up', host_name: 'Someone' };
  const withDocs = o => stsm(g, Object.assign({}, base, { documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }), host_letter: g.uploadFile({ name: 'l.pdf', data: PDF }), call_d1: g.uploadFile({ name: 'nda.pdf', data: PDF }) }, q_q1: 'The dry-electrode headset.' }, o || {}));
  throwsLike(() => g.submitApplication(withDocs({ q_q1: '' })), /Which NeuroTech product line/);
  throwsLike(() => g.submitApplication(withDocs({ documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }), host_letter: g.uploadFile({ name: 'l.pdf', data: PDF }) } })), /upload: NDA signed with NeuroTech/i);
  throwsLike(() => g.submitApplication(withDocs({ start_date: '2027-08-20', end_date: '2027-09-10' })), /completed by 31 August 2027/);
  throwsLike(() => g.submitApplication(withDocs({ scheme: 'stsm' })), /not part of Industry STSM: NeuroTech GmbH/);
  const r = g.submitApplication(withDocs());
  assert.strictEqual(r.id, 'EEG101-IND1-001');
  assert.match(r.html, /NeuroTech GmbH, Germany[\s\S]*SME[\s\S]*Which NeuroTech product line[\s\S]*dry-electrode/);
  assert.match(r.html, /Dr Lena Fischer/);
  assert.match(r.html, /Industry STSM: NeuroTech GmbH/);
  const row = g.rowsAsObjects(g.tab('Applications'))[0];
  assert.strictEqual(row['Call'], ind.id);
  // The main call carries on with its own numbering.
  assert.strictEqual(g.submitApplication(stsm(g, { call: 'main' })).id, 'EEG101-G2-001');
  assert.strictEqual(g.submitApplication(stsm(g)).id, 'EEG101-G2-002', 'the only open call offering STSM is chosen');
  throwsLike(() => g.submitApplication(stsm(g, { call: 'nope' })), /closed/);

  // Calls with applications keep their prefix and cannot be deleted; a closed call is not offered.
  throwsLike(() => g.saveCall(chair, Object.assign({}, company, { id: ind.id, prefix: 'IND9' })), /cannot change/);
  throwsLike(() => g.deleteCall(chair, ind.id), /cannot be deleted/);
  g.saveCall(chair, Object.assign({}, company, { id: ind.id, open: false }));
  assert.ok(!g.applyConfig('').calls.some(c => c.id === ind.id));
  calls = g.deleteCall(chair, 'industry-stsm-brainco');
  same(calls.calls.map(c => [c.id, c.applications]), [['main', 2], [ind.id, 1]]);
  // Each call's deadline is its own.
  g.setNow('2027-03-01T09:00:00Z');
  same(g.applyConfig('').calls.map(c => c.id), []);
  // Settings for all calls.
  throwsLike(() => g.saveGrantSettings(chair, { budgets: { stsm: '-5' } }), /amount in euros/);
  const after = g.saveGrantSettings(chair, { budgets: { stsm: '20000' } });
  g.saveCall(chair, Object.assign({}, after.calls[0], { blind: false }));
  assert.strictEqual(after.budgets.stsm, '20000');
  assert.strictEqual(g.listApplications(keys['r1@example.org']).blind, false);
  // Reports and funded grants know the calls.
  const rep = g.getReport(chair);
  same(rep.byCall.submitted.map(x => [x.key, x.count]), [['EEG101 Grant Period 2 call', 2], ['Industry STSM: NeuroTech GmbH', 1]]);
  g.saveDecisions(chair, [{ id: 'EEG101-IND1-001', decision: 'Funded' }]);
  const f = g.listFunded(chair).grants[0];
  assert.strictEqual(f.callName, 'Industry STSM: NeuroTech GmbH');
  assert.strictEqual(f.reportDue, '2027-04-13');
  assert.strictEqual(g.reportDue('2027-08-25', '2027-08-31'), '2027-09-15', 'its own period end');
});

test('the web app remembers its own address for review links', () => {
  const g = makeGoogle();
  g.setUpGrants();
  g.state.serviceUrl = 'https://script.google.com/macros/s/LIVE/exec';
  g.doGet({ parameter: {} });
  assert.strictEqual(g.readSettings().web_app_url, 'https://script.google.com/macros/s/LIVE/exec');
});

test('funded grants: tracked to payment by chairs and the grants administrator, with reminders', () => {
  const g = ready();
  const a = g.submitApplication(stsm(g)).id;                                                      // ends 14 March 2027
  const b = g.submitApplication(stsm(g, { email: 'b@example.org', first_name: 'Bea', start_date: '2027-09-01', end_date: '2027-09-20' })).id;
  const c = g.submitApplication(stsm(g, { email: 'c@example.org' })).id;
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['admin@example.org', 'Grants Admin', 'administrator'], ['r1@example.org', 'Rev One', 'reviewer']]);
  const chair = keys['chair@example.org'], admin = keys['admin@example.org'], r1 = keys['r1@example.org'];
  g.saveDecisions(chair, [{ id: a, decision: 'Funded' }, { id: b, decision: 'Funded', awarded: 1500 }, { id: c, decision: 'Not funded' }]);

  // The administrator does not review, and sees only funded grants.
  throwsLike(() => g.listApplications(admin), /Funded grants page/);
  throwsLike(() => g.saveReview(admin, { id: a, conflict: true }), /Funded grants page/);
  throwsLike(() => g.listFunded(r1), /Only a grants chair/);
  assert.ok(g.getApplication(admin, a).html);
  throwsLike(() => g.getApplication(admin, c), /not assigned to you/);
  assert.ok(g.getReport(admin).totals);

  let list = g.listFunded(admin);
  same(list.grants.map(x => [x.id, x.status, x.reportDue]), [[a, 'Awaiting e-COST application', '2027-04-13'], [b, 'Awaiting e-COST application', '2027-10-15']]);
  assert.strictEqual(list.grants[1].awarded, 1500);
  // Report due: 30 days after the end, or 15 days after the grant period, whichever is first.
  assert.strictEqual(g.reportDue('2027-09-20', '2027-09-30'), '2027-10-15');
  assert.strictEqual(g.reportDue('2027-03-14', '2027-09-30'), '2027-04-13');

  // Reminders: e-COST application first, then the report.
  g.state.mail = [];
  let out = g.sendGrantReminders(admin, [a]);
  assert.match(out.notice, /1 reminder sent/);
  assert.match(g.state.mail[0].subject, /please apply in e-COST/);
  assert.ok(!g.state.mail[0].cc);
  g.updateGrants(admin, [{ id: a, status: 'Report due', notes: 'Chased by phone' }]);
  out = g.sendGrantReminders(chair, [a, b, c]);
  assert.match(g.state.mail[1].subject, new RegExp(`${a}: report due 13 April 2027`));
  assert.match(g.state.mail[1].body, /submit your report through e-COST/);
  assert.match(out.notice, /2 reminders sent/);
  assert.match(out.notice, /is not a funded grant/);
  list = g.listFunded(chair);
  const ga = list.grants.filter(x => x.id === a)[0];
  assert.strictEqual(ga.reminders, 2);
  assert.strictEqual(ga.notes, 'Chased by phone');
  assert.strictEqual(ga.statusBy, 'admin@example.org');
  // Once the report is in, no more reminders, and it moves to the bottom.
  g.updateGrants(chair, [{ id: a, status: 'Report submitted in e-COST' }]);
  out = g.sendGrantReminders(chair, [a]);
  assert.match(out.notice, /0 reminders sent.*no reminder is needed/);
  assert.strictEqual(out.grants[out.grants.length - 1].id, a);
  throwsLike(() => g.updateGrants(admin, [{ id: a, status: 'Lost' }]), /Unknown grant status/);
  throwsLike(() => g.updateGrants(admin, [{ id: c, status: 'Paid' }]), /not a funded grant/);
  // The administrator can be added from the portal.
  const people = g.saveReviewer(chair, { email: 'admin2@example.org', name: 'Second Admin', role: 'administrator', invite: true });
  assert.strictEqual(people.filter(p => p.email === 'admin2@example.org')[0].role, 'administrator');
  assert.match(g.state.mail.filter(m => m.to === 'admin2@example.org')[0].body, /the grants administrator/);
  // Administrators are never offered as reviewers.
  assert.ok(!g.listApplications(chair).reviewers.some(r => r.email === 'admin@example.org'));
  throwsLike(() => g.assignReviewers(chair, { ids: [c], add: ['admin@example.org'] }), /not on the reviewer list/);
});

test('the status the website reads follows the calls', () => {
  const g = ready();
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair']]);
  let status = JSON.parse(g.doGet({ parameter: { view: 'status' } }).getContent());
  assert.strictEqual(status.open, true);
  same(status.schemes, ['stsm', 'vmg', 'itc_conference', 'yri_conference', 'dissemination_conference']);
  assert.match(status.calls[0].deadlineText, /15 December 2026/);
  assert.ok(!g.applyConfig('').schemes.stsm_industry, 'the industry STSM is not in the main call');
  throwsLike(() => g.submitApplication(stsm(g, { scheme: 'stsm_industry', host_type: 'Start-up' })), /not part of|choose the call|closed/);
  const main = g.listCalls(keys['chair@example.org']).calls[0];
  g.saveCall(keys['chair@example.org'], Object.assign({}, main, { open: false }));
  status = JSON.parse(g.doGet({ parameter: { view: 'status' } }).getContent());
  assert.strictEqual(status.open, false);
  same(status.schemes, []);
});

test('blind review is set per call, and the website can send people their portal link', () => {
  const g = ready();
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['r1@example.org', 'Rev One', 'reviewer']]);
  const chair = keys['chair@example.org'], r1 = keys['r1@example.org'];
  const open = g.saveCall(chair, { name: 'Open review call', schemes: ['stsm'], open: true, periodEnd: '2027-09-30', prefix: 'OPN', blind: false }).saved;
  const a = g.submitApplication(stsm(g, { call: 'main' })).id;
  const b = g.submitApplication(stsm(g, { call: open })).id;
  g.assignReviewers(chair, { ids: [a, b], add: ['r1@example.org'] });
  const list = g.listApplications(r1).applications;
  assert.strictEqual(list.filter(x => x.id === a)[0].applicant, '', 'the main call is blind');
  assert.strictEqual(list.filter(x => x.id === b)[0].applicant, 'Ada Lovelace', 'this call is not');
  throwsLike(() => g.getDocument(r1, a, 'cv'), /blind review/);
  assert.ok(g.getDocument(r1, b, 'cv').data);
  // The host-confirmation template is offered with the document.
  assert.match(g.applyConfig('stsm').schemes.stsm.documents[1].template, /eeg101-stsm-host-confirmation-template\.docx$/);
  // Portal link requests: same reply for anyone, an email only for listed people, at most every 10 minutes.
  g.state.mail = [];
  const ask = email => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ email: email }) } }).getContent());
  const r = ask('R1@example.org');
  const s2 = ask('stranger@example.org');
  same(r, s2);
  assert.strictEqual(g.state.mail.length, 1);
  assert.match(g.state.mail[0].body, new RegExp('as requested on the website[\\s\\S]*key=' + r1));
  ask('r1@example.org');
  assert.strictEqual(g.state.mail.length, 1, 'not again within 10 minutes');
  g.setNow('2026-11-10T09:11:00Z');
  ask('r1@example.org');
  assert.strictEqual(g.state.mail.length, 2);
  ask('not an email'); ask('');
  assert.strictEqual(g.state.mail.length, 2);
});

test('a rolling call (no deadline) promises a decision within 8 weeks of submission', () => {
  const g = ready();
  setCall(g, 'main', { 'Deadline': '' });
  const r = g.submitApplication(stsm(g));
  assert.match(r.timing, /rolling basis[\s\S]*within 8 weeks of your submission/);
  assert.match(g.state.mail[0].body, /rolling basis/);
});

test('spam protection: honeypot, minimum time, hourly limits and the optional CAPTCHA', () => {
  const g = ready();
  throwsLike(() => g.submitApplication(stsm(g, { website: 'http://spam.example' })), /could not be submitted/);
  throwsLike(() => g.submitApplication(stsm(g, { started: undefined, startedSig: undefined })), /reload the page/);
  throwsLike(() => g.submitApplication(stsm(g, { startedSig: 'forged' })), /reload the page/);
  const now = g.applyConfig('').started;
  throwsLike(() => g.submitApplication(stsm(g, { started: now, startedSig: g.sign('started:' + now) })), /check your answers/);
  // Three from one address an hour, then a pause.
  g.state.cache = {};
  const quick = o => { const p = stsm(g, o); g.state.cache = g.state.saved || g.state.cache; return p; };
  g.state.saved = {};
  for (let i = 0; i < 3; i++) { const p = stsm(g); g.state.cache = g.state.saved; assert.ok(g.submitApplication(p).id); g.state.saved = g.state.cache; }
  const p4 = stsm(g); g.state.cache = g.state.saved;
  throwsLike(() => g.submitApplication(p4), /several applications in the last hour/);
  assert.ok(quick({ email: 'someone.else@example.org' }) && true);
  // No CAPTCHA until the secret is set; then a token is required and checked with Cloudflare.
  assert.strictEqual(g.applyConfig('').captcha, false);
  g.state.props.TURNSTILE_SECRET = 'secret';
  assert.strictEqual(g.applyConfig('').captcha, true);
  throwsLike(() => g.submitApplication(stsm(g, { email: 'b@example.org' })), /not a robot[\s\S]*www\.eeg101\.eu\/grants\/apply/);
  throwsLike(() => g.submitApplication(stsm(g, { email: 'b@example.org', captcha: 'bad-token' })), /did not work/);
  assert.ok(g.submitApplication(stsm(g, { email: 'b@example.org', captcha: 'good-token' })).id);
  assert.strictEqual(g.state.fetches[g.state.fetches.length - 1].opts.payload.secret, 'secret');
  // The portal's form links point at the website, where the CAPTCHA is.
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair']]);
  assert.strictEqual(g.listCalls(keys['chair@example.org']).applyPage, 'https://www.eeg101.eu/grants/apply/');
});

test('the daily digest goes to the GRANTS_BCC people, once, with what is new', () => {
  const g = ready();
  g.state.mail = [];
  assert.strictEqual(g.sendDailyDigest(), 0, 'nothing new, nothing sent');
  assert.strictEqual(g.state.mail.length, 0);
  g.setNow('2026-11-10T10:00:00Z');
  const a = g.submitApplication(stsm(g)).id;
  const b = g.submitApplication(stsm(g, { email: 'ben@example.org', first_name: 'Ben', last_name: 'Okafor', country: 'Germany' })).id;
  g.state.mail = [];
  g.setNow('2026-11-11T07:00:00Z');
  assert.strictEqual(g.sendDailyDigest(), 2);
  const d = g.state.mail[0];
  assert.strictEqual(d.to, 'amy@example.org,faisal@example.org');
  assert.match(d.subject, /2 new applications/);
  assert.match(d.body, new RegExp(`${a} · STSM · Ada Lovelace \\(Portugal\\)[\\s\\S]*${b} · STSM · Ben Okafor`));
  assert.match(d.body, /EEG101 Grant Period 2 call: 2/);
  assert.strictEqual(d.attachments.length, 2);
  assert.strictEqual(g.sendDailyDigest(), 0, 'not the same ones again');
  delete g.state.props.GRANTS_BCC;
  g.setNow('2026-11-11T09:00:00Z');
  g.submitApplication(stsm(g, { email: 'c@example.org' }));
  g.setNow('2026-11-12T07:00:00Z');
  assert.strictEqual(g.sendDailyDigest(), 0, 'no one to send to');
});

test('decision emails: previewed and sent by chairs, recorded, with the right template', () => {
  const g = ready();
  const a = g.submitApplication(stsm(g)).id;
  const b = g.submitApplication(stsm(g, { email: 'ben@example.org', first_name: 'Ben' })).id;
  const c = g.submitApplication(conference(g, { email: 'cy@example.org', first_name: 'Cy' })).id;
  const keys = reviewers(g, [['chair@example.org', 'Chair', 'chair'], ['chair2@example.org', 'Chair Two', 'chair'], ['r1@example.org', 'Rev', 'reviewer']]);
  const chair = keys['chair@example.org'];
  throwsLike(() => g.previewDecisionEmail(chair, a, ''), /no decision to email/);
  g.saveDecisions(chair, [{ id: a, decision: 'Funded', awarded: 1500 }, { id: b, decision: 'Not funded' }, { id: c, decision: 'Reserve' }]);
  throwsLike(() => g.previewDecisionEmail(keys['r1@example.org'], a, ''), /Only a grants chair/);
  const p = g.previewDecisionEmail(chair, a, 'Well done on a clear plan.');
  assert.strictEqual(p.to, 'ada@example.org');
  assert.match(p.subject, new RegExp(`EEG101 grant awarded: ${a}`));
  assert.match(p.body, /up to €1500\.00[\s\S]*e-COST \(https:\/\/e-services\.cost\.eu\/\)[\s\S]*1 March 2027 to 14 March 2027[\s\S]*CA24148: ‘EEG101[\s\S]*by 13 April 2027[\s\S]*up to 50%[\s\S]*A note from the grants committee:\nWell done on a clear plan\./);
  assert.strictEqual(p.alreadySent, '');
  assert.match(g.previewDecisionEmail(chair, b, '').body, /has not been selected for funding[\s\S]*www\.eeg101\.eu\/grants/);
  const reserve = g.previewDecisionEmail(chair, c, '').body;
  assert.match(reserve, /reserve list[\s\S]*do not apply in e-COST/);
  assert.ok(!/50%/.test(reserve));
  // A chair with a conflict cannot send; others go out and are recorded.
  g.saveReview(keys['chair2@example.org'], { id: b, conflict: true });
  g.state.mail = [];
  let out = g.sendDecisionEmails(keys['chair2@example.org'], [{ id: a }, { id: b }]);
  assert.match(out.notice, /1 decision email sent[\s\S]*conflict of interest for/);
  out = g.sendDecisionEmails(chair, [{ id: b }, { id: c, note: '' }]);
  assert.match(out.notice, /2 decision emails sent/);
  assert.strictEqual(g.state.mail.length, 3);
  assert.ok(g.state.mail.every(m => !m.cc && !m.bcc));
  const listed = out.applications.filter(x => x.id === a)[0];
  assert.ok(listed.decisionEmailed && listed.decisionEmailedAs === 'Funded');
  assert.match(g.previewDecisionEmail(chair, a, '').alreadySent, /as Funded/);
  // The daily allowance is respected.
  vm.runInContext('MailApp.getRemainingDailyQuota = () => 1;', g);
  out = g.sendDecisionEmails(chair, [{ id: a }]);
  assert.match(out.notice, /0 decision emails sent[\s\S]*allowance for today/);
});

test('the application page is built with its settings and can be framed', () => {
  const g = ready();
  const page = g.doGet({ parameter: { scheme: 'vmg' } });
  assert.strictEqual(page.xframe, 'ALLOWALL');
  const boot = JSON.parse(page.getContent().match(/const CONFIG = (.*);\n/)[1]);
  assert.strictEqual(boot.preselect, 'vmg');
  assert.strictEqual(boot.calls[0].periodEnd, '2027-09-30');
  assert.ok(!/<\/script>/.test(page.getContent().match(/const CONFIG = (.*);\n/)[1]));
});

console.log(`\n${passed} passed`);
