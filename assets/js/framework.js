/*
 * EEG Community Framework — document controls and signature submission.
 *
 * The Framework is signed commitment by commitment: every checkbox in the
 * document is one column of the Supabase `signatories` table that has collected
 * signatures since the Framework launched. This file gathers those answers and
 * posts them to that same table, so the website integration adds a new front
 * door to the existing store rather than starting a new one.
 *
 * The request goes straight to Supabase's PostgREST endpoint with the project's
 * publishable key. That key is public by design: row-level security grants the
 * anonymous role INSERT only, so it can add a signature and can neither read,
 * amend nor delete one. Posting directly (rather than loading the supabase-js
 * bundle) keeps a 100 KB CDN dependency off the page for one HTTP request.
 */
(function () {
  'use strict';

  var form = document.getElementById('cf-form');
  if (!form) return;

  var config = window.EEG101_FRAMEWORK || {};
  var snackbar = document.getElementById('cf-snackbar');
  var statusLine = document.getElementById('cf-form-status');
  var submitButton = document.getElementById('cf-submit');

  /* ---------------------------------------------------------------- feedback */

  var snackbarTimer;
  function notify(message, kind, duration) {
    if (statusLine) {
      statusLine.textContent = message;
      statusLine.className = 'cf-form-status cf-form-status--' + (kind || 'info');
    }
    if (!snackbar) return;
    snackbar.textContent = message;
    snackbar.className = 'cf-snackbar cf-snackbar--show cf-snackbar--' + (kind || 'info');
    clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(function () {
      snackbar.className = 'cf-snackbar';
    }, duration || 6000);
  }

  /* ------------------------------------------------- document fold controls */

  document.querySelectorAll('[data-cf-fold]').forEach(function (button) {
    button.addEventListener('click', function () {
      var open = button.dataset.cfFold === 'open';
      document.querySelectorAll('.cf-page details').forEach(function (details) {
        details.open = open;
      });
    });
  });

  /* ------------------------------------------- "select all" group checkboxes */

  /* Each group heading carries a checkbox that ticks or clears every commitment
     in the list immediately after it. Upstream wired this with an inline
     onchange handler and duplicated element ids; the build script strips both,
     so bind by class and walk the DOM instead. */
  function commitmentsFor(selectAll) {
    var node = selectAll.parentElement;
    while (node && node.nextElementSibling) {
      node = node.nextElementSibling;
      if (node.matches('ul.cf-tasklist')) {
        return Array.prototype.slice.call(
          node.querySelectorAll('input.cf-pledge-input')
        );
      }
      /* Stop at the next group rather than reaching into it. */
      if (node.querySelector && node.querySelector('input.cf-select-all')) break;
    }
    return [];
  }

  var selectAlls = Array.prototype.slice.call(
    document.querySelectorAll('input.cf-select-all')
  );

  selectAlls.forEach(function (selectAll) {
    var commitments = commitmentsFor(selectAll);
    if (!commitments.length) return;

    selectAll.addEventListener('change', function () {
      commitments.forEach(function (box) { box.checked = selectAll.checked; });
      updateCount();
    });

    /* Keep the group checkbox honest: indeterminate when partly ticked. */
    function syncGroup() {
      var ticked = commitments.filter(function (b) { return b.checked; }).length;
      selectAll.checked = ticked === commitments.length;
      selectAll.indeterminate = ticked > 0 && ticked < commitments.length;
    }
    commitments.forEach(function (box) {
      box.addEventListener('change', function () { syncGroup(); updateCount(); });
    });
    syncGroup();
  });

  /* ------------------------------------------------- running commitment tally */

  var allCommitments = Array.prototype.slice.call(
    document.querySelectorAll('input.cf-pledge-input')
  );
  var counter = document.getElementById('cf-commitment-count');

  function updateCount() {
    if (!counter) return;
    var ticked = allCommitments.filter(function (b) { return b.checked; }).length;
    counter.textContent = ticked;
    counter.parentElement.dataset.cfAll =
      ticked === allCommitments.length ? 'true' : 'false';
  }
  updateCount();

  /* ------------------------------------------------------------- submission */

  function gather() {
    var payload = {};

    /* Personal details and consent. */
    form.querySelectorAll('.cf-data').forEach(function (field) {
      if (field.type === 'checkbox') {
        payload[field.name] = field.checked;
      } else if (field.type === 'number') {
        /* An empty number input reads as NaN, which is not valid JSON. */
        payload[field.name] = field.value === '' ? null : Number(field.value);
      } else {
        payload[field.name] = field.value.trim();
      }
    });

    /* Every commitment in the document, ticked or not. */
    allCommitments.forEach(function (box) {
      if (box.name) payload[box.name] = box.checked;
    });

    return payload;
  }

  function firstInvalidField() {
    var fields = form.querySelectorAll('.cf-data[required]');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) return fields[i];
    }
    return null;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var invalid = firstInvalidField();
    if (invalid) {
      form.classList.add('cf-form--validated');
      invalid.focus();
      invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notify('Please complete the highlighted fields before signing.', 'error');
      return;
    }

    if (!config.supabaseUrl || !config.supabaseKey) {
      notify(
        'The signature form is not configured. Please email ' +
          (config.contactEmail || 'the steering group') + ' and let us know.',
        'error',
        12000
      );
      return;
    }

    var originalLabel = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Signing…';
    }
    notify('Recording your signature…', 'info');

    fetch(
      config.supabaseUrl.replace(/\/$/, '') +
        '/rest/v1/' + (config.table || 'signatories'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.supabaseKey,
          Authorization: 'Bearer ' + config.supabaseKey,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify([gather()])
      }
    )
      .then(function (response) {
        if (response.ok) return null;
        return response.text().then(function (body) {
          var detail = body;
          try {
            var parsed = JSON.parse(body);
            detail = parsed.message || parsed.hint || body;
          } catch (error) { /* keep the raw body */ }
          throw new Error(
            'HTTP ' + response.status + (detail ? ': ' + detail : '')
          );
        });
      })
      .then(function () {
        form.reset();
        /* reset() clears the commitment boxes, which default to ticked. */
        allCommitments.forEach(function (box) { box.checked = true; });
        selectAlls.forEach(function (box) {
          box.checked = true;
          box.indeterminate = false;
        });
        updateCount();
        notify(
          'Thank you — your signature has been recorded. If you asked to be ' +
            'listed publicly, your name appears on the signatories page within a day.',
          'success',
          12000
        );
        var heading = document.getElementById('cf-sign');
        if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (error) {
        notify(
          'Your signature could not be recorded (' + error.message + '). ' +
            'Please try again, or email ' +
            (config.contactEmail || 'the steering group') + '.',
          'error',
          15000
        );
      })
      .finally(function () {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      });
  });

  /* Clear the validation styling once someone starts fixing things. */
  form.addEventListener('input', function () {
    form.classList.remove('cf-form--validated');
  });
})();
