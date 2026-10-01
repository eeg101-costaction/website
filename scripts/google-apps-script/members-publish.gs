/**
 * EEG101 Members publishing action
 *
 * Bind this script to the private “EEG101 Members: eCOST Export” spreadsheet.
 * Organisers only paste an unchanged eCOST CSV export into the Raw eCOST export
 * tab and select EEG101 Members → Validate and publish.
 */

const EEG101_MEMBERS = {
  rawSheet: 'Raw eCOST export',
  cacheSheet: 'Location cache',
  logSheet: 'Publishing log',
  repository: 'eeg101-costaction/website',
  branch: 'main',
  mapPath: 'assets/data/network-map.json',
  tokenProperty: 'EEG101_GITHUB_TOKEN',
  countryAliases: { Turkey: 'Türkiye', Turkiye: 'Türkiye' },
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('EEG101 Members')
    .addItem('Validate and publish', 'validateAndPublish')
    .addToUi();
}

function validateAndPublish() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) throw new Error('A Members publication is already running. Please wait and try again.');
  try {
    const workbook = SpreadsheetApp.getActiveSpreadsheet();
    const rows = getRawRows_(workbook.getSheetByName(EEG101_MEMBERS.rawSheet));
    validateRows_(rows);
    const cache = readCache_(workbook.getSheetByName(EEG101_MEMBERS.cacheSheet));
    const result = buildDataset_(rows, cache);
    writeNewCacheEntries_(workbook.getSheetByName(EEG101_MEMBERS.cacheSheet), result.newCacheRows);
    const commit = publishToGitHub_(result.dataset);
    appendLog_(workbook.getSheetByName(EEG101_MEMBERS.logSheet), 'Published', rows.length, result.dataset.member_count, result.dataset.site_count, result.newCacheRows.length, result.provisionalCount, commit, result.notes.join(' | '));
    SpreadsheetApp.getUi().alert(`Published ${result.dataset.member_count} members at ${result.dataset.site_count} institutions. GitHub commit: ${commit}.`);
  } catch (error) {
    const workbook = SpreadsheetApp.getActiveSpreadsheet();
    appendLog_(workbook.getSheetByName(EEG101_MEMBERS.logSheet), 'Blocked', '', '', '', '', '', '', String(error));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function getRawRows_(sheet) {
  if (!sheet) throw new Error('The Raw eCOST export tab is missing.');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error('Paste the detailed eCOST export, including its header row, into Raw eCOST export before publishing.');
  const headers = values[0].map(fieldKey_);
  return values.slice(1).filter(row => row.some(value => clean_(value))).map(row => headers.reduce((record, header, index) => {
    if (header) record[header] = clean_(row[index]);
    return record;
  }, {}));
}

function validateRows_(rows) {
  const headers = new Set(Object.keys(rows[0] || {}));
  const required = ['first name', 'last name', 'email', 'affiliation', 'country'];
  const missing = required.filter(header => !headers.has(header));
  const groupField = ['assigned working groups', 'application working groups'].some(header => headers.has(header)) || [...headers].some(header => /^wg[123]\./.test(header));
  if (missing.length || !groupField) throw new Error(`This does not appear to be the detailed eCOST Working Group export. Missing: ${missing.join(', ') || 'none'}; working-group data present: ${groupField}.`);
  if (rows.length < 20) throw new Error('The export has fewer than 20 member rows and was not published as a safety precaution.');
  rows.forEach((row, index) => {
    const missingValues = required.filter(header => !clean_(row[header]));
    if (missingValues.length) throw new Error(`Row ${index + 2} has blank required values: ${missingValues.join(', ')}.`);
  });
}

function buildDataset_(rows, cache) {
  const grouped = {};
  const newCacheRows = [];
  let provisionalCount = 0;
  rows.forEach(row => {
    const country = normaliseCountry_(row.country);
    const name = `${clean_(row['first name'])} ${clean_(row['last name'])}`.trim();
    const location = resolveLocation_(clean_(row.affiliation), country, cache, newCacheRows);
    if (location.confidence === 'country-provisional') provisionalCount += 1;
    const key = `${asciiKey_(location.institution)}|${asciiKey_(location.country)}`;
    if (!grouped[key]) grouped[key] = { location, members: [] };
    grouped[key].members.push({
      name, affiliation: clean_(row.affiliation), working_groups: extractGroups_(row),
      email: obfuscateEmail_(row.email), homepage: clean_(row.homepages), orcid: clean_(row.orcid),
    });
  });
  const sites = Object.values(grouped).sort((a, b) => a.location.institution.localeCompare(b.location.institution)).map((group, index) => {
    const members = group.members.sort((a, b) => a.name.localeCompare(b.name));
    return { id: `site-${index + 1}`, ...group.location, members, member_count: members.length,
      working_groups: [...new Set(members.flatMap(member => member.working_groups))].sort() };
  });
  const countries = {};
  sites.forEach(site => {
    if (!countries[site.country]) countries[site.country] = { name: site.country, site_count: 0, member_count: 0 };
    countries[site.country].site_count += 1; countries[site.country].member_count += site.member_count;
  });
  return { dataset: { generated_from: 'EEG101 Members: eCOST Export', member_count: rows.length, site_count: sites.length, country_count: Object.keys(countries).length, countries: Object.values(countries).sort((a, b) => a.name.localeCompare(b.name)), sites }, newCacheRows, provisionalCount, notes: provisionalCount ? [`${provisionalCount} member records use a country-provisional location.`] : ['All locations resolved to institutions.'] };
}

function resolveLocation_(affiliation, country, cache, newRows) {
  const key = `institution|${asciiKey_(affiliation)}|${asciiKey_(country)}`;
  if (cache[key]) return cache[key];
  const result = Maps.newGeocoder().setLanguage('en').geocode(`${affiliation}, ${country}`);
  const candidate = (result.results || []).find(item => resultMatchesCountry_(item, country));
  if (candidate) {
    const location = { institution: affiliation, city: cityFromResult_(candidate, country), country, latitude: candidate.geometry.location.lat, longitude: candidate.geometry.location.lng, location_confidence: 'geocoded' };
    cache[key] = location; newRows.push(cacheRow_(key, 'institution', location, 'Google Maps institution geocoder', 'Review recommended')); return location;
  }
  const countryKey = `country|${asciiKey_(country)}`;
  if (cache[countryKey]) return { ...cache[countryKey], institution: affiliation, city: country, location_confidence: 'country-provisional' };
  const countryResult = Maps.newGeocoder().setLanguage('en').geocode(country);
  if (!(countryResult.results || []).length) throw new Error(`No map location could be found for ${affiliation}, ${country}.`);
  const point = countryResult.results[0];
  const countryLocation = { institution: country, city: country, country, latitude: point.geometry.location.lat, longitude: point.geometry.location.lng, location_confidence: 'country-provisional' };
  cache[countryKey] = countryLocation; newRows.push(cacheRow_(countryKey, 'country', countryLocation, 'Google Maps country geocoder', 'Country fallback only'));
  return { ...countryLocation, institution: affiliation };
}

function readCache_(sheet) {
  const values = sheet.getDataRange().getValues();
  const output = {};
  values.slice(1).forEach(row => {
    if (!row[0]) return;
    output[row[0]] = { institution: row[2], country: row[3], city: row[4], latitude: Number(row[5]), longitude: Number(row[6]), location_confidence: row[7] || 'reviewed' };
  });
  return output;
}

function writeNewCacheEntries_(sheet, rows) { if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); }
function cacheRow_(key, type, location, source, review) { return [key, type, location.institution, location.country, location.city, location.latitude, location.longitude, location.location_confidence, source, new Date().toISOString(), review]; }
function appendLog_(sheet, result, sourceRows, members, sites, newLocations, provisional, commit, notes) { sheet.appendRow([new Date().toISOString(), result, sourceRows, members, sites, newLocations, provisional, commit, notes]); }

