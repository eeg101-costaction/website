# eCOST Network Map synchronisation

This workflow keeps the public EEG101 Network Map aligned with the detailed Working Group member export from eCOST. It runs every Monday morning and can also be started manually from the repository's **Actions** page.

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

When the validated export changes the map data, the workflow creates or updates a pull request titled **Update Network Map from eCOST membership export**. Merging that pull request publishes the update through the normal GitHub Pages deployment. If nothing has changed, no pull request is created.

## Manual run and review

Open the repository's **Actions** tab, select **Sync eCOST membership to Network Map**, and choose **Run workflow**. After it completes, inspect the generated pull request and merge it only if the member count, institutional groupings, and changed map entries look appropriate.

If eCOST changes its login page or export control, the export step fails without changing the public map. Update `scripts/ecost_export.py` to match the revised interface, then run the workflow manually to confirm the repair.
