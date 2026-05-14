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

  const PDFParser = (await import('pdf2json')).default;
  const pdfParser = new PDFParser(this, 1);
  
  pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
  pdfParser.on("pdfParser_dataReady", pdfData => {
    const rawText = pdfParser.getRawTextContent();
    console.log("pdf2json Extracted text length:", rawText.length);
    console.log("First 500 chars:", rawText.substring(0, 500));
  });

  pdfParser.parseBuffer(buffer);
}

run().catch(console.error);
