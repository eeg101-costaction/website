---
layout: page
title: "Knowledge hub"
subtitle: "Open-access publications from the EEG101 community"
description: "A curated collection of open-access papers from EEG101 members and collaborators, organised by theme. Filter by topic or search by author, title, or keyword."
permalink: /hub/
---

{::nomarkdown}

<section class="section-content">
  <div class="container">

    <!-- Filter controls -->
    <div class="library-controls">
      <input type="text" id="hub-search" class="library-search" placeholder="Search by title, author, or keyword...">
      <div class="library-filters" id="hub-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="EEG history &amp; centenary">EEG history &amp; centenary</button>
        <button class="filter-btn" data-filter="Reporting standards">Reporting standards</button>
        <button class="filter-btn" data-filter="Data harmonisation">Data harmonisation</button>
        <button class="filter-btn" data-filter="Global neuroscience">Global neuroscience</button>
        <button class="filter-btn" data-filter="Open science &amp; replication">Open science &amp; replication</button>
      </div>
    </div>

    <p class="library-count" id="hub-count">Showing {{ site.data.hub | size }} papers</p>

    <!-- Paper grid -->
    <div class="hub-grid" id="hub-grid">
      {% for paper in site.data.hub %}
      <div class="paper-card"
           data-theme="{{ paper.theme }}"
           data-title="{{ paper.title | downcase }}"
           data-authors="{{ paper.authors | downcase }}"
           data-tags="{{ paper.tags | join: ' ' | downcase }}">
        <a href="{{ paper.doi }}" target="_blank" rel="noopener" class="paper-cover">
          <img src="{{ paper.image }}" alt="{{ paper.title }}" loading="lazy">
        </a>
        <div class="paper-info">
          <p class="paper-theme">{{ paper.theme }}</p>
          <h3 class="paper-title">
            <a href="{{ paper.doi }}" target="_blank" rel="noopener">{{ paper.title }}</a>
          </h3>
          <p class="paper-authors">{{ paper.authors }}</p>
          <p class="paper-journal"><em>{{ paper.journal }}</em>, {{ paper.year }}</p>
          <div class="paper-tag-list">
            {% for tag in paper.tags %}
              <span class="paper-tag">{{ tag }}</span>
            {% endfor %}
          </div>
          <div class="paper-links">
            <a href="{{ paper.doi }}" target="_blank" rel="noopener" class="paper-link paper-link--oa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              View paper
            </a>
            {% if paper.open_access %}
            <span class="paper-link" style="color: var(--color-gold-dark); font-size: 0.72rem;">
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>
              Open access
            </span>
            {% endif %}
          </div>
        </div>
      </div>
      {% endfor %}
    </div>

    <p class="library-empty" id="hub-empty" style="display:none;">No papers match your search.</p>

  </div>
</section>

<script>
(function() {
  var searchInput = document.getElementById('hub-search');
  var filterBtns  = document.querySelectorAll('#hub-filters .filter-btn');
  var cards       = document.querySelectorAll('.paper-card');
  var countEl     = document.getElementById('hub-count');
  var emptyEl     = document.getElementById('hub-empty');
  var activeTheme = 'all';
  var searchTerm  = '';

  function update() {
    var visible = 0;
    cards.forEach(function(card) {
      var themeMatch = activeTheme === 'all' || card.dataset.theme === activeTheme;
      var searchMatch = searchTerm === '' ||
        card.dataset.title.includes(searchTerm) ||
        card.dataset.authors.includes(searchTerm) ||
        card.dataset.tags.includes(searchTerm);
      if (themeMatch && searchMatch) {
        card.style.display = '';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });
    countEl.textContent = 'Showing ' + visible + ' paper' + (visible !== 1 ? 's' : '');
    emptyEl.style.display = visible === 0 ? '' : 'none';
  }

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeTheme = btn.dataset.filter;
      update();
    });
  });

  searchInput.addEventListener('input', function() {
    searchTerm = searchInput.value.toLowerCase().trim();
    update();
  });
})();
</script>

{:/nomarkdown}
