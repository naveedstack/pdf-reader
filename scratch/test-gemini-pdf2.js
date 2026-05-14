require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const https = require('https');
const { generateText } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');

async function run() {
  const url = 'https://utfs.io/f/XvuGy6MgpTwPxemvXyVNDgmPsLG1dSrZzT63QfI5o8ly9Vt7'; // User's latest URL
  
  const buffer = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });

  console.log("Downloaded size:", buffer.length);
  
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  });

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all the text from this document.' },
            { type: 'file', mimeType: 'application/pdf', data: buffer.toString('base64') }
          ]
        }
      ]
    });

    console.log("Extracted text length:", text.length);
    console.log("First 500 chars:", text.substring(0, 500));
  } catch (err) {
    console.error("OCR Failed:", err.message);
  }
}

run().catch(console.error);
