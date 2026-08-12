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
        <button class="filter-btn" data-filter="History">History</button>
        <button class="filter-btn" data-filter="Reporting standards">Reporting standards</button>
        <button class="filter-btn" data-filter="Data harmonisation">Data harmonisation</button>
        <button class="filter-btn" data-filter="Global neuroscience">Global neuroscience</button>
        <button class="filter-btn" data-filter="#EEGManyLabs">#EEGManyLabs</button>
        <button class="filter-btn" data-filter="Community">Community</button>
        <button class="filter-btn" data-filter="Software">Software</button>
        <button class="filter-btn" data-filter="Open Science">Open Science</button>
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
        <a href="{{ paper.source_url }}" target="_blank" rel="noopener" class="paper-cover">
          <img src="{{ paper.image }}" alt="{{ paper.title }}" loading="lazy">
        </a>
        <div class="paper-info">
          <p class="paper-theme">{{ paper.theme }}</p>
          <h3 class="paper-title">
            <a href="{{ paper.source_url }}" target="_blank" rel="noopener">{{ paper.title }}</a>
          </h3>
          <p class="paper-authors">{{ paper.authors }}</p>
          <p class="paper-journal"><em>{{ paper.journal }}</em>, {{ paper.year }}</p>
          <div class="paper-tag-list">
            {% for tag in paper.tags %}
              <span class="paper-tag">{{ tag }}</span>
            {% endfor %}
          </div>
          <p class="paper-access-version">{{ paper.access_version }}</p>
          <div class="paper-links">
            <a href="{{ paper.open_access_url }}" target="_blank" rel="noopener" class="paper-link paper-link--oa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M14 3v7h7M14 3l7 7M8 16h8M8 12h3"/></svg>
              {{ paper.open_access_label }}
            </a>
            <a href="{{ paper.source_url }}" target="_blank" rel="noopener" class="paper-link paper-link--source">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              {{ paper.source_label }}
            </a>
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
  var activeFilter = 'all';
  var searchTerm  = '';

  function update() {
    var visible = 0;
    cards.forEach(function(card) {
      var tagMatch = activeFilter === 'all' || 
                     card.dataset.theme === activeFilter ||
                     card.dataset.tags.includes(activeFilter.toLowerCase());
      var searchMatch = searchTerm === '' ||
        card.dataset.title.includes(searchTerm) ||
        card.dataset.authors.includes(searchTerm) ||
        card.dataset.tags.includes(searchTerm);
      if (tagMatch && searchMatch) {
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
      activeFilter = btn.dataset.filter;
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
