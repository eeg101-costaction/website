---
layout: page
title: "Library"
subtitle: "Papers, tools and resources from EEG101 and the Community Framework"
description: "The EEG101 Library: curated open-access papers from the Action alongside the full Community Framework resource catalogue. Filter by topic, Framework part or resource type, or search by title, author or keyword."
permalink: /library/
---

{::nomarkdown}

{% assign lib = site.data.library_index %}
{% assign curated = lib.items | where: "featured", true %}
{% assign catalogue = lib.items | where: "featured", false %}

<section class="section-content">
  <div class="container">

    <p class="cf-helper">
      Two collections, one place to search. The
      <strong>EEG101 collection</strong> is {{ curated | size }} open-access
      papers from the Action and its members. The
      <strong>Community Framework catalogue</strong> is the
      {{ catalogue | size }} readings, tools and recordings behind
      <a href="{{ '/framework/' | relative_url }}">the Framework</a>, curated as a
      public <a href="{{ lib.zotero_url | default: 'https://www.zotero.org/groups/5794905/library' }}" target="_blank" rel="noopener">Zotero group library</a>.
      The filters below search both at once.
    </p>

    <!-- Filter controls -->
    <div class="library-controls">
      <label for="hub-search" class="visually-hidden">Search the library by title, author or keyword</label>
      <input type="text" id="hub-search" class="library-search" placeholder="Search by title, author, or keyword...">

      <div class="library-filters" id="hub-collections" role="group" aria-label="Filter by collection">
        <button class="filter-btn active" data-collection="all">Everything ({{ lib.total }})</button>
        <button class="filter-btn" data-collection="eeg101">EEG101 collection ({{ curated | size }})</button>
        <button class="filter-btn" data-collection="framework">Framework catalogue ({{ catalogue | size }})</button>
      </div>

      <div class="library-filters" id="hub-topics" role="group" aria-label="Filter by topic">
        <button class="filter-btn active" data-topic="all">All topics</button>
        {% comment %}
          Eighteen topics is five rows of pills, which pushes the collection
          itself below the fold. Show the eight largest and keep the rest one
          click away.
        {% endcomment %}
        {% for topic in lib.topics %}
        <button class="filter-btn{% if forloop.index > 8 %} filter-btn--extra{% endif %}"
                data-topic="{{ topic.name | downcase }}"{% if forloop.index > 8 %} hidden{% endif %}>{{ topic.name }} ({{ topic.count }})</button>
        {% endfor %}
        {% assign extra = lib.topics | size | minus: 8 %}
        {% if extra > 0 %}
        <button type="button" class="filter-btn filter-btn--toggle" id="hub-more-topics"
                aria-expanded="false">+{{ extra }} more topics</button>
        {% endif %}
      </div>

      <div class="library-filters" id="hub-parts" role="group" aria-label="Filter by Framework part">
        <button class="filter-btn active" data-part="all">All Framework parts</button>
        {% for section in site.data.cf_catalogue.sections %}
        <button class="filter-btn" data-part="{{ section.number }}">Part {{ section.number }}: {{ section.title }}</button>
        {% endfor %}
      </div>
    </div>

    <p class="library-count" id="hub-count">Showing {{ lib.total }} items</p>

    <!-- The EEG101 collection keeps its cover art: these are the Action's own
         outputs and the covers are the point of the card. -->
    <div class="hub-section" id="hub-curated">
      <h2 class="hub-section__heading">EEG101 collection <span class="hub-section__count" data-count-for="curated"></span></h2>
      <div class="hub-grid">
        {% for paper in curated %}
        <div class="paper-card lib-item"
             data-collection="eeg101"
             data-parts=""
             data-topics="{{ paper.topics | join: '|' | downcase }}"
             data-title="{{ paper.title | downcase }}"
             data-authors="{{ paper.authors | downcase }}"
             data-tags="{{ paper.tags | join: ' ' | downcase }} {{ paper.theme | downcase }}">
          <a href="{{ paper.source_url }}" target="_blank" rel="noopener" class="paper-cover">
            <img src="{{ paper.image | relative_url }}" alt="{{ paper.title }}" loading="lazy">
          </a>
          <div class="paper-info">
            <p class="paper-theme">{{ paper.theme }}</p>
            <h3 class="paper-title">
              <a href="{{ paper.source_url }}" target="_blank" rel="noopener">{{ paper.title }}</a>
            </h3>
            <p class="paper-authors">{{ paper.authors }}</p>
            <p class="paper-journal"><em>{{ paper.venue }}</em>, {{ paper.year }}</p>
            <div class="paper-tag-list">
              {% for tag in paper.tags %}
                <span class="paper-tag">{{ tag }}</span>
              {% endfor %}
            </div>
            <p class="paper-access-version">{{ paper.access_version }}</p>
            <div class="paper-links">
              <a href="{{ paper.oa_url }}" target="_blank" rel="noopener" class="paper-link paper-link--oa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M14 3v7h7M14 3l7 7M8 16h8M8 12h3"/></svg>
                {{ paper.oa_label }}
              </a>
              <a href="{{ paper.source_url }}" target="_blank" rel="noopener" class="paper-link paper-link--source">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                {{ paper.source_label }}
              </a>
              {% comment %}
                Shown only for papers whose PDF we are allowed to redistribute and have
                placed in assets/docs/. Set the entry's `pdf:` field in library.yml.
              {% endcomment %}
              {% if paper.pdf and paper.pdf != "" %}
              <a href="{{ paper.pdf | relative_url }}" class="paper-link paper-link--source" download>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Download PDF
              </a>
              {% endif %}
            </div>
          </div>
        </div>
        {% endfor %}
      </div>
    </div>

    <div class="hub-section" id="hub-catalogue">
      <h2 class="hub-section__heading">Community Framework catalogue <span class="hub-section__count" data-count-for="catalogue"></span></h2>
      <div class="cf-cat-grid">
        {% for item in catalogue %}
        <article class="cf-cat-card cf-cat-card--{{ item.family }} lib-item"
                 data-collection="framework"
                 data-parts="{{ item.parts | join: ' ' }}"
                 data-topics="{{ item.topics | join: '|' | downcase }}"
                 data-title="{{ item.title | downcase }}"
                 data-authors="{{ item.authors | downcase }}"
                 data-tags="{{ item.tags | join: ' ' | downcase }} {{ item.venue | downcase }}">
          <div class="cf-cat-card__meta">
            <span class="cf-cat-card__type">{{ item.type_label }}</span>
            {% for number in item.parts %}
            <span class="cf-cat-card__part">Part {{ number }}</span>
            {% endfor %}
            {% if item.year and item.year != "" %}<span class="cf-cat-card__year">{{ item.year }}</span>{% endif %}
          </div>
          <h3 class="cf-cat-card__title">
            <a href="{{ item.url }}" target="_blank" rel="noopener">{{ item.title }}</a>
          </h3>
          {% if item.authors and item.authors != "" %}
          <p class="cf-cat-card__creators">{{ item.authors }}</p>
          {% endif %}
          {% if item.venue and item.venue != "" %}
          <p class="cf-cat-card__publication"><em>{{ item.venue }}</em></p>
          {% endif %}
          {% if item.abstract and item.abstract != "" %}
          <p class="cf-cat-card__abstract">{{ item.abstract | strip_html | truncate: 170 }}</p>
          {% endif %}
          <div class="cf-cat-card__links">
            {% if item.doi and item.doi != "" %}
            <a href="https://doi.org/{{ item.doi }}" class="cf-cat-card__link">DOI</a>
            {% endif %}
            <a href="{{ item.source_url }}" class="cf-cat-card__link cf-cat-card__link--muted">Zotero record</a>
          </div>
        </article>
        {% endfor %}
      </div>
    </div>

    <p class="library-empty" id="hub-empty" style="display:none;">Nothing in the library matches your search.</p>

    <p class="cf-cat-footer">
      Curated entries are maintained in the site repository; Framework entries come
      from the public
      <a href="https://www.zotero.org/groups/5794905/library" target="_blank" rel="noopener">EEG101 Community Framework Zotero library</a>
      and refresh nightly (last updated {{ site.data.cf_catalogue.generated }}).
      To suggest a resource, email
      <a href="mailto:{{ site.data.framework.contact_email }}">{{ site.data.framework.contact_email }}</a>.
    </p>

  </div>
