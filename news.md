---
layout: page
title: "News & Events"
subtitle: "Stay updated with EEG101 activities"
description: "A combined feed of EEG101 announcements, grants, working group meetings, and community events."
permalink: /news/
---

{::nomarkdown}

<div class="event-hub-news-callout mb-5">
  <div>
    <span>EEG101 INTERNAL EVENTS</span>
    <strong>Register for meetings, training and Working Group activity through the Event Hub.</strong>
  </div>
  <a class="btn btn-primary btn-sm" href="{{ "/events/" | relative_url }}">Open Event Hub</a>
</div>

{% assign now_epoch = "now" | date: "%s" | plus: 0 %}
{% assign thirty_days_ago_epoch = now_epoch | minus: 2592000 %}

<!-- Filter Section -->
<div class="news-filter-section mb-5">
  <!-- Status Filters -->
  <div class="mb-3">
    <label class="text-muted small text-uppercase fw-bold mb-2 d-block">Timeframe</label>
    <div class="news-filter d-flex flex-wrap gap-2" id="statusFilters">
      <button class="news-filter__btn" data-filter-type="status" data-filter-val="upcoming-recent">Upcoming & Recent</button>
      <button class="news-filter__btn active" data-filter-type="status" data-filter-val="all">All Time</button>
      <button class="news-filter__btn" data-filter-type="status" data-filter-val="upcoming">Upcoming</button>
      <button class="news-filter__btn" data-filter-type="status" data-filter-val="recent">Recent</button>
      <button class="news-filter__btn" data-filter-type="status" data-filter-val="past">Past</button>
    </div>
  </div>

  <!-- Topic Filters -->
  <div>
    <label class="text-muted small text-uppercase fw-bold mb-2 d-block">Topics</label>
    <div class="news-filter d-flex flex-wrap gap-2" id="topicFilters">
      <button class="news-filter__btn active" data-filter-type="topic" data-filter-val="all">All Topics</button>
      <button class="news-filter__btn" data-filter-type="topic" data-filter-val="Grants">Grants</button>
      <button class="news-filter__btn" data-filter-type="topic" data-filter-val="Announcement">Announcements</button>
      <button class="news-filter__btn" data-filter-type="topic" data-filter-val="Events">Meetings</button>
    </div>
  </div>
</div>

