# eCOST Network Map synchronisation

This workflow keeps the public EEG101 Network Map aligned with the detailed Working Group member export from eCOST. It is scheduled daily at 05:17 UTC (GitHub often starts scheduled runs hours late, and occasionally twice) and can also be started manually from the repository's **Actions** page.

## One-time setup

Create two repository secrets in **Settings → Secrets and variables → Actions**. Use the eCOST account that is authorised to access the CA24148 Working Group Management export.

| Secret | Value |
|---|---|
| `ECOST_EMAIL` | The authorised eCOST account email address |
| `ECOST_PASSWORD` | The authorised eCOST account password |

The secrets are available only while the workflow runs. They are not committed to the repository, included in workflow logs, or written to the public website.

## What each run does

The workflow signs into eCOST, opens the CA24148 Working Group Management area, and downloads the detailed `.xlsx` export. It then validates the file before modifying any public data. The export must include first name, last name, email, affiliation, country, and Working Group assignment fields. It must also contain at least 70% of the current member count.

The generator rebuilds the map using the existing reviewed institution locations. It retains only the member name, affiliation, Working Group tags, obfuscated public email, homepage, and ORCID. Research-interest text, scientific background, motivation, contribution, gender, and other non-essential export fields are never included in the public dataset.

A member at a previously unreviewed institution causes the run to stop safely. The action log and `ecost-network-map-report` workflow artifact identify the unresolved institution so its city-level location can be reviewed before the map is changed.

When the validated export changes the map data, the workflow commits the update straight to `main` as **Synchronise Network Map from eCOST export**, and the normal GitHub Pages deployment publishes it. There is no pull request and no review step: a validated export goes live on its own. If something looks wrong afterwards, revert that commit.

The `generated_at` timestamps in `member-stats.json` and `pending-members.json` change on every run, so in practice there is a commit most days even when no member has changed.

## Manual run and review

Open the repository's **Actions** tab, select **Sync eCOST membership to Network Map**, and choose **Run workflow**. After it completes, look at the new commit on `main` and check that the member count, institutional groupings, and changed map entries look appropriate; revert it if they do not.

If eCOST changes its login page or export control, the export step fails without changing the public map. Update `scripts/ecost_export.py` to match the revised interface, then run the workflow manually to confirm the repair.

## If something else writes to `main` while the job runs

The job checks out the current `main` when it starts and pushes with `scripts/push_to_main.sh`. If `main` moves in between (the Framework sync, or a person), the script rebases onto it and tries again, up to five times. Each outcome is visible on the run page:

| What you see | What it means |
| --- | --- |
| Green, no annotation | Pushed on the first try. |
| Green, log says "lost a race ... Rebasing onto it" | `main` moved; it rebased and pushed. Nothing to do. |
| Green, **warning** "our changes conflict with ...", nothing pushed | Someone had already written newer data to the same file while the job ran, so theirs was kept. The next run reconciles. A warning that repeats every day means something is persistently editing the same lines; find out what. |
| **Red**, "not a race" or "other than a conflict" | The push or rebase failed for a different reason (credentials, a protected branch, a bug in the job). Read git's message above it. |
| **Red**, "was rewritten" | `main` was force-pushed while the job ran. It refuses to rebase onto rewritten history in case that re-publishes something that was rolled back. Check `main`, then re-run. |

Tests: `python3 -I scripts/test_push_to_main.py`.
