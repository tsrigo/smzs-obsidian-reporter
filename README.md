# SMZS Obsidian Reporter

Receive data-reporting webhooks from the 社媒助手 browser extension and save them as Obsidian Markdown notes.

This is a small local bridge:

```text
社媒助手 data reporting -> local HTTP endpoint -> Obsidian vault Markdown + raw JSON
```

It is not affiliated with 社媒助手 or Obsidian.

## Why

社媒助手 can report collected data to a custom API endpoint. Obsidian is a local Markdown vault. This receiver connects the two: the extension posts JSON, and the receiver writes structured source notes into your vault.

## Requirements

- Node.js 18+
- An Obsidian vault on your local machine
- 社媒助手 extension with data reporting enabled

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
- Other fields are kept under a collapsible metadata block.

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
