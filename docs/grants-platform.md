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
   `GRANTS_BCC` = the addresses to blind-copy on every confirmation,
   separated by commas (Amy Bland's and yours).
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
  **Funded grants**, **People**, **Call settings** and **Reports**.
- **Reviewers** see Applications (only those assigned to them), plus Reports
  when review is not blind.
- **The grants administrator** sees **Funded grants** and **Reports** only.
  They do not review, and see only funded applications.

In most calls the chairs are also the reviewers, so decisions can be quick:
a chair scores an application and records the decision on the same page.

**Adding people (People tab).** Enter a name and email, choose
*Reviewer*, *Chair* or *Grants administrator*, and click **Add**. With "Email them their link now"
ticked, they get their **personal link** straight away. No password or
Google account is needed. The table shows who has been invited and, for
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

**Blind review.** With **Blind review** ticked in Call settings (the default), reviewers
who are not chairs do not see who applied. They see the proposal, budget,
dates, country, ITC, under-40 and career stage, but not the applicant's name,
email, institution, ORCID, gender, signature or uploaded documents (CVs and
letters name people). They do not get the Reports tab either. Untick it to
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
  the amounts set in **Call settings**.
- **Reports:** totals, then breakdowns by scheme (against budget), by start
  month, gender, ITC, under-40, career stage and country. Also a list of
  funded grants with a CSV download, and **Print or save as PDF**.

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

## Running a call

All of this is in the portal's **Call settings** tab. No code or
spreadsheet changes are needed.

1. Set the name of the call (shown on the form and in emails), the deadline
   (Brussels time), the date activities must end by (the end of the grant
   period), the **schemes in this call**, and optionally the money available
   per scheme.
2. Tick **Accepting applications** and save. The form opens at once, offering
   only the schemes in the call. It closes by itself at the deadline, or when
   you untick it.
3. The website follows by itself. While the call is open, the Grants page
   shows its schemes as "Open now", with the deadline and an **Apply now**
   button linking to the form with that scheme already chosen. When the call
   closes, they show as closed again. Nothing in the site needs editing.
   (`_data/grants.yml` still holds each scheme's description, and the status
   shown if the platform cannot be reached.) Announce the call as usual, for
   example as an event or a calendar date in the website editor.
4. Assign reviewers to the applications. After the deadline,
   reviewers score and the chairs record decisions. Then email applicants;
   the platform does not send decision emails. Funded applicants are then
   asked to apply through e-COST (track this, and send reminders, on Funded
   grants), where the application is approved and the
   grant letter issued. Grants are paid after the activity, once the
   grantee's report is approved. The one exception: an STSM grantee may ask
   the Grant Holder for up to 50% in advance once the grant is approved, if
   funds allow and the Grant Holder agrees.
5. For the next call, change the ID prefix (e.g. `G3`), the name and the
   dates, and tick Accepting applications again. Earlier applications are
   kept.

**The industry STSM call** is a call of its own. In Call settings choose
only *Industry STSM* as the scheme, give it its own name and ID prefix
(e.g. `IND1`), set its dates, and open it. It works like an STSM, but the
host must be an industry organisation, the applicant says what kind
(large company, SME, start-up or other), and one proposal question asks
about the benefit to academia–industry collaboration. Applications go
through the same review, funding and Funded grants pages, listed as
*Industry STSM*. Only one call runs at a time, so run the industry call
before or after the main call, not alongside it.

## If something goes wrong

- **An applicant says the form will not submit:** the message above the
  form says why, for example a date after `period_end` or a budget over the
  maximum. If it says the call is closed, check Call settings.
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
