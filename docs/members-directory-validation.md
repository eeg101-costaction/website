# Members directory validation

The local Jekyll build completed successfully after the Members page directory was added below the map. The page loaded the map summary for 249 institutions, 376 members, and 51 countries, together with the directory search field, Working Group selector, country selector, and member-result cards.

The Working Group 2 filter reduced the directory to 309 matching members. A combined name search for Anne-Sophie Dubarry and the Working Group 2 filter then returned one matching member, with institution, country, Working Group tags, obfuscated contact information, and a control to return to the relevant map institution.

Selecting the member’s map control centred the map on Aix-Marseille Université and displayed its two affiliated EEG101 members in the map detail panel. The unfiltered directory renders an initial page of 60 results and accurately reports, “Showing the first 60 of 376 members”, with a progressive control for further results.

After restarting the local preview to refresh the cache-busted member-directory script, the page displayed the expected initial summary and the **Show more members** control was present after the first group of results.

The GitHub Pages deployment for the Members directory completed successfully. A live, cache-bypassed visit confirmed that the public page uses the **Members** label in navigation, loads the map for 249 institutions and 376 members, and populates the searchable directory with Working Group and country filters beneath the map.

The revised local directory now renders all 376 members by default, with the summary stating “Showing 376 members” and no progressive-result control until a directory filter is applied.

Applying the Working Group 2 filter reduced the directory to 309 matching members and correctly restored progressive paging, with the summary stating “Showing the first 60 of 309 matching members”.
