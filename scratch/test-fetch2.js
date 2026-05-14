const https = require('https');

async function run() {
  const url = 'https://utfs.io/f/XvuGy6MgpTwPxemvXyVNDgmPsLG1dSrZzT63QfI5o8ly9Vt7';
  
  console.log("Downloading...");
  const buffer = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  console.log("Sending to Gemini...");
  const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log("Status:", res.statusCode);
      if (res.statusCode !== 200) {
        console.log("Error response:", body.substring(0, 1000));
      } else {
        const result = JSON.parse(body);
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("Success! Text length:", text ? text.length : 0);
      }
    });
  });

  req.on('error', console.error);
  req.write(JSON.stringify({
    contents: [{
      parts: [
        { text: 'Extract all the text.' },
        { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }
      ]
    }]
  }));
  req.end();
}

require('dotenv').config({ path: '.env.local' });
run().catch(console.error);
