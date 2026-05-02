#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const REPORT_TOKEN = process.env.REPORT_TOKEN || '';
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 20 * 1024 * 1024);
const VAULT_ROOT = path.resolve(process.env.VAULT_PATH || process.cwd());

const REPORTS_DIR = path.join(VAULT_ROOT, 'Knowledge', 'Sources', 'Reports');
const RAW_DIR = path.join(REPORTS_DIR, 'Raw');
const INBOX_PATH = path.join(VAULT_ROOT, 'Knowledge', 'Inbox.md');
const REPORTS_INDEX_PATH = path.join(REPORTS_DIR, 'README.md');
const KNOWLEDGE_SOURCES_INDEX_PATH = path.join(VAULT_ROOT, 'Knowledge', 'Sources', 'README.md');

function pad(value) {
  return String(value).padStart(2, '0');
}

function nowParts() {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    fileTime: `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`,
  };
}

function sanitizeFilePart(value) {
  return String(value || 'data report')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'data report';
}

function yamlString(value) {
  return JSON.stringify(String(value || ''));
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function inferTitle(payload) {
  const extra = asObject(payload.extra);
  const firstItem = Array.isArray(payload.list) && payload.list.length > 0
    ? asObject(payload.list[0])
    : {};

  return firstText(
    payload.remark,
    extra.title,
    extra.name,
    extra.url,
    firstItem.title,
    firstItem.name,
    firstItem.url,
    '数据上报'
  );
}

function valueAtPath(object, dottedPath) {
  if (!object || !dottedPath) return undefined;
  return String(dottedPath).split('.').reduce((current, part) => {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      return current[part];
    }
    return undefined;
  }, object);
}

function firstField(object, names) {
  for (const name of names) {
    const value = valueAtPath(object, name);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return '';
}

function formatContent(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(splitUrls);
  }
  if (typeof value !== 'string') return [];
  return value
    .split(/[\n,，\s]+/)
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function collectImageUrls(item) {
  const directFields = [
    'note_cover',
    'cover',
    'cover_url',
    'image_url',
    'image_urls',
    'images',
    'image',
    'picture',
    'pictures',
  ];

  const urls = [];
  for (const field of directFields) {
    urls.push(...splitUrls(valueAtPath(item, field)));
  }

  for (const [key, value] of Object.entries(item)) {
    if (/image|img|cover|picture|photo/i.test(key)) {
      urls.push(...splitUrls(value));
    }
  }

  return unique(urls);
}

function formatTimestamp(value) {
  if (!value) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 100000000000 ? value : value * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().replace('T', ' ').slice(0, 19);
  }
  if (typeof value === 'string') return value;
  return '';
}

