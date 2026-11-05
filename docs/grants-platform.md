# EEG101 grants platform: applications and review

The grants platform has two parts, both served by one Google Apps Script project
(`scripts/google-apps-script/grants/`) owned by the EEG101 admin account:

- **The application form**, at **www.eeg101.eu/grants/apply/**. Applicants
  choose a scheme and fill in seven short steps: scheme, about you, activity
  and dates, proposal, budget, documents, check and submit. Each submission
  gets an ID (for example `EEG101-G2-001`) and is saved straight away:
  - a row in the **Applications** tab of the *EEG101 Grant Applications*
    spreadsheet;
  - a Drive folder with the uploaded documents and a PDF of the application;
  - a confirmation email to the applicant, with the PDF attached, copied
    (cc) to eeg101costaction@gmail.com and blind-copied (bcc) to the
    addresses in the `GRANTS_BCC` script property;
  - on screen, the reference and two downloads: the PDF and an editable Word
    copy.
- **The review dashboard**, a separate web address only listed reviewers can
  open. Reviewers score applications; chairs rank them, select them for
  funding and run reports.

Everything private (applications, documents, reviewers, email addresses) stays
in Google. This repository holds only the code.

## The rules the form enforces

They are checked twice, in the form and again on the server, so they cannot be
bypassed.

| Scheme | Maximum | Length | Documents |
| --- | --- | --- | --- |
| STSM | €4,000 | 5–90 days | CV; letter of support from the host |
| Virtual Mobility Grant | €1,500 | 1–90 days | CV; letter from the collaborating organisation if a third party is involved |
| Conference Grant (in person) | €2,500 | 1–14 days | CV; proof of abstract submission or acceptance |
| Conference Grant (online) | €500 | 1–14 days | CV; proof of abstract submission or acceptance |

In addition:
- the applicant must be an EEG101 member;
- an STSM host, or a VMG third-party lead, must also be a member;
- activities must start after the day of application and end by
  **`period_end`** (30 September 2027 unless changed in Settings);
- the costed budget may not exceed the scheme's maximum, and every line needs
  a description;
- a written justification of costs is required;
- uploads must be PDFs of at most 5 MB.

Conference Grants are meant for early-career and ITC-based researchers. An
applicant who is neither can still apply, but the application is flagged for
reviewers ("Eligibility notes"). The same applies to an abstract not yet
accepted.

The limits live in `SCHEMES` at the top of `Code.gs`. They match
`_data/grants.yml` (the Grants page), so change both together.

## One-time setup (about 20 minutes)

Do this signed in to the Google account that should own the applications. Its
Gmail sends the confirmation emails.

1. Go to **script.google.com → New project**. Rename it *EEG101 Grants*.
2. Replace the contents of `Code.gs` with `scripts/google-apps-script/grants/Code.gs`
   from this repository, and save.
3. Click **+ (Add a file) → HTML**, name it `Apply` (exactly; the editor adds
   `.html`), and paste in `Apply.html`. Do the same for `Review` with
   `Review.html`. Save.
4. In the function list at the top, choose **setUpGrants** and click **Run**.
   Allow the permissions it asks for. It creates the *EEG101 Grant
   Applications* spreadsheet and Drive folder (both in your Drive; the log
   shows their links) and a daily clean-up of abandoned uploads.
5. **Project Settings (⚙) → Script properties → Add script property**:
   `GRANTS_BCC` = the addresses to blind-copy on every confirmation,
   separated by commas (Amy Bland's and yours).
6. **Deploy the application form:** **Deploy → New deployment → ⚙ Web app**.
   Description *Applications*, **Execute as: Me**, **Who has access: Anyone**.
   Click **Deploy** and copy the **Web app URL**.
7. **Deploy the review dashboard:** **Deploy → New deployment → ⚙ Web app** again.
   Description *Review*, **Execute as: User accessing the web app**, **Who has
   access: Anyone with a Google account**. Click **Deploy** and copy this URL
   too. Reviewers open it with **`?view=review`** added at the end.
8. Put the *Applications* URL into `_data/site.yml` as
   `grants_application_endpoint` (or send it to the website admin). The
   /grants/apply/ page then shows the form.

When `Code.gs`, `Apply.html` or `Review.html` change later, paste the new
versions in, save, then for **each** of the two deployments: **Deploy →
Manage deployments → select it → ✏️ → Version: New version → Deploy**. This
keeps both web addresses.

## Reviewers

1. In the spreadsheet's **Reviewers** tab, list each reviewer's Google
   account email, their name, and `reviewer` or `chair`. You are added as
   chair during setup.
2. In the Apps Script editor, run **shareWithReviewers**. It gives everyone on
   the list edit access to the spreadsheet and view access to the
   applications folder. The dashboard runs as the reviewer, so they need
   that access.
3. Send reviewers the *Review* URL with `?view=review` at the end. The first
   time, Google asks them to allow access to the spreadsheet and Drive.

To remove a reviewer, delete their row in the tab, then remove their access
from the spreadsheet and folder (**Share** in Google Drive).

**What reviewers see:** every application, its PDF and documents, and a
scoring form:
- four criteria, each scored 1–5: quality, relevance, feasibility and value
  for money, and benefit;
- a recommendation;
- comments;
- a conflict-of-interest box. Ticking it means the reviewer doesn't score
  that application.

Other reviewers' scores stay hidden from a reviewer until they have scored
the application, or declared a conflict, themselves.

**What chairs also see:**
- **Ranking and funding:** applications per scheme with their mean scores. A
  button ranks them by score; the order can then be adjusted by hand.
- **Decisions:** Funded, Reserve, Not funded or Withdrawn, with the amount
  awarded. It defaults to the amount requested and may not exceed it.
- **Budget tracker:** money committed per scheme against the amounts set in
  the Settings tab (`budget_stsm` and so on).
- **Reports:** totals, then breakdowns by scheme (against budget), by start
  month, gender, ITC, under-40, career stage and country. Also a list of
  funded grants with a CSV download, and **Print or save as PDF**.

## Running a call

All of this is in the spreadsheet's **Settings** tab. No code changes are
needed.

1. Set `call_name` (shown on the form and in emails), `deadline` (Brussels
   time, e.g. `2026-12-15T17:00`), `period_end` (e.g. `2027-09-30`), and
   optionally the budgets.
2. Set `call_open` to `TRUE`. The form opens at once. It closes by itself at
   the deadline, or when `call_open` is set back to `FALSE`.
3. On the website, set each scheme's `status: "open"` in `_data/grants.yml`.
   An **Apply now** button then appears on the Grants page, linking to the
   form with that scheme already chosen. Announce the call as usual, for
   example as an event or a calendar date in the website editor.
4. After the deadline, reviewers score and the chair records decisions. Then
   email applicants; the platform does not send decision emails.
5. For the next call, change `id_prefix` (e.g. `G3`) and the dates, and set
   `call_open` to `TRUE` again. Earlier rows stay in the spreadsheet.

## If something goes wrong

- **An applicant says the form will not submit:** the message above the
  form says why, for example a date after `period_end` or a budget over the
  maximum. If it says the call is closed, check `call_open` and `deadline`.
- **No confirmation email arrived:** the application is still saved; the
  applicant is told so on screen and can download their copy. Look in the
  spreadsheet for their row. Emails come from the Gmail account that owns the
  script, so check its daily sending limit.
- **A reviewer sees "This page is for EEG101 grant reviewers":** they are
  signed in to Google with an account that isn't in the Reviewers tab, or
  `shareWithReviewers` hasn't been run since they were added.
- **To correct an application:** edit its row in the spreadsheet. The PDF in
  the folder is what the applicant submitted, and stays as the record.

## Testing changes

`node scripts/google-apps-script/grants/test/run.cjs` runs the server code
against an in-memory stand-in for Google (Sheets, Drive, Gmail):
submissions, every rule, uploads, emails, review, ranking and reports. Run it
after any change to `Code.gs`.
