# 社媒助手数据上报配置

This project is a local webhook receiver for the 社媒助手 browser extension data-reporting feature.

Official references:

- Data reporting guide: <https://smzs.xisence.com/help/guide/data-reporting>
- Chrome Web Store listing: <https://chromewebstore.google.com/detail/dbichmdlbjdeplpkhcejgkakobjbjalc>

## Rule

Create a new reporting rule in 社媒助手:

| Field | Value |
| --- | --- |
| 规则名称 | `Obsidian 本地上报` |
| 接口地址 | `http://127.0.0.1:8787/reporting` |
| 请求方法 | `POST` |
| 请求头配置 | `Content-Type: application/json; charset=utf-8` |

If `REPORT_TOKEN` is set when starting the server, add:

```text
X-Report-Token: your-token
```

## Request Body

社媒助手 sends a JSON body shaped like:

```json
{
  "extra": {},
  "meta": [
    {
      "key": "string",
      "name": "string",
      "alias": "string",
      "description": "string"
    }
  ],
  "list": [],
  "remark": "string",
  "version": "string"
}
```

The receiver stores this payload as:

- Raw JSON: `Knowledge/Sources/Reports/Raw/`
- Markdown source note: `Knowledge/Sources/Reports/`
- Inbox entry: `Knowledge/Inbox.md`

## CORS

The server responds with:

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, PUT, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Report-Token
```

This is required because the extension sends requests from the browser context.