function publishToGitHub_(dataset) {
  const token = PropertiesService.getScriptProperties().getProperty(EEG101_MEMBERS.tokenProperty);
  if (!token) throw new Error(`Set the private Script property ${EEG101_MEMBERS.tokenProperty} before publishing.`);
  const base = `https://api.github.com/repos/${EEG101_MEMBERS.repository}/contents/${EEG101_MEMBERS.mapPath}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const current = UrlFetchApp.fetch(`${base}?ref=${EEG101_MEMBERS.branch}`, { headers, muteHttpExceptions: true });
  if (current.getResponseCode() !== 200) throw new Error(`Could not read the current public data file from GitHub (${current.getResponseCode()}).`);
  const body = JSON.parse(current.getContentText());
  const response = UrlFetchApp.fetch(base, { method: 'put', headers, contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ message: 'Sync Members data from eCOST export', content: Utilities.base64Encode(JSON.stringify(dataset, null, 2) + '\n'), sha: body.sha, branch: EEG101_MEMBERS.branch }) });
  if (response.getResponseCode() >= 300) throw new Error(`GitHub publication failed (${response.getResponseCode()}): ${response.getContentText()}`);
  return JSON.parse(response.getContentText()).commit.sha;
}

function extractGroups_(row) { const text = `${row['assigned working groups'] || ''} ${row['application working groups'] || ''}`; return [1, 2, 3].filter(number => new RegExp(`\\bWG\\s*${number}\\b`, 'i').test(text) || ['y', 'yes', 'true', '1'].includes(clean_(row[`wg${number}. ${number === 1 ? 'reporting standards' : number === 2 ? 'curation and harmonization' : 'manifesto'}`]).toLowerCase())).map(number => `WG${number}`); }
function resultMatchesCountry_(result, country) { return (result.address_components || []).some(component => (component.types || []).includes('country') && normaliseCountry_(component.long_name) === country); }
function cityFromResult_(result, fallback) { const component = (result.address_components || []).find(item => (item.types || []).some(type => ['locality', 'postal_town', 'administrative_area_level_1'].includes(type))); return component ? component.long_name : fallback; }
function fieldKey_(value) { return clean_(value).replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, ' '); }
function clean_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function normaliseCountry_(value) { const country = clean_(value).replace(/\s*\([A-Z]{2,3}\)\s*$/, ''); return EEG101_MEMBERS.countryAliases[country] || country; }
function asciiKey_(value) { return clean_(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function obfuscateEmail_(value) { const email = clean_(value); if (!email.includes('@')) return ''; const [local, domain] = email.split('@'); return `${local} [at] ${domain.replace(/\./g, ' [dot] ')}`; }