</section>

<script>
(function () {
  var search   = document.getElementById('hub-search');
  var items    = Array.prototype.slice.call(document.querySelectorAll('.lib-item'));
  var countEl  = document.getElementById('hub-count');
  var emptyEl  = document.getElementById('hub-empty');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.hub-section'));
  if (!search) return;

  var state = { collection: 'all', topic: 'all', part: 'all', term: '' };

  function matches(el) {
    if (state.collection !== 'all' && el.dataset.collection !== state.collection) return false;
    if (state.topic !== 'all' &&
        el.dataset.topics.split('|').indexOf(state.topic) === -1) return false;
    /* Framework parts only apply to catalogue entries; selecting one narrows to
       those, which is what someone picking "Part 2" is asking for. */
    if (state.part !== 'all' &&
        el.dataset.parts.split(' ').indexOf(state.part) === -1) return false;
    if (state.term !== '') {
      var hay = el.dataset.title + ' ' + el.dataset.authors + ' ' + el.dataset.tags;
      if (hay.indexOf(state.term) === -1) return false;
    }
    return true;
  }

  function update() {
    var visible = 0;
    items.forEach(function (el) {
      var show = matches(el);
      el.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    /* Hide a collection heading when nothing in it survives the filter, and
       show each section's own count beside its heading. */
    sections.forEach(function (section) {
      var shown = section.querySelectorAll('.lib-item').length -
        Array.prototype.filter.call(
          section.querySelectorAll('.lib-item'),
          function (el) { return el.style.display === 'none'; }
        ).length;
      section.style.display = shown === 0 ? 'none' : '';
      var badge = section.querySelector('.hub-section__count');
      if (badge) badge.textContent = shown;
    });

    countEl.textContent = 'Showing ' + visible + ' item' + (visible === 1 ? '' : 's');
    emptyEl.style.display = visible === 0 ? '' : 'none';
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

  var moreBtn = document.getElementById('hub-more-topics');
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      var hidden = moreBtn.getAttribute('aria-expanded') === 'false';
      document.querySelectorAll('.filter-btn--extra').forEach(function (b) {
        b.hidden = !hidden;
      });
      moreBtn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
      moreBtn.textContent = hidden ? 'Fewer topics' : moreBtn.dataset.label;
    });
    moreBtn.dataset.label = moreBtn.textContent;
  }

  wire('hub-collections', 'collection');
  wire('hub-topics', 'topic');
  wire('hub-parts', 'part');

  search.addEventListener('input', function () {
    state.term = search.value.toLowerCase().trim();
    update();
  });

  /* Deep links from the Framework pages: /library/#part-2, #framework, #eeg101 */
  function applyHash() {
    var hash = (window.location.hash || '').replace('#', '');
    var part = hash.match(/^part-([123])$/);
    if (part) {
      var pb = document.querySelector('#hub-parts .filter-btn[data-part="' + part[1] + '"]');
      if (pb) pb.click();
      if (moreBtn && moreBtn.getAttribute('aria-expanded') === 'false') { /* part links need no topic row */ }
    } else if (hash === 'framework' || hash === 'eeg101') {
      var cb = document.querySelector('#hub-collections .filter-btn[data-collection="' + hash + '"]');
      if (cb) cb.click();
    }
  }
  applyHash();
  window.addEventListener('hashchange', applyHash);

  update();
})();
</script>

{:/nomarkdown}
