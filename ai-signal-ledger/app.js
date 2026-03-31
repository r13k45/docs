const DATA_URL = './data/brief.json';
const sectionLabels = {
  research: 'Research',
  news: 'News',
  threads: 'Threads'
};

const dom = {
  heroMeta: document.querySelector('#hero-meta'),
  summaryGrid: document.querySelector('#summary-grid'),
  tabs: document.querySelector('#tabs'),
  feed: document.querySelector('#feed'),
  methodSummary: document.querySelector('#method-summary'),
  methodCaveats: document.querySelector('#method-caveats'),
  sourceStatus: document.querySelector('#source-status'),
  cardTemplate: document.querySelector('#card-template')
};

let state = {
  data: null,
  activeSection: 'research'
};

bootstrap().catch((error) => {
  dom.feed.innerHTML = `<article class="card"><h3 class="title">Unable to load data</h3><p class="summary">${error.message}</p></article>`;
});

async function bootstrap() {
  const response = await fetch(DATA_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  state.data = await response.json();
  renderChrome();
  renderTabs();
  renderSection();
}

function renderChrome() {
  const { data } = state;
  const generated = new Date(data.generatedAt);
  const summary = data.summary;

  dom.heroMeta.innerHTML = '';
  [
    `${summary.totalItems} total signals`,
    `${summary.last24h} in the last 24h`,
    `Updated ${generated.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
  ].forEach((text) => {
    const tag = document.createElement('span');
    tag.textContent = text;
    dom.heroMeta.appendChild(tag);
  });

  dom.summaryGrid.innerHTML = '';
  [
    {
      label: 'Coverage',
      value: String(summary.totalItems),
      copy: 'Every item keeps its original source link so you can jump back to first-party material immediately.'
    },
    {
      label: 'Freshness',
      value: String(summary.last24h),
      copy: 'Signals published in the last 24 hours are counted separately so fresh movement is visible at a glance.'
    },
    {
      label: 'Top Themes',
      value: summary.topCategories.map((item) => item.name).join(' / '),
      copy: 'Keyword rules create a first-pass taxonomy so you can scan the shape of the market before reading deeply.'
    }
  ].forEach((item) => {
    const card = document.createElement('article');
    card.className = 'summary-card';
    card.innerHTML = `<p>${item.label}</p><strong>${item.value}</strong><p>${item.copy}</p>`;
    dom.summaryGrid.appendChild(card);
  });

  dom.methodSummary.textContent = data.methodology.summary;
  dom.methodCaveats.innerHTML = '';
  data.methodology.caveats.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    dom.methodCaveats.appendChild(li);
  });
}

function renderTabs() {
  dom.tabs.innerHTML = '';
  Object.keys(state.data.sections).forEach((section) => {
    const button = document.createElement('button');
    button.className = 'tab';
    button.type = 'button';
    button.role = 'tab';
    button.setAttribute('aria-selected', String(state.activeSection === section));
    button.textContent = `${sectionLabels[section] || section} (${state.data.sections[section].length})`;
    button.addEventListener('click', () => {
      state.activeSection = section;
      renderTabs();
      renderSection();
    });
    dom.tabs.appendChild(button);
  });
}

function renderSection() {
  const items = state.data.sections[state.activeSection] || [];
  dom.feed.innerHTML = '';

  items.forEach((item) => {
    const fragment = dom.cardTemplate.content.cloneNode(true);
    fragment.querySelector('.source').textContent = item.source;
    fragment.querySelector('.category').textContent = item.category;
    fragment.querySelector('.title').textContent = item.title;
    fragment.querySelector('.meta').textContent = `${item.feed} | ${formatDate(item.publishedAt)} | ${item.ageHours}h ago`;
    fragment.querySelector('.summary').textContent = item.summary || 'No summary provided by the source feed.';
    fragment.querySelector('.authors').textContent = (item.authors || []).join(', ') || 'Unknown author';
    const link = fragment.querySelector('.link');
    link.href = item.url;
    dom.feed.appendChild(fragment);
  });

  renderSourceStatus();
}

function renderSourceStatus() {
  const group = state.data.sourceGroups.find((entry) => entry.group === state.activeSection);
  if (!group) {
    dom.sourceStatus.innerHTML = '';
    return;
  }

  const rows = [
    `<div class="source-row"><span>Section</span><strong>${sectionLabels[group.group] || group.group}</strong></div>`,
    `<div class="source-row"><span>Live items</span><strong>${group.itemCount}</strong></div>`,
    `<div class="source-row"><span>Source attempts</span><strong>${group.attemptedSources.length}</strong></div>`,
    `<div class="source-row"><span>Errors</span><strong>${group.errors.length}</strong></div>`
  ];

  if (group.errors.length) {
    group.errors.slice(0, 3).forEach((error) => {
      rows.push(`<div class="source-row"><span>Feed issue</span><strong>${escapeHtml(error)}</strong></div>`);
    });
  }

  dom.sourceStatus.innerHTML = rows.join('');
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
