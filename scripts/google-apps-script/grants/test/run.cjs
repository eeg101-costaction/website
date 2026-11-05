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
  const settings = g.tab('Settings');
  settings.rows.forEach(r => { if (r[0] === 'call_open') r[1] = 'TRUE'; if (r[0] === 'deadline') r[1] = '2026-12-15T17:00'; if (r[0] === 'web_app_url') r[1] = 'https://script.google.com/macros/s/ABC/exec'; });
  g.state.props.GRANTS_BCC = 'amy@example.org, faisal@example.org, not-an-email';
  return g;
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

function stsm(g, overrides) {
  const cv = g.uploadFile({ name: 'cv.pdf', data: PDF });
  const letter = g.uploadFile({ name: 'host letter.pdf', data: PDF });
  return Object.assign({
    scheme: 'stsm', first_name: 'Ada', last_name: 'Lovelace', email: 'Ada@Example.org', position: 'Postdoc', career_stage: 'Postdoctoral researcher',
    institution: 'University of Lisbon', department: 'Psychology', country: 'Portugal', orcid: '', yri: 'Yes', eci: 'Yes', gender: 'Female', member: 'Yes',
    working_groups: ['WG2 Curation and Harmonisation', 'Not a WG'], start_date: '2027-03-01', end_date: '2027-03-14',
    host_name: 'Prof Host', host_email: 'host@leeds.ac.uk', host_institution: 'University of Leeds', host_country: 'United Kingdom', host_member: 'Yes',
    title: 'Harmonising resting-state EEG', summary: 'A short summary.', workplan: 'Plan.', outcomes: 'Outcomes.', relevance: 'Relevant.', benefit: 'Benefit.',
    budget: [{ category: 'Travel', description: 'Flights', amount: '450' }, { category: 'Accommodation', description: '13 nights', amount: 1300 }],
    justification: 'Quotes from airline and university housing.',
    documents: { cv: cv, host_letter: letter },
    confirm_accurate: true, confirm_rules: true, confirm_privacy: true, signature: 'Ada Lovelace'
  }, overrides || {});
}

test('set-up creates the tabs, defaults and a staging clean-up trigger, closed by default', () => {
  const g = makeGoogle();
  g.setUpGrants();
  const book = g.state.sheets[g.state.props.GRANTS_SHEET_ID];
  same(book.tabs.map(t => t.name), ['Applications', 'Reviews', 'Reviewers', 'Settings']);
  assert.strictEqual(g.applyConfig('').open, false);
  assert.strictEqual(g.state.triggers.length, 1);
  g.setUpGrants(); // running again adds nothing twice
  assert.strictEqual(g.tab('Settings').rows.filter(r => r[0] === 'call_open').length, 1);
  assert.strictEqual(g.tab('Reviewers').rows.length, 2);
});

test('the call opens and closes with the Settings tab and the deadline', () => {
  const g = ready();
  assert.strictEqual(g.applyConfig('stsm').open, true);
  assert.strictEqual(g.applyConfig('stsm').preselect, 'stsm');
  assert.strictEqual(g.applyConfig('nonsense').preselect, '');
  assert.match(g.applyConfig('').deadlineText, /15 December 2026, 17:00 Brussels time/);
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
  assert.strictEqual(row['Working Groups'], 'WG2 Curation and Harmonisation');
  assert.match(row['Drive folder'], /drive\.google\.com\/drive\/folders/);
  const folder = Object.values(g.state.folders).filter(f => f.name.indexOf('EEG101-G2-001') === 0)[0];
  const inFolder = Object.values(g.state.files).filter(f => f.folder === folder).map(f => f.name).sort();
  assert.deepStrictEqual(inFolder.length, 3, inFolder);
  assert.ok(inFolder.some(n => /Application\.pdf$/.test(n)));
  const mail = g.state.mail[0];
  assert.strictEqual(mail.to, 'ada@example.org');
  assert.strictEqual(mail.cc, 'eeg101costaction@gmail.com');
  assert.strictEqual(mail.bcc, 'amy@example.org,faisal@example.org');
  assert.strictEqual(mail.attachments.length, 1);
  assert.match(mail.subject, /EEG101-G2-001/);
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

  // Links: emailed once each, and only a listed key opens the page.
  g.sendReviewerLinks();
  assert.strictEqual(g.state.mail.filter(m => m.subject === 'Your EEG101 grant review link').length, 5);
  assert.match(g.state.mail.filter(m => m.to === 'r1@example.org')[0].body, new RegExp('exec\\?view=review&key=' + keys['r1@example.org']));
  g.sendReviewerLinks();
  assert.strictEqual(g.state.mail.filter(m => m.subject === 'Your EEG101 grant review link').length, 5);
  assert.match(g.doGet({ parameter: { view: 'review', key: 'x'.repeat(40) } }).getContent(), /not valid/);
  assert.match(g.doGet({ parameter: { view: 'review' } }).getContent(), /not valid/);
  throwsLike(() => g.listApplications('nope'), /not valid/);
  const page = g.doGet({ parameter: { view: 'review', key: keys['r1@example.org'] } }).getContent();
  assert.match(page, /EEG101 grant review/);
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
  g.saveReview(r1, { id: a, scores: [5, 4, 4, 5], recommendation: 'Fund', comments: 'Strong' });
  throwsLike(() => g.saveReview(r1, { id: a, scores: [5, 4, 9, 5], recommendation: 'Fund' }), /1 to 5/);
  g.saveReview(r1, { id: a, scores: [5, 5, 5, 5], recommendation: 'Fund', comments: 'Updated' }); // edits, not duplicates
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
  throwsLike(() => g.saveReview(bob, { id: b, scores: [5, 5, 5, 5], recommendation: 'Fund' }), /your own application/);
  assert.ok(g.listApplications(bob).applications.filter(x => x.id === b)[0].own);

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
  g.saveReview(chair, { id: b, scores: [3, 3, 3, 3], recommendation: 'Fund if budget allows' });
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

  // With blind_review FALSE, reviewers see names and reports too.
  g.tab('Settings').rows.forEach(r => { if (r[0] === 'blind_review') r[1] = 'FALSE'; });
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

test('the application page is built with its settings and can be framed', () => {
  const g = ready();
  const page = g.doGet({ parameter: { scheme: 'vmg' } });
  assert.strictEqual(page.xframe, 'ALLOWALL');
  const boot = JSON.parse(page.getContent().match(/const CONFIG = (.*);\n/)[1]);
  assert.strictEqual(boot.preselect, 'vmg');
  assert.strictEqual(boot.periodEnd, '2027-09-30');
  assert.ok(!/<\/script>/.test(page.getContent().match(/const CONFIG = (.*);\n/)[1]));
});

console.log(`\n${passed} passed`);
