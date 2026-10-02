---
layout: page
title: "Library"
subtitle: "Papers, tools and resources from EEG101 and the Community Framework"
description: "The EEG101 Library: curated open-access papers from the Action alongside the full Community Framework resource catalogue. Filter by collection, Framework section, type or language, or search by title, author or keyword."
permalink: /library/
wide: true
---

{::nomarkdown}

{% assign lib = site.data.library_index %}

<div class="lib">

  <aside class="lib__filters" id="lib-filters">
    <div class="lib__filters-head">
      <h2 class="lib__filters-title">Filter</h2>
      <button type="button" class="lib__clear" id="lib-clear" hidden>Clear all</button>
    </div>

    {% comment %}
      Four facet groups, the same ones the standalone catalogue offered, plus
      Collection so the Action's own papers can be told from the Framework's
      reading list. Checkboxes within a group are OR; the groups are ANDed.
    {% endcomment %}

    <details class="lib__group" open>
      <summary>Collection</summary>
      <ul class="lib__options">
        {% for c in lib.collections %}
        <li><label><input type="checkbox" data-facet="collection" value="{{ c.slug }}">
          <span>{{ c.name }}</span><em>{{ c.count }}</em></label></li>
        {% endfor %}
      </ul>
    </details>

    <details class="lib__group" open>
      <summary>Framework Section</summary>
      <ul class="lib__options">
        {% for s in lib.sections %}
        <li><label><input type="checkbox" data-facet="section" value="{{ s.name | downcase }}">
          <span>{{ s.name }}</span><em>{{ s.count }}</em></label></li>
        {% endfor %}
      </ul>
    </details>

    <details class="lib__group" open>
      <summary>Type</summary>
      <ul class="lib__options">
        {% for t in lib.types %}
        <li><label><input type="checkbox" data-facet="type" value="{{ t.name | downcase }}">
          <span>{{ t.name }}</span><em>{{ t.count }}</em></label></li>
        {% endfor %}
      </ul>
    </details>

    <details class="lib__group" open>
      <summary>Language</summary>
      <ul class="lib__options">
        {% for l in lib.languages %}
        <li><label><input type="checkbox" data-facet="language" value="{{ l.name | downcase }}">
          <span>{{ l.name }}</span><em>{{ l.count }}</em></label></li>
        {% endfor %}
      </ul>
    </details>
  </aside>

  <div class="lib__main">
    <p class="lib__intro">
      Two collections, one place to search. The <strong>EEG101 Collection</strong>
      is {{ lib.curated_count }} open-access papers from the Action and its
      members; the <strong>Community Framework</strong> catalogue is the
      {{ lib.framework_count }} readings, tools and recordings behind
      <a href="{{ '/framework/' | relative_url }}">the Framework</a>, curated as a
      public <a href="https://www.zotero.org/groups/5794905/library" target="_blank" rel="noopener">Zotero group library</a>.
    </p>

    <div class="lib__toolbar">
      <label for="lib-search" class="visually-hidden">Search by title, author or keyword</label>
      <input type="search" id="lib-search" class="lib__search" placeholder="Search by title, author, or keyword...">
      <button type="button" class="lib__filters-toggle" id="lib-filters-toggle" aria-expanded="false">Filters</button>
    </div>

    <p class="lib__count" id="lib-count">Showing {{ lib.total }} items</p>
    <div class="lib__chips" id="lib-chips"></div>

    <div class="lib__grid" id="lib-grid">
      {% for item in lib.items %}
      <article class="lib-card{% if item.featured %} lib-card--featured{% endif %}"
               data-collection="{{ item.collection }}"
               data-section="{{ item.section_titles | join: '|' | downcase }}"
               data-type="{{ item.type_label | downcase }}"
               data-language="{{ item.language | downcase }}"
               data-text="{{ item.title | append: ' ' | append: item.authors | append: ' ' | append: item.venue | append: ' ' | append: item.tags | join: ' ' | downcase | escape }}">
        <a class="lib-card__media" href="{{ item.url }}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
          {% if item.image and item.image != "" %}
          <img src="{{ item.image | relative_url }}" alt="" loading="lazy" width="480" height="270">
          {% else %}
          <img src="{{ item.placeholder | relative_url }}" alt="" loading="lazy" width="480" height="270">
          {% endif %}
          {% if item.featured %}<span class="lib-card__flag">EEG101</span>{% endif %}
        </a>
        <div class="lib-card__body">
          <p class="lib-card__meta">
            <span class="lib-card__type">{{ item.type_label }}</span>
            {% if item.year and item.year != "" %}<span class="lib-card__year">{{ item.year }}</span>{% endif %}
          </p>
          <h3 class="lib-card__title">
            <a href="{{ item.url }}" target="_blank" rel="noopener">{{ item.title }}</a>
          </h3>
          {% if item.authors and item.authors != "" %}
          <p class="lib-card__authors">{{ item.authors | truncate: 78 }}</p>
          {% endif %}
          {% if item.venue and item.venue != "" %}
          <p class="lib-card__venue"><em>{{ item.venue | truncate: 60 }}</em></p>
          {% endif %}
          {% if item.featured and item.tags != empty %}
          <p class="lib-card__tags">{% for tag in item.tags %}<span>{{ tag }}</span>{% endfor %}</p>
          {% endif %}
          <p class="lib-card__links">
            {% if item.featured %}
              <a href="{{ item.oa_url }}" target="_blank" rel="noopener">{{ item.oa_label | default: "Open access" }}</a>
              {% if item.pdf and item.pdf != "" %}
              <a href="{{ item.pdf | relative_url }}" download>PDF</a>
              {% endif %}
            {% else %}
              {% if item.doi and item.doi != "" %}
              <a href="https://doi.org/{{ item.doi }}" target="_blank" rel="noopener">DOI</a>
              {% endif %}
              <a href="{{ item.source_url }}" target="_blank" rel="noopener" class="lib-card__link--muted">Zotero</a>
            {% endif %}
          </p>
        </div>
      </article>
      {% endfor %}
    </div>

    <p class="lib__empty" id="lib-empty" hidden>Nothing in the library matches those filters.</p>

    <p class="lib__footer">
      Curated entries are maintained in the site repository; Framework entries
      come from the public Zotero library and refresh nightly (last updated
      {{ site.data.cf_catalogue.generated }}). To suggest a resource, email
      <a href="mailto:{{ site.data.framework.contact_email }}">{{ site.data.framework.contact_email }}</a>.
    </p>
  </div>
