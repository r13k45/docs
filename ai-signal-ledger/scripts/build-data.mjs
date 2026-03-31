import { writeFile } from 'node:fs/promises';

const OUTPUT_PATH = new URL('../data/brief.json', import.meta.url);
const NOW = new Date().toISOString();

const MAX_ITEMS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

const SOURCE_GROUPS = {
  research: [
    {
      name: 'arXiv cs.AI',
      type: 'atom',
      url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&start=0&max_results=12',
      sourceLabel: 'arXiv'
    },
    {
      name: 'arXiv cs.LG',
      type: 'atom',
      url: 'https://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&start=0&max_results=12',
      sourceLabel: 'arXiv'
    },
    {
      name: 'arXiv cs.CL',
      type: 'atom',
      url: 'https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&start=0&max_results=12',
      sourceLabel: 'arXiv'
    }
  ],
  news: [
    {
      name: 'TechCrunch AI',
      type: 'rss',
      url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
      sourceLabel: 'TechCrunch'
    },
    {
      name: 'MIT News AI',
      type: 'rss',
      url: 'https://news.mit.edu/rss/topic/artificial-intelligence2',
      sourceLabel: 'MIT News'
    },
    {
      name: 'Google DeepMind Blog',
      type: 'rss',
      url: 'https://deepmind.google/blog/rss.xml',
      sourceLabel: 'Google DeepMind'
    },
    {
      name: 'OpenAI News',
      type: 'rss',
      url: 'https://openai.com/news/rss.xml',
      sourceLabel: 'OpenAI'
    },
    {
      name: 'Anthropic News',
      type: 'rss',
      url: 'https://www.anthropic.com/news/rss.xml',
      sourceLabel: 'Anthropic'
    }
  ],
  threads: [
    {
      name: 'Threads / OpenAI',
      type: 'rss',
      url: 'https://rsshub.app/threads/openai',
      sourceLabel: 'Threads via RSSHub'
    },
    {
      name: 'Threads / GoogleDeepMind',
      type: 'rss',
      url: 'https://rsshub.app/threads/googledeepmind',
      sourceLabel: 'Threads via RSSHub'
    },
    {
      name: 'Threads / AnthropicAI',
      type: 'rss',
      url: 'https://rsshub.app/threads/anthropicai',
      sourceLabel: 'Threads via RSSHub'
    }
  ]
};

const categoryRules = [
  {
    name: 'Research',
    keywords: ['benchmark', 'dataset', 'evaluation', 'diffusion', 'transformer', 'multimodal', 'reasoning', 'agent']
  },
  {
    name: 'Models',
    keywords: ['model', 'llm', 'gpt', 'claude', 'gemini', 'mistral', 'token', 'inference']
  },
  {
    name: 'Products',
    keywords: ['launch', 'product', 'release', 'api', 'assistant', 'studio', 'feature', 'tool']
  },
  {
    name: 'Policy',
    keywords: ['policy', 'regulation', 'safety', 'governance', 'compliance', 'risk', 'law']
  },
  {
    name: 'Infrastructure',
    keywords: ['chip', 'gpu', 'datacenter', 'inference', 'training', 'latency', 'serving']
  }
];

