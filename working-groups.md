---
layout: page
title: "Our Work"
subtitle: "Four focused groups driving EEG101's scientific programme"
description: "EEG101 operates through four Working Groups addressing reporting standards, data curation, a community framework for open EEG science, and mobile EEG harmonisation."
permalink: /working-groups/
---

EEG101's scientific programme is organised into four Working Groups, each addressing a distinct challenge in the field. The Working Groups are coordinated by the Management Committee and supported by education, dissemination, and community activities. Working Group 4 is the newest addition, joining EEG101 from October 2026.

---

{::nomarkdown}
{% assign wgs = site.data.working_groups.working_groups %}
{% assign all_people = site.data.people %}

{% for wg in wgs %}
<section class="wg-section" id="{{ wg.id }}">
{% if wg.image and wg.image != "" %}
<div class="wg-section__thumb"><img src="{{ wg.image | relative_url }}" alt="{{ wg.title }}" loading="lazy" width="480" height="240"></div>
{% endif %}
<div class="wg-section__header">
<span class="wg-section__number">WG{{ wg.number }}</span>
<h2 class="wg-section__title">{{ wg.title }}</h2>
<p class="wg-section__tagline">{{ wg.tagline }}</p>
</div>

<p>{{ wg.aim }}</p>

<div class="wg-leaders mt-3 mb-4">
{% for leader_id in wg.leaders %}
{% assign leader = all_people | where: "id", leader_id | first %}
{% if leader %}
<div class="wg-leader">
<strong>{{ leader.name }}</strong>
{% if leader.institution and leader.institution != "" %}<span class="wg-leader__inst">{{ leader.institution }}{% if leader.country and leader.country != "" %}, {{ leader.country }}{% endif %}</span>{% endif %}
{% if leader.website and leader.website != "" %}<a href="{{ leader.website }}" class="wg-leader__email" target="_blank" rel="noopener">Website</a>{% endif %}
<span class="wg-leader__badge">WG Leader</span>
</div>
{% endif %}
{% endfor %}
{% for coleader_id in wg.co_leaders %}
{% assign coleader = all_people | where: "id", coleader_id | first %}
{% if coleader %}
<div class="wg-leader">
<strong>{{ coleader.name }}</strong>
{% if coleader.institution and coleader.institution != "" %}<span class="wg-leader__inst">{{ coleader.institution }}{% if coleader.country and coleader.country != "" %}, {{ coleader.country }}{% endif %}</span>{% endif %}
{% if coleader.website and coleader.website != "" %}<a href="{{ coleader.website }}" class="wg-leader__email" target="_blank" rel="noopener">Website</a>{% endif %}
<span class="wg-leader__badge wg-leader__badge--co">Co-leader</span>
</div>
{% endif %}
{% endfor %}
</div>

<div class="row g-3 mb-4">
<div class="col-12 col-md-6">
<div class="wg-detail-card">
<h3 class="wg-detail-card__title">Activities</h3>
<ul class="wg-detail-card__list">
{% for activity in wg.activities %}
<li>{{ activity }}</li>
{% endfor %}
</ul>
</div>
</div>
<div class="col-12 col-md-6">
<div class="wg-detail-card">
<h3 class="wg-detail-card__title">Expected Outputs</h3>
<ul class="wg-detail-card__list">
{% for output in wg.outputs %}
<li>{{ output }}</li>
{% endfor %}
</ul>
</div>
</div>
</div>
</section>
<hr class="section-divider">
{% endfor %}
{:/nomarkdown}

## Activities and community programmes

In addition to the four Working Groups, EEG101 delivers a range of community activities coordinated by the Management Committee.

{::nomarkdown}
{% assign activities = site.data.working_groups.activities %}
<div class="row g-4 mt-2">
{% for activity in activities %}
<div class="col-12 col-sm-6 col-lg-4">
<div class="activity-card">
{% if activity.image and activity.image != "" %}
<div class="activity-card__thumb"><img src="{{ activity.image | relative_url }}" alt="{{ activity.title }}" loading="lazy" width="480" height="240"></div>
{% else %}
<span class="activity-card__icon" aria-hidden="true">{{ activity.icon }}</span>
{% endif %}
<h3 class="activity-card__title">{{ activity.title }}</h3>
<p class="activity-card__tagline">{{ activity.tagline }}</p>
<p class="activity-card__desc">{{ activity.description }}</p>
</div>
</div>
{% endfor %}
</div>
{:/nomarkdown}

---
