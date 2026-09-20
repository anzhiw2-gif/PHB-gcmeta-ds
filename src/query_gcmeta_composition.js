#!/usr/bin/env node
/**
 * gcMeta composition audit: domain (Bacteria/Archaea/Eukaryota), biome groups,
 * records without a biome assignment, and PHB-relevant archaeal counts.
 *
 * Usage: node src/query_gcmeta_composition.js
 * Output: data/out/gcmeta_composition.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const gc = require('./gcmeta_client.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'out');
const GROUPS = ['Human', 'Large Livestock', 'Animals', 'Marine', 'Environments', 'Poultry',
  'Extreme Environments', 'Freshwater', 'Wild Animals', 'Domestic Animals',
  'Plant Rhizosphere', 'Fish'];

async function count(params) {
  const r = await gc.apiGet('/genome/list', { ...params, pageNum: 1, pageSize: 1 });
  const d = r.json && r.json.data;
  if (!d || typeof d === 'string') return null;
  return d.totalElements;
}

(async () => {
  await gc.init();
  const report = { queriedAt: new Date().toISOString(), scope: {}, domains: {}, groups: [], catalogues: {} };

  report.scope.totalGenomeRecords = await count({});
  report.scope.biosamples = (await gc.apiGet('/sample/list', { pageNum: 1, pageSize: 1 })).json.data.totalElements;
  report.scope.projects = (await gc.apiGet('/project/list', { pageNum: 1, pageSize: 1 })).json.data.totalElements;

  for (const d of ['Bacteria', 'Archaea', 'Eukaryota', 'Fungi', 'Novel Species']) {
    report.domains[d] = await count({ Domain: d });
  }
  report.domains.unassigned = (report.scope.totalGenomeRecords || 0)
    - (report.domains.Bacteria || 0) - (report.domains.Archaea || 0);

  const cats = (await gc.apiGet('/catalogue/catalogueList', { pageNum: 1, pageSize: 100 })).json.data.content;
  let mags = 0, species = 0;
  for (const c of cats) mags += c.genomeNum, species += c.speciesNum;
  report.catalogues = { count: cats.length, magsInCatalogues: mags, speciesLevelPerCatalogueSum: species };

  for (const g of GROUPS) {
    report.groups.push({
      group: g,
      mags: await count({ catalogueGroup: g }),
      bacteria: await count({ catalogueGroup: g, Domain: 'Bacteria' }),
      archaea: await count({ catalogueGroup: g, Domain: 'Archaea' }),
    });
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'gcmeta_composition.json'), JSON.stringify(report, null, 2));

  console.log('domain counts:', report.domains);
  console.log('catalogues:', report.catalogues);
  console.table(report.groups.map(g => ({
    group: g.group, MAGs: g.mags, Archaea: g.archaea,
    'archaea %': g.mags ? ((g.archaea / g.mags) * 100).toFixed(2) : '0',
  })));
  console.log('written: data/out/gcmeta_composition.json');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
