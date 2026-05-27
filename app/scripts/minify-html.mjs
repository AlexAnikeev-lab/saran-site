import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'html-minifier-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const indexPath = path.join(appRoot, 'index.html');

const html = fs.readFileSync(indexPath, 'utf8');
const minified = await minify(html, {
  collapseWhitespace: true,
  conservativeCollapse: false,
  removeComments: true,
  removeOptionalTags: false,
  minifyCSS: true,
  minifyJS: {
    compress: true,
    mangle: true,
  },
  keepClosingSlash: true,
});

fs.writeFileSync(indexPath, minified, 'utf8');
console.log('[build] index.html minified:', html.length, '->', minified.length, 'bytes');
