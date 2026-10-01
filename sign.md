---
layout: page
title: "Sign the EEG Community Framework"
subtitle: "Add your name to the Framework for open, rigorous and responsible EEG science"
description: "Sign the EEG101 Community Framework: commit to the standards the EEG community has set for scientific integrity, democratization, and technological and environmental responsibility."
permalink: /sign/
redirect_target: /framework/#cf-sign
---

{::nomarkdown}

<section class="section-content">
  <div class="container">
    <div class="cf-redirect">
      <p class="cf-redirect__lead">
        The Community Framework is signed commitment by commitment, so signing
        happens on the Framework itself — read the parts you care about, untick
        anything you would rather not sign up to, and add your details at the end.
      </p>
      <div class="cf-actions">
        <a href="{{ '/framework/#cf-sign' | relative_url }}" class="btn btn-primary btn-lg">Go to the Framework and sign</a>
        <a href="{{ '/framework/' | relative_url }}" class="btn btn-outline-primary">Read it first</a>
      </div>
      <p class="cf-redirect__note">
        Taking you there now. If nothing happens,
        <a href="{{ '/framework/#cf-sign' | relative_url }}">follow this link</a>.
      </p>
    </div>
  </div>
</section>

{% comment %}
  /sign/ is the short address the Framework is promoted under, and it stays a
  real page so the link never breaks and search engines resolve it to the
  Framework. The redirect runs client-side because GitHub Pages serves static
  files only; the links above work with JavaScript disabled.
{% endcomment %}
<script>
  window.location.replace({{ '/framework/#cf-sign' | relative_url | jsonify }});
</script>

{:/nomarkdown}
