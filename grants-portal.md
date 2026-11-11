---
layout: page
title: "Grants portal"
subtitle: "For EEG101 grant reviewers, chairs and the grants administrator"
description: "Sign in to the EEG101 grants portal to review applications, decide on funding and track funded grants."
permalink: /grants/portal/
noindex: true
---
{%- comment -%}
  The portal itself is the grants Apps Script web app opened with a person's
  own key (scripts/google-apps-script/grants/, docs/grants-platform.md). There
  is no password: each person signs in with the personal link emailed to them.
  This page sends that link again, by email only, to people on the list.
{%- endcomment -%}
{%- assign endpoint = site.data.site.grants_application_endpoint -%}

{::nomarkdown}
<p>The grants portal is where reviewers score the applications assigned to them, chairs decide on funding and manage calls, and the grants administrator tracks funded grants to payment.</p>
<p><strong>To sign in, open the personal link in your invitation email</strong> (subject "Your EEG101 grants portal link"). Bookmark it: it is your sign-in, so please do not share it.</p>
{% if endpoint and endpoint != "" %}
<div class="grant-portal">
  <h2>Lost your link?</h2>
  <p>Enter the email address you were invited with, and we will email your link to it.</p>
  <form id="portalLink" class="grant-portal__form">
    <label for="portalEmail" class="visually-hidden">Email address</label>
    <input id="portalEmail" type="email" required autocomplete="email" placeholder="you@example.org">
    <button type="submit" class="btn btn-primary">Email me my link</button>
  </form>
  <p class="grant-portal__msg" id="portalMsg" role="status"></p>
</div>
<script>
(function () {
  var form = document.getElementById('portalLink'), msg = document.getElementById('portalMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var button = form.querySelector('button');
    button.disabled = true; msg.textContent = 'Sending…';
    // text/plain keeps this a simple request that Google's web app accepts.
    fetch('{{ endpoint }}', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ email: document.getElementById('portalEmail').value }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { msg.textContent = d.message; })
      .catch(function () { msg.textContent = 'That did not work. Please try again, or email {{ site.data.site.email }}.'; })
      .then(function () { button.disabled = false; });
  });
})();
</script>
{% endif %}
<p>Not a reviewer yet? Reviewers are invited by the grants chairs. Questions: <a href="mailto:{{ site.data.site.email }}">{{ site.data.site.email }}</a>.</p>
{:/nomarkdown}
