import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
const data = await readFile('docs/BROKER2.GENIALNET.COM.BR.pdf');
const parser = new PDFParse({ data });
const result = await parser.getText();
await parser.destroy();
console.log(result.text.slice(0, 4000));
