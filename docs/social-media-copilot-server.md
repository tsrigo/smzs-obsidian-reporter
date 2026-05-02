# social-media-copilot Server Integration

This project can work without the paid 社媒助手 "data reporting" feature by using the open-source `server` branch of `social-media-copilot` as an external API service.

Repository:

- <https://github.com/iszhouhua/social-media-copilot>
- Server branch: <https://github.com/iszhouhua/social-media-copilot/tree/server>

## Recommendation

Do not vendor `social-media-copilot` source code into this repository.

Reasons:

- It is GPL-3.0. Keeping it as a separate service keeps licensing and redistribution boundaries clear.
- It is independently maintained and may need frequent platform fixes.
- This repository only needs its HTTP API output, not its internal browser-extension code.

Recommended shape:

```text
social-media-copilot server -> adapter script -> smzs-obsidian-reporter -> Obsidian
```

## Run social-media-copilot Server

Option A: Docker server image:

```bash
docker run -d --name social-media-copilot -p 3000:3000 iszhouhua/social-media-copilot:server
```

Option B: clone the server branch and run it locally:

```bash
git clone -b server https://github.com/iszhouhua/social-media-copilot.git
cd social-media-copilot/server
pnpm install
pnpm dev
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:3000
```

The server branch also needs its plugin side connected, because the server proxies requests to the browser extension through socket.io. Follow the upstream README for loading the unpacked extension from `output/chrome-mv3`.

## Start Obsidian Reporter

In this repository:

```powershell
$env:VAULT_PATH="C:\path\to\your\obsidian-vault"
node src/server.js
```

Reporter endpoint:

```text
http://127.0.0.1:8787/reporting
```

## Import Data from social-media-copilot

There are two supported adapter modes.

### Mode 1: Convert an existing response JSON file

If you already saved a response from `social-media-copilot`:

```powershell
node examples/social-media-copilot-to-report.js --input response.json
```

If the list is nested, pass a dotted path:

```powershell
node examples/social-media-copilot-to-report.js --input response.json --list-path data.items
```

Dry run without writing to Obsidian:

```powershell
node examples/social-media-copilot-to-report.js --input response.json --dry-run
```

### Mode 2: Call `/request` and send to Obsidian

Create an Axios-style request config JSON, for example:

```json
{
  "url": "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
  "method": "POST",
  "data": {
    "source_note_id": "replace-with-note-id",
    "image_formats": ["jpg", "webp", "avif"],
    "extra": {
      "need_body_topic": "1"
    },
    "xsec_source": "pc_feed",
    "xsec_token": "replace-with-xsec-token"
  }
}
```

Then run:

```powershell
$env:COPILOT_API_BASE="http://127.0.0.1:3000"
node examples/social-media-copilot-to-report.js --request examples/copilot-xhs-feed-request.json
```

If the useful items are nested:

```powershell
node examples/social-media-copilot-to-report.js --request examples/copilot-xhs-feed-request.json --list-path data.items
```

The adapter normalizes common fields into the reporter payload:

- `title` / `name` / `note_title`
- `content` / `text` / `desc` / `description`
- `url` / `link`
- common image and cover URL fields

The raw normalized payload is still stored by the reporter under `Knowledge/Sources/Reports/Raw/`.

## Auth Token

If `smzs-obsidian-reporter` is started with `REPORT_TOKEN`, pass it to the adapter too:

```powershell
$env:REPORT_TOKEN="your-token"
node examples/social-media-copilot-to-report.js --input response.json
```

## Notes

- This does not bypass the Chrome Web Store edition's paid data-reporting feature.
- It uses the upstream open-source server branch as a separate API service.
- Platform APIs and anti-abuse behavior change frequently. Keep `social-media-copilot` updated separately.
- Respect platform terms, privacy requirements, and the upstream project's GPL-3.0 license.

