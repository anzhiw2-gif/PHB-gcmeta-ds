#!/usr/bin/env node
/**
 * Precise Bacteria/Archaea breakdown of gcMeta at three scopes:
 *   1. whole genome table        (/genome/list, Domain filter)
 *   2. per biome catalogue       (50 catalogues x Domain filter)
 *   3. species-level representatives (catalogue/overview/rank per catalogue)
 * Output: data/out/gcmeta_domain_breakdown.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const gc = require('./gcmeta_client.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function count(params) {
  const r = await gc.apiGet('/genome/list', { ...params, pageNum: 1, pageSize: 1 });
  const d = r.json && r.json.data;
  return d && typeof d !== 'string' ? d.totalElements : null;
}

(async () => {
  await gc.init();
  const report = { queriedAt: new Date().toISOString() };

  // 1. global
  report.global = {
    all: await count({}),
    bacteria: await count({ Domain: 'Bacteria' }),
    archaea: await count({ Domain: 'Archaea' }),
  };
  report.global.bacteriaPct = +(report.global.bacteria / report.global.all * 100).toFixed(2);
  report.global.archaeaPct = +(report.global.archaea / report.global.all * 100).toFixed(2);

  // 2. per catalogue
  const cats = (await gc.apiGet('/catalogue/catalogueList', { pageNum: 1, pageSize: 100 })).json.data.content;
  report.catalogues = [];
  let sumAll = 0, sumB = 0, sumA = 0;
  for (const c of cats) {
    const a = await count({ catalogueName: c.catalogueName, Domain: 'Archaea' });
    await sleep(250);
    const b = await count({ catalogueName: c.catalogueName, Domain: 'Bacteria' });
    await sleep(250);
    report.catalogues.push({
      catalogue: c.catalogueName, group: c.catalogueGroup,
      genomeNum: c.genomeNum, archaea: a, bacteria: b,
    });
    sumAll += (a || 0) + (b || 0); sumB += b || 0; sumA += a || 0;
  }
  report.catalogueTotals = { bacteria: sumB, archaea: sumA, bacteriaPlusArchaea: sumAll };

  // 3. species-level split from the rank endpoint
  report.speciesLevel = [];
  let spB = 0, spA = 0;
  for (const c of cats) {
    const r = await gc.apiGet('/catalogue/overview/rank', { catalogueName: c.catalogueName });
    const d = r.json && r.json.data;
    if (!d || !d.Bacteria || !d.Archaea) continue;
    const pick = (arr) => {
      const row = arr.find(x => x.name === 'Species') || {};
      return { annotated: row.AnnotatedCount || 0, novel: row.NovelCount || 0 };
    };
    const b = pick(d.Bacteria), a = pick(d.Archaea);
    report.speciesLevel.push({ catalogue: c.catalogueName, bacteria: b, archaea: a });
    spB += b.annotated; spA += a.annotated;
    await sleep(250);
  }
  report.speciesLevelTotals = { annotatedBacteria: spB, annotatedArchaea: spA };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'gcmeta_domain_breakdown.json'), JSON.stringify(report, null, 2));

  console.log('global:', report.global);
  console.log('catalogueTotals:', report.catalogueTotals);
  console.log('speciesLevelTotals (annotated species, per-catalogue sum):', report.speciesLevelTotals);
  const top = [...report.catalogues].sort((x, y) => y.archaea - x.archaea).slice(0, 12);
  console.log('\ntop archaeal catalogues:');
  top.forEach(r => console.log('  ' + r.catalogue.padEnd(24) + 'archaea=' + String(r.archaea).padStart(7) +
    ' bacteria=' + String(r.bacteria).padStart(9) + '  archaea%=' +
    (((r.archaea || 0) / ((r.archaea || 0) + (r.bacteria || 1))) * 100).toFixed(2)));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