function renderItem(item, index) {
  const title = firstField(item, ['title', 'name', 'note_title']) || `条目 ${index + 1}`;
  const url = firstField(item, ['url', 'link', 'note_url']);
  const content = formatContent(firstField(item, ['content', 'text', 'desc', 'description', 'note_content']));
  const publishedAt = formatTimestamp(firstField(item, ['create_time', 'created_at', 'publish_time', 'time']));
  const imageUrls = collectImageUrls(item);

  const lines = [];
  lines.push(`## ${title}`);
  lines.push('');
  if (url) lines.push(`- 原始链接：${url}`);
  if (publishedAt) lines.push(`- 发布时间：${publishedAt}`);
  if (url || publishedAt) lines.push('');

  if (content) {
    lines.push('### 内容');
    lines.push('');
    lines.push(content);
    lines.push('');
  }

  if (imageUrls.length > 0) {
    lines.push('### 图片');
    lines.push('');
    imageUrls.forEach((imageUrl, imageIndex) => {
      lines.push(`![图片 ${imageIndex + 1}](${imageUrl})`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

function renderReportBody(list) {
  const lines = [];

  if (list.length > 0) {
    lines.push('# 上报内容');
    lines.push('');
    list.forEach((item, index) => {
      lines.push(renderItem(asObject(item), index));
    });
  } else {
    lines.push('# 上报内容');
    lines.push('');
    lines.push('本次上报没有 `list` 数据。');
    lines.push('');
  }

  return lines.join('\n');
}

function ensureVaultLayout() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  if (!fs.existsSync(INBOX_PATH)) {
    fs.mkdirSync(path.dirname(INBOX_PATH), { recursive: true });
    fs.writeFileSync(INBOX_PATH, `---\ntitle: Knowledge Inbox\ntype: inbox\ncreated: ${nowParts().date}\nupdated: ${nowParts().date}\ntags:\n  - inbox\n  - knowledge\n---\n\n# Knowledge Inbox\n\n## 待处理\n`, 'utf8');
  }

  if (!fs.existsSync(REPORTS_INDEX_PATH)) {
    fs.writeFileSync(REPORTS_INDEX_PATH, `---\ntitle: Report Sources\ntype: index\ncreated: ${nowParts().date}\nupdated: ${nowParts().date}\ntags:\n  - index\n  - sources\n  - reports\n---\n\n# Report Sources\n\n这里存放通过数据上报接口接收的原始采集数据提要。\n\n## Reports\n`, 'utf8');
  }

  if (fs.existsSync(KNOWLEDGE_SOURCES_INDEX_PATH)) {
    appendIfMissing(
      KNOWLEDGE_SOURCES_INDEX_PATH,
      '[[Knowledge/Sources/Reports/README|Reports]]',
      '\n- [[Knowledge/Sources/Reports/README|Reports]]\n'
    );
  }
}

function appendIfMissing(filePath, marker, text) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current.includes(marker)) return;
  fs.writeFileSync(filePath, current.endsWith('\n') ? current + text : current + '\n' + text, 'utf8');
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function writeReport(payload) {
  ensureVaultLayout();

  const { date, time, fileTime } = nowParts();
  const title = inferTitle(payload);
  const safeTitle = sanitizeFilePart(title);
  const basename = `${date} ${fileTime} ${safeTitle}`;
  const rawFile = `${basename}.json`;
  const noteFile = `${basename}.md`;
  const rawPath = path.join(RAW_DIR, rawFile);
  const notePath = path.join(REPORTS_DIR, noteFile);
  const list = toArray(payload.list);
  const remark = typeof payload.remark === 'string' ? payload.remark : '';
  const version = typeof payload.version === 'string' ? payload.version : '';

  fs.writeFileSync(rawPath, JSON.stringify(payload, null, 2), 'utf8');

  const note = `---\ntitle: ${yamlString(title)}\ntype: source\nsource_type: report\ncreated: ${date}\nupdated: ${date}\nreport_time: ${yamlString(`${date} ${time}`)}\nversion: ${yamlString(version)}\ntags:\n  - source\n  - report\n  - data-reporting\n---\n\n# ${title}\n\n> 来源说明：本文件由本地数据上报接收器自动生成。原始 JSON 保存于 [[Raw/${rawFile}|${rawFile}]]。\n\n## 概览\n\n- 上报时间：${date} ${time}\n- 插件版本：${version || '未提供'}\n- 数据条数：${list.length}\n- 备注：${remark || '无'}\n\n${renderReportBody(list)}\n## 后续处理\n\n- [ ] 判断这批数据是否需要整理为 source / insight。\n- [ ] 如果包含长期可复用结论，沉淀到 [[Knowledge/Insights/README|Knowledge / Insights]]。\n`;
  fs.writeFileSync(notePath, note, 'utf8');

  appendIfMissing(
    REPORTS_INDEX_PATH,
    `[[${basename}]]`,
    `\n- [[${basename}]]\n`
  );

  appendIfMissing(
    INBOX_PATH,
    `[[${basename}]]`,
    `\n### ${date} ${time} 数据上报\n\n- 来源：[[${basename}]]\n- 数据条数：${list.length}\n- 备注：${remark || '无'}\n`
  );

  return {
    notePath: path.relative(VAULT_ROOT, notePath).replace(/\\/g, '/'),
    rawPath: path.relative(VAULT_ROOT, rawPath).replace(/\\/g, '/'),
    count: list.length,
  };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Report-Token',
  });

  if (statusCode === 204) {
    res.end();
    return;
  }

  res.end(JSON.stringify(body));
}

function readBody(req, callback) {
  let size = 0;
  const chunks = [];

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy(new Error(`Request body too large. Limit: ${MAX_BODY_BYTES} bytes`));
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => callback(null, Buffer.concat(chunks).toString('utf8')));
  req.on('error', callback);
}

function handleReport(req, res) {
  if (REPORT_TOKEN && req.headers['x-report-token'] !== REPORT_TOKEN) {
    return sendJson(res, 401, { ok: false, error: 'Invalid X-Report-Token' });
  }

  readBody(req, (err, body) => {
    if (err) {
      return sendJson(res, 413, { ok: false, error: err.message });
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      return sendJson(res, 400, { ok: false, error: 'Request body must be valid JSON' });
    }

    try {
      const result = writeReport(payload);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (writeError) {
      return sendJson(res, 500, { ok: false, error: writeError.message });
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.url === '/' || req.url === '/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'smzs-obsidian-reporter',
      vaultPath: VAULT_ROOT,
    });
  }

  if (req.url !== '/reporting' || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }

  return handleReport(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`SMZS Obsidian Reporter listening on http://${HOST}:${PORT}/reporting`);
  console.log(`Vault path: ${VAULT_ROOT}`);
  if (!REPORT_TOKEN) {
    console.log('REPORT_TOKEN is not set. Requests can post without authentication.');
  }
});
