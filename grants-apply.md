---
layout: page
title: "Apply for EEG101 funding"
subtitle: "Short-Term Scientific Missions, Virtual Mobility Grants and Conference Grants"
description: "Apply for an EEG101 COST Action grant: choose a scheme, describe your plan and budget, and upload your documents."
permalink: /grants/apply/
---
{%- comment -%}
  The form itself is the "Applications" deployment of the grants Apps Script
  (scripts/google-apps-script/grants/), shown in a frame. It tells this page how
  tall it is and when to scroll back to the top, so it reads as part of the site.
  See docs/grants-platform.md.
{%- endcomment -%}
{%- assign endpoint = site.data.site.grants_application_endpoint -%}

{::nomarkdown}
{% if endpoint and endpoint != "" %}
<p>Please read the scheme details and COST rules on the <a href="{{ '/grants/' | relative_url }}">Grants page</a> before you start. The form takes about 30 minutes; your answers are kept on your device as you go, so you can come back to it. You will need your CV, and depending on the scheme, a confirmation from your host, a letter of support, or the acceptance or invitation letter for your conference, as PDF files. You do not need to apply in e-COST now: if your application is accepted, we will ask you to apply through COST's online platform, e-COST, at that point.</p>
<div class="grant-apply">
  <p class="grant-apply__loading" id="grantApplyLoading">Loading the application form…</p>
  <iframe id="grantApplyFrame" class="grant-apply__frame" title="EEG101 grant application form" src="{{ endpoint }}" allow="clipboard-write"></iframe>
</div>
<p class="grant-apply__help">Problems with the form? Email <a href="mailto:{{ site.data.site.email }}">{{ site.data.site.email }}</a>.</p>
<script>
(function () {
  var frame = document.getElementById('grantApplyFrame');
  var scheme = (new URLSearchParams(location.search).get('scheme') || '').replace(/[^a-z_]/g, '');
  if (scheme) frame.src = frame.src + (frame.src.indexOf('?') < 0 ? '?' : '&') + 'scheme=' + scheme;
  frame.addEventListener('load', function () { document.getElementById('grantApplyLoading').hidden = true; });
  // The form runs inside Google's own wrapper frames, so accept messages from
  // any frame nested in ours, and only these two kinds.
  function fromFrame(source) { for (var w = source; w; w = w.parent === w ? null : w.parent) if (w === frame.contentWindow) return true; return false; }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (!fromFrame(e.source)) return;
    if (d.type === 'eeg101-grant-height' || d.type === 'eeg101-grant-scroll') {
      if (d.height > 200) frame.style.height = Math.min(d.height + 24, 20000) + 'px';
      if (d.type === 'eeg101-grant-scroll') frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
</script>
{% else %}
<div class="grants-status-banner">
<h3>Applications are not open yet</h3>
<p>The application form opens with the next EEG101 funding call. Calls and deadlines are announced on the <a href="{{ '/grants/' | relative_url }}">Grants page</a> and the <a href="{{ '/events/' | relative_url }}">Events page</a>.</p>
</div>
{% endif %}
{:/nomarkdown}
