---
layout: page
title: "Calendar"
subtitle: "EEG101 events at a glance"
permalink: /calendar/
---

{::nomarkdown}
<div class="cal-nav mb-2">
  <button class="btn btn-outline-primary btn-sm" id="cal-prev" type="button">&#8592; Prev</button>
  <h2 class="cal-nav__title mb-0" id="cal-title"></h2>
  <button class="btn btn-outline-primary btn-sm" id="cal-next" type="button">Next &#8594;</button>
</div>

<div class="cal-toolbar">
  <label class="cal-tz" for="cal-tz">Times in
    <select class="cal-tz__select" id="cal-tz"><option value="auto">Your time zone</option></select>
  </label>
  <a class="events-view-switch__link" href="{{ '/events/' | relative_url }}">List view &rarr;</a>
</div>

<div class="cal-legend" aria-hidden="true">
  <span class="cal-legend__item"><span class="cal-legend__swatch cal-legend__swatch--online"></span>Online</span>
  <span class="cal-legend__item"><span class="cal-legend__swatch cal-legend__swatch--in-person"></span>In person</span>
  <span class="cal-legend__item"><span class="cal-legend__swatch cal-legend__swatch--hybrid"></span>Hybrid</span>
  {% if site.data.site.internal_calendar_endpoint and site.data.site.internal_calendar_endpoint != "" %}
  <span class="cal-legend__item cal-legend__item--internal" id="cal-legend-internal" hidden><span class="cal-legend__swatch cal-legend__swatch--internal"></span>Internal</span>
  {% endif %}
</div>

{% if site.data.site.internal_calendar_endpoint and site.data.site.internal_calendar_endpoint != "" %}
<div class="cal-internal" id="cal-internal">
  <div class="cal-internal__bar">
    <p class="cal-internal__text" id="cal-internal-text">Core group and Management Committee members can add the internal calendar to this view.</p>
    <button type="button" class="btn btn-outline-primary btn-sm" id="cal-internal-toggle">Show internal calendar</button>
  </div>
  <div class="cal-internal__panel" id="cal-internal-panel" hidden>
    <iframe class="cal-internal__frame" id="cal-internal-frame" title="Internal calendar passphrase" loading="lazy"></iframe>
  </div>
</div>
{% endif %}

<div class="cal-grid-wrap">
  <div class="cal-grid" id="cal-grid">
    <div class="cal-header-cell">Mon</div>
    <div class="cal-header-cell">Tue</div>
    <div class="cal-header-cell">Wed</div>
    <div class="cal-header-cell">Thu</div>
    <div class="cal-header-cell">Fri</div>
    <div class="cal-header-cell cal-header-cell--weekend">Sat</div>
    <div class="cal-header-cell cal-header-cell--weekend">Sun</div>
  </div>
</div>

<div id="cal-popover" class="cal-popover" hidden aria-live="polite"></div>

