---
layout: page
title: "Grants"
subtitle: "Funding opportunities for EEG101 network members"
description: "EEG101 COST Action grant schemes: Short-Term Scientific Missions, Virtual Mobility Grants, and ITC, YRI and Dissemination Conference Grants. Deadlines, rules and application guidance."
permalink: /grants/
---

EEG101 offers several COST grant schemes to support research collaboration, training, and dissemination. Grants are open to EEG101 members affiliated with institutions in COST Full Member or Cooperating Member countries, or in Near Neighbour Countries.

<div class="grants-status-banner">
<h3>Important information</h3>

🔹 Please note that the **academic lead at the host institution for all STSM placements must be a member of EEG101**. Applicants should ensure that prospective hosts have joined the Action before submitting their application. Membership is open to eligible researchers internationally, including those based outside COST countries.

🔹 For **Virtual Mobility applications** involving collaboration with a third party, the **named academic or professional lead at the collaborating organisation must also be a member of EEG101**. Applicants should ensure that any third-party collaborator has joined the Action before submitting their application.

🔹 Applications must also include a **clear justification of the requested expenses**, including estimated travel, accommodation and subsistence costs where relevant, so that the Grant Reviewers can assess whether the proposed budget is reasonable and eligible.

🔹 **All visible output** produced with support from these funding schemes **must acknowledge the support of the COST Action** and whenever possible use the COST and EEG101 logos (e.g. on presentation slides and posters). Manuscripts must include the following acknowledgement statement:

> **Example acknowledgement statement:**
> 
> This publication is based on work supported by the European COST Action CA24148: ‘EEG101 - Fundamentals of Open & Rigorous EEG Science’.
</div>

---

## Grant schemes

{% for grant in site.data.grants.schemes %}
<section class="grant-detail" id="{{ grant.id }}">
<div class="grant-detail__header">
<span class="grant-detail__icon" aria-hidden="true">{{ grant.icon }}</span>
<div>
<h2 class="grant-detail__title">{{ grant.title }}</h2>
<span class="grant-detail__value">{{ grant.value }}</span>
<span class="grant-status grant-status--{{ grant.status }}">{% if grant.status == "open" %}● Open now{% elsif grant.status == "upcoming" %}◌ Coming soon{% else %}✕ Closed{% endif %}</span>
</div>
</div>

{{ grant.summary }}

<div class="row g-4 mt-1 mb-3">
<div class="col-12 col-md-6">

**Eligibility**
{{ grant.eligibility }}

**Duration:** {{ grant.duration }}

</div>
<div class="col-12 col-md-6">

**Who is this for?**
{% if grant.yri_track %}✓ Young Researchers & Innovators (YRIs) {% endif %}
{% if grant.itc_track %}✓ ITC-based researchers {% endif %}
{% if grant.industry_track %}✓ Industry-involved projects {% endif %}

{% if grant.deadline and grant.deadline != "" %}
**Deadline:** {{ grant.deadline }}
{% endif %}

{% if grant.notes and grant.notes != "" %}
**Notes:** {{ grant.notes }}
{% endif %}

</div>
</div>

<div class="grant-detail__actions">
{% if grant.status == "open" and site.data.site.grants_application_endpoint and site.data.site.grants_application_endpoint != "" %}
<a href="{{ '/grants/apply/' | relative_url }}?scheme={{ grant.id | replace: '-', '_' }}" class="btn btn-primary">Apply now</a>
{% elsif grant.status == "open" and grant.application_url != "" %}
<a href="{{ grant.application_url }}" class="btn btn-primary" target="_blank" rel="noopener">Apply on e-COST ↗</a>
{% endif %}
{% if grant.guidance_url and grant.guidance_url != "" %}
<a href="{{ grant.guidance_url }}" class="btn btn-outline-primary" target="_blank" rel="noopener">COST guidance ↗</a>
{% endif %}
</div>

</section>
<hr class="section-divider">
{% endfor %}

---

## How to apply

{::nomarkdown}
{% for step in site.data.grants.application_process %}
<div class="process-step">
<div class="process-step__number">{{ step.step }}</div>
<div class="process-step__body">
<h3 class="process-step__title">{{ step.title }}</h3>
<p class="process-step__desc">{{ step.description }}</p>
</div>
</div>
{% endfor %}
{:/nomarkdown}

---

## Frequently asked questions
{::nomarkdown}
<div class="accordion" id="faqAccordion">
<div class="accordion-item">
<h3 class="accordion-header" id="faq1-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq1" aria-expanded="false" aria-controls="faq1">Who can apply for EEG101 grants?</button>
</h3>
<div id="faq1" class="accordion-collapse collapse" aria-labelledby="faq1-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">EEG101 members affiliated with an institution in a COST Full or Cooperating Member country, or in a Near Neighbour Country. For an STSM, your host must be in a different country from your own institution. ITC Conference Grants are only for people at institutions in Inclusiveness Target Countries or Near Neighbour Countries, and YRI Conference Grants only for Young Researchers and Innovators (under 40). Membership of EEG101 is free — <a href="{{ '/join/' | relative_url }}">join first</a>.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq2-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2" aria-expanded="false" aria-controls="faq2">Do I need to be a current EEG101 member?</button>
</h3>
<div id="faq2" class="accordion-collapse collapse" aria-labelledby="faq2-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Yes. Join the Action through e-COST before submitting a grant application.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq3-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3" aria-expanded="false" aria-controls="faq3">Can early career researchers apply?</button>
</h3>
<div id="faq3" class="accordion-collapse collapse" aria-labelledby="faq3-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Absolutely — EEG101 prioritises Young Researchers &amp; Innovators and ITC-based applicants for all grant schemes.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq4-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq4" aria-expanded="false" aria-controls="faq4">Can I apply for a STSM with an industry partner?</button>
</h3>
<div id="faq4" class="accordion-collapse collapse" aria-labelledby="faq4-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Yes. EEG101 has a dedicated industry engagement track. At least five funded projects will involve industry partners.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq5-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq5" aria-expanded="false" aria-controls="faq5">Where can I find host institutions?</button>
</h3>
<div id="faq5" class="accordion-collapse collapse" aria-labelledby="faq5-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Contact the coordination team at <a href="mailto:{{ site.data.site.email }}">{{ site.data.site.email }}</a> to connect with potential hosts across the network.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq6-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq6" aria-expanded="false" aria-controls="faq6">What happens after my grant?</button>
</h3>
<div id="faq6" class="accordion-collapse collapse" aria-labelledby="faq6-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">You submit a report in e-COST within 30 days of the end of your activity, or within 15 days of the end of the grant period if that comes first. For conference grants, include your certificate of attendance and the programme or book of abstracts showing your presentation. The grant is paid once your report is approved; STSM grantees can ask for up to 50% in advance.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq7-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq7" aria-expanded="false" aria-controls="faq7">Which conference grant should I apply for?</button>
</h3>
<div id="faq7" class="accordion-collapse collapse" aria-labelledby="faq7-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Presenting your own work: an <strong>ITC Conference Grant</strong> if your institution is in an Inclusiveness Target Country or Near Neighbour Country (oral presentations only), or a <strong>YRI Conference Grant</strong> if you are under 40 (poster or oral). Presenting the work of EEG101 itself: a <strong>Dissemination Conference Grant</strong> (oral presentations only). Each covers up to €2,500 to attend in person or €500 online. The conference must be organised entirely by others, not by EEG101 or another COST Action, and you can hold only one type of conference grant in a grant period.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq8-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq8" aria-expanded="false" aria-controls="faq8">Can I hold more than one grant?</button>
</h3>
<div id="faq8" class="accordion-collapse collapse" aria-labelledby="faq8-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Not at the same time: COST does not allow overlapping grants in the same grant period. Every activity must take place within one grant period; this period's activities must end by 30 September 2027.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq9-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq9" aria-expanded="false" aria-controls="faq9">What can a grant pay for?</button>
</h3>
<div id="faq9" class="accordion-collapse collapse" aria-labelledby="faq9-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">A contribution to travel, accommodation and subsistence, conference registration fees (and poster printing for YRI Conference Grants), and your effort. Grants do not cover salaries or other employment costs, and a Virtual Mobility Grant cannot pay for tasks that are part of a leadership role in EEG101.</div>
</div>
</div>
<div class="accordion-item">
<h3 class="accordion-header" id="faq10-heading">
<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq10" aria-expanded="false" aria-controls="faq10">How are applications reviewed?</button>
</h3>
<div id="faq10" class="accordion-collapse collapse" aria-labelledby="faq10-heading" data-bs-parent="#faqAccordion">
<div class="accordion-body">Reviewers score each application on its quality, your contribution to EEG101 to date, relevance to EEG101, feasibility and value for money, and benefit to the applicant and the network, taking into account COST's Excellence and Inclusiveness policy. Reviewers declare any conflict of interest and do not score those applications. The grants committee then ranks the applications and decides on funding.</div>
</div>
</div>
</div>
{:/nomarkdown}

For further guidance, consult the [COST funding pages](https://www.cost.eu/funding/funding-opportunities/).
