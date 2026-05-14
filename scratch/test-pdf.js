const fs = require('fs');
const https = require('https');

async function run() {
  const url = 'https://utfs.io/f/XvuGy6MgpTwPEGF8cn7FgZ9Y0eqnfBwW6NAuRUjsyvKL32Ta';
  
  const buffer = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });

  console.log("Downloaded size:", buffer.length);

  const pdfParseModule = await import('pdf-parse');
  const parser = new pdfParseModule.PDFParse({ data: buffer });
  const textResult = await parser.getText();
  
  console.log("Extracted text length:", textResult.text.length);
  console.log("First 500 chars:", textResult.text.substring(0, 500));
  console.log("Last 500 chars:", textResult.text.substring(textResult.text.length - 500));
}

run().catch(console.error);
