---
layout: page
title: "Video library"
subtitle: "Recordings from EEG101 events and working group sessions"
description: "Recordings from EEG101 working group mini-symposia, invited talks, and community events. Filter by series or search by keyword to find specific topics."
permalink: /library/
---

{::nomarkdown}

<section class="section-content">
  <div class="container">

    <!-- Filter controls -->
    <div class="library-controls">
      <input type="text" id="library-search" class="library-search" placeholder="Search by title, speaker, or topic...">
      <div class="library-filters" id="library-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="WG2 Mini-Symposium">WG2 mini-symposium</button>
      </div>
    </div>

    <p class="library-count" id="library-count">Showing {{ site.data.library | size }} videos</p>

    <!-- Video grid -->
    <div class="library-grid" id="library-grid">
      {% for video in site.data.library %}
      <div class="video-card"
           data-series="{{ video.series }}"
           data-title="{{ video.title | downcase }}"
           data-tags="{{ video.tags | join: ' ' | downcase }}">
        <a href="https://www.youtube.com/watch?v={{ video.id }}"
           target="_blank" rel="noopener"
           class="video-thumb-link">
          <div class="video-thumb">
            <img src="https://i.ytimg.com/vi/{{ video.id }}/mqdefault.jpg"
                 alt="{{ video.title }}"
                 loading="lazy">
            <span class="video-duration">{{ video.duration }}</span>
            <div class="video-play-overlay">
              <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </a>
        <div class="video-info">
          <p class="video-series">{{ video.series }}</p>
          <h3 class="video-title">
            <a href="https://www.youtube.com/watch?v={{ video.id }}" target="_blank" rel="noopener">{{ video.title }}</a>
          </h3>
          <div class="video-tag-list">
            {% for tag in video.tags %}
              <span class="video-tag">{{ tag }}</span>
            {% endfor %}
          </div>
        </div>
      </div>
      {% endfor %}
    </div>

    <p class="library-empty" id="library-empty" style="display:none;">No videos match your search.</p>

  </div>
</section>

<script>
(function() {
  var searchInput = document.getElementById('library-search');
  var filterBtns  = document.querySelectorAll('.filter-btn');
  var cards       = document.querySelectorAll('.video-card');
  var countEl     = document.getElementById('library-count');
  var emptyEl     = document.getElementById('library-empty');
  var activeSeries = 'all';
  var searchTerm   = '';

  function update() {
    var visible = 0;
    cards.forEach(function(card) {
      var seriesMatch = activeSeries === 'all' || card.dataset.series === activeSeries;
      var searchMatch = searchTerm === '' ||
        card.dataset.title.includes(searchTerm) ||
        card.dataset.tags.includes(searchTerm);
      if (seriesMatch && searchMatch) {
        card.style.display = '';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });
    countEl.textContent = 'Showing ' + visible + ' video' + (visible !== 1 ? 's' : '');
    emptyEl.style.display = visible === 0 ? '' : 'none';
  }

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeSeries = btn.dataset.filter;
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
