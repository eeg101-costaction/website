---
layout: page
title: "Drafts"
subtitle: "Events, calendar dates and Spotlights that are not on the website yet"
description: "Previews of EEG101 website drafts for review."
permalink: /drafts/
sitemap: false
noindex: true
---
{%- comment -%}
  Drafts are items whose "Published on the website" tick is off. Jekyll leaves
  them out of the site, so this page reads copies of them from _data/drafts.yml,
  which the content-check workflow regenerates after every save
  (scripts/export_drafts.py). Each draft is shown with the same templates the
  live site uses, so it looks exactly as it will once published. Nothing links
  here and search engines are asked not to index it, but it is not secret: the
  drafts are also in the public repository.
{%- endcomment -%}
{%- assign d = site.data.drafts -%}
{%- assign today = site.time | date: "%Y-%m-%d" -%}
{%- assign total = d.events.size | plus: d.dates.size | plus: d.spotlights.size -%}

{::nomarkdown}
<div class="drafts">
  <div class="drafts__intro">
    <p><strong>Nothing on this page is on the website.</strong> Each draft below is shown exactly as it will look once it is published. It updates a couple of minutes after each save in the <a href="https://app.pagescms.org" target="_blank" rel="noopener">website editor</a>.</p>
    <p><strong>To review:</strong> read the draft here, then open it in the editor (the button beside it). If it is ready, tick <em>Published on the website</em> and save; it goes live a minute or two later. If it needs changes, untick <em>Ready for review</em>, save, and tell the author what to change.</p>
  </div>

  {% if total == 0 %}
  <p class="drafts__empty">There are no drafts at the moment.</p>
  {% endif %}

  {% if d.events.size > 0 %}
  <h2 class="drafts__heading">Events</h2>
  {% for event in d.events %}
  {%- assign end = event.end_date | default: event.start_date | date: "%Y-%m-%d" -%}
  {%- if end >= today %}{% assign status = "upcoming" %}{% else %}{% assign status = "past" %}{% endif -%}
  <section class="drafts__item" id="events-{{ event.id }}">
    {% include draft-status.html item=event %}
    <div class="row"><div class="col-12 col-md-8 col-lg-7">
      {% include event-card.html event=event computed_status=status %}
    </div></div>
  </section>
  {% endfor %}
  {% endif %}

  {% if d.dates.size > 0 %}
  <h2 class="drafts__heading">Other calendar dates</h2>
  <p class="drafts__note">These appear on the Calendar only.</p>
  {% for item in d.dates %}
  {% capture link_url %}{% include safe-url.html url=item.link %}{% endcapture %}
  <section class="drafts__item" id="dates-{{ item.id }}">
    {% include draft-status.html item=item %}
    <div class="drafts__date-card">
      <span class="cal-popover__badge cal-popover__badge--date">{{ item.kind | default: "Key date" | escape }}</span>
      <h3 class="cal-popover__title">{{ item.title | escape }}</h3>
      <p class="cal-popover__meta">{{ item.start_date | date: "%-d %B %Y" }}{% if item.end_date and item.end_date != "" and item.end_date != item.start_date %} – {{ item.end_date | date: "%-d %B %Y" }}{% endif %}{% if item.time and item.time != "" %} · {% include clock.html value=item.time %}{% if item.end_time and item.end_time != "" %}–{% include clock.html value=item.end_time %}{% endif %}{% if item.timezone and item.timezone != "" %} ({{ item.timezone | replace: "_", " " | escape }} time){% endif %}{% endif %}{% if item.location and item.location != "" %}<br>{{ item.location | escape }}{% endif %}</p>
      {% if item.summary and item.summary != "" %}<p class="cal-popover__summary">{{ item.summary | escape }}</p>{% endif %}
      {% if link_url != "" %}<a href="{{ link_url | escape }}" class="btn btn-primary btn-sm mt-2"{% if link_url contains "://" %} target="_blank" rel="noopener"{% endif %}>{{ item.link_label | default: "More information" | escape }}{% if link_url contains "://" %} &#8599;{% endif %}</a>{% endif %}
    </div>
  </section>
  {% endfor %}
  {% endif %}

  {% if d.spotlights.size > 0 %}
  <h2 class="drafts__heading">Spotlights</h2>
  {% for s in d.spotlights %}
  <section class="drafts__item" id="spotlights-{{ s.id }}">
    {% include draft-status.html item=s %}
    <p class="drafts__note">On the Spotlight list{% if s.featured %} and the home page{% endif %}:</p>
    <div class="row"><div class="col-12 col-md-8 col-lg-7">
      {% include spotlight-card.html item=s %}
    </div></div>
    <p class="drafts__note">Its page:</p>
    <div class="drafts__page">
      <div class="drafts__page-hero">
        {% capture hero_category %}{{ s.type }}{% if s.working_groups.size > 0 %} · {{ s.working_groups | array_to_sentence_string }}{% endif %}{% endcapture %}
        {% if hero_category != "" %}<span class="page-hero__category">{{ hero_category | escape }}</span>{% endif %}
        <p class="page-hero__title">{{ s.title | escape }}</p>
        {% if s.subtitle and s.subtitle != "" %}<p class="page-hero__subtitle">{{ s.subtitle | escape }}</p>{% endif %}
      </div>
      {% include spotlight-detail.html item=s %}
    </div>
  </section>
  {% endfor %}
  {% endif %}
</div>
{:/nomarkdown}
