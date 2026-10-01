---
layout: page
title: "Framework Signatories"
subtitle: "Researchers, engineers, clinicians and students who have signed the EEG Community Framework"
description: "The people who have signed the EEG101 Community Framework and asked to be listed publicly."
permalink: /framework/signatories/
category: "EEG Community Framework"
---

{::nomarkdown}

<section class="section-content">
  <div class="container">

    {% assign sigs = site.data.signatories %}

    {% if sigs.total > 0 %}
    <div class="cf-sig-summary">
      <p class="cf-sig-summary__count"><strong>{{ sigs.total }}</strong> {% if sigs.total == 1 %}person has{% else %}people have{% endif %} signed the Community Framework.</p>
      <p class="cf-sig-summary__note">
        {{ sigs.public_count }} asked to be named here. Signing without being
        named is always an option, and those signatures count toward the total
        just the same.
      </p>
      <p class="cf-sig-summary__updated">Updated {{ sigs.generated }}. New public signatures appear within a day.</p>
      <a href="{{ '/framework/#cf-sign' | relative_url }}" class="btn btn-primary">Add your signature</a>
    </div>

    {% if sigs.public_count > 0 %}
    <div class="library-controls">
      <label for="cf-sig-search" class="visually-hidden">Search signatories by name or affiliation</label>
      <input type="text" id="cf-sig-search" class="library-search" placeholder="Search by name or affiliation...">
    </div>
    <p class="library-count" id="cf-sig-count">Showing {{ sigs.public_count }} signatories</p>

    <ul class="cf-sig-list" id="cf-sig-list">
      {% for person in sigs.people %}
      <li class="cf-sig" data-search="{{ person.name | downcase | escape }} {{ person.affiliation | downcase | escape }}">
        <span class="cf-sig__name">{{ person.name }}</span>
        {% if person.affiliation and person.affiliation != "" %}<span class="cf-sig__affiliation">{{ person.affiliation }}</span>{% endif %}
      </li>
      {% endfor %}
    </ul>
    <p class="library-empty" id="cf-sig-empty" style="display:none;">No signatories match your search.</p>
    {% endif %}

    {% else %}
    <div class="cf-sig-summary">
      <p class="cf-sig-summary__note">
        The signature list is published from the Framework's own signature store,
        which is refreshed here daily. It has not been fetched into this site yet,
        so in the meantime the current list is on the Framework's original site.
      </p>
      <div class="cf-actions">
        <a href="https://sign-cf.eeg101.eu/signatories/" class="btn btn-outline-primary" target="_blank" rel="noopener">Current signatory list ↗</a>
        <a href="{{ '/framework/#cf-sign' | relative_url }}" class="btn btn-primary">Add your signature</a>
      </div>
    </div>
    {% endif %}

  </div>
</section>

{% if sigs.public_count > 0 %}
<script>
(function () {
  var search = document.getElementById('cf-sig-search');
  var items  = document.querySelectorAll('.cf-sig');
  var count  = document.getElementById('cf-sig-count');
  var empty  = document.getElementById('cf-sig-empty');
  if (!search) return;

  search.addEventListener('input', function () {
    var term = search.value.toLowerCase().trim();
    var visible = 0;
    items.forEach(function (item) {
      var match = term === '' || item.dataset.search.indexOf(term) !== -1;
      item.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    count.textContent = 'Showing ' + visible + ' signator' + (visible === 1 ? 'y' : 'ies');
    empty.style.display = visible === 0 ? '' : 'none';
  });
})();
</script>
{% endif %}

{:/nomarkdown}
