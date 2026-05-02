const fs = require('fs');
const path = require('path');

const endpoint = process.env.REPORT_ENDPOINT || 'http://127.0.0.1:8787/reporting';
const token = process.env.REPORT_TOKEN || '';
const samplePath = path.join(__dirname, 'sample-report.json');
const body = fs.readFileSync(samplePath, 'utf8');

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
};

if (token) {
  headers['X-Report-Token'] = token;
}

fetch(endpoint, {
  method: 'POST',
  headers,
  body,
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    console.log(text);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });

