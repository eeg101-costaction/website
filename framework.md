---
layout: page
title: "EEG Community Framework"
subtitle: "Toward a deontological framework for EEG science"
description: "The EEG101 Community Framework sets out the standards the EEG community commits to across scientific integrity, democratization, and technological and environmental responsibility. Read it, and sign the pledges you agree with."
permalink: /framework/
category: "Working Group 3"
framework_form: true
---

{::nomarkdown}

<section class="section-content cf-page">
  <div class="container">

    <div class="cf-intro">
      {% include framework/introduction.html %}
    </div>

    <div class="cf-actions">
      <a href="#cf-sign" class="btn btn-primary">Sign the Framework</a>
      <a href="{{ site.data.framework.one_pager | relative_url }}" class="btn btn-outline-primary" download>Download the one-page summary (PDF)</a>
      <a href="{{ '/framework/catalogue/' | relative_url }}" class="btn btn-outline-primary">Resource catalogue</a>
      <a href="{{ '/framework/signatories/' | relative_url }}" class="btn btn-outline-primary">Signatories{% if site.data.signatories.total > 0 %} ({{ site.data.signatories.total }}){% endif %}</a>
    </div>

    <p class="cf-helper">
      Every commitment below is ticked by default. Untick anything you would
      rather not sign up to, then add your details at the end of the page —
      your choices are recorded commitment by commitment. Terms in
      <a href="{{ '/framework/glossary/' | relative_url }}">the glossary</a> are
      explained there, and every citation links through to
      <a href="{{ '/framework/references/' | relative_url }}">the references</a>.
    </p>

    <div class="cf-toolbar">
      <div role="group" aria-label="Expand or collapse the whole document">
        <button type="button" class="btn btn-outline-primary btn-sm" data-cf-fold="open">Expand all sections</button>
        <button type="button" class="btn btn-outline-primary btn-sm" data-cf-fold="close">Collapse all sections</button>
      </div>
      <p class="cf-tally" data-cf-all="true" aria-live="polite">
        <span id="cf-commitment-count">{{ site.data.cf_meta.pledge_count }}</span>
        of {{ site.data.cf_meta.pledge_count }} commitments selected
      </p>
    </div>

    <form id="cf-form" class="cf-document" novalidate>

      <div id="cf-validity">{% include framework/validity.html %}</div>
      <div id="cf-democratization">{% include framework/democratization.html %}</div>
      <div id="cf-responsibility">{% include framework/responsibility.html %}</div>
      <div id="cf-conclusion">{% include framework/conclusion.html %}</div>

      <div class="cf-sign" id="cf-sign">
        <h2 class="cf-sign__heading">Sign the pledge</h2>

        <details class="cf-note cf-privacy">
          <summary>🔒 Data privacy notice (GDPR)</summary>
          <p>
            We are committed to protecting your privacy. By signing the Community
            Framework you consent to the collection of the personal data you
            provide (name, affiliation, email address, and the optional
            demographic details below).
          </p>
          <p><strong>How we use your data</strong></p>
          <ul>
            <li>To publicly display your name and affiliation, if — and only if — you choose to make them public.</li>
            <li>To verify signatories and maintain the integrity of this initiative.</li>
            <li>To contact you with essential updates about the EEG Community Framework. We will not use your email address for marketing.</li>
          </ul>
          <p><strong>Your rights</strong></p>
          <p>
            Your data is stored securely and will not be sold or shared with
            unrelated third parties. Under the General Data Protection Regulation
            (GDPR) you have the right to access, amend, or request the deletion of
            your personal data at any time. For any request or privacy concern,
            contact <a href="mailto:{{ site.data.framework.contact_email }}">{{ site.data.framework.contact_email }}</a>.
          </p>
        </details>

        {% include framework/sign-fields.html %}

      </div>
    </form>

    <div class="cf-after">
      <h2>Discuss, and read further</h2>
      <p>
        Some of these commitments are uncontroversial; others we hope will start
        an argument. The
        <a href="{{ site.data.framework.forum_url }}" target="_blank" rel="noopener">CuttingEEG forum</a>
        is the place for that discussion, and the steering group can be reached at
        <a href="mailto:{{ site.data.framework.contact_email }}">{{ site.data.framework.contact_email }}</a>.
      </p>
      <ul class="cf-after__links">
        <li><a href="{{ '/framework/catalogue/' | relative_url }}">Resource catalogue</a> — {{ site.data.cf_catalogue.item_count }} readings, tools and recordings behind the Framework</li>
        <li><a href="{{ '/framework/glossary/' | relative_url }}">Glossary</a> — the terms used in this document</li>
        <li><a href="{{ '/framework/references/' | relative_url }}">References</a> — the full bibliography</li>
        <li><a href="{{ '/framework/contributors/' | relative_url }}">Contributors</a> — the {{ site.data.cf_contributors | size }} people who wrote it</li>
        <li><a href="{{ '/working-groups/#wg3' | relative_url }}">Working Group 3</a> — the EEG101 working group that stewards the Framework</li>
      </ul>
    </div>

  </div>
</section>

<div id="cf-snackbar" class="cf-snackbar" role="status" aria-live="polite"></div>

{:/nomarkdown}
