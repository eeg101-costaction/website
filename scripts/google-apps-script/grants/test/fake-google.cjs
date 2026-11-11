/*
 * A small in-memory stand-in for the Google services the grants Apps Script
 * uses (Sheets, Drive, Gmail, properties, HtmlService...), so its logic can be
 * tested with plain Node: `node scripts/google-apps-script/grants/test/run.cjs`.
 * Only what Code.gs calls is implemented.
 */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');

function makeGoogle(opts = {}) {
  let now = opts.now ? new Date(opts.now) : new Date('2026-11-10T09:00:00Z');
  let ids = 0; const newId = p => `${p}${++ids}`;
  const state = { mail: [], props: {}, files: {}, folders: {}, sheets: {}, triggers: [], activeUser: '', effectiveUser: 'owner@example.org' };

  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr: nr || 1, nc: nc || 1 }); }
    getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.sheet.rows[this.r - 1 + i] || []; const o = []; for (let j = 0; j < this.nc; j++) o.push(row[this.c - 1 + j] === undefined ? '' : row[this.c - 1 + j]); out.push(o); } return out; }
    setValues(v) { v.forEach((row, i) => { const target = this.sheet.rows[this.r - 1 + i] = this.sheet.rows[this.r - 1 + i] || []; row.forEach((x, j) => { target[this.c - 1 + j] = x; }); }); return this; }
    setValue(x) { return this.setValues([[x]]); }
    setFontWeight() { return this; } setBackground() { return this; } setNumberFormat() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getName() { return this.name; }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
    getRange(a, c, nr, nc) { if (typeof a === 'string') return new Range(this, 1, 2, Math.max(1, this.rows.length), 1); return new Range(this, a, c, nr, nc); }
    getDataRange() { return new Range(this, 1, 1, Math.max(1, this.rows.length), Math.max(1, this.getLastColumn())); }
    appendRow(v) { this.rows.push(v.slice()); return this; }
    setFrozenRows() {} hideColumns() {}
    deleteRow(n) { this.rows.splice(n - 1, 1); }
  }
  class Book {
    constructor(name) { this.id = newId('sheet'); this.name = name; this.tabs = [new Sheet('Sheet1')]; this.editors = []; state.sheets[this.id] = this; }
    getId() { return this.id; } getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}`; }
    getSheetByName(n) { return this.tabs.filter(t => t.name === n)[0] || null; }
    insertSheet(n) { const s = new Sheet(n); this.tabs.push(s); return s; }
    deleteSheet(s) { this.tabs = this.tabs.filter(t => t !== s); }
    getSheets() { return this.tabs; }
    addEditor(e) { this.editors.push(e); }
  }
  class Blob {
    constructor(bytes, type, name) { this.bytes = Array.from(bytes || []); this.type = type; this.name = name; }
    getBytes() { return this.bytes.slice(); } getContentType() { return this.type; } getName() { return this.name; }
    setName(n) { this.name = n; return this; } copyBlob() { return new Blob(this.bytes, this.type, this.name); }
    getDataAsString() { return Buffer.from(this.bytes.map(b => b & 255)).toString('utf8'); }
    getAs(type) { return new Blob(Buffer.from('%PDF-1.4\n' + this.getDataAsString()), type, this.name.replace(/\.\w+$/, '.pdf')); }
  }
  class File {
    constructor(blob, folder) { this.id = newId('file'); this.blob = blob; this.name = blob.getName(); this.folder = folder; this.created = new Date(now); this.trashed = false; state.files[this.id] = this; }
    getId() { return this.id; } getName() { return this.name; } setName(n) { this.name = n; return this; }
    getUrl() { return `https://drive.google.com/file/d/${this.id}/view`; } moveTo(f) { this.folder = f; return this; }
    getDateCreated() { return this.created; } setTrashed(t) { this.trashed = t; } getBlob() { return this.blob.copyBlob(); }
  }
  class Folder {
    constructor(name, parent) { this.id = newId('folder'); this.name = name; this.parent = parent; this.viewers = []; state.folders[this.id] = this; }
    getId() { return this.id; } getName() { return this.name; } getUrl() { return `https://drive.google.com/drive/folders/${this.id}`; }
    createFolder(n) { return new Folder(n, this); }
    createFile(blob) { return new File(blob, this); }
    getFoldersByName(n) { const list = Object.values(state.folders).filter(f => f.parent === this && f.name === n); return iter(list); }
    getFiles() { return iter(Object.values(state.files).filter(f => f.folder === this && !f.trashed)); }
    addViewer(e) { this.viewers.push(e); } addEditor(e) { this.viewers.push(e); }
  }
  const iter = list => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };

  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function parts(date, tz) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz === 'Etc/UTC' ? 'UTC' : tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = {}; f.formatToParts(date).forEach(p => { o[p.type] = p.value; }); return o;
  }
  const Utilities = {
    formatDate(date, tz, pattern) {
      const p = parts(date, tz);
      return pattern.replace(/'([^']*)'|yyyy|MMMM|MM|dd|d|HH|mm/g, (m, lit) => lit !== undefined ? lit : m === 'yyyy' ? p.year : m === 'MMMM' ? MONTHS[+p.month - 1] : m === 'MM' ? pad(p.month) : m === 'dd' ? pad(p.day) : m === 'd' ? String(+p.day) : m === 'HH' ? pad(p.hour) : pad(p.minute));
    },
    parseDate(text, tz, pattern) {
      const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
      const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
      if (tz === 'UTC') return new Date(guess);
      const p = parts(new Date(guess), tz);
      const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess;
      return new Date(guess - offset);
    },
    base64Decode: s => Array.from(Buffer.from(String(s), 'base64')).map(b => b > 127 ? b - 256 : b),
    base64Encode: b => Buffer.from((Array.isArray(b) ? b : Array.from(b)).map(x => x & 255)).toString('base64'),
    base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', k).update(v).digest()).map(b => b > 127 ? b - 256 : b),
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => b > 127 ? b - 256 : b),
    DigestAlgorithm: { SHA_256: 'sha256' },
    getUuid: () => crypto.randomUUID(),
    newBlob: (data, type, name) => new Blob(typeof data === 'string' ? Buffer.from(data) : data.map(b => b & 255), type, name)
  };
  const dir = path.join(__dirname, '..');
  const HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createHtmlOutput: html => output(html),
    createTemplateFromFile(name) {
      const src = fs.readFileSync(path.join(dir, name + '.html'), 'utf8');
      const t = { evaluate() { return output(src.replace(/<\?!=\s*(\w+)\s*\?>/g, (m, k) => t[k])); } };
      return t;
    }
  };
  function output(html) { const o = { html, title: '', setTitle(t) { o.title = t; return o; }, addMetaTag() { return o; }, setXFrameOptionsMode(m) { o.xframe = m; return o; }, getContent: () => html }; return o; }

  const context = {
    console: { log() {}, warn() {} }, state,
    SpreadsheetApp: { create: n => new Book(n), openById: id => { const b = state.sheets[id]; if (!b) throw new Error('no sheet'); return b; } },
    DriveApp: { createFolder: n => new Folder(n, null), getFolderById: id => state.folders[id], getFileById: id => { const f = state.files[id]; if (!f) throw new Error('No item with the given ID could be found.'); return f; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => state.props[k] ?? null, setProperty: (k, v) => { state.props[k] = String(v); } }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: t => { const o = { text: t, setMimeType(m) { o.mime = m; return o; }, getContent: () => t }; return o; } },
    CacheService: { getScriptCache: () => ({ get: k => (state.cache || (state.cache = {}))[k] ?? null, put: (k, v) => { (state.cache || (state.cache = {}))[k] = String(v); } }) },
    UrlFetchApp: { fetch: (url, opts) => { state.fetches = (state.fetches || []).concat([{ url, opts }]); return { getContentText: () => JSON.stringify({ success: opts.payload.response === 'good-token' }) }; } },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    MailApp: { sendEmail: o => state.mail.push(o), getRemainingDailyQuota: () => 100 },
    Session: { getActiveUser: () => ({ getEmail: () => state.activeUser }), getEffectiveUser: () => ({ getEmail: () => state.effectiveUser }) },
    ScriptApp: { getService: () => ({ getUrl: () => state.serviceUrl || '' }), getProjectTriggers: () => state.triggers, deleteTrigger() {}, newTrigger: h => ({ timeBased: () => ({ everyDays: () => ({ create: () => state.triggers.push({ getHandlerFunction: () => h }) }) }) }) },
    Utilities, HtmlService,
  };
  // Fix "now" for Date() inside the script, so "today" is predictable.
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now.getTime(); } }
  context.Date = FakeDate;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  context.setNow = d => { now = new RealDate(d); };
  return context;
}
module.exports = { makeGoogle };
