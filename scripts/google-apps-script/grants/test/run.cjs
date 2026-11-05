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
  settings.rows.forEach(r => { if (r[0] === 'call_open') r[1] = 'TRUE'; if (r[0] === 'deadline') r[1] = '2026-12-15T17:00'; });
  g.state.props.GRANTS_BCC = 'amy@example.org, faisal@example.org, not-an-email';
  return g;
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
    [{ member: 'No' }, /must be members/],
    [{ confirm_privacy: false }, /declarations/],
    [{ summary: 'word '.repeat(201) }, /200 words/],
    [{ email: 'nope' }, /valid email/],
    [{ country: 'Atlantis' }, /country/]
  ];
  cases.forEach(([o, re]) => throwsLike(() => g.submitApplication(stsm(g, o)), re));
  const p = stsm(g); delete p.documents.host_letter;
  throwsLike(() => g.submitApplication(p), /Upload: Letter of support/i);
  const forged = stsm(g); forged.documents.cv = { id: forged.documents.cv.id, name: 'cv.pdf', token: 'forged' };
  throwsLike(() => g.submitApplication(forged), /could not be verified/);
  assert.strictEqual(g.rowsAsObjects(g.tab('Applications')).length, 0);
  assert.strictEqual(g.state.mail.length, 0);
});

test('conference and VMG rules, and eligibility notes for reviewers', () => {
  const g = ready();
  const conf = stsm(g, { scheme: 'conference_online', start_date: '2027-05-10', end_date: '2027-05-12', country: 'Germany', eci: 'No',
    conference_name: 'OHBM', contribution_title: 'Poster', presentation: 'Poster', abstract_status: 'Submitted, awaiting decision',
    budget: [{ category: 'Registration fee', description: 'Fee', amount: 450 }], documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }), acceptance: g.uploadFile({ name: 'abs.pdf', data: PDF }) } });
  const r = g.submitApplication(conf);
  const row = g.rowsAsObjects(g.tab('Applications')).filter(x => x['ID'] === r.id)[0];
  assert.match(row['Eligibility notes'], /early-career researchers and researchers based in ITC/);
  assert.match(row['Eligibility notes'], /not yet accepted/);
  throwsLike(() => g.submitApplication(Object.assign({}, conf, { budget: [{ category: 'Registration fee', description: 'Fee', amount: 501 }], documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }), acceptance: g.uploadFile({ name: 'a.pdf', data: PDF }) } })), /maximum|amount/);
  const vmg = stsm(g, { scheme: 'vmg', collaborators: 'Dr X, Uni Y', third_party: 'Yes', third_party_member: 'Yes', budget: [{ category: 'Other', description: 'Licence', amount: 300 }], documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }) } });
  throwsLike(() => g.submitApplication(vmg), /Upload: Letter of support from the collaborating/i);
  vmg.third_party = 'No';
  assert.ok(g.submitApplication(vmg).id);
});

test('the confirmation email failing does not lose the application', () => {
  const g = ready();
  vm.runInContext('MailApp.sendEmail = () => { throw new Error("quota"); }', g);
  const r = g.submitApplication(stsm(g));
  assert.strictEqual(r.emailed, false);
  assert.strictEqual(g.rowsAsObjects(g.tab('Applications')).length, 1);
});

test('review: only listed reviewers, blind until scored, chairs decide, reports add up', () => {
  const g = ready();
  const a = g.submitApplication(stsm(g)).id;
  const b = g.submitApplication(stsm(g, { scheme: 'vmg', collaborators: 'Dr X', third_party: 'No', budget: [{ category: 'Other', description: 'x', amount: 1000 }], documents: { cv: g.uploadFile({ name: 'cv.pdf', data: PDF }) }, gender: 'Male', country: 'Germany' })).id;
  const reviewers = g.tab('Reviewers');
  reviewers.rows = [reviewers.rows[0], ['chair@example.org', 'Chair', 'chair'], ['r1@example.org', 'Rev One', 'reviewer'], ['r2@example.org', 'Rev Two', 'reviewer']];

  g.state.activeUser = 'stranger@example.org';
  assert.match(g.doGet({ parameter: { view: 'review' } }).getContent(), /This page is for EEG101 grant reviewers/);
  throwsLike(() => g.listApplications(), /not on the list/);
  g.state.activeUser = '';
  assert.match(g.doGet({ parameter: { view: 'review' } }).getContent(), /This page is for EEG101 grant reviewers/);

  g.state.activeUser = 'r1@example.org';
  assert.match(g.doGet({ parameter: { view: 'review' } }).getContent(), /EEG101 grant review/);
  g.saveReview({ id: a, scores: [5, 4, 4, 5], recommendation: 'Fund', comments: 'Strong' });
  throwsLike(() => g.saveReview({ id: a, scores: [5, 4, 9, 5], recommendation: 'Fund' }), /1 to 5/);
  g.saveReview({ id: a, scores: [5, 5, 5, 5], recommendation: 'Fund', comments: 'Updated' }); // edits, not duplicates
  assert.strictEqual(g.tab('Reviews').rows.length, 2);

  g.state.activeUser = 'r2@example.org';
  let list = g.listApplications().applications;
  assert.strictEqual(list.filter(x => x.id === a)[0].mean, null, 'r2 must not see scores before scoring');
  g.saveReview({ id: a, conflict: true });
  list = g.listApplications().applications;
  assert.strictEqual(list.filter(x => x.id === a)[0].mean, 5);
  assert.strictEqual(list.filter(x => x.id === a)[0].reviewCount, 1, 'a conflict is not a score');
  throwsLike(() => g.saveDecisions([{ id: a, decision: 'Funded' }]), /Only a grants chair/);

  g.state.activeUser = 'chair@example.org';
  throwsLike(() => g.saveDecisions([{ id: a, decision: 'Funded', awarded: 99999 }]), /between €0 and the €1750 requested/);
  g.saveDecisions([{ id: a, decision: 'Funded', awarded: '', rank: 1, notes: 'Top' }, { id: b, decision: 'Funded', awarded: 800, rank: 1 }]);
  const rows = g.rowsAsObjects(g.tab('Applications'));
  assert.strictEqual(rows.filter(r => r['ID'] === a)[0]['Awarded (€)'], 1750);
  assert.strictEqual(rows.filter(r => r['ID'] === a)[0]['Status'], 'Funded');
  const rep = g.getReport();
  same(rep.totals, { submitted: 2, requested: 2750, funded: 2, awarded: 2550 });
  same(rep.byScheme.funded.map(x => [x.key, x.amount]), [['STSM', 1750], ['VMG', 800]]);
  same(rep.byMonth, [{ key: '2027-03', count: 2, amount: 2550 }]);
  same(rep.byItc.funded.map(x => [x.key, x.count]), [['No', 1], ['Yes', 1]]);
  const full = g.getApplication(a);
  assert.match(full.html, /Harmonising resting-state EEG/);
  assert.ok(full.documents.cv.url);
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
