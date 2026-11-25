/**
 * EEG101 Google Calendar feed for the website's Calendar page.
 *
 * Every event on the chosen Google Calendar is shown publicly on
 * www.eeg101.eu/calendar/. The page asks this web app for the events each time
 * it loads, so a change in Google Calendar shows up on the site straight away,
 * with no rebuild.
 *
 * What is published, per event: title, dates, times, time zone and location
 * (with any web links in the location removed). Descriptions are never sent,
 * because that is where meeting links and passcodes usually live.
 *
 * Set-up: docs/internal-calendar.md. It needs one Script Property,
 * EEG101_INTERNAL_CALENDAR_ID, and the web app deployed as Execute as: Me,
 * Who has access: Anyone.
 */

const CALENDAR_FEED = {
  calendarProperty: 'EEG101_INTERNAL_CALENDAR_ID',
  monthsBack: 12,
  monthsForward: 24,
  // Calendar reads are cached briefly so a busy page cannot use up the
  // script's daily Calendar quota. Edits show on the site within this time.
  cacheSeconds: 300
};

function doGet() {
  let body;
  try {
    body = { ok: true, events: cachedEvents() };
  } catch (err) {
    body = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function cachedEvents() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('eeg101-calendar-feed');
  if (hit) return JSON.parse(hit);
  const events = readEvents();
  const text = JSON.stringify(events);
  // The cache holds at most 100KB per entry; a larger calendar is just read fresh.
  if (text.length < 95000) cache.put('eeg101-calendar-feed', text, CALENDAR_FEED.cacheSeconds);
  return events;
}

function feedCalendar() {
  const id = String(PropertiesService.getScriptProperties().getProperty(CALENDAR_FEED.calendarProperty) || '').trim();
  const calendar = id ? CalendarApp.getCalendarById(id) : null;
  if (!calendar) throw new Error('The calendar could not be opened. Check EEG101_INTERNAL_CALENDAR_ID, and that the calendar is shared with the account this script runs as.');
  return calendar;
}

function readEvents() {
  const calendar = feedCalendar();
  const zone = calendar.getTimeZone();
  const from = shiftMonths(new Date(), -CALENDAR_FEED.monthsBack);
  const to = shiftMonths(new Date(), CALENDAR_FEED.monthsForward);
  return calendar.getEvents(from, to).map(event => {
    const allDay = event.isAllDayEvent();
    const start = event.getStartTime();
    // An all-day event ends at midnight on the following day, which would put a
    // one-day event on two squares of the grid.
    const end = allDay ? new Date(event.getEndTime().getTime() - 86400000) : event.getEndTime();
    return {
      id: 'gcal-' + String(event.getId()).replace(/[^A-Za-z0-9-]+/g, ''),
      title: event.getTitle() || 'Untitled',
      start_date: Utilities.formatDate(start, zone, 'yyyy-MM-dd'),
      end_date: Utilities.formatDate(end < start ? start : end, zone, 'yyyy-MM-dd'),
      time: allDay ? '' : Utilities.formatDate(start, zone, 'HH:mm'),
      end_time: allDay ? '' : Utilities.formatDate(event.getEndTime(), zone, 'HH:mm'),
      timezone: zone,
      timezone_label: allDay ? '' : Utilities.formatDate(start, zone, 'zzz'),
      all_day: allDay,
      location: withoutLinks(event.getLocation() || '')
    };
  });
}

// A location such as "Zoom: https://..." keeps its words but loses the link.
function withoutLinks(text) {
  return String(text).replace(/\b(?:https?:\/\/|www\.)\S+/gi, '').replace(/\s*[:,;-]\s*$/, '').replace(/\s+/g, ' ').trim();
}

function shiftMonths(date, months) {
  const shifted = new Date(date.getTime());
  shifted.setMonth(shifted.getMonth() + months);
  return shifted;
}

// Run this from the editor to check the set-up: it logs how many events it can
// see, or why it cannot open the calendar.
function testCalendarFeed() {
  const events = readEvents();
  Logger.log(events.length + ' events found. First: ' + (events[0] ? events[0].start_date + ' ' + events[0].title : 'none'));
}