<div class="row g-4" id="unifiedGrid">
  {% comment %}
    Build a combined list. Events use start_date; news items use date.
    We normalise both into a sort_date field so the combined sort works correctly.
  {% endcomment %}
  {% assign combined_items = "" | split: "," %}

  {% for event in site.data.events %}
    {% assign event_with_sort = event %}
    {% assign combined_items = combined_items | push: event %}
  {% endfor %}

  {% for news in site.data.news %}
    {% assign combined_items = combined_items | push: news %}
  {% endfor %}

  {% comment %}
    Sort: events have start_date, news items have date.
    We sort twice — first by date (news), then by start_date (events) — and
    merge by rendering in a single pass sorted by whichever field is present.
    Liquid cannot sort on a computed field, so we sort by start_date (which
    is nil for news items, pushing them to the end), then re-sort by date
    (which is nil for events, pushing them to the end), and interleave manually.
    Simplest reliable approach: assign a unified epoch for each item in the loop.
  {% endcomment %}

  {% assign all_epochs = "" | split: "," %}
  {% for item in combined_items %}
    {% if item.start_date %}
      {% assign sort_key = item.start_date %}
    {% else %}
      {% assign sort_key = item.date %}
    {% endif %}
    {% assign epoch = sort_key | date: "%s" %}
    {% assign all_epochs = all_epochs | push: epoch %}
  {% endfor %}

  {% comment %}
    Liquid's sort is stable and works on a single key. We tag each item with
    a sort_date string and sort the whole array by it.
    Since Liquid cannot mutate objects, we use a workaround: build a parallel
    array of "epoch|index" strings, sort it, then render items in that order.
  {% endcomment %}

  {% assign tagged = "" | split: "," %}
  {% assign idx = 0 %}
  {% for item in combined_items %}
    {% if item.start_date %}
      {% assign sort_key = item.start_date %}
    {% else %}
      {% assign sort_key = item.date %}
    {% endif %}
    {% assign epoch = sort_key | date: "%s" %}
    {% assign tag = epoch | append: "|" | append: idx %}
    {% assign tagged = tagged | push: tag %}
    {% assign idx = idx | plus: 1 %}
  {% endfor %}

  {% assign sorted_tags = tagged | sort | reverse %}

  {% for tag in sorted_tags %}
    {% assign parts = tag | split: "|" %}
    {% assign item_idx = parts[1] | plus: 0 %}
    {% assign item = combined_items[item_idx] %}

    {% if item.start_date %}
      {% assign item_date = item.start_date %}
      {% assign is_event = true %}
    {% else %}
      {% assign item_date = item.date %}
      {% assign is_event = false %}
    {% endif %}
    {% assign topic = item.category %}

    {% assign item_epoch = item_date | date: "%s" | plus: 0 %}
    {% if item_epoch >= now_epoch %}
      {% assign status = "upcoming" %}
    {% elsif item_epoch >= thirty_days_ago_epoch %}
      {% assign status = "recent" %}
    {% else %}
      {% assign status = "past" %}
    {% endif %}

    <div class="col-12 col-md-6 col-lg-4 grid-item" data-status="{{ status }}" data-topic="{{ topic }}">
      {% if is_event %}
        {% include event-card.html event=item computed_status=status %}
      {% else %}
        {% include news-card.html item=item %}
      {% endif %}
    </div>
  {% endfor %}
</div>

<div id="noItemsMessage" class="text-muted mt-5 text-center" style="display: none;">
  <p class="fs-5">No items found matching these filters.</p>
  <button class="btn btn-outline-primary btn-sm" id="resetFilters">Clear all filters</button>
</div>

<script>
(function(){
  var statusBtns = document.querySelectorAll('#statusFilters .news-filter__btn');
  var topicBtns = document.querySelectorAll('#topicFilters .news-filter__btn');
  var gridItems = document.querySelectorAll('#unifiedGrid .grid-item');
  var noItemsMsg = document.getElementById('noItemsMessage');
  var resetBtn = document.getElementById('resetFilters');

  var currentFilters = {
    status: 'all',
    topic: 'all'
  };

  function updateDisplay() {
    var visibleCount = 0;
    gridItems.forEach(function(item) {
      var status = item.dataset.status;
      var topic = item.dataset.topic;

      var statusMatch = false;
      if (currentFilters.status === 'all') {
        statusMatch = true;
      } else if (currentFilters.status === 'upcoming-recent') {
        statusMatch = (status === 'upcoming' || status === 'recent');
      } else {
        statusMatch = (status === currentFilters.status);
      }

      var topicMatch = (currentFilters.topic === 'all' || topic === currentFilters.topic);

      var isVisible = statusMatch && topicMatch;
      item.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCount++;
    });

    noItemsMsg.style.display = (visibleCount === 0) ? '' : 'none';
  }

  function handleFilterClick(btns, type) {
    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        btns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentFilters[type] = this.dataset.filterVal;
        updateDisplay();
      });
    });
  }

  handleFilterClick(statusBtns, 'status');
  handleFilterClick(topicBtns, 'topic');

  resetBtn.addEventListener('click', function() {
    statusBtns.forEach(function(b) { b.classList.remove('active'); if(b.dataset.filterVal === 'all') b.classList.add('active'); });
    topicBtns.forEach(function(b) { b.classList.remove('active'); if(b.dataset.filterVal === 'all') b.classList.add('active'); });
    currentFilters.status = 'all';
    currentFilters.topic = 'all';
    updateDisplay();
  });

  updateDisplay();
})();
</script>
{:/nomarkdown}
