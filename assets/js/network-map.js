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

  const escapeHTML = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const safeExternalLink = (url, label) => {
    if (!/^https?:\/\//i.test(url || '')) return '';
    return `<a class="network-map__external-link" href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(label)}</a>`;
  };

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
      const expertise = member.expertise
        ? `<p class="network-map__member-expertise">${escapeHTML(member.expertise)}</p>`
        : '';
      const contact = member.email
        ? `<span class="network-map__email">${escapeHTML(member.email)}</span>`
        : '';
      const links = [
        safeExternalLink(member.homepage, 'Profile'),
        safeExternalLink(member.orcid, 'ORCID')
      ].filter(Boolean).join('');
      const linkBlock = links ? `<div class="network-map__member-links">${links}</div>` : '';
      return `
        <article class="network-map__member">
          <h3>${escapeHTML(member.name)}</h3>
          ${member.affiliation && member.affiliation !== site.institution ? `<p class="network-map__member-affiliation">${escapeHTML(member.affiliation)}</p>` : ''}
          ${memberTags}
          ${expertise}
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

  fetch(dataUrl)
    .then((response) => {
      if (!response.ok) throw new Error('Network map data could not be loaded.');
      return response.json();
    })
    .then((data) => {
      allSites = data.sites || [];
      data.countries.forEach((country) => {
        const option = document.createElement('option');
        option.value = country.name;
        option.textContent = `${country.name} (${country.member_count})`;
        countrySelect.appendChild(option);
      });

      allSites.forEach((site) => {
        const marker = L.marker([site.latitude, site.longitude], { icon: createMarkerIcon(site), title: site.institution });
        marker.bindTooltip(`${site.institution} · ${site.member_count} ${site.member_count === 1 ? 'member' : 'members'}`, { direction: 'top', offset: [0, -16] });
        marker.on('click', () => renderSite(site));
        markers.set(site.id, marker);
        markerCluster.addLayer(marker);
      });

      summary.textContent = `Showing ${data.site_count} institutions and ${data.member_count} members across ${data.country_count} countries.`;
      const bounds = L.latLngBounds(allSites.map((site) => [site.latitude, site.longitude]));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 5 });
      window.setTimeout(() => map.invalidateSize(), 100);
    })
    .catch((error) => {
      summary.textContent = 'The map data is temporarily unavailable.';
      renderEmptyPanel('The interactive map could not be loaded. Please refresh the page or visit the Team page to browse current profiles.');
      console.error(error);
    });

  searchInput.addEventListener('input', updateVisibleSites);
  countrySelect.addEventListener('change', updateVisibleSites);
  resetButton.addEventListener('click', resetMap);
})();
