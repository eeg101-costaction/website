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

  function eventsOnDay(year, month, day) {
    return EVENTS.filter(function (ev) {
      if (!ev.start_date) return false;
      var d = parseLocalDate(ev.start_date);
      return d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
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
    btn.className = "cal-event-chip cal-event-chip--" + fmt;
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
    var dateLine = esc(ev.start_date || "");
    if (ev.time)     dateLine += " &middot; " + esc(ev.time);
    if (ev.location) dateLine += "<br>" + esc(ev.location);

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

  var now = new Date();
  curYear  = now.getFullYear();
  curMonth = now.getMonth();
  render();
}());
</script>

{% include event-booking-modal.html %}
{:/nomarkdown}
