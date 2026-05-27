import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { minify } from 'html-minifier-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const HTML_MIN = {
  collapseWhitespace: true,
  conservativeCollapse: false,
  removeComments: true,
  removeOptionalTags: false,
  minifyCSS: true,
  minifyJS: false,
  keepClosingSlash: true,
};

const OBFUSCATE = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.15,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.55,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

function extractInlineScripts(html) {
  const chunks = [];
  let cursor = 0;
  let out = '';

  while (cursor < html.length) {
    const open = html.indexOf('<script', cursor);
    if (open === -1) {
      out += html.slice(cursor);
      break;
    }
    out += html.slice(cursor, open);
    const tagEnd = html.indexOf('>', open);
    if (tagEnd === -1) throw new Error('Unclosed <script tag');
    const openTag = html.slice(open, tagEnd + 1);
    const close = html.indexOf('</script>', tagEnd + 1);
    if (close === -1) throw new Error('Unclosed </script>');
    const body = html.slice(tagEnd + 1, close);

    if (/\bsrc\s*=/.test(openTag) || !body.trim()) {
      out += html.slice(open, close + '</script>'.length);
    } else {
      chunks.push(body);
      out += `<!--__SARAN_JS_${chunks.length - 1}__-->`;
    }
    cursor = close + '</script>'.length;
  }

  return { html: out, chunks };
}

function injectRuntimeScripts(html, chunks, baseDir, publicPrefix) {
  let result = html;
  chunks.forEach((code, i) => {
    const obf = JavaScriptObfuscator.obfuscate(code, OBFUSCATE).getObfuscatedCode();
    const hash = crypto.createHash('sha256').update(obf).digest('hex').slice(0, 10);
    const fileName = i === 0 ? 'saran.runtime.js' : `saran.chunk-${i}.js`;
    const outPath = path.join(baseDir, fileName);
    fs.writeFileSync(outPath, obf, 'utf8');
    const src = `${publicPrefix}${fileName}?v=${hash}`;
    const tag = `<script src="${src}" defer></script>`;
    result = result.replace(`<!--__SARAN_JS_${i}__-->`, tag);
  });
  return result;
}

async function shipHtml(relPath, opts = {}) {
  const { externalizeJs = false, publicPrefix = '' } = opts;
  const abs = path.join(root, relPath);
  const dir = path.dirname(abs);
  const before = fs.readFileSync(abs, 'utf8');
  let html = before;

  if (externalizeJs) {
    const { html: stripped, chunks } = extractInlineScripts(html);
    if (!chunks.length) {
      console.warn('[build] no inline scripts in', relPath);
    } else {
      html = injectRuntimeScripts(stripped, chunks, dir, publicPrefix);
      console.log(
        '[build]',
        relPath,
        '→',
        chunks.length,
        'runtime file(s),',
        Math.round(chunks[0].length / 1024),
        'KB obfuscated'
      );
    }
  }

  const minified = await minify(html, HTML_MIN);
  fs.writeFileSync(abs, minified, 'utf8');
  console.log('[build] minified', relPath, before.length, '→', minified.length, 'bytes');
}

await shipHtml('index.html');
await shipHtml('app/index.html', { externalizeJs: true, publicPrefix: '' });

console.log('[build] done');
