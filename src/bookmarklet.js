(async function saveCurrentPageToObsidian() {
  const endpoint = 'http://127.0.0.1:8787/reporting';

  function meta(name) {
    const selectors = [
      `meta[property="${name}"]`,
      `meta[name="${name}"]`,
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node && node.getAttribute('content');
      if (value && value.trim()) return value.trim();
    }
    return '';
  }

  function textOf(selector) {
    const node = document.querySelector(selector);
    return node ? cleanText(node.innerText || node.textContent || '') : '';
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  function bestTextCandidate() {
    const selectors = [
      '#detail-title',
      '.title',
      '[class*="title"]',
      '#detail-desc',
      '.note-content',
      '[class*="note-content"]',
      '[class*="desc"]',
      'article',
      'main',
    ];

    const candidates = selectors
      .map(textOf)
      .filter((value) => value.length >= 20)
      .sort((a, b) => b.length - a.length);

    return candidates[0] || cleanText(meta('description') || document.body.innerText).slice(0, 8000);
  }

  function collectImages() {
    const urls = [];
    const add = (url) => {
      if (!url) return;
      const normalized = String(url).trim();
      if (!/^https?:\/\//i.test(normalized)) return;
      if (urls.includes(normalized)) return;
      urls.push(normalized);
    };

    add(meta('og:image'));
    add(meta('twitter:image'));

    for (const img of Array.from(document.images)) {
      const url = img.currentSrc || img.src;
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width && height && (width < 180 || height < 120)) continue;
      if (/avatar|icon|emoji|logo/i.test(img.className || '')) continue;
      add(url);
    }

    return urls.slice(0, 30);
  }

  function pageTitle() {
    return cleanText(
      meta('og:title') ||
      meta('twitter:title') ||
      textOf('#detail-title') ||
      textOf('h1') ||
      document.title ||
      location.href
    ).split('\n')[0].slice(0, 120);
  }

  const images = collectImages();
  const title = pageTitle();
  const content = bestTextCandidate();
  const payload = {
    extra: {
      source: 'bookmarklet',
      pageTitle: document.title,
    },
    meta: [
      { key: 'url', name: 'URL' },
      { key: 'title', name: 'Title' },
      { key: 'content', name: 'Content' },
      { key: 'image_count', name: 'Image count' },
      { key: 'note_cover', name: 'Cover image' },
      { key: 'image_urls', name: 'Image URLs' },
    ],
    list: [
      {
        url: location.href,
        title,
        content,
        image_count: images.length,
        note_cover: images[0] || '',
        image_urls: images.join('\n'),
      },
    ],
    remark: title,
    version: 'bookmarklet',
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    alert(`Saved to Obsidian:\n${result.notePath || title}`);
  } catch (error) {
    alert(`Failed to save to Obsidian.\n\nMake sure the local reporter is running.\n\n${error.message || error}`);
  }
}());

