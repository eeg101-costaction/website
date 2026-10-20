---
layout: page
title: "EEG101 Podcast"
subtitle: "Conversations with the people behind EEG101"
description: "The EEG101 Podcast series: online interviews with members of the EEG101 COST Action community, alongside the full EEG101 Video Library."
permalink: /podcast/
# Not linked from the menu yet and kept out of search engines until the series
# is integrated into the site; the page itself is public for reporting.
sitemap: false
noindex: true
---
{%- comment -%}
  Episodes, newest last. Each plays in place: the YouTube player only loads
  (from youtube-nocookie.com) when someone presses play, so visiting the page
  does not contact YouTube beyond fetching the still.
{%- endcomment -%}
{%- assign episodes = site.data.podcast -%}

{::nomarkdown}

<section class="section-content">
  <div class="container">
    <div class="section-header">
      <span class="section-label">Podcast series</span>
      <h2 class="section-heading">Episodes</h2>
    </div>

    <div class="podcast-episodes">
      {% for ep in episodes %}
      <article class="podcast-episode">
        <div class="podcast-episode__player" data-youtube-id="{{ ep.id }}">
          <button type="button" class="podcast-episode__play" aria-label="Play episode {{ forloop.index }}: {{ ep.title | escape }}">
            <img src="https://i.ytimg.com/vi/{{ ep.id }}/maxresdefault.jpg" alt="{{ ep.alt | escape }}" loading="lazy" width="1280" height="720">
            <span class="video-card__play" aria-hidden="true"><svg width="64" height="64" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="24" fill="rgba(0,0,153,0.85)"/><polygon points="19,15 37,24 19,33" fill="#FFCC00"/></svg></span>
          </button>
        </div>
        <div class="podcast-episode__info">
          <p class="video-series">Episode {{ forloop.index }}</p>
          <h3 class="podcast-episode__title">{{ ep.title | escape }}</h3>
          <a class="podcast-episode__link" href="https://www.youtube.com/watch?v={{ ep.id }}" target="_blank" rel="noopener">Watch on YouTube ↗</a>
        </div>
      </article>
      {% endfor %}
    </div>
  </div>
</section>

<section class="section-content podcast-library">
  <div class="container">
    <div class="section-header">
      <span class="section-label">Video Library</span>
      <h2 class="section-heading">Talks and recordings</h2>
      <p class="section-lead">Recordings from EEG101 working group symposia, invited talks and community events.</p>
    </div>

    <p class="library-count">{{ site.data.video_hub | size }} videos</p>

    <div class="library-grid">
      {% for video in site.data.video_hub %}
      <div class="video-card">
        <a href="https://www.youtube.com/watch?v={{ video.id }}" target="_blank" rel="noopener" class="video-thumb-link">
          <div class="video-thumb">
            {% if video.thumbnail and video.thumbnail != "" %}
            <img src="{{ video.thumbnail | relative_url }}" alt="{{ video.title | escape }}" loading="lazy">
            {% else %}
            <img src="https://i.ytimg.com/vi/{{ video.id }}/mqdefault.jpg" alt="{{ video.title | escape }}" loading="lazy">
            {% endif %}
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
            {% for tag in video.tags %}<span class="video-tag">{{ tag }}</span>{% endfor %}
          </div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</section>

<script>
(function () {
  document.querySelectorAll('.podcast-episode__player').forEach(function (player) {
    var button = player.querySelector('.podcast-episode__play');
    button.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(player.dataset.youtubeId) + '?autoplay=1&rel=0';
      frame.title = button.getAttribute('aria-label').replace(/^Play /, '');
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      player.replaceChildren(frame);
      frame.focus();
    });
  });
})();
</script>

{:/nomarkdown}
