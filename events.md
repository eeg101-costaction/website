---
layout: page
title: "Event Hub"
subtitle: "Register for EEG101 meetings, training, workshops and Working Group activities"
description: "Account-free registration for internal EEG101 events, with calendar invitations and private administration."
permalink: /events/
---

{::nomarkdown}
<section class="event-hub-intro">
  <div>
    <p class="event-hub__eyebrow">EEG101 INTERNAL EVENTS</p>
    <h2>Register, connect and keep every event in your calendar.</h2>
    <p>Register without creating an account. Your details are used only to administer the event, send registration updates and maintain the private attendee record for up to 12 months after the event.</p>
  </div>
  <aside class="event-hub-privacy" aria-label="Registration and privacy">
    <strong>Registration and privacy</strong>
    <p>Attendee records are held privately by EEG101 and are never published on this website.</p>
  </aside>
</section>

{% assign now_epoch = "now" | date: "%s" | plus: 0 %}
{% assign visible_events = site.data.events | where: "registration_enabled", true | sort: "start_date" %}

<section class="event-hub-section" aria-labelledby="event-hub-open-title">
  <p class="event-hub__eyebrow">UPCOMING</p>
  <h2 id="event-hub-open-title">Open for registration</h2>
  <div class="event-hub-grid">
    {% assign open_count = 0 %}
    {% for event in visible_events %}
      {% assign event_epoch = event.start_date | date: "%s" | plus: 0 %}
      {% if event_epoch >= now_epoch and event.registration_status == "open" %}
        {% assign open_count = open_count | plus: 1 %}
        <article class="event-hub-card" id="{{ event.id }}">
          <div class="event-hub-card__meta"><span>{{ event.format | default: "online" }}</span><time datetime="{{ event.start_date }}">{{ event.start_date | date: "%-d %B %Y" }}</time></div>
          <h3>{{ event.title }}</h3>
          <p class="event-hub-card__location">{{ event.time }}{% if event.time and event.location %} · {% endif %}{{ event.location }}</p>
          <p>{{ event.summary }}</p>
          {% if event.capacity and event.capacity > 0 %}<p class="event-hub-card__capacity"><strong>Capacity:</strong> {{ event.capacity }} places. A waiting list will operate once all places are confirmed.</p>{% endif %}
          <div class="event-hub-card__actions"><button class="btn btn-primary event-hub-register" type="button" data-event-id="{{ event.id }}">Register for this event</button><button class="event-hub-calendar" type="button" data-event-id="{{ event.id }}">Add to calendar (.ics)</button></div>
        </article>
      {% endif %}
    {% endfor %}
    {% if open_count == 0 %}
      <div class="event-hub-empty"><strong>No events are currently open for registration.</strong><p>Future EEG101 events will appear here when registration opens.</p></div>
    {% endif %}
  </div>
</section>

<section class="event-hub-section event-hub-section--secondary" aria-labelledby="event-hub-all-title">
  <p class="event-hub__eyebrow">EVENT INFORMATION</p>
  <h2 id="event-hub-all-title">All upcoming EEG101 events</h2>
  <div class="event-hub-list">
    {% assign future_count = 0 %}
    {% for event in site.data.events %}
      {% assign event_epoch = event.start_date | date: "%s" | plus: 0 %}
      {% if event_epoch >= now_epoch %}
        {% assign future_count = future_count | plus: 1 %}
        <article class="event-hub-list__item"><div><time datetime="{{ event.start_date }}">{{ event.start_date | date: "%-d %B %Y" }}</time><h3>{{ event.title }}</h3><p>{{ event.location }}{% if event.time %} · {{ event.time }}{% endif %}</p></div>{% if event.registration_enabled and event.registration_status == "open" %}<button class="btn btn-outline-primary btn-sm event-hub-register" type="button" data-event-id="{{ event.id }}">Register</button>{% else %}<span class="event-hub-list__state">Details to follow</span>{% endif %}</article>
      {% endif %}
    {% endfor %}
    {% if future_count == 0 %}<div class="event-hub-empty"><strong>The forthcoming EEG101 programme will be announced shortly.</strong><p>Please consult <a href="{{ "/news/" | relative_url }}">News &amp; Events</a> for recent activity.</p></div>{% endif %}
  </div>
</section>

