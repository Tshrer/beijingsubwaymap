const fs = require('fs');
const path = require('path');

function parseAttributes(attrStr) {
  const attrs = {};
  const re = /([a-zA-Z0-9_:-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function loadBeijingMap(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const map = [];
  const re = /<l\s+([^>]+)>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = parseAttributes(m[1]);
    const lcode = attrs.lcode || attrs.li || attrs.lnub || null;
    const lb = attrs.lb || '';
    const slb = attrs.slb || '';
    const aliases = [];
    if (lb) aliases.push(lb);
    if (slb) slb.split(',').forEach(s => { if (s && s.trim()) aliases.push(s.trim()); });
    // also add number forms like '1号线' from li
    if (attrs.li) aliases.push(attrs.li + '号线');
    map.push({ lcode, li: attrs.li || null, aliases: Array.from(new Set(aliases)).filter(Boolean) });
  }
  return map;
}

function normalizeSpacings(spacingsPath, map) {
  const raw = fs.readFileSync(spacingsPath, 'utf8');
  const json = JSON.parse(raw);
  const keys = Object.keys(json);
  const newObj = {};
  const unmapped = [];

  keys.forEach(k => {
    const found = map.find(m => m.aliases.some(a => k.indexOf(a) !== -1 || a.indexOf(k) !== -1));
    if (found && found.lcode) {
      newObj[found.lcode] = json[k];
    } else {
      unmapped.push(k);
      newObj[k] = json[k]; // keep original if not mapped
    }
  });

  // backup
  fs.copyFileSync(spacingsPath, spacingsPath + '.bak');
  fs.writeFileSync(spacingsPath, JSON.stringify(newObj, null, 2), 'utf8');
  return unmapped;
}

function normalizeStations(stationsPath, map) {
  const raw = fs.readFileSync(stationsPath, 'utf8');
  // backup
  fs.copyFileSync(stationsPath, stationsPath + '.bak');

  const out = raw.replace(/<s\s+([^>]*?)>/g, (match, attrStr) => {
    // find linename attr
    const attrs = parseAttributes(attrStr);
    const linename = attrs.linename || '';
    if (!linename) return match;
    const parts = linename.split('||||||').map(p => p.trim()).filter(Boolean);
    const codes = parts.map(p => {
      const found = map.find(m => m.aliases.some(a => p.indexOf(a) !== -1 || a.indexOf(p) !== -1));
      return found && found.lcode ? found.lcode : '';
    });
    const codesJoined = codes.filter(Boolean).join('||||||');
    if (!codesJoined) return match; // nothing matched, keep original
    // add attribute lcode (preserve existing attrs ordering)
    // if already has lcode, skip
    if (/\slcode=/.test(attrStr)) return match;
    const newAttrStr = attrStr + ' lcode="' + codesJoined + '"';
    return '<s ' + newAttrStr + '>';
  });

  fs.writeFileSync(stationsPath, out, 'utf8');
}

function main() {
  const xmlPath = path.join(__dirname, '..', 'docs', 'subwaymap', 'beijing.xml');
  const spacingsPath = path.join(__dirname, '..', 'docs', 'subwaymap', 'spacings.json');
  const stationsPath = path.join(__dirname, '..', 'docs', 'subwaymap', 'stations.xml');

  if (!fs.existsSync(xmlPath)) { console.error('beijing.xml not found:', xmlPath); process.exit(1); }
  if (!fs.existsSync(spacingsPath)) { console.error('spacings.json not found:', spacingsPath); process.exit(1); }
  if (!fs.existsSync(stationsPath)) { console.error('stations.xml not found:', stationsPath); process.exit(1); }

  const map = loadBeijingMap(xmlPath);
  console.log('Loaded', map.length, 'lines from beijing.xml');

  const unmappedSpacings = normalizeSpacings(spacingsPath, map);
  console.log('Updated spacings.json — backups saved as spacings.json.bak');
  console.log('Unmapped spacings keys:', unmappedSpacings.length);
  if (unmappedSpacings.length) console.log(unmappedSpacings.join('\n'));

  normalizeStations(stationsPath, map);
  console.log('Updated stations.xml — backup saved as stations.xml.bak');
  console.log('Done. Please review .bak files and unmapped keys.');
}

main();
