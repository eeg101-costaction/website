#!/usr/bin/env node
/*
 * Rewrite the front matter Pages CMS saves so Jekyll reads it exactly as typed.
 *
 * Pages CMS writes YAML 1.2 (the `yaml` package's default). Jekyll reads front
 * matter as YAML 1.1, where several things staff type unquoted mean something
 * else: every time ("09:00" reads as the number 540), and the words yes, no, on,
 * off (in any case, so the country code NO becomes false), and numbers written
 * with commas (1,200 reads as 1200). Unchecked, the first save of any timed
 * event would break its time on the site.
 *
 * This parses each file with the same library and version Pages CMS used, then
 * writes it back as YAML 1.1, which quotes the values 1.1 would misread; text
 * that merely looks like a number (1,200 or 12,5) is quoted as well, because
 * Jekyll's reader accepts commas in numbers where the library does not.
 * Values are unchanged; only quoting and layout change. The body below the
 * front matter is kept byte for byte. A file already in this form is left
 * untouched, so running it twice changes nothing. A file that cannot be parsed
 * is reported and left alone (the content check then says what is wrong).
 *
 * Usage: node scripts/normalise_front_matter.cjs FILE [FILE...]
 * Needs the `yaml` package (the workflow installs the same major version Pages CMS uses).
 */
const fs = require('fs');
const YAML = require('yaml');

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

// Text Jekyll (Ruby's Psych, YAML 1.1) would read as a number: digits with
// commas, underscores, colons, dots or an exponent, or a 0x / 0b / 0o prefix.
const NUMBER_LIKE = /^[-+]?(\.?[0-9][0-9_,:.]*([eE][-+]?[0-9]+)?|0[xXbBoO][0-9a-fA-F_,]+)$/;

function normalise(text) {
  const m = text.match(FRONT_MATTER);
  if (!m) return null;
  const data = YAML.parse(m[1], { strict: false, uniqueKeys: false }) || {};
  const doc = new YAML.Document(data, { version: '1.1' });
  YAML.visit(doc, {
    Scalar(key, node) {
      if (key !== 'key' && typeof node.value === 'string' && NUMBER_LIKE.test(node.value)) node.type = 'QUOTE_DOUBLE';
    },
  });
  const front = doc.toString({ lineWidth: 0 });
  return '---\n' + front + '---\n' + text.slice(m[0].length);
}

let changed = 0;
for (const file of process.argv.slice(2)) {
  if (!/\.md$/.test(file) || !fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  let after;
  try {
    after = normalise(before);
  } catch (error) {
    console.log(`::warning::${file}: could not be read (${String(error.message).split('\n')[0]}); left as it is.`);
    continue;
  }
  if (after === null) { console.error(`${file}: no front matter, left alone`); continue; }
  if (after !== before) { fs.writeFileSync(file, after); changed++; console.log(`${file}: normalised`); }
}
if (!changed) console.log('Front matter already in Jekyll-safe form.');
