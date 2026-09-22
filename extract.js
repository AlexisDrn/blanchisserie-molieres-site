// One-time build script: extracts gallery/tarifs/articles data from the current
// site_updated.html, writes content.seed.json, and produces index.template.html
// with the three data blocks replaced by placeholder tokens the server will fill in.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.template.html');
let html = fs.readFileSync(SRC, 'utf-8');

function indexOfOrThrow(text, marker, label){
  const idx = text.indexOf(marker);
  if(idx === -1){ throw new Error('Marker not found: ' + label); }
  return idx;
}

// ---------- Gallery ----------
function parseGallery(html){
  const startMarker = '    var galleryData = [';
  const endMarker = '\n\n    function renderGallery(){';
  const startIdx = indexOfOrThrow(html, startMarker, 'galleryData');
  const endIdx = html.indexOf(endMarker, startIdx);
  if(endIdx === -1){ throw new Error('galleryData end not found'); }
  let arrayText = html.slice(startIdx + '    var galleryData = '.length, endIdx);
  arrayText = arrayText.replace(/;\s*$/, '');

  let varsCtx = '';
  const varRe = /var (\w+) = '(data:[^']*)';/g;
  let m;
  while((m = varRe.exec(html))){
    varsCtx += 'var ' + m[1] + ' = ' + JSON.stringify(m[2]) + ';\n';
  }
  const arr = new Function(varsCtx + 'return ' + arrayText + ';')();
  return {
    data: arr.map(it => ({ label: it.label || '', photo: it.photo || null })),
    startIdx, endIdx
  };
}

// ---------- Tarifs ----------
function parseTarifs(html){
  const anchorText = 'Les tarifs indiqués sont ceux en vigueur au jour de la prestation.</p>';
  const anchorIdx = indexOfOrThrow(html, anchorText, 'tarifs anchor');
  const startIdx = anchorIdx + anchorText.length + '\n      </div>\n\n'.length;
  const endMarker = '<p class="price-note">';
  const endIdx = html.indexOf(endMarker, startIdx);
  if(endIdx === -1){ throw new Error('tarifs end not found'); }
  const block = html.slice(startIdx, endIdx);

  // Split on each group's opening tag rather than matching to a closing </div>,
  // since price-row divs nested inside would make a naive non-greedy match stop
  // at the first row's closing tag instead of the group's.
  const chunks = block.split('<div class="price-group">').slice(1);
  const rowRe = /<div class="price-row"><span class="price-row__name">([\s\S]*?)<\/span><span class="price-row__leader"><\/span><span class="price-row__amount u-mono">([\s\S]*?)<\/span><\/div>/g;
  const titleRe = /<h3>([\s\S]*?)<\/h3>/;
  const groups = chunks.map(chunk => {
    const tm = titleRe.exec(chunk);
    const title = tm ? decodeHtml(tm[1].trim()) : '';
    const rows = [];
    let rm;
    rowRe.lastIndex = 0;
    while((rm = rowRe.exec(chunk))){
      rows.push({ name: decodeHtml(rm[1].trim()), amount: decodeHtml(rm[2].trim()) });
    }
    return { title, rows };
  });
  return { data: groups, startIdx, endIdx };
}

function decodeHtml(str){
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ---------- Articles ----------
function parseArticles(html){
  const startMarker = '    var articlesData = [';
  const endMarker = '\n\n    function renderArticles(){';
  const startIdx = indexOfOrThrow(html, startMarker, 'articlesData');
  const endIdx = html.indexOf(endMarker, startIdx);
  if(endIdx === -1){ throw new Error('articlesData end not found'); }
  let arrayText = html.slice(startIdx + '    var articlesData = '.length, endIdx);
  arrayText = arrayText.replace(/;\s*$/, '');
  const arr = new Function('return ' + arrayText + ';')();
  const data = arr.map(it => {
    if(it.html){ return { title: it.q || '', mode: 'html', html: it.html, text: '' }; }
    return { title: it.q || '', mode: 'text', html: '', text: it.a || '' };
  });
  return { data, startIdx, endIdx };
}

const gallery = parseGallery(html);
const tarifs = parseTarifs(html);
const articles = parseArticles(html);

console.log('Extracted:', gallery.data.length, 'gallery items,', tarifs.data.reduce((n,g)=>n+g.rows.length,0), 'tarif rows in', tarifs.data.length, 'groups,', articles.data.length, 'articles');

// Write seed content.json
const seed = { gallery: gallery.data, tarifs: tarifs.data, articles: articles.data };
fs.writeFileSync(path.join(__dirname, 'data', 'content.seed.json'), JSON.stringify(seed, null, 2), 'utf-8');

// Build templated HTML with placeholders. File order is: tarifs < gallery < articles.
// Replace from the LAST block to the FIRST so earlier (lower-index) blocks' stored
// offsets stay valid as later replacements change the string length after them.
let out = html;
out = out.slice(0, articles.startIdx) + '__ARTICLES_DATA_PLACEHOLDER__' + out.slice(articles.endIdx);
out = out.slice(0, gallery.startIdx) + '    var galleryData = __GALLERY_DATA_PLACEHOLDER__;' + out.slice(gallery.endIdx);
out = out.slice(0, tarifs.startIdx) + '__TARIFS_HTML_PLACEHOLDER__\n\n      ' + out.slice(tarifs.endIdx);

fs.writeFileSync(path.join(__dirname, 'index.template.html'), out, 'utf-8');
console.log('Wrote index.template.html and data/content.seed.json');
