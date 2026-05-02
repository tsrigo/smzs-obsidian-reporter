# SMZS Obsidian Reporter

Save social media posts into Obsidian from a browser bookmarklet, 社媒助手 data-reporting webhooks, or social-media-copilot server responses.

This is a small local bridge:

```text
browser page / 社媒助手 / social-media-copilot -> local HTTP endpoint -> Obsidian Markdown + raw JSON
```

It is not affiliated with 社媒助手 or Obsidian.

## Why

Obsidian is a local Markdown vault. This receiver provides a tiny local HTTP endpoint that can receive a social post payload and write a readable source note into your vault.

## Requirements

- Node.js 18+
- An Obsidian vault on your local machine
- Optional: 社媒助手 extension or social-media-copilot server

## Quick Start

Clone and start:

```powershell
git clone https://github.com/<owner>/smzs-obsidian-reporter.git
cd smzs-obsidian-reporter
$env:VAULT_PATH="C:\path\to\your\obsidian-vault"
node src/server.js
```

The default endpoint is:

```text
http://127.0.0.1:8787/reporting
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

## Simplest Use: Bookmarklet

After starting the reporter, open:

```text
http://127.0.0.1:8787/bookmarklet
```

Drag the `Save to Obsidian` button to your browser bookmarks bar.

Then use it like this:

1. Open a Xiaohongshu post page or another social media post page.
2. Click the `Save to Obsidian` bookmark.
3. The current page title, readable text, and images are saved into your Obsidian vault.

This does not use the paid 社媒助手 data-reporting feature.

## 社媒助手 Configuration

In 社媒助手, create a reporting rule:

- 规则名称: `Obsidian 本地上报`
- 接口地址: `http://127.0.0.1:8787/reporting`
- 请求方法: `POST`
- 请求头配置:
  - `Content-Type: application/json; charset=utf-8`

Optional token:

```powershell
$env:REPORT_TOKEN="your-token"
$env:VAULT_PATH="C:\path\to\your\obsidian-vault"
node src/server.js
```

Then add this header in 社媒助手:

```text
X-Report-Token: your-token
```

More details: [docs/smzs-data-reporting.md](docs/smzs-data-reporting.md).

## social-media-copilot Server Mode

If you do not want to use the Chrome Web Store edition's paid data-reporting feature, run the open-source `social-media-copilot` server branch as a separate service and use the adapter script in this repository:

```text
social-media-copilot server -> adapter script -> smzs-obsidian-reporter -> Obsidian
```

This repository does not vendor `social-media-copilot` code. It only documents how to call its HTTP API and normalize the result into this reporter.

See [docs/social-media-copilot-server.md](docs/social-media-copilot-server.md).

## Output

The receiver creates:

```text
Knowledge/
  Inbox.md
  Sources/
    README.md
    Reports/
      README.md
      2026-05-02 12-00-00 Example.md
      Raw/
        2026-05-02 12-00-00 Example.json
```

Each report gets:

- A raw JSON file for complete provenance.
- A readable Markdown source note that renders common fields such as `title`, `content`, `note_cover`, and `image_urls`.
- A pending entry in `Knowledge/Inbox.md` for later processing.

For 社媒助手 social posts, the note body is optimized for reading:

- `title` / `name` becomes the item heading.
- `content` / `text` / `desc` becomes Markdown body text.
- `note_cover` and `image_urls` are rendered as images.
- Other fields are kept only in the raw JSON file to keep the note readable.

## Test Locally

Start the server in one terminal:

```powershell
$env:VAULT_PATH="C:\path\to\your\obsidian-vault"
node src/server.js
```

Send a sample report in another terminal:

```powershell
node examples/send-sample-report.js
```

## Environment Variables

| Name | Default | Description |
| --- | --- | --- |
| `VAULT_PATH` | current working directory | Absolute path to your Obsidian vault |
| `HOST` | `127.0.0.1` | Bind host |
| `PORT` | `8787` | Bind port |
| `REPORT_TOKEN` | empty | Optional shared secret checked via `X-Report-Token` |
| `MAX_BODY_BYTES` | `20971520` | Request body size limit |

## Security Notes

- Keep `HOST=127.0.0.1` unless you explicitly need LAN access.
- Use `REPORT_TOKEN` if pages outside your local browser context can reach the server.
- Review raw JSON before syncing sensitive reports to a remote Git repository.

## License

MIT