<script>
(function () {
  var EVENTS = {{ site.data.events | jsonify }};
  var INTERNAL = [];
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

  var curYear, curMonth;
  var grid     = document.getElementById("cal-grid");
  var titleEl  = document.getElementById("cal-title");
  var popover  = document.getElementById("cal-popover");

  function parseLocalDate(str) {
    if (!str) return null;
    var p = String(str).split("-");
    if (p.length < 3) return null;
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  /* ---- Time zones -------------------------------------------------------
     Event times are stored as a wall clock plus an IANA zone ("10:00" in
     Europe/Brussels). To show them anywhere else we need the instant they
     describe, which the browser's own time-zone database can give us: no
     library, and no request to an IP-geolocation service either, since
     Intl already knows where the reader is. An event is only converted when
     its time is a bare HH:MM and it carries a zone; anything else (a
     free-text time, a conference with no time at all) is shown as written. */

  var DEFAULT_ZONE = "Europe/London";       // what the booking form assumes too
  var TZ_KEY = "eeg101-calendar-tz";
  var HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

  var AUTO_ZONE = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }());
  var tzMode = "auto";                       // "auto" | "event" | an IANA name

  function zoneFor(ev) {
    if (tzMode === "event") return ev.timezone || DEFAULT_ZONE;
    if (tzMode === "auto")  return AUTO_ZONE || ev.timezone || DEFAULT_ZONE;
    return tzMode;
  }

  function zoneParts(ts, zone, opts) {
    var out = {};
    try {
      new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: zone }, opts))
        .formatToParts(new Date(ts))
        .forEach(function (part) { out[part.type] = part.value; });
    } catch (e) { return null; }
    return out;
  }

  /* How far ahead of UTC the zone is at that instant. */
  function zoneOffset(ts, zone) {
    var p = zoneParts(ts, zone, { hour12: false, year: "numeric", month: "2-digit",
                                  day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (!p) return 0;
    return Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) - ts;
  }

  /* The instant a wall clock describes in a given zone. Two passes, so a time
     that falls near a daylight-saving change still lands on the right side. */
  function instantOf(dateStr, timeStr, zone) {
    var d = parseLocalDate(dateStr);
    var m = HHMM.exec(String(timeStr || "").trim());
    if (!d || !m || !zone) return null;
    var naive = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), +m[1], +m[2]);
    var ts = naive;
    for (var i = 0; i < 2; i++) ts = naive - zoneOffset(ts, zone);
    return ts;
  }

  function dayKey(ts, zone) {
    var p = zoneParts(ts, zone, { year: "numeric", month: "2-digit", day: "2-digit" });
    return p ? p.year + "-" + p.month + "-" + p.day : null;
  }
  function clockIn(ts, zone) {
    var p = zoneParts(ts, zone, { hour12: false, hour: "2-digit", minute: "2-digit" });
    return p ? (p.hour % 24 < 10 ? "0" : "") + (p.hour % 24) + ":" + p.minute : "";
  }
  function abbrevIn(ts, zone) {
    var p = zoneParts(ts, zone, { timeZoneName: "short" });
    return p && p.timeZoneName ? p.timeZoneName : "";
  }
  function addDays(dateStr, days) {
    var d = parseLocalDate(dateStr);
    if (!d) return dateStr;
    d.setDate(d.getDate() + days);
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
  }
  function daysBetween(a, b) {
    var x = parseLocalDate(a), y = parseLocalDate(b);
    return x && y ? Math.round((x.getTime() - y.getTime()) / 86400000) : 0;
  }

  /* What this event looks like in the chosen zone. Attached to the event once
     per render so the 42 cells of a month do not each recompute it. */
  function describe(ev) {
    var stated = ev.timezone || (HHMM.test(String(ev.time || "").trim()) ? DEFAULT_ZONE : "");
    var startTs = instantOf(ev.start_date, ev.time, stated);
    if (startTs === null) {
      return { start: ev.start_date, end: ev.end_date || ev.start_date,
               time: ev.time || "", endTime: ev.end_time || "",
               label: ev.timezone_label || "", converted: false };
    }
    var zone = zoneFor(ev);
    var endTs = instantOf(ev.end_date || ev.start_date, ev.end_time, stated);
    var start = dayKey(startTs, zone) || ev.start_date;
    /* A zone can move an event onto the day before or after. When only the
       start has a clock, the rest of the span moves with it. */
    var end = endTs !== null ? (dayKey(endTs, zone) || start)
                             : addDays(ev.end_date || ev.start_date, daysBetween(start, ev.start_date));
    /* An end that lands exactly on midnight belongs to the day that just
       finished: 08:00-09:00 in Brussels is 23:00-00:00 in Los Angeles, which
       is one evening, not two days. */
    if (endTs !== null && clockIn(endTs, zone) === "00:00" && daysBetween(end, start) > 0) end = addDays(end, -1);
    if (daysBetween(end, start) < 0) end = start;
    return {
      start: start, end: end,
      time: clockIn(startTs, zone),
      endTime: endTs !== null ? clockIn(endTs, zone) : "",
      label: abbrevIn(startTs, zone),
      converted: true
    };
  }

  function describeAll() {
    EVENTS.concat(INTERNAL).forEach(function (ev) { ev.shown = describe(ev); });
  }

  // A multi-day event belongs on every square it runs across, not only the one
  // it starts on, so a conference week reads as a week.
  function eventsOnDay(year, month, day) {
    var cell = new Date(year, month, day).getTime();
    return EVENTS.concat(INTERNAL).filter(function (ev) {
      var shown = ev.shown || describe(ev);
      var start = parseLocalDate(shown.start);
      if (!start) return false;
      var end = parseLocalDate(shown.end) || start;
      if (end < start) end = start;
      return cell >= start.getTime() && cell <= end.getTime();
    });
  }

  function formatRange(ev) {
    var shown = ev.shown || describe(ev);
    var start = parseLocalDate(shown.start);
    var end   = parseLocalDate(shown.end);
    if (!start) return shown.start || "";
    var opts  = { day: "numeric", month: "long", year: "numeric" };
    var first = start.toLocaleDateString("en-GB", opts);
    if (!end || end <= start) return first;
    var sameMonth = end.getFullYear() === start.getFullYear() && end.getMonth() === start.getMonth();
    return (sameMonth ? start.getDate() : start.toLocaleDateString("en-GB", opts)) +
           " \u2013 " + end.toLocaleDateString("en-GB", opts);
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function makeChip(ev) {
    var btn = document.createElement("button");
    var fmt = (ev.format || "online").toLowerCase().replace(/[^a-z-]/g, "");
    btn.type = "button";
    btn.className = ev.internal === true
      ? "cal-event-chip cal-event-chip--internal"
      : "cal-event-chip cal-event-chip--" + fmt;
    var shown = ev.shown || describe(ev);
    btn.textContent = shown.converted && shown.time ? shown.time + " " + ev.title : ev.title;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      showPopover(ev);
    });
    return btn;
  }

  function makeCell(year, month, day, otherMonth, isToday) {
    var cell = document.createElement("div");
    var dow  = new Date(year, month, day).getDay(); // 0=Sun ... 6=Sat
    var cls  = "cal-cell";
    if (otherMonth) cls += " cal-cell--other-month";
    if (isToday)    cls += " cal-cell--today";
    if (dow === 0 || dow === 6) cls += " cal-cell--weekend";
    cell.className = cls;

    var num = document.createElement("span");
    num.className = "cal-day-num";
    num.textContent = day;
    cell.appendChild(num);

    if (!otherMonth) {
      eventsOnDay(year, month, day).forEach(function (ev) {
        cell.appendChild(makeChip(ev));
      });
    }
    return cell;
  }

  function render() {
    describeAll();
    titleEl.textContent = MONTHS[curMonth] + " " + curYear;

    // Remove day cells but keep the 7 fixed header cells
    while (grid.children.length > 7) {
      grid.removeChild(grid.lastChild);
    }

    var today    = new Date();
    var firstDay = new Date(curYear, curMonth, 1);
    var lastDate = new Date(curYear, curMonth + 1, 0).getDate();

    // Mon-based day-of-week for the 1st  (0=Mon ... 6=Sun)
    var startDow = (firstDay.getDay() + 6) % 7;

    // Leading cells from the previous month
    var prevLast = new Date(curYear, curMonth, 0).getDate();
    for (var i = 0; i < startDow; i++) {
      var prevDay = prevLast - startDow + 1 + i;
      grid.appendChild(makeCell(curYear, curMonth - 1, prevDay, true, false));
    }

    // Current-month cells
    for (var d = 1; d <= lastDate; d++) {
      var isToday = today.getFullYear() === curYear &&
                    today.getMonth()    === curMonth &&
                    today.getDate()     === d;
      grid.appendChild(makeCell(curYear, curMonth, d, false, isToday));
    }

    // Trailing cells to complete the last row
    var total    = startDow + lastDate;
    var trailing = (7 - (total % 7)) % 7;
    for (var t = 1; t <= trailing; t++) {
      grid.appendChild(makeCell(curYear, curMonth + 1, t, true, false));
    }
  }

  function showPopover(ev) {
    var fmt      = (ev.format || "online").toLowerCase();
    var fmtLabel = { "online": "Online", "in-person": "In Person", "hybrid": "Hybrid" }[fmt] || fmt;
    var shown    = ev.shown || describe(ev);
    var dateLine = esc(formatRange(ev));
    if (shown.time)  dateLine += " &middot; " + esc(shown.time) + (shown.endTime ? "&ndash;" + esc(shown.endTime) : "") + (shown.label ? " " + esc(shown.label) : "");
    if (ev.location) dateLine += "<br>" + esc(ev.location);

    if (ev.internal === true) {
      popover.innerHTML =
        "<button class=\"cal-popover__close\" type=\"button\" aria-label=\"Close\">&times;</button>" +
        "<span class=\"cal-popover__badge\">Internal</span>" +
        "<h3 class=\"cal-popover__title\">" + esc(ev.title) + "</h3>" +
        "<p class=\"cal-popover__meta\">" + dateLine + (ev.all_day ? "<br>All day" : "") + "</p>" +
        (ev.summary ? "<p class=\"cal-popover__summary\">" + esc(ev.summary) + "</p>" : "");
      popover.hidden = false;
      popover.querySelector(".cal-popover__close").addEventListener("click", function () { popover.hidden = true; });
      return;
    }

    var membersOnly = ev.audience === "members";
    var bookingAction = membersOnly
      ? "<button type=\"button\" class=\"btn btn-primary btn-sm mt-2\" id=\"calendar-booking-action\">How to attend</button>"
      : ev.booking_enabled === true && ev.booking_status === "open"
      ? "<button type=\"button\" class=\"btn btn-primary btn-sm mt-2\" id=\"calendar-booking-action\">Register</button>"
      : ev.registration_url
      ? "<a href=\"" + esc(ev.registration_url) + "\" class=\"btn btn-primary btn-sm mt-2\" target=\"_blank\" rel=\"noopener\">Register &#8599;</a>"
      : "";
    var eventDate = parseLocalDate(ev.start_date);
    var todayDate = new Date();
    var isUpcoming = eventDate && eventDate >= new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    var shareUrl = "{{ site.url }}{{ '/events/' | relative_url }}#event-" + ev.id;
    var shareText = ev.title + " — EEG101 COST Action event";
    var shareAction = isUpcoming
      ? "<div class=\"event-share\">" +
          "<button type=\"button\" class=\"btn btn-outline-primary btn-sm mt-2 event-card__share\" id=\"calendar-share-action\" aria-haspopup=\"true\" aria-expanded=\"false\">Share</button>" +
          "<div class=\"event-share__menu\" id=\"calendar-share-menu\" hidden>" +
            "<a href=\"https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText) + "&amp;url=" + encodeURIComponent(shareUrl) + "\" target=\"_blank\" rel=\"noopener\">Share on X</a>" +
            "<a href=\"https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(shareUrl) + "\" target=\"_blank\" rel=\"noopener\">Share on LinkedIn</a>" +
            "<a href=\"https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareUrl) + "\" target=\"_blank\" rel=\"noopener\">Share on Facebook</a>" +
            "<a href=\"https://wa.me/?text=" + encodeURIComponent(shareText + " " + shareUrl) + "\" target=\"_blank\" rel=\"noopener\">Share on WhatsApp</a>" +
            "<a href=\"mailto:?subject=" + encodeURIComponent(ev.title) + "&amp;body=" + encodeURIComponent(shareText + " " + shareUrl) + "\">Share by email</a>" +
            "<button type=\"button\" class=\"event-share__copy\" data-copy-url=\"" + esc(shareUrl) + "\">Copy link</button>" +
          "</div>" +
        "</div>"
      : "";
    popover.innerHTML =
      "<button class=\"cal-popover__close\" type=\"button\" aria-label=\"Close\">&times;</button>" +
      "<span class=\"event-card__format event-card__format--" + fmt + "\">" + esc(fmtLabel) + "</span>" +
      (ev.external === true ? "<span class=\"event-card__external-badge\">External event</span>" : "") +
      "<h3 class=\"cal-popover__title\">" + esc(ev.title) + "</h3>" +
      "<p class=\"cal-popover__meta\">" + dateLine + "</p>" +
      (ev.summary ? "<p class=\"cal-popover__summary\">" + esc(ev.summary) + "</p>" : "") +
      bookingAction +
      shareAction +
      "<a href=\"{{ '/events/' | relative_url }}\" class=\"btn btn-outline-primary btn-sm mt-2\">Events &rarr;</a>";

    popover.hidden = false;
    var bookingButton = popover.querySelector("#calendar-booking-action");
    if (bookingButton && window.EEG101EventBooking) bookingButton.addEventListener("click", function () { popover.hidden = true; membersOnly ? window.EEG101EventBooking.openMembers(ev) : window.EEG101EventBooking.open(ev); });
    var shareButton = popover.querySelector("#calendar-share-action");
    var shareMenu = popover.querySelector("#calendar-share-menu");
    if (shareButton && shareMenu) {
      shareButton.addEventListener("click", function () {
        if (navigator.share) {
          navigator.share({ title: ev.title, text: shareText, url: shareUrl }).catch(function () {});
          return;
        }
        var opening = shareMenu.hidden;
        shareMenu.hidden = !opening;
        shareButton.setAttribute("aria-expanded", String(opening));
      });
      shareMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () { shareMenu.hidden = true; shareButton.setAttribute("aria-expanded", "false"); });
      });
      var copyButton = shareMenu.querySelector(".event-share__copy");
      copyButton.addEventListener("click", function () {
        var copyUrl = copyButton.dataset.copyUrl;
        var restoreLabel = copyButton.textContent;
        function showCopied() {
          copyButton.textContent = "Link copied!";
          copyButton.disabled = true;
          setTimeout(function () { copyButton.textContent = restoreLabel; copyButton.disabled = false; }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyUrl).then(showCopied, function () { window.prompt("Copy this link:", copyUrl); });
        } else {
          window.prompt("Copy this link:", copyUrl);
        }
      });
    }
    popover.querySelector(".cal-popover__close").addEventListener("click", function () {
      popover.hidden = true;
    });
  }

  // Close popover when clicking outside
  document.addEventListener("click", function () { popover.hidden = true; });
  popover.addEventListener("click", function (e) { e.stopPropagation(); });

  document.getElementById("cal-prev").addEventListener("click", function () {
    curMonth--;
    if (curMonth < 0) { curMonth = 11; curYear--; }
    render();
  });
  document.getElementById("cal-next").addEventListener("click", function () {
    curMonth++;
    if (curMonth > 11) { curMonth = 0; curYear++; }
    render();
  });

  // Internal events are never built into this site: they stay in Google Calendar
  // and are fetched, on demand, by a Google-hosted page in the iframe below. The
  // passphrase is typed into that iframe, so it is sent to Google and never
  // passes through eeg101.eu, and the events are held in memory only — a reload
  // asks again.
  (function internalCalendar() {
    var wrap = document.getElementById("cal-internal");
    if (!wrap) return;

    var endpoint = {{ site.data.site.internal_calendar_endpoint | default: "" | jsonify }};
    var toggle   = document.getElementById("cal-internal-toggle");
    var panel    = document.getElementById("cal-internal-panel");
    var frame    = document.getElementById("cal-internal-frame");
    var text     = document.getElementById("cal-internal-text");
    var legend   = document.getElementById("cal-legend-internal");
    var prompt   = text.textContent;

    function lock() {
      INTERNAL = [];
      panel.hidden = true;
      frame.removeAttribute("src");
      if (legend) legend.hidden = true;
      text.textContent = prompt;
      text.className = "cal-internal__text";
      toggle.textContent = "Show internal calendar";
      render();
    }

    function unlock(events) {
      INTERNAL = events || [];
      panel.hidden = true;
      frame.removeAttribute("src");
      if (legend) legend.hidden = false;
      text.textContent = INTERNAL.length === 1
        ? "1 internal event is showing. It is visible to you only, and goes when you reload."
        : INTERNAL.length + " internal events are showing. They are visible to you only, and go when you reload.";
      text.className = "cal-internal__text cal-internal__text--on";
      toggle.textContent = "Hide internal events";
      render();
    }

    toggle.addEventListener("click", function () {
      if (INTERNAL.length) { lock(); return; }
      if (!panel.hidden) { panel.hidden = true; return; }
      if (!frame.getAttribute("src")) {
        frame.src = endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") +
                    "origin=" + encodeURIComponent(window.location.origin);
      }
      panel.hidden = false;
    });

    window.addEventListener("message", function (e) {
      // Only the iframe we opened may speak for the internal calendar.
      if (!frame.contentWindow || e.source !== frame.contentWindow) return;
      var data = e.data || {};
      if (data.type !== "eeg101-internal-calendar") return;
      if (data.ok === true && Array.isArray(data.events)) unlock(data.events);
    });
  }());

  /* The picker. "Your time zone" is whatever the browser reports, which comes
     from the reader's own clock settings rather than a lookup of their IP, so
     it is both more accurate and nobody's address is sent anywhere. */
  (function timeZonePicker() {
    var select = document.getElementById("cal-tz");
    if (!select) return;

    var COMMON = ["UTC", "Europe/London", "Europe/Brussels", "Europe/Athens", "Europe/Istanbul",
                  "Europe/Moscow", "America/New_York", "America/Chicago", "America/Los_Angeles",
                  "America/Sao_Paulo", "Africa/Lagos", "Africa/Johannesburg", "Asia/Jerusalem",
                  "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
                  "Pacific/Auckland"];
    var every = [];
    try { every = Intl.supportedValuesOf("timeZone") || []; } catch (e) { every = []; }

    function option(value, text) {
      var o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      return o;
    }
    function group(label, zones) {
      var g = document.createElement("optgroup");
      g.label = label;
      zones.forEach(function (z) { g.appendChild(option(z, z.replace(/_/g, " "))); });
      return g;
    }

    select.innerHTML = "";
    select.appendChild(option("auto", AUTO_ZONE ? "Your time zone — " + AUTO_ZONE.replace(/_/g, " ") : "Your time zone"));
    select.appendChild(option("event", "The event's own time zone"));
    select.appendChild(group("Common", COMMON));
    if (every.length) select.appendChild(group("All time zones", every));

    var saved = null;
    try { saved = window.localStorage.getItem(TZ_KEY); } catch (e) {}
    if (saved && (saved === "auto" || saved === "event" ||
                  Array.prototype.some.call(select.options, function (o) { return o.value === saved; }))) {
      tzMode = saved;
    }
    select.value = tzMode;
    if (select.value !== tzMode) { tzMode = "auto"; select.value = "auto"; }

    select.addEventListener("change", function () {
      tzMode = select.value;
      try { window.localStorage.setItem(TZ_KEY, tzMode); } catch (e) {}
      popover.hidden = true;
      render();
    });
  }());

  var now = new Date();
  curYear  = now.getFullYear();
  curMonth = now.getMonth();
  render();
}());
</script>

{% include event-booking-modal.html %}
{:/nomarkdown}
