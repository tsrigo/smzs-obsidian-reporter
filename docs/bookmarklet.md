# Bookmarklet Mode

Bookmarklet mode is the simplest way to save the current browser page into Obsidian.

It does not require:

- 社媒助手 paid data reporting
- social-media-copilot server
- modifying a browser extension

## Setup

Start the reporter:

```powershell
$env:VAULT_PATH="C:\path\to\your\obsidian-vault"
node src/server.js
```

Open:

```text
http://127.0.0.1:8787/bookmarklet
```

Drag `Save to Obsidian` to your browser bookmarks bar.

## Use

1. Open a social media post page.
2. Click `Save to Obsidian`.
3. The reporter receives a payload at `/reporting`.
4. A readable Markdown source note is written under `Knowledge/Sources/Reports/`.

## What It Extracts

The bookmarklet tries to extract:

- page URL
- page title
- readable text from common title/content/description areas
- Open Graph image
- visible large images on the page

The extraction is intentionally generic. It is less precise than platform-specific APIs, but much faster to use.

## Limitations

- Some pages lazy-load images only after scrolling.
- Some platforms hide content behind dynamic components.
- If extraction is poor, use 社媒助手 data reporting or social-media-copilot server mode instead.
- If `REPORT_TOKEN` is enabled, bookmarklet mode needs additional customization because the bookmarklet does not store a token by default.

