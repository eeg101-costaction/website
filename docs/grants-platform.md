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
  - a confirmation email to the applicant, with the PDF attached. Nobody
    is copied in: a free Gmail account can email only about 100 people a
    day. Instead, the addresses in the `GRANTS_BCC` script property get a
    **daily digest** at about 08:00 Brussels time, listing the applications
    received since the last one, with their PDFs when there are up to 10. No
    digest is sent on a day with none. Every email the platform sends is
    also in the EEG101 account's Sent folder;
  - on screen, the reference and a PDF download. The PDF is headed with
    EEG101, COST Action CA24148 and the call.

  Before applying, people can download a **Word template** for each scheme
  in each call (the link on its card in the form). It has every question,
  word limit, budget rule and document, including the call's own questions,
  so they can prepare offline and then paste their answers into the form.
  STSM applicants also get a Word template for their host's confirmation
  letter (`assets/docs/eeg101-stsm-host-confirmation-template.docx`, made by
  `scripts/make_host_confirmation_template.py`). COST's own template is only
  in e-COST, which applicants reach once accepted.
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
| Industry STSM (special call) | €4,000 | 5–90 days | as STSM, with a company, SME, start-up or other industry host | CV; confirmation from the host organisation |
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
   `GRANTS_BCC` = the addresses that get the daily digest of new
   applications, separated by commas (Amy Bland's and yours).
6. **Deploy → New deployment → ⚙ Web app**. Description *Grants*, **Execute
   as: Me**, **Who has access: Anyone**. Click **Deploy** and copy the **Web
   app URL** (it ends in `/exec`).
7. Open that URL once in your browser. It shows the application form, and
   the app remembers its own address, which it needs for portal links. Then
   run **showReviewerLinks** in the editor. The log shows your personal link
   to the **grants portal**; bookmark it. Add everyone else from the portal.
8. Put the same URL into `_data/site.yml` as `grants_application_endpoint`
   (or send it to the website admin). The /grants/apply/ page then shows the
   form.

When `Code.gs`, `Apply.html` or `Review.html` change later, paste the new
versions in and save. Then go to **Deploy → Manage deployments**, select the
deployment, click ✏️, set **Version: New version** and click **Deploy**. This
keeps the web address. Then run **setUpGrants** once more. It adds any new
settings and columns and leaves everything else as it is.

If you set the platform up with an earlier version, you may have a second
deployment called *Review*. You can archive it, since the portal now comes
from the main deployment. Run **setUpGrants**, then add and invite people
from the portal (below).

## The grants portal: reviewers, chairs and assignments

Everything is managed in the portal, not the spreadsheet. The spreadsheet
only stores the data, and is the backup. There are three roles:
- **Chairs** see these tabs: **Applications**, **Ranking and funding**,
  **Funded grants**, **People**, **Calls** and **Reports**.
- **Reviewers** see Applications (only those assigned to them), plus Reports
  when review is not blind.
- **The grants administrator** sees **Funded grants** and **Reports** only.
  They do not review, and see only funded applications.

In most calls the chairs are also the reviewers, so decisions can be quick:
a chair scores an application and records the decision on the same page.

**Adding people (People tab).** Enter a name and email, choose
*Reviewer*, *Chair* or *Grants administrator*, and click **Add**. With "Email them their link now"
ticked, they get their **personal link** straight away. No password or
Google account is needed. Anyone who loses their link can get it again from
**www.eeg101.eu/grants/portal/** (linked at the foot of the Grants page): it
emails the link to listed people only, at most once every 10 minutes, and
says the same thing whatever address is entered. The table shows who has been invited and, for
each person, how many assigned applications they have done, how many they
have scored, and how many conflicts they have declared. From the table you
can:
- change someone's role;
- **Resend link**;
- **New link**, which stops the old link working, e.g. if it was forwarded;
- **Remove**, which stops their link at once and takes them off their
  assignments. Their reviews so far are kept.

You cannot remove yourself or your own chair role; another chair can.

**Assigning reviewers (Applications tab).** Reviewers see only the
applications assigned to them; an application with no reviewers assigned is
seen by the chairs alone. So assign every application that needs reviewing
beyond the chairs. Two ways to assign:
- **In bulk:** tick applications in the list, tick reviewers in the yellow
  bar, then **Assign** or **Unassign**.
- **One at a time:** on an application's page, under *Reviewers for this
  application*.

With "Email them" ticked, each newly assigned reviewer gets one email
listing their new applications. The *Reviewers* column shows each
assignee's progress: ○ to score, ✓ scored, ✕ conflict. Use the "No
reviewers assigned" filter to find gaps. Applicants are never assigned
their own application.

From the Apps Script editor, **showReviewerLinks** logs everyone's link,
including your own. **shareWithChairs** gives the chairs the spreadsheet and
Drive folder too, if they want them.

**Blind review** is set for each call, in its settings on the Calls page,
and is on by default for a new call. With it on, reviewers
who are not chairs do not see who applied. They see the proposal, budget,
dates, country, ITC, under-40 and career stage, but not the applicant's name,
email, institution, ORCID, gender, signature or uploaded documents (CVs and
letters name people). While any call is blind, they do not get the Reports tab. Untick it to
show reviewers everything. **Chairs always see
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
  the amounts set on the **Calls** page (per call or per scheme).
- **Reports:** totals, then breakdowns by scheme (against budget), by start
  month, gender, ITC, under-40, career stage and country. Also a list of
  funded grants with a CSV download, and **Print or save as PDF**.

## Decision emails

Once a decision is saved (Funded, Reserve or Not funded), a chair emails it
to the applicant from the portal. It is sent from the EEG101 account, using
the template for that decision:
- **Funded:** the amount, then what happens next: apply in e-COST with the
  same details (and the CV in the e-COST profile), carry out the activity
  and acknowledge COST, and the report due date (that the grant is paid
  after the report is approved). Conference grants also get the attendance
  documents.
- **Reserve:** fundable but the budget is committed. We will be in touch if
  funds become available. Do not apply in e-COST yet.
- **Not funded:** not selected this time, with an invitation to apply again.

There are two ways to send them:
- **One at a time,** from the application's page (**Decision email**): add
  an optional personal note, **Preview**, then **Send**.
- **All at once,** from **Ranking and funding** → **Email N decisions**. It
  sends every decision not yet emailed, or changed since it was, using the
  plain templates.

Each email is recorded (when, by whom, and as which decision), and shows as
✓ in the Emailed column. A chair with a conflict of interest, or who
applied, cannot send that one. Sending stops before the account's daily
email allowance runs out, and says which emails to send again the next day.

## Funded grants: from decision to payment

As soon as a chair marks an application **Funded**, it leaves the
Applications list and appears on **Funded grants**. Chairs and the grants
administrator both work here. For each grant the page shows:
- the grantee and their email;
- the scheme and the amount awarded;
- the activity dates, and whether it has started or finished;
- the **report due date**: 30 days after the activity ends, or 15 days after
  the end of the grant period if sooner. It is marked "N days overdue" when
  late.

**Status**, set by hand from a drop-down as the grant moves on: *Awaiting
e-COST application* (the starting point), *Grant letter issued*, *Activity
under way*, *Report due*, *Report submitted in e-COST*, *Report approved*,
*Paid*, *Cancelled*. Each change records who made it and when. The page
cannot see e-COST itself, so whoever checks e-COST updates the status here.
There is also a notes box per grant.

**Reminders.** Click **Send reminder** on a grant, or tick several and use
**Email reminder to selected**. The email depends on the status:
- *Awaiting e-COST application*: it asks them to apply through e-COST, with
  their CV in their e-COST profile.
- Otherwise: it asks them to submit their report in e-COST by the due date
  (with the certificate and programme for conference grants).

Grants whose report is in, or that are paid or cancelled, are skipped.
Reminders are copied to the EEG101 address, and the page shows how many have
been sent and when.

The filter at the top shows the grants still open (the default), reports
overdue, those awaiting an e-COST application, those done, or all of them.
The cards count each group.

## Running calls

Calls are managed on the portal's **Calls** page. Any number can be open at
once, each with its own:
- name;
- schemes;
- deadline (Brussels time);
- end date for activities (the end of its grant period);
- ID prefix (e.g. `G2` gives EEG101-G2-001);
- optional budget.

The first call, the main one, is made during setup.

1. **New call**, or **Edit** on an existing one. Fill in the details, tick
   the schemes, and tick **Accepting applications** to open it. It closes by
   itself at its deadline, or when you untick it.
2. **A company call** (e.g. an Industry STSM with one company) can also:
   - **fix the host**: organisation, and optionally country, type and named
     lead. Applicants see these filled in and cannot change them;
   - add **its own questions** (with help text, a word limit, required or
     optional), asked after the scheme's questions;
   - add **its own documents** to upload (e.g. a signed NDA).

   Each company can have different questions and timelines. Make one call
   per company.
3. **The website follows by itself.** The Grants page shows every scheme in
   an open call as "Open now", with an **Apply now** button. A scheme that
   several calls offer lists each call with its deadline, e.g. "Industry
   STSM: NeuroTech GmbH: closes 28 February; Industry STSM: BrainCo: closes
   31 March". `_data/grants.yml` still holds each scheme's description, and
   the status shown if the platform cannot be reached.
4. **On the form**, applicants choose the call and scheme. **Copy form link**
   on the Calls page gives a link that opens one call only, to send to a
   company's contacts.
5. Review, ranking, Funded grants and reports work across calls. Ranking has
   one table per call and scheme, and can be filtered by call. Report due
   dates use each call's own end date. Overlapping grants are flagged
   across all calls.
6. After the deadline, reviewers score and the chairs record decisions. Then
   **email the decisions from the portal** (below). Funded
   applicants are then asked to apply through e-COST (track this, and send
   reminders, on Funded grants), where the application is approved and the
   grant letter issued. Grants are paid after the activity, once the
   grantee's report is approved; there are no advance payments.

A call with applications keeps its ID prefix and cannot be deleted, only
closed. **For all calls**, at the bottom of the Calls page, sets the money
available per scheme.

## Spam protection

Always on, with nothing to set up:
- a hidden form field that people never see but spam robots fill in;
- a minimum of 20 seconds between opening the form and submitting it;
- at most 3 applications an hour from one email address, 60 an hour in
  all, and 150 file uploads an hour (limits in `LIMITS` in `Code.gs`).

**The CAPTCHA (optional, recommended once calls are public).** It uses
Cloudflare Turnstile: free, and usually invisible. Most people see nothing; a
few are asked to tick a box below the form when they submit. It runs on
www.eeg101.eu/grants/apply/, so once it is on, applications must come through
that page. The portal's **Copy form link** already points there. To switch it
on (10 minutes):

1. Create a free account at **dash.cloudflare.com**, then go to **Turnstile →
   Add widget**. Name it *EEG101 grants*, add the hostname **www.eeg101.eu**,
   choose **Managed**, and create it.
2. Copy the **Site key** (public) and send it to the website admin, or put it
   in `_data/site.yml` as `grants_turnstile_site_key`.
3. Copy the **Secret key**. In the Apps Script project go to **Project
   Settings → Script properties → Add script property**: `TURNSTILE_SECRET` =
   the secret key. Never put it anywhere else.
4. Run **setUpGrants** once and **Allow** the new permission (connect to an
   external service: the script checks each token with Cloudflare).

Do steps 2 and 3 together. With the secret but no site key, the form cannot
get a token and every submission is refused. To switch it off, delete the
`TURNSTILE_SECRET` property.

## If something goes wrong

- **An applicant says the form will not submit:** the message above the
  form says why, for example a date after `period_end` or a budget over the
  maximum. If it says the call is closed, check the call on the Calls page.
- **No confirmation email arrived:** the application is still saved; the
  applicant is told so on screen and can download their copy. Look in the
  spreadsheet for their row. Emails come from the Gmail account that owns the
  script, so check its daily sending limit.
- **A reviewer sees "This page is for EEG101 grant reviewers":** their link
  is wrong or no longer valid (they were removed, or given a new link).
  Use **Resend link** on the Reviewers tab.
- **"The review links need the web app address":** open the deployed web
  app once, so it can remember its address, then try again.
- **A reviewer can't find an application:** it is assigned to other
  reviewers. Assign them on its page.
- **To correct an application:** edit its row in the spreadsheet. The PDF in
  the folder is what the applicant submitted, and stays as the record.

## Testing changes

`node scripts/google-apps-script/grants/test/run.cjs` runs the server code
against an in-memory stand-in for Google (Sheets, Drive, Gmail):
submissions, every rule, uploads, emails, review, ranking and reports. Run it
after any change to `Code.gs`.