<div class="event-hub-dialog" id="eventHubDialog" hidden aria-hidden="true">
  <div class="event-hub-dialog__backdrop" data-dialog-close></div>
  <section class="event-hub-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="eventHubDialogTitle">
    <button class="event-hub-dialog__close" type="button" aria-label="Close registration form" data-dialog-close>&times;</button>
    <p class="event-hub__eyebrow">EVENT REGISTRATION</p>
    <h2 id="eventHubDialogTitle">Register for an EEG101 event</h2>
    <p class="event-hub-dialog__details" id="eventHubDialogDetails"></p>
    <p class="event-hub-form__notice">No participant account is required. The secure registration form will open below and sends a confirmation or waiting-list email with a calendar invitation.</p>
    <p class="event-hub-form__message" id="eventHubFormMessage" aria-live="polite"></p>
    <iframe class="event-hub-registration-frame" id="eventHubRegistrationFrame" title="EEG101 event registration" hidden></iframe>
  </section>
</div>

<script>
(function () {
  var events = {{ site.data.events | jsonify }};
  var endpoint = {{ site.data.site.event_hub_endpoint | default: "" | jsonify }};
  var dialog = document.getElementById('eventHubDialog');
  var message = document.getElementById('eventHubFormMessage');
  var title = document.getElementById('eventHubDialogTitle');
  var details = document.getElementById('eventHubDialogDetails');
  var registrationFrame = document.getElementById('eventHubRegistrationFrame');
  function findEvent(id) { return events.find(function (event) { return event.id === id; }); }
  function esc(value) { return String(value || '').replace(/[&<>"']/g, function (character) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]; }); }
  function icsDate(dateString, timeString) {
    var value = String(dateString || '').replace(/-/g, '');
    var time = String(timeString || '09:00').match(/(\d{1,2}):(\d{2})/);
    return value + 'T' + String(time ? time[1] : '09').padStart(2, '0') + (time ? time[2] : '00') + '00';
  }
  function calendarFor(event) {
    var start = icsDate(event.start_date, event.time);
    var end = icsDate(event.end_date || event.start_date, event.end_time || event.time);
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EEG101//Event Hub//EN','BEGIN:VEVENT','UID:' + event.id + '@eeg101.eu','DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),'DTSTART;TZID=Europe/London:' + start,'DTEND;TZID=Europe/London:' + end,'SUMMARY:' + String(event.title || '').replace(/[,;]/g, '\\$&'),'DESCRIPTION:' + String(event.summary || '').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&'),'LOCATION:' + String(event.location || 'EEG101').replace(/[,;]/g, '\\$&'),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  }
  function downloadCalendar(event) {
    var blob = new Blob([calendarFor(event)], { type: 'text/calendar;charset=utf-8' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = event.id + '.ics'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
  }
  function openDialog(event) { message.textContent = ''; title.textContent = 'Register for ' + event.title; details.textContent = [event.start_date, event.time, event.location].filter(Boolean).join(' · '); if (endpoint) { var query = new URLSearchParams({ event_id: event.id, title: event.title, start_date: event.start_date, end_date: event.end_date || event.start_date, time: event.time || '', end_time: event.end_time || '', timezone: event.timezone || 'Europe/London', location: event.location || '', capacity: String(event.capacity || 0), summary: event.summary || '', privacy_url: '{{ "/privacy/" | absolute_url }}' }); registrationFrame.src = endpoint + (endpoint.indexOf('?') >= 0 ? '&' : '?') + query.toString(); registrationFrame.hidden = false; } else { message.textContent = 'Registration is being prepared. Please check back shortly or contact eeg101costaction@gmail.com.'; message.className = 'event-hub-form__message event-hub-form__message--error'; registrationFrame.hidden = true; } dialog.hidden = false; dialog.setAttribute('aria-hidden', 'false'); }
  function closeDialog() { dialog.hidden = true; dialog.setAttribute('aria-hidden', 'true'); registrationFrame.src = 'about:blank'; }
  document.querySelectorAll('.event-hub-register').forEach(function (button) { button.addEventListener('click', function () { var event = findEvent(button.dataset.eventId); if (event) openDialog(event); }); });
  document.querySelectorAll('.event-hub-calendar').forEach(function (button) { button.addEventListener('click', function () { var event = findEvent(button.dataset.eventId); if (event) downloadCalendar(event); }); });
  document.querySelectorAll('[data-dialog-close]').forEach(function (button) { button.addEventListener('click', closeDialog); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !dialog.hidden) closeDialog(); });
  window.addEventListener('message', function (messageEvent) { var data = messageEvent.data || {}; if (data.type !== 'eeg101-event-registration') return; message.textContent = data.message || ''; message.className = 'event-hub-form__message ' + (data.ok ? 'event-hub-form__message--success' : 'event-hub-form__message--error'); if (data.ok) registrationFrame.style.minHeight = '180px'; });
}());
</script>
{:/nomarkdown}
