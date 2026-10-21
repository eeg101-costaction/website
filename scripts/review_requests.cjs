/*
 * Open and close "Ready for review" issues for website drafts.
 *
 * Run by .github/workflows/content-check.yml (actions/github-script) after
 * scripts/export_drafts.py has written review.json: every Event, calendar date
 * and Spotlight, whether it is published, whether it is marked ready for
 * review, and the reviewers from _data/site.yml.
 *
 *   ready for review and not published, no open issue  -> open one, @mentioning
 *                                                          the reviewers (GitHub
 *                                                          emails them)
 *   open issue, item now published                      -> comment "now live", close
 *   open issue, "Ready for review" unticked             -> comment, close
 *   open issue, item deleted                            -> comment, close
 *
 * Each issue carries a hidden marker naming its item, so this is safe to run
 * any number of times. Nothing here can publish or change content.
 */
const fs = require('fs');

const LABEL = 'ready-for-review';
const marker = key => `<!-- review:${key} -->`;
const keyOf = body => ((body || '').match(/<!-- review:(\S+) -->/) || [])[1];
const KIND = { events: 'Event', dates: 'Calendar date', spotlights: 'Spotlight' };

function requestBody(item, reviewers) {
  const named = reviewers.map(r => r.name.split(' ')[0]).filter(Boolean);
  const mentions = reviewers.filter(r => r.github).map(r => '@' + r.github);
  const who = named.length ? named.join(' and ') : 'Reviewers';
  return [
    `${who}: a draft is ready for your review.`,
    '',
    `**${KIND[item.collection] || 'Item'}:** ${item.title}`,
    '',
    `1. **Read it on the drafts page:** ${item.preview_url}`,
    `2. **Open it in the website editor:** ${item.edit_url}`,
    '3. If it is ready, tick **Published on the website** and save. It goes live a minute or two later and this issue closes by itself.',
    '4. If it needs changes, reply here (or tell the author), untick **Ready for review** and save.',
    '',
    mentions.length ? `cc ${mentions.join(' ')}` : '',
    marker(item.key),
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
}

module.exports = async function run({ github, context, core, file = 'review.json' }) {
  if (!fs.existsSync(file)) { core.info('No review list; nothing to do.'); return; }
  const { reviewers = [], items = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const repo = context.repo;

  try { await github.rest.issues.getLabel({ ...repo, name: LABEL }); }
  catch { await github.rest.issues.createLabel({ ...repo, name: LABEL, color: '0e8a16', description: 'A website draft waiting for review' }); }

  const open = await github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'open', labels: LABEL, per_page: 100 });
  const openByKey = new Map();
  for (const issue of open) { const key = keyOf(issue.body); if (key && !openByKey.has(key)) openByKey.set(key, issue); }
  const byKey = new Map(items.map(item => [item.key, item]));

  const close = async (issue, body, reason) => {
    await github.rest.issues.createComment({ ...repo, issue_number: issue.number, body });
    await github.rest.issues.update({ ...repo, issue_number: issue.number, state: 'closed', state_reason: reason });
    core.info(`Closed #${issue.number}: ${body}`);
  };

  for (const item of items) {
    const issue = openByKey.get(item.key);
    if (item.ready && !item.published && !issue) {
      const created = await github.rest.issues.create({ ...repo, labels: [LABEL],
        title: `Ready for review: ${item.title}`, body: requestBody(item, reviewers) });
      core.info(`Opened #${created.data.number} for ${item.key}`);
    } else if (issue && item.published) {
      await close(issue, `Published: this is now live${item.live_url ? ` (${item.live_url})` : ''}. Closing.`, 'completed');
    } else if (issue && !item.ready) {
      await close(issue, 'Moved back to draft ("Ready for review" was unticked). A new request will be opened when it is marked ready again.', 'not_planned');
    }
  }
  for (const [key, issue] of openByKey) {
    if (!byKey.has(key)) await close(issue, 'This draft was deleted. Closing.', 'not_planned');
  }
};

module.exports.requestBody = requestBody;
