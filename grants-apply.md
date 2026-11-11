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
<p>Please read the scheme details and COST rules on the <a href="{{ '/grants/' | relative_url }}">Grants page</a> before you start. The form takes about 30 minutes; your answers are kept on your device as you go, so you can come back to it. Each scheme also has a Word template (the link on its card in the form) to prepare your answers offline first. You will need your CV, and depending on the scheme, a confirmation from your host, a letter of support, or the acceptance or invitation letter for your conference, as PDF files. You do not need to apply in e-COST now: if your application is accepted, we will ask you to apply through COST's online platform, e-COST, at that point.</p>
<div class="grant-apply">
  <p class="grant-apply__loading" id="grantApplyLoading">Loading the application form…</p>
  <iframe id="grantApplyFrame" class="grant-apply__frame" title="EEG101 grant application form" src="{{ endpoint }}" allow="clipboard-write"></iframe>
</div>
{% assign captcha = site.data.site.grants_turnstile_site_key %}
{% if captcha and captcha != "" %}<div id="grantCaptcha" class="grant-apply__captcha"></div>{% endif %}
<p class="grant-apply__help">Problems with the form? Email <a href="mailto:{{ site.data.site.email }}">{{ site.data.site.email }}</a>.</p>
<script>
(function () {
  var frame = document.getElementById('grantApplyFrame');
  var params = new URLSearchParams(location.search);
  var scheme = (params.get('scheme') || '').replace(/[^a-z_]/g, '');
  var callId = (params.get('call') || '').replace(/[^a-z0-9-]/g, '');
  var extra = (scheme ? '&scheme=' + scheme : '') + (callId ? '&call=' + callId : '');
  if (extra) frame.src = frame.src + (frame.src.indexOf('?') < 0 ? '?' : '&') + extra.slice(1);
  frame.addEventListener('load', function () { document.getElementById('grantApplyLoading').hidden = true; });
  // The form runs inside Google's own wrapper frames, so accept messages from
  // any frame nested in ours, and only these kinds.
  function fromFrame(source) { for (var w = source; w; w = w.parent === w ? null : w.parent) if (w === frame.contentWindow) return true; return false; }
  // The CAPTCHA (Cloudflare Turnstile) runs on this page, not in the form: when
  // the form asks at submission, get a token and hand it back. Usually nobody
  // sees anything; if Cloudflare wants a click, the box shows below the form.
  var captchaKey = '{{ site.data.site.grants_turnstile_site_key }}', widget = null, asker = null;
  function reply(token) { if (asker) asker.postMessage({ type: 'eeg101-grant-token', token: token || '' }, '*'); }
  function captchaFor(source) {
    asker = source;
    if (!captchaKey) { reply(''); return; }
    if (!window.turnstile) { setTimeout(function () { captchaFor(source); }, 300); return; }
    if (widget === null) {
      widget = turnstile.render('#grantCaptcha', {
        sitekey: captchaKey, execution: 'execute', appearance: 'interaction-only',
        callback: reply, 'error-callback': function () { reply(''); }, 'expired-callback': function () { turnstile.reset(widget); },
        'before-interactive-callback': function () { document.getElementById('grantCaptcha').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
    } else turnstile.reset(widget);
    turnstile.execute(widget);
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (!fromFrame(e.source)) return;
    if (d.type === 'eeg101-grant-token-request') { captchaFor(e.source); return; }
    if (d.type === 'eeg101-grant-height' || d.type === 'eeg101-grant-scroll') {
      if (d.height > 200) frame.style.height = Math.min(d.height + 24, 20000) + 'px';
      if (d.type === 'eeg101-grant-scroll') frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
</script>
{% if captcha and captcha != "" %}<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>{% endif %}
{% else %}
<div class="grants-status-banner">
<h3>Applications are not open yet</h3>
<p>The application form opens with the next EEG101 funding call. Calls and deadlines are announced on the <a href="{{ '/grants/' | relative_url }}">Grants page</a> and the <a href="{{ '/events/' | relative_url }}">Events page</a>.</p>
</div>
{% endif %}
{:/nomarkdown}
