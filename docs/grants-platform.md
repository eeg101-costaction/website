# EEG101 grants platform: applications and review

The grants platform has two parts, both served by one Google Apps Script web app
(`scripts/google-apps-script/grants/`) owned by the EEG101 admin account. It
follows the COST *Annotated Rules for COST Actions* (level C, version 4.0),
Annex 2 and Article 6.4:

- **The application form**, at **www.eeg101.eu/grants/apply/**. Applicants
  choose one of five schemes and fill in seven short steps: scheme, about you, activity
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
- **The review dashboard**, which each reviewer opens with a personal link.
  Reviewers score applications; chairs can score too, and rank them, decide
  on funding and run reports. Reviewers can be blinded to who applied; chairs
  never are.

Everything private (applications, documents, reviewers, email addresses) stays
in Google. This repository holds only the code.

## The rules the form enforces

They are checked twice, in the form and again on the server, so they cannot be
bypassed.

| Scheme | Maximum | Length | Who | Documents |
| --- | --- | --- | --- | --- |
| STSM | €4,000 | 5–90 days | any eligible member; host in a **different country** | CV; confirmation from the host |
| Virtual Mobility Grant | €1,500 | 1–90 days | any eligible member; not for leadership-role tasks | CV; letter from the collaborating organisation if a third party is involved |
| ITC Conference Grant | €2,500 in person, €500 online | 1–14 days | institution in an ITC or Near Neighbour Country; oral only | CV; acceptance or invitation letter |
| YRI Conference Grant | €2,500 in person, €500 online | 1–14 days | under 40; poster or oral | CV; acceptance or invitation letter |
| Dissemination Conference Grant | €2,500 in person, €500 online | 1–14 days | any eligible member presenting EEG101's work; oral only | CV; acceptance or invitation letter |

In addition:
- the applicant must be an EEG101 member;
- an STSM host, or a VMG third-party lead, must also be a member;
- a conference must be organised entirely by others, not by EEG101 or
  another COST Action, and the applicant says whether they attend face to
  face or online (which sets the maximum and the budget categories);
- activities must start after the day of application and end by
  **`period_end`** (30 September 2027 unless changed in Settings), so within
  one grant period;
- the costed budget may not exceed the maximum, and every line needs a
  description. There are no salary or employment-cost categories;
- a written justification of costs is required;
- uploads must be PDFs of at most 5 MB;
- every scheme asks for the applicant's contribution to EEG101 to date,
  which reviewers score as one of the criteria;
- applicants do not apply in e-COST at this stage. Only those whose
  application is accepted are asked to apply through e-COST afterwards, with
  their CV in their e-COST profile (COST requires this before it issues the
  grant letter). Applicants declare they will do so if accepted.

Flagged for reviewers, not blocked ("Eligibility notes" and the ⚠ lines on
the dashboard):
- an institution outside COST Full and Cooperating Members and Near
  Neighbour Countries (COST grants are normally not available there);
- an abstract not yet accepted;
- two applications by the same person with overlapping dates, or for two
  different types of conference grant, in the same call. COST allows neither,
  so fund at most one. A flag disappears once the other application is set
  to *Not funded* or *Withdrawn*.

The proposal questions follow the e-COST templates for each scheme: for
example, conference grants ask about the relevance of the conference and the
benefit to the applicant's career, and Dissemination grants about the
Science Communication Plan.

The limits, questions and country lists (`ITC_COUNTRIES`, `COST_MEMBERS`,
`NNC_COUNTRIES`) live at the top of `Code.gs`. The limits match
`_data/grants.yml` (the Grants page), so change both together. Check the
country lists against cost.eu when a call opens.

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
6. **Deploy → New deployment → ⚙ Web app**. Description *Grants*, **Execute
   as: Me**, **Who has access: Anyone**. Click **Deploy** and copy the **Web
   app URL** (it ends in `/exec`).
7. In the spreadsheet's **Settings** tab, paste that URL into `web_app_url`.
8. Put the same URL into `_data/site.yml` as `grants_application_endpoint`
   (or send it to the website admin). The /grants/apply/ page then shows the
   form.

When `Code.gs`, `Apply.html` or `Review.html` change later, paste the new
versions in and save. Then go to **Deploy → Manage deployments**, select the
deployment, click ✏️, set **Version: New version** and click **Deploy**. This
keeps the web address. Then run **setUpGrants** once more. It adds any new
settings and columns and leaves everything else as it is.

If you set the platform up with an earlier version, you may have a second
deployment called *Review*. You can archive it, since the review page now
comes from the main deployment. Run **setUpGrants**, fill in `web_app_url`,
and send everyone their link (below).

## Reviewers and chairs

In most calls the chairs are also the reviewers, so decisions can be quick:
a chair scores an application and records the decision on the same page.

1. In the spreadsheet's **Reviewers** tab, list each person's email, their
   name, and `reviewer` or `chair`. You are added as chair during setup.
2. In the Apps Script editor, run **sendReviewerLinks**. It emails everyone
   on the list who has not had a link yet their **personal link** to the
   review page, and records the date in *Link sent*. Run
   **showReviewerLinks** to see the links in the log without emailing them,
   for example to open your own.
3. Reviewers need no Google access to the spreadsheet or folder. The page
   runs as the owner and shows each person only what they may see.

To remove someone, delete their row; their link stops working at once. To
replace a link that was shared by mistake, clear their *Personal key* and
*Link sent* cells and run **sendReviewerLinks** again. Chairs who also want
the spreadsheet and Drive folder can be given access with
**shareWithChairs**.

**Blind review.** With `blind_review` set to `TRUE` (the default), reviewers
who are not chairs do not see who applied. They see the proposal, budget,
dates, country, ITC, under-40 and career stage, but not the applicant's name,
email, institution, ORCID, gender, signature or uploaded documents (CVs and
letters name people). They do not get the Reports tab either. Set
`blind_review` to `FALSE` to show reviewers everything. **Chairs always see
everything**, including every score as soon as it is given, so they can
decide without waiting.

**What everyone sees:** the applications and a scoring form:
- five criteria, each scored 1–5: quality, contribution to EEG101 to date,
  relevance, feasibility and value for money, and benefit;
- a recommendation;
- comments;
- a conflict-of-interest box, with the situations from the COST rules
  (same research unit, close relationship, professional dependence or
  competition, close cooperation such as joint publications, benefiting from
  the grant). Ticking it means that person doesn't score that application,
  sees none of its reviews, and, if a chair, cannot decide on it.

A reviewer sees other reviewers' scores only after scoring the application
themselves. Nobody can review, see the scores of, or decide on their own
application.

**What chairs also see:**
- **Documents:** the application PDF and the uploaded documents, as
  downloads, plus the Drive folder link.
- **Decision on the application page:** Funded, Reserve, Not funded or
  Withdrawn, the amount awarded (it defaults to the amount requested and may
  not exceed it), rank and notes.
- **Ranking and funding:** applications per scheme with their mean scores. A
  button ranks them by score; the order can then be adjusted by hand, and
  decisions made for many at once.
- **Budget tracker:** money committed per scheme against the amounts set in
  the Settings tab (`budget_stsm`, `budget_itc_conference` and so on).
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
4. After the deadline, reviewers score and the chairs record decisions. Then
   email applicants; the platform does not send decision emails. Funded
   applicants are then asked to apply through e-COST, where the
   application is approved and the grant letter issued. Grants are paid after
   the activity, once the grantee's report is approved. The one exception:
   an STSM grantee may ask the Grant Holder for up to 50% in advance once
   the grant is approved, if funds allow and the Grant Holder agrees.
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
- **A reviewer sees "This page is for EEG101 grant reviewers":** their link
  is wrong or no longer valid (their row was deleted or their key cleared).
  Run **showReviewerLinks** and send them the link from the log.
- **`sendReviewerLinks` says to fill in `web_app_url`:** paste the
  deployment's address (ending in `/exec`) into the Settings tab.
- **To correct an application:** edit its row in the spreadsheet. The PDF in
  the folder is what the applicant submitted, and stays as the record.

## Testing changes

`node scripts/google-apps-script/grants/test/run.cjs` runs the server code
against an in-memory stand-in for Google (Sheets, Drive, Gmail):
submissions, every rule, uploads, emails, review, ranking and reports. Run it
after any change to `Code.gs`.
