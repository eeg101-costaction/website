---
layout: page
title: "Framework Contributors"
subtitle: "The people who wrote the EEG Community Framework"
description: "The contributors who drafted the EEG101 Community Framework."
permalink: /framework/contributors/
category: "EEG Community Framework"
---

{::nomarkdown}

<section class="section-content">
  <div class="container">
    <p class="cf-helper">
      {{ site.data.cf_contributors | size }} people contributed to writing
      <a href="{{ '/framework/' | relative_url }}">the Community Framework</a>.
      It is stewarded by
      <a href="{{ '/working-groups/#wg3' | relative_url }}">Working Group 3</a>,
      and the steering group can be reached at
      <a href="mailto:{{ site.data.framework.contact_email }}">{{ site.data.framework.contact_email }}</a>.
    </p>
    <ul class="cf-contributors">
      {% for person in site.data.cf_contributors %}
      <li>{{ person.name }}</li>
      {% endfor %}
    </ul>
  </div>
</section>

{:/nomarkdown}
