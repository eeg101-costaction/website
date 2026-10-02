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

<div class="cal-legend" aria-hidden="true">
  <span class="cal-legend__item"><span class="cal-legend__swatch cal-legend__swatch--online"></span>Online</span>
  <span class="cal-legend__item"><span class="cal-legend__swatch cal-legend__swatch--in-person"></span>In person</span>
  <span class="cal-legend__item"><span class="cal-legend__swatch cal-legend__swatch--hybrid"></span>Hybrid</span>
  {% if site.data.site.internal_calendar_endpoint and site.data.site.internal_calendar_endpoint != "" %}
  <span class="cal-legend__item cal-legend__item--internal" id="cal-legend-internal" hidden><span class="cal-legend__swatch cal-legend__swatch--internal"></span>Internal</span>
  {% endif %}
  <a class="events-view-switch__link cal-legend__link" href="{{ '/events/' | relative_url }}">List view &rarr;</a>
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

  // A multi-day event belongs on every square it runs across, not only the one
  // it starts on, so a conference week reads as a week.
  function eventsOnDay(year, month, day) {
    var cell = new Date(year, month, day).getTime();
    return EVENTS.concat(INTERNAL).filter(function (ev) {
      var start = parseLocalDate(ev.start_date);
      if (!start) return false;
      var end = parseLocalDate(ev.end_date) || start;
      if (end < start) end = start;
      return cell >= start.getTime() && cell <= end.getTime();
    });
  }

  function formatRange(ev) {
    var start = parseLocalDate(ev.start_date);
    var end   = parseLocalDate(ev.end_date);
    if (!start) return ev.start_date || "";
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
    btn.textContent = ev.title;
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
    var dateLine = esc(formatRange(ev));
    if (ev.time)     dateLine += " &middot; " + esc(ev.time) + (ev.end_time ? "&ndash;" + esc(ev.end_time) : "") + (ev.timezone_label ? " " + esc(ev.timezone_label) : "");
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

  var now = new Date();
  curYear  = now.getFullYear();
  curMonth = now.getMonth();
  render();
}());
</script>

{% include event-booking-modal.html %}
{:/nomarkdown}
