const fs = require('fs');
const https = require('https');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function run() {
  const url = 'https://utfs.io/f/XvuGy6MgpTwPEGF8cn7FgZ9Y0eqnfBwW6NAuRUjsyvKL32Ta';
  
  const buffer = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });

  const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(buffer)});
  const pdfDocument = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= Math.min(5, pdfDocument.numPages); i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  console.log("pdf.js Extracted text length (first 5 pages):", fullText.length);
  console.log("Extracted:", fullText.substring(0, 500));
}

run().catch(console.error);
