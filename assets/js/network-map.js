(() => {
  'use strict';

  const page = document.querySelector('.network-map-page');
  if (!page || typeof L === 'undefined') return;

  const mapElement = document.getElementById('network-map');
  const panel = document.getElementById('network-map-panel');
  const summary = document.getElementById('network-map-summary');
  const searchInput = document.getElementById('network-map-search');
  const countrySelect = document.getElementById('network-map-country');
  const resetButton = document.getElementById('network-map-reset');
  const dataUrl = page.dataset.mapUrl;
  const pendingUrl = page.dataset.pendingUrl;
  const directorySearchInput = document.getElementById('member-directory-search');
  const directoryWGSelect = document.getElementById('member-directory-wg');
  const directoryCountrySelect = document.getElementById('member-directory-country');
  const directoryResetButton = document.getElementById('member-directory-reset');
  const directoryResults = document.getElementById('member-directory-results');
  const directorySummary = document.getElementById('member-directory-summary');

  const escapeHTML = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const safeExternalLinks = (value, label) => String(value || '')
    .split(/\s*;\s*/)
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url, index, urls) => {
      const linkLabel = urls.length > 1 ? `${label} ${index + 1}` : label;
      return `<a class="network-map__external-link" href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(linkLabel)}</a>`;
    })
    .join('');

  const map = L.map(mapElement, {
    scrollWheelZoom: false,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 16
  }).setView([42, 15], 3);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  }).addTo(map);

  const createClusterIcon = (cluster) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<span>${count}</span>`,
      className: 'network-map-cluster',
      iconSize: L.point(42, 42)
    });
  };

  const markerCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 48,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: createClusterIcon
  }).addTo(map);

  const createMarkerIcon = (site) => L.divIcon({
    html: `<span class="network-map-marker__count">${site.member_count}</span>`,
    className: 'network-map-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });

  let allSites = [];
  let allMembers = [];       // members with a map location
  let pendingMembers = [];   // members whose institution could not be resolved (Option A)
  let directoryLimit = 60;
  let markers = new Map();

  const renderEmptyPanel = (message = 'Choose an institution marker or use the search and country controls to find members across EEG101.') => {
    panel.innerHTML = `
      <div class="network-map__panel-empty">
        <span class="network-map__panel-kicker">Explore the network</span>
        <h2>Select a marker</h2>
        <p>${escapeHTML(message)}</p>
      </div>`;
  };

  const renderSite = (site) => {
    const workingGroups = site.working_groups.length
      ? site.working_groups.map((group) => `<span class="network-map__tag">${escapeHTML(group)}</span>`).join('')
      : '<span class="network-map__tag network-map__tag--muted">No WG listed</span>';

    const members = site.members.map((member) => {
      const memberTags = member.working_groups.length
        ? `<div class="network-map__member-tags">${member.working_groups.map((group) => `<span>${escapeHTML(group)}</span>`).join('')}</div>`
        : '';
      const contact = member.email
        ? `<span class="network-map__email">${escapeHTML(member.email)}</span>`
        : '';
      const links = [
        safeExternalLinks(member.homepage, 'Profile'),
        safeExternalLinks(member.orcid, 'ORCID')
      ].filter(Boolean).join('');
      const linkBlock = links ? `<div class="network-map__member-links">${links}</div>` : '';
      return `
        <article class="network-map__member">
          <h3>${escapeHTML(member.name)}</h3>
          ${member.affiliation && member.affiliation !== site.institution ? `<p class="network-map__member-affiliation">${escapeHTML(member.affiliation)}</p>` : ''}
          ${memberTags}
          ${contact}${linkBlock}
        </article>`;
    }).join('');

    panel.innerHTML = `
      <div class="network-map__panel-header">
        <span class="network-map__panel-kicker">${escapeHTML(site.city)}, ${escapeHTML(site.country)}</span>
        <h2>${escapeHTML(site.institution)}</h2>
        <p>${site.member_count} ${site.member_count === 1 ? 'member' : 'members'} at this site</p>
        <div class="network-map__tags">${workingGroups}</div>
      </div>
      <div class="network-map__members">${members}</div>`;
    panel.scrollTop = 0;
  };

  const markerMatches = (site, query, country) => {
    const haystack = [
      site.institution, site.city, site.country,
      ...site.members.flatMap((member) => [member.name, member.affiliation, member.expertise, member.working_groups.join(' ')])
    ].join(' ').toLowerCase();
    return (!country || site.country === country) && (!query || haystack.includes(query));
  };

  const updateVisibleSites = () => {
    const query = searchInput.value.trim().toLowerCase();
    const country = countrySelect.value;
    const visibleSites = allSites.filter((site) => markerMatches(site, query, country));
    markerCluster.clearLayers();
    visibleSites.forEach((site) => markerCluster.addLayer(markers.get(site.id)));

    if (visibleSites.length) {
      const bounds = L.latLngBounds(visibleSites.map((site) => [site.latitude, site.longitude]));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: visibleSites.length === 1 ? 11 : 6 });
      summary.textContent = `Showing ${visibleSites.length} ${visibleSites.length === 1 ? 'institution' : 'institutions'} and ${visibleSites.reduce((total, site) => total + site.member_count, 0)} members.`;
    } else {
      summary.textContent = 'No institutions match the current search or country filter.';
      renderEmptyPanel('No institutions match the current search or country filter. Try clearing the search or selecting a different country.');
    }
  };

  const resetMap = () => {
    searchInput.value = '';
    countrySelect.value = '';
    markerCluster.clearLayers();
    allSites.forEach((site) => markerCluster.addLayer(markers.get(site.id)));
    const bounds = L.latLngBounds(allSites.map((site) => [site.latitude, site.longitude]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 5 });
    summary.textContent = `Showing ${allSites.length} institutions across ${new Set(allSites.map((site) => site.country)).size} countries.`;
    renderEmptyPanel();
  };

  const memberMatches = (member, query, workingGroup, country) => {
    const haystack = [
      member.name, member.affiliation, member.institution, member.city, member.country,
      (member.working_groups || []).join(' '), member.homepage, member.orcid
    ].join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (!workingGroup || (member.working_groups || []).includes(workingGroup))
      && (!country || member.country === country);
  };

  const viewSiteOnMap = (siteId) => {
    const site = allSites.find((candidate) => candidate.id === siteId);
    if (!site) return;
    map.setView([site.latitude, site.longitude], 9, { animate: true });
    renderSite(site);
    document.getElementById('network-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderMemberCard = (member) => {
    const tags = (member.working_groups || []).length
      ? member.working_groups.map((group) => `<span class="member-directory__tag">${escapeHTML(group)}</span>`).join('')
      : '<span class="member-directory__tag member-directory__tag--muted">No WG listed</span>';
    const links = [safeExternalLinks(member.homepage, 'Profile'), safeExternalLinks(member.orcid, 'ORCID')].filter(Boolean).join('');
    const location = member.country + (member.city ? ` · ${member.city}` : '');

    // Option A: pending members get a "Location pending" badge instead of a map button.
    const action = member.pending
      ? `<span class="member-directory__pending-badge">Location pending</span>`
      : `<button type="button" class="member-directory__map-link" data-directory-site="${escapeHTML(member.site_id)}">View institution on map</button>`;

    return `<article class="member-directory__card${member.pending ? ' member-directory__card--pending' : ''}">
      <h3>${escapeHTML(member.name)}</h3>
      <p class="member-directory__affiliation">${escapeHTML(member.affiliation || member.institution)}</p>
      <p class="member-directory__location">${escapeHTML(location)}</p>
      <div class="member-directory__tags">${tags}</div>
      ${member.email ? `<span class="member-directory__email">${escapeHTML(member.email)}</span>` : ''}
      ${links ? `<div class="member-directory__links">${links}</div>` : ''}
      ${action}
    </article>`;
  };

  const renderDirectory = () => {
    if (!directoryResults) return;
    const query = directorySearchInput.value.trim().toLowerCase();
    const workingGroup = directoryWGSelect.value;
    const country = directoryCountrySelect.value;
    const hasActiveDirectoryFilter = Boolean(query || workingGroup || country);

    if (!hasActiveDirectoryFilter) {
      directorySummary.textContent = 'Search or choose a Working Group or country to find members.';
      directoryResults.innerHTML = '<p class="member-directory__empty">Start with a name, institution, country, or Working Group to explore the EEG101 network.</p>';
      return;
    }

    // Combine resolved members and pending members; pending come after resolved.
    const combinedMembers = [
      ...allMembers.filter((m) => memberMatches(m, query, workingGroup, country)),
      ...pendingMembers.filter((m) => memberMatches(m, query, workingGroup, country)),
    ];
    const shownMembers = combinedMembers.slice(0, directoryLimit);

    const matchingLabel = combinedMembers.length === (allMembers.length + pendingMembers.length)
      ? `${combinedMembers.length} members`
      : `${combinedMembers.length} matching ${combinedMembers.length === 1 ? 'member' : 'members'}`;

    const pendingInResults = shownMembers.filter((m) => m.pending).length;
    let summaryText = combinedMembers.length > directoryLimit
      ? `Showing the first ${directoryLimit} of ${matchingLabel}.`
      : `Showing ${matchingLabel}.`;
    if (pendingInResults > 0) {
      summaryText += ` ${pendingInResults} ${pendingInResults === 1 ? 'member has' : 'members have'} a location pending verification.`;
    }
    directorySummary.textContent = summaryText;

    if (!combinedMembers.length) {
      directoryResults.innerHTML = '<p class="member-directory__empty">No members match the current search and filters. Try clearing a filter or using a broader search term.</p>';
      return;
    }

    directoryResults.innerHTML = `
      <div class="member-directory__grid">
        ${shownMembers.map(renderMemberCard).join('')}
      </div>
      ${combinedMembers.length > directoryLimit ? `<div class="member-directory__more"><button type="button" class="btn btn-outline-primary" id="member-directory-more">Show more members</button></div>` : ''}`;

    directoryResults.querySelectorAll('[data-directory-site]').forEach((button) => {
      button.addEventListener('click', () => viewSiteOnMap(button.dataset.directorySite));
    });
    const moreButton = document.getElementById('member-directory-more');
    if (moreButton) moreButton.addEventListener('click', () => { directoryLimit += 60; renderDirectory(); });
  };

  const resetDirectory = () => {
    directorySearchInput.value = '';
    directoryWGSelect.value = '';
    directoryCountrySelect.value = '';
    directoryLimit = 60;
    renderDirectory();
  };

  // Load both data files in parallel.
  const mapFetch = fetch(dataUrl).then((r) => { if (!r.ok) throw new Error('Map data unavailable.'); return r.json(); });
  const pendingFetch = pendingUrl
    ? fetch(pendingUrl).then((r) => r.ok ? r.json() : { members: [] }).catch(() => ({ members: [] }))
    : Promise.resolve({ members: [] });

  Promise.all([mapFetch, pendingFetch])
    .then(([data, pendingData]) => {
      allSites = data.sites || [];

      allMembers = allSites.flatMap((site) => site.members.map((member) => ({
        ...member,
        site_id: site.id,
        institution: site.institution,
        city: site.city,
        country: site.country,
        pending: false,
      }))).sort((a, b) => a.name.localeCompare(b.name));

      // Option A: pending members shown in directory but not on the map.
      pendingMembers = (pendingData.members || []).map((member) => ({
        ...member,
        site_id: null,
        institution: member.affiliation,
        city: '',
        pending: true,
      })).sort((a, b) => a.name.localeCompare(b.name));

      // Populate map country filter (map only uses resolved sites).
      data.countries.forEach((country) => {
        const option = document.createElement('option');
        option.value = country.name;
        option.textContent = `${country.name} (${country.member_count})`;
        countrySelect.appendChild(option);
      });

      // Populate directory WG filter from all members including pending.
      [...new Set([...allMembers, ...pendingMembers].flatMap((m) => m.working_groups || []))].sort().forEach((wg) => {
        const option = document.createElement('option');
        option.value = wg;
        option.textContent = wg;
        directoryWGSelect.appendChild(option);
      });

      // Populate directory country filter from all members including pending.
      const allCountries = [...new Set([
        ...data.countries.map((c) => c.name),
        ...pendingMembers.map((m) => m.country),
      ])].sort();
      allCountries.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        directoryCountrySelect.appendChild(option);
      });

      allSites.forEach((site) => {
        const marker = L.marker([site.latitude, site.longitude], { icon: createMarkerIcon(site), title: site.institution });
        marker.bindTooltip(`${site.institution} · ${site.member_count} ${site.member_count === 1 ? 'member' : 'members'}`, { direction: 'top', offset: [0, -16] });
        marker.on('click', () => renderSite(site));
        markers.set(site.id, marker);
        markerCluster.addLayer(marker);
      });

      const pendingNote = pendingMembers.length
        ? ` ${pendingMembers.length} member${pendingMembers.length === 1 ? "'s" : "s'"} institution location is pending verification.`
        : '';
      summary.textContent = `Showing ${data.site_count} institutions and ${data.member_count} members across ${data.country_count} countries.${pendingNote}`;

      const bounds = L.latLngBounds(allSites.map((site) => [site.latitude, site.longitude]));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 5 });
      window.setTimeout(() => map.invalidateSize(), 100);
      renderDirectory();
    })
    .catch((error) => {
      summary.textContent = 'The map data is temporarily unavailable.';
      renderEmptyPanel('The interactive map could not be loaded. Please refresh the page or visit the Team page to browse current profiles.');
      console.error(error);
    });

  searchInput.addEventListener('input', updateVisibleSites);
  countrySelect.addEventListener('change', updateVisibleSites);
  resetButton.addEventListener('click', resetMap);
  directorySearchInput.addEventListener('input', () => { directoryLimit = 60; renderDirectory(); });
  directoryWGSelect.addEventListener('change', () => { directoryLimit = 60; renderDirectory(); });
  directoryCountrySelect.addEventListener('change', () => { directoryLimit = 60; renderDirectory(); });
  directoryResetButton.addEventListener('click', resetDirectory);
})();
