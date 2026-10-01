---
layout: page
title: "Framework Resource Catalogue"
subtitle: "Readings, tools and recordings behind the EEG Community Framework"
description: "The EEG101 Community Framework resource catalogue: papers, preprints, websites, software and recordings supporting each part of the Framework. Filter by Framework part, resource family or language, or search by title, author or keyword."
permalink: /framework/catalogue/
category: "EEG Community Framework"
---

{::nomarkdown}

{% assign cat = site.data.cf_catalogue %}

<section class="section-content">
  <div class="container">

    <p class="cf-helper">
      Every commitment in
      <a href="{{ '/framework/' | relative_url }}">the Community Framework</a>
      rests on work by other people. This is that work: {{ cat.item_count }}
      papers, preprints, websites, tools and recordings, grouped by the part of
      the Framework they speak to. It is curated as a public
      <a href="{{ cat.zotero_url }}" target="_blank" rel="noopener">Zotero group library</a>,
      so anyone can follow it, cite from it or suggest additions.
    </p>

    <div class="cf-cat-parts">
      {% for section in cat.sections %}
      <a class="cf-cat-part" href="{{ '/framework/#' | append: section.anchor | relative_url }}">
        <span class="cf-cat-part__number">Part {{ section.number }}</span>
        <span class="cf-cat-part__title">{{ section.title }}</span>
        <span class="cf-cat-part__count">{{ section.count }} resources</span>
      </a>
      {% endfor %}
    </div>

    <div class="library-controls">
      <label for="cf-cat-search" class="visually-hidden">Search the catalogue by title, author or keyword</label>
      <input type="text" id="cf-cat-search" class="library-search" placeholder="Search by title, author, or keyword...">

      <div class="library-filters" id="cf-cat-parts" role="group" aria-label="Filter by Framework part">
        <button class="filter-btn active" data-part="all">All parts</button>
        {% for section in cat.sections %}
        <button class="filter-btn" data-part="{{ section.number }}">Part {{ section.number }}: {{ section.title }}</button>
        {% endfor %}
      </div>

      <div class="library-filters" id="cf-cat-families" role="group" aria-label="Filter by resource family">
        <button class="filter-btn active" data-family="all">All types</button>
        {% for family in cat.families %}
        {% if family.count > 0 %}
        <button class="filter-btn cf-cat-family--{{ family.slug }}" data-family="{{ family.slug }}">{{ family.label }} ({{ family.count }})</button>
        {% endif %}
        {% endfor %}
      </div>
    </div>

    <p class="library-count" id="cf-cat-count">Showing {{ cat.item_count }} resources</p>

    <div class="cf-cat-grid" id="cf-cat-grid">
      {% for item in cat.items %}
      {% comment %}
        A resource's own URL is the useful destination where there is one; a DOI
        is the next best; otherwise fall back to its Zotero record so every card
        leads somewhere.
      {% endcomment %}
      {% if item.url and item.url != "" %}
        {% assign item_link = item.url %}
      {% elsif item.doi and item.doi != "" %}
        {% assign item_link = item.doi | prepend: "https://doi.org/" %}
      {% else %}
        {% assign item_link = item.zotero_url %}
      {% endif %}
      <article class="cf-cat-card cf-cat-card--{{ item.family }}"
               data-parts="{{ item.sections | join: ' ' }}"
               data-family="{{ item.family }}"
               data-search="{{ item.title | append: ' ' | append: item.creators | append: ' ' | append: item.tags | join: ' ' | downcase | escape }}">
        <div class="cf-cat-card__meta">
          <span class="cf-cat-card__type">{{ item.type_label }}</span>
          {% for number in item.sections %}
          <span class="cf-cat-card__part">Part {{ number }}</span>
          {% endfor %}
          {% if item.year and item.year != "" %}<span class="cf-cat-card__year">{{ item.year }}</span>{% endif %}
        </div>
        <h3 class="cf-cat-card__title">
          <a href="{{ item_link }}" target="_blank" rel="noopener">{{ item.title }}</a>
        </h3>
        {% if item.creators and item.creators != "" %}
        <p class="cf-cat-card__creators">{{ item.creators }}</p>
        {% endif %}
        {% if item.publication and item.publication != "" %}
        <p class="cf-cat-card__publication"><em>{{ item.publication }}</em></p>
        {% endif %}
        {% if item.abstract and item.abstract != "" %}
        <p class="cf-cat-card__abstract">{{ item.abstract | strip_html | truncate: 170 }}</p>
        {% endif %}
        <div class="cf-cat-card__links">
          {% if item.doi and item.doi != "" %}
          <a href="https://doi.org/{{ item.doi }}" class="cf-cat-card__link">DOI</a>
          {% endif %}
          {% if item.video_id and item.video_id != "" %}
          <a href="https://www.youtube.com/watch?v={{ item.video_id }}" class="cf-cat-card__link">Watch ↗</a>
          {% endif %}
          <a href="{{ cat.zotero_group | prepend: 'https://www.zotero.org/groups/' | append: '/items/' | append: item.id }}" class="cf-cat-card__link cf-cat-card__link--muted">Zotero record</a>
        </div>
      </article>
      {% endfor %}
    </div>

    <p class="library-empty" id="cf-cat-empty" style="display:none;">No resources match your search.</p>

    <p class="cf-cat-footer">
      Catalogue updated {{ cat.generated }} from the public
      <a href="{{ cat.zotero_url }}" target="_blank" rel="noopener">EEG101 Community Framework Zotero library</a>.
      To suggest a resource, email
      <a href="mailto:{{ site.data.framework.contact_email }}">{{ site.data.framework.contact_email }}</a>.
    </p>

  </div>
</section>

<script>
(function () {
  var search   = document.getElementById('cf-cat-search');
  var cards    = Array.prototype.slice.call(document.querySelectorAll('.cf-cat-card'));
  var count    = document.getElementById('cf-cat-count');
  var empty    = document.getElementById('cf-cat-empty');
  if (!search) return;

  var state = { part: 'all', family: 'all', term: '' };

  function update() {
    var visible = 0;
    cards.forEach(function (card) {
      var partMatch = state.part === 'all' ||
        card.dataset.parts.split(' ').indexOf(state.part) !== -1;
      var familyMatch = state.family === 'all' || card.dataset.family === state.family;
      var searchMatch = state.term === '' ||
        card.dataset.search.indexOf(state.term) !== -1;
      var show = partMatch && familyMatch && searchMatch;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    count.textContent = 'Showing ' + visible + ' resource' + (visible === 1 ? '' : 's');
    empty.style.display = visible === 0 ? '' : 'none';
  }

  function wire(containerId, key) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var buttons = Array.prototype.slice.call(container.querySelectorAll('.filter-btn'));
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        button.classList.add('active');
        state[key] = button.dataset[key];
        update();
      });
    });
  }

  /* Catalogue links all leave the site. Setting this here rather than on 283
     anchors keeps ~40 KB of repeated attributes out of the page; without
     JavaScript the links still work, just in the same tab. */
  document.querySelectorAll('.cf-cat-card a[href^="http"]').forEach(function (link) {
    link.target = '_blank';
    link.rel = 'noopener';
  });

  wire('cf-cat-parts', 'part');
  wire('cf-cat-families', 'family');

  search.addEventListener('input', function () {
    state.term = search.value.toLowerCase().trim();
    update();
  });
})();
</script>

{:/nomarkdown}
