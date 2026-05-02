const fs = require('fs');

const args = parseArgs(process.argv.slice(2));
const reporterEndpoint = args.reporter || process.env.REPORT_ENDPOINT || 'http://127.0.0.1:8787/reporting';
const reportToken = args.token || process.env.REPORT_TOKEN || '';

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});

async function main() {
  const sourcePayload = await loadSourcePayload(args);
  const list = resolveList(sourcePayload, args.listPath || process.env.COPILOT_LIST_PATH)
    .map((item) => normalizeItem(item));

  const reportPayload = {
    extra: {
      source: 'social-media-copilot',
      request: args.request || '',
      listPath: args.listPath || process.env.COPILOT_LIST_PATH || '',
    },
    meta: buildMeta(),
    list,
    remark: args.remark || process.env.REPORT_REMARK || 'social-media-copilot import',
    version: 'social-media-copilot-adapter',
  };

  if (args.dryRun) {
    console.log(JSON.stringify(reportPayload, null, 2));
    return;
  }

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (reportToken) headers['X-Report-Token'] = reportToken;

  const res = await fetch(reporterEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(reportPayload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Reporter returned HTTP ${res.status}: ${text}`);
  console.log(text);
}

async function loadSourcePayload(options) {
  if (options.input) {
    return JSON.parse(fs.readFileSync(options.input, 'utf8'));
  }

  if (options.request) {
    const copilotBase = options.copilot || process.env.COPILOT_API_BASE || 'http://127.0.0.1:3000';
    const requestConfig = JSON.parse(fs.readFileSync(options.request, 'utf8'));
    const res = await fetch(`${copilotBase.replace(/\/$/, '')}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(requestConfig),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`social-media-copilot returned HTTP ${res.status}: ${text}`);
    return JSON.parse(text);
  }

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (stdin) return JSON.parse(stdin);

  throw new Error('Provide --input <json>, --request <axios-config-json>, or pipe JSON to stdin.');
}

function normalizeItem(input) {
  const item = unwrapItem(input);
  const title = firstString(
    item.title,
    item.note_card && item.note_card.display_title,
    item.note_card && item.note_card.title,
    item.desc,
    item.description,
    item.caption,
    item.aweme_detail && item.aweme_detail.desc,
  );

  const content = firstString(
    item.content,
    item.desc,
    item.description,
    item.caption,
    item.note_card && item.note_card.desc,
    item.note_card && item.note_card.title,
    item.aweme_detail && item.aweme_detail.desc,
  );

  const url = firstString(item.url, item.link, item.share_url, item.note_url);
  const noteId = firstString(item.note_id, item.id, item.aweme_id, item.photo_id);
  const created = firstValue(item.create_time, item.time, item.timestamp, item.createTime);
  const images = collectImages(item);

  return {
    note_id: noteId,
    url,
    title: title || content.slice(0, 60) || noteId || 'Imported item',
    content,
    create_time: created || '',
    image_count: images.length,
    note_cover: images[0] || '',
    image_urls: images.join('\n'),
  };
}

function unwrapItem(input) {
  if (!input || typeof input !== 'object') return {};
  if (input.note_card && typeof input.note_card === 'object') {
    return { ...input, ...input.note_card };
  }
  if (input.aweme_detail && typeof input.aweme_detail === 'object') {
    return { ...input, ...input.aweme_detail };
  }
  if (input.photo && typeof input.photo === 'object') {
    return { ...input, ...input.photo };
  }
  return input;
}

function resolveList(payload, listPath) {
  if (listPath) {
    const value = getPath(payload, listPath);
    if (!Array.isArray(value)) throw new Error(`--list-path ${listPath} did not resolve to an array.`);
    return value;
  }

  const candidates = [
    payload,
    payload.data,
    payload.data && payload.data.items,
    payload.data && payload.data.notes,
    payload.data && payload.data.list,
    payload.data && payload.data.aweme_list,
    payload.items,
    payload.notes,
    payload.list,
    payload.aweme_list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [payload];
}

function getPath(object, dottedPath) {
  return dottedPath.split('.').reduce((current, part) => {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) return current[part];
    return undefined;
  }, object);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function collectImages(item) {
  const urls = [];
  collectImageLikeValues(item, urls);
  return Array.from(new Set(urls.filter(Boolean)));
}

function collectImageLikeValues(value, urls) {
  if (!value) return;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(value)) {
      urls.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectImageLikeValues(entry, urls));
    return;
  }
  if (typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    if (/image|img|cover|picture|photo|url/i.test(key)) {
      collectImageLikeValues(child, urls);
    }
  }
}

function buildMeta() {
  return [
    { key: 'note_id', name: 'ID' },
    { key: 'url', name: 'URL' },
    { key: 'title', name: 'Title' },
    { key: 'content', name: 'Content' },
    { key: 'create_time', name: 'Created at' },
    { key: 'image_count', name: 'Image count' },
    { key: 'note_cover', name: 'Cover image' },
    { key: 'image_urls', name: 'Image URLs' },
  ];
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      result[key] = argv[i + 1];
      i += 1;
    }
  }
  return result;
}

