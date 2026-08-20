# EEG101 Members: paste and publish workflow

The public Members map and directory are updated from the private **EEG101 Members: eCOST Export** workbook. The visible website data is generated from the raw eCOST export. Organisers should not edit `assets/data/network-map.json` directly.

## Routine update

Export the detailed Working Group membership CSV from eCOST. In the workbook, open **Raw eCOST export**, select the existing used range, and paste the complete new export into cell A1, retaining its original header row and columns. The workflow ignores additional eCOST columns and requires the fields `first name`, `last name`, `email`, `affiliation`, `country`, and a Working Group assignment field.

Select **EEG101 Members → Validate and publish**. The action blocks incomplete or unexpectedly small exports. It maps member records to existing reviewed institution locations first. A new institution is geocoded using its affiliation and country. When no reliable institution result is returned, the action uses a country-level fallback and logs it as provisional for later review. It then commits the regenerated public dataset to the website repository, which triggers the established GitHub Pages deployment.

## One-time Apps Script configuration

Open the private workbook and select **Extensions → Apps Script**. Replace `Code.gs` with `scripts/google-apps-script/members-publish.gs` from the website repository. In **Project Settings → Script properties**, add `EEG101_GITHUB_TOKEN`, containing a fine-grained GitHub personal access token that has **Contents: Read and write** access only to `eeg101-costaction/website`. Do not place this token in the Sheet or the website repository.

On the next spreadsheet refresh, the **EEG101 Members** menu appears. A successful publication gives the GitHub commit identifier and a row in the **Publishing log** tab. The public site usually updates after the GitHub Pages deployment finishes.

## Location cache and review

The **Location cache** tab is an automatic support layer. It stores current reviewed institution coordinates and any new results found during publishing. Country-level provisional records mean the country is represented on the map, but the institution should receive a more precise placement when convenient. The raw export remains unchanged throughout this process.