</div>

<script>
(function () {
  var grid = document.getElementById('lib-grid');
  if (!grid) return;
  var cards   = Array.prototype.slice.call(grid.querySelectorAll('.lib-card'));
  var boxes   = Array.prototype.slice.call(document.querySelectorAll('#lib-filters input[type="checkbox"]'));
  var search  = document.getElementById('lib-search');
  var countEl = document.getElementById('lib-count');
  var emptyEl = document.getElementById('lib-empty');
  var chipsEl = document.getElementById('lib-chips');
  var clearEl = document.getElementById('lib-clear');
  var panel   = document.getElementById('lib-filters');
  var toggle  = document.getElementById('lib-filters-toggle');

  /* data-section holds every section an item belongs to, pipe separated. */
  function has(card, facet, values) {
    if (!values.length) return true;
    var field = card.dataset[facet] || '';
    var owned = facet === 'section' ? field.split('|') : [field];
    for (var i = 0; i < values.length; i++) {
      if (owned.indexOf(values[i]) !== -1) return true;
    }
    return false;
  }

  function selected() {
    var out = { collection: [], section: [], type: [], language: [] };
    boxes.forEach(function (b) { if (b.checked) out[b.dataset.facet].push(b.value); });
    return out;
  }

  function update() {
    var sel = selected();
    var term = search.value.toLowerCase().trim();
    var visible = 0;
    cards.forEach(function (card) {
      var show =
        has(card, 'collection', sel.collection) &&
        has(card, 'section', sel.section) &&
        has(card, 'type', sel.type) &&
        has(card, 'language', sel.language) &&
        (term === '' || card.dataset.text.indexOf(term) !== -1);
      card.hidden = !show;
      if (show) visible++;
    });

    countEl.textContent = 'Showing ' + visible + ' item' + (visible === 1 ? '' : 's');
    emptyEl.hidden = visible !== 0;

    /* A chip per active choice, so what is filtering stays visible when the
       sidebar is collapsed on a phone. */
    chipsEl.textContent = '';
    var active = boxes.filter(function (b) { return b.checked; });
    active.forEach(function (b) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lib__chip';
      chip.textContent = b.parentNode.querySelector('span').textContent;
      chip.setAttribute('aria-label', 'Remove filter ' + chip.textContent);
      chip.addEventListener('click', function () { b.checked = false; update(); });
      chipsEl.appendChild(chip);
    });
    clearEl.hidden = active.length === 0 && term === '';
  }

  boxes.forEach(function (b) { b.addEventListener('change', update); });
  search.addEventListener('input', update);
  clearEl.addEventListener('click', function () {
    boxes.forEach(function (b) { b.checked = false; });
    search.value = '';
    update();
    search.focus();
  });

  toggle.addEventListener('click', function () {
    var open = panel.classList.toggle('lib__filters--open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* Deep links from the Framework pages: #framework, #eeg101, #part-1..3 */
  var PART_SECTION = {
    '1': 'validity and research integrity',
    '2': 'democratization',
    '3': 'responsibility'
  };
  function applyHash() {
    var hash = (window.location.hash || '').replace('#', '');
    var part = hash.match(/^part-([123])$/);
    var want = part ? PART_SECTION[part[1]] : null;
    var known = want || ['framework', 'eeg101'].indexOf(hash) !== -1;
    if (!known) return;
    /* A fragment change does not reload the page, so following a second deep
       link would otherwise stack its filters on top of the first. Start from a
       clean slate whenever one is followed. */
    boxes.forEach(function (b) { b.checked = false; });
    boxes.forEach(function (b) {
      if (want && b.dataset.facet === 'section' && b.value === want) b.checked = true;
      if (!want && b.dataset.facet === 'collection' && b.value === hash) b.checked = true;
    });
    update();
  }
  update();
  applyHash();
  window.addEventListener('hashchange', applyHash);
})();
</script>

{:/nomarkdown}