async function main() {
  const report = {
    generatedAt: NOW,
    methodology: {
      title: 'Curated source-first AI intelligence brief',
      summary:
        'This dataset is generated from public source feeds. Items are linked back to their original URLs, timestamped, and auto-categorized for triage rather than treated as infallible truth.',
      caveats: [
        'Feed freshness depends on source publication latency and RSS availability.',
        'Threads coverage uses RSSHub adapters and may fail or lag if the upstream route changes.',
        'Automatic categorization is heuristic and should be reviewed for decision-critical workflows.'
      ]
    },
    sourceGroups: [],
    sections: {}
  };

  for (const [groupName, sources] of Object.entries(SOURCE_GROUPS)) {
    const settled = await Promise.allSettled(sources.map((source) => fetchSource(source, groupName)));
    const items = settled
      .filter((entry) => entry.status === 'fulfilled')
      .flatMap((entry) => entry.value.items);
    const errors = settled
      .filter((entry) => entry.status === 'rejected')
      .map((entry) => entry.reason instanceof Error ? entry.reason.message : String(entry.reason));

    const deduped = dedupeByUrl(items)
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        ...item,
        category: categorizeItem(item),
        ageHours: Math.max(0, Math.round((Date.now() - Date.parse(item.publishedAt)) / (60 * 60 * 1000)))
      }));

    report.sections[groupName] = deduped;
    report.sourceGroups.push({
      group: groupName,
      attemptedSources: sources.map((source) => ({
        name: source.name,
        url: source.url
      })),
      itemCount: deduped.length,
      errors
    });
  }

  report.summary = buildSummary(report.sections);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH.pathname}`);
}

async function fetchSource(source, groupName) {
  const response = await fetch(source.url, {
    headers: {
      'user-agent': 'ai-intel-brief/1.0 (+https://github.com/)',
      accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`${groupName}:${source.name} -> HTTP ${response.status}`);
  }

  const raw = await response.text();
  const parsedItems = source.type === 'atom' ? parseAtom(raw) : parseRss(raw);

  return {
    source,
    items: parsedItems.map((item) => ({
      ...item,
      source: source.sourceLabel,
      feed: source.name,
      provenance: source.url
    }))
  };
}

function parseAtom(xml) {
  return extractBlocks(xml, 'entry').map((entry) => {
    const links = [...entry.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*\/?>/gi)].map((match) => match[1]);
    const summary = decodeXml(firstTag(entry, 'summary') || firstTag(entry, 'content') || '');

    return {
      title: cleanText(firstTag(entry, 'title')),
      url: links[0] || '',
      publishedAt: normalizeDate(firstTag(entry, 'published') || firstTag(entry, 'updated')),
      summary,
      authors: extractBlocks(entry, 'author').map((author) => cleanText(firstTag(author, 'name'))).filter(Boolean)
    };
  }).filter(isValidItem);
}

function parseRss(xml) {
  return extractBlocks(xml, 'item').map((item) => {
    const description = decodeXml(firstTag(item, 'description') || '');
    const content = decodeXml(firstTag(item, 'content:encoded') || description);

    return {
      title: cleanText(firstTag(item, 'title')),
      url: cleanText(firstTag(item, 'link')),
      publishedAt: normalizeDate(firstTag(item, 'pubDate') || firstTag(item, 'dc:date') || firstTag(item, 'published')),
      summary: stripHtml(content),
      authors: [cleanText(firstTag(item, 'dc:creator') || firstTag(item, 'author'))].filter(Boolean)
    };
  }).filter(isValidItem);
}

function extractBlocks(xml, tagName) {
  const pattern = new RegExp(`<${escapeTag(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTag(tagName)}>`, 'gi');
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function firstTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${escapeTag(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeTag(tagName)}>`, 'i'));
  return match ? match[1] : '';
}

function escapeTag(tagName) {
  return tagName.replace(':', '\\:');
}

function cleanText(value) {
  return stripHtml(decodeXml(value || '')).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return (value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXml(value) {
  return (value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeDate(value) {
  const fallback = NOW;
  const parsed = Date.parse(cleanText(value));
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

function isValidItem(item) {
  return Boolean(item.title && item.url && item.publishedAt);
}

function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.url)) {
      return false;
    }
    seen.add(item.url);
    return true;
  });
}

function categorizeItem(item) {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  const matched = categoryRules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
  return matched ? matched.name : 'General';
}

function buildSummary(sections) {
  const allItems = Object.values(sections).flat();
  const last24h = allItems.filter((item) => Date.now() - Date.parse(item.publishedAt) <= DAY_MS).length;
  const categories = aggregateCounts(allItems.map((item) => item.category));

  return {
    totalItems: allItems.length,
    last24h,
    topCategories: Object.entries(categories)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count }))
  };
}

function aggregateCounts(values) {
  return values.reduce((accumulator, value) => {
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
