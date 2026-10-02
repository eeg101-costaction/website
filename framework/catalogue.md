---
layout: page
title: "Framework Resource Catalogue"
subtitle: "Now part of the EEG101 Library"
description: "The EEG101 Community Framework resource catalogue is now part of the EEG101 Library, searchable alongside the Action's own papers."
permalink: /framework/catalogue/
---

{::nomarkdown}

<section class="section-content">
  <div class="container">
    <div class="cf-redirect">
      <p class="cf-redirect__lead">
        The Framework's {{ site.data.cf_catalogue.item_count }} readings, tools and
        recordings now live in the EEG101 Library, where they can be searched
        alongside the Action's own papers and filtered by topic or Framework part.
      </p>
      <div class="cf-actions">
        <a href="{{ '/library/#framework' | relative_url }}" class="btn btn-primary btn-lg">Open the catalogue in the Library</a>
        <a href="{{ '/framework/' | relative_url }}" class="btn btn-outline-primary">Back to the Framework</a>
      </div>
      <p class="cf-redirect__note">
        Taking you there now. If nothing happens,
        <a href="{{ '/library/#framework' | relative_url }}">follow this link</a>.
      </p>
    </div>
  </div>
</section>

{% comment %}
  This URL was published while the catalogue was a page of its own, so it stays
  a real page rather than becoming a 404. The redirect runs client-side because
  GitHub Pages serves static files only; the links above work without JavaScript.
{% endcomment %}
<script>
  window.location.replace({{ '/library/#framework' | relative_url | jsonify }});
</script>

{:/nomarkdown}
