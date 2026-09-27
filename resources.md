---
layout: page
title: "Resources"
subtitle: "Tools, templates, datasets, and community channels from EEG101"
description: "The EEG101 resource library — reporting templates, pre-registration tools, datasets, training materials, and community documents."
permalink: /resources/
---

A growing library of open resources developed by and for the EEG101 community. Resources are released as they become available throughout the Action.

---

## Resources

{% assign all_resources = site.data.resources %}

<div class="row g-4">
{% for resource in all_resources %}
<div class="col-12 col-sm-6 col-lg-4">
<div class="resource-card">
{% if resource.image and resource.image != "" %}
<div class="resource-card__thumb">
<img src="{{ resource.image | relative_url }}" alt="{{ resource.title }}" loading="lazy" width="480" height="240">
</div>
{% else %}
<span class="resource-card__icon" aria-hidden="true">{{ resource.icon }}</span>
{% endif %}
<span class="resource-card__type">{{ resource.type | capitalize }}</span>
<h3 class="resource-card__title">{{ resource.title }}</h3>
<p class="resource-card__desc">{{ resource.description }}</p>
{% if resource.status %}<p class="resource-card__status">{{ resource.status }}</p>{% endif %}
<div class="resource-card__links">
{% if resource.url and resource.url != "" %}
<a href="{{ resource.url }}" class="btn btn-primary btn-sm" target="_blank" rel="noopener">Open ↗</a>
{% endif %}
{% if resource.file and resource.file != "" %}
<a href="{{ resource.file | relative_url }}" class="btn btn-outline-primary btn-sm" download>Download</a>
{% endif %}
</div>
</div>
</div>
{% endfor %}
</div>
