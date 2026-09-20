#!/usr/bin/env node
/**
 * Query gcMeta (https://gcmeta.wdcm.org/) for PHB-degradation-related genomes.
 *
 * Uses the PhaDED / PHA Depolymerase Engineering Database (DED) classification
 * architecture (Knoll et al. 2009, BMC Bioinformatics 10:89) mapped onto KEGG
 * orthologs (config/phb_degradation_genes.tsv).
 *
 * For every KO it retrieves:
 *   1. global distribution across the 50 biome catalogues  (/function/annotation/chart/list/KEGG)
 *   2. gene-level loci with genomeId + GTDB lineage       (/catalogue/annotation/KEGG/info/locusList)
 *   3. genome-level records with quality metadata         (/function/genomeList, per catalogue)
 *
 * Raw JSON is cached under data/raw/ so re-runs resume automatically.
 * Visualize results afterwards with src/make_visualizations.js.
 *
 * Usage:  node src/query_gcmeta_phb.js [--ko K05973] [--fresh]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const gc = require('./gcmeta_client.js');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const GENE_SET = path.join(ROOT, 'config', 'phb_degradation_genes.tsv');
const PAGE_SIZE = 100;
const LOCI_CAP = 100000; // per-KO cap on loci downloaded
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadGeneSet() {
  const lines = fs.readFileSync(GENE_SET, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const head = lines[0].replace(/^\uFEFF/, '').split('\t');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split('\t');
    const row = {};
    head.forEach((h, j) => { row[h] = v[j]; });
    if (!row.ko) continue; // skip malformed rows
    row.include_loci = row.include_loci === '1';
    out.push(row);
  }
  return out;
}

function save(name, obj) {
  const p = path.join(RAW, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 1));
  return p;
}

function has(name) { return fs.existsSync(path.join(RAW, name)); }
function load(name) { return JSON.parse(fs.readFileSync(path.join(RAW, name), 'utf8')); }

async function fetchPages(pathName, params, cap) {
  const rows = [];
  let total = null;
  for (let page = 1; page <= 10000; page++) {
    const r = await gc.apiGet(pathName, { ...params, pageNum: page, pageSize: PAGE_SIZE });
    if (r.status !== 200) throw new Error(`${pathName} HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`);
    const data = r.json.data;
    if (typeof data === 'string') throw new Error(`${pathName}: ${data}`);
    total = data.totalElements;
    const content = data.content || [];
    rows.push(...content);
    if (content.length < PAGE_SIZE || data.last) break;
    if (cap && rows.length >= cap) break;
    await sleep(DELAY_MS);
  }
  return { rows, total };
}

async function main() {
  const args = process.argv.slice(2);
  const onlyKo = args.includes('--ko') ? args[args.indexOf('--ko') + 1] : null;
  const fresh = args.includes('--fresh');
  fs.mkdirSync(RAW, { recursive: true });

  const genes = loadGeneSet().filter(g => !onlyKo || g.ko === onlyKo);
  await gc.init();

  // 1. catalogues
  let catalogues;
  if (fresh || !has('catalogues.json')) {
    const { rows, total } = await fetchPages('/catalogue/catalogueList', {}, null);
    catalogues = rows;
    save('catalogues.json', { total, content: rows });
    console.log(`[catalogues] ${rows.length}/${total}`);
    await sleep(DELAY_MS);
  } else {
    catalogues = load('catalogues.json').content;
  }
  const allNames = catalogues.map(c => c.catalogueName);

  for (const g of genes) {
    const ko = g.ko;
    console.log(`\n===== ${ko} (${g.name}) tier=${g.tier} =====`);

    // 2. distribution across catalogues
    const distFile = `dist_${ko}.json`;
    if (fresh || !has(distFile)) {
      const r = await gc.apiGet('/function/annotation/chart/list/KEGG', {
        xDBid: ko, catalogueName: allNames.join(','), pageNum: 1, pageSize: 50,
      });
      if (r.status !== 200 || typeof r.json.data === 'string') {
        console.log(`  [dist] FAILED: ${JSON.stringify(r.json).slice(0, 200)}`);
      } else {
        save(distFile, r.json.data);
        const c = r.json.data.content[0];
        console.log(`  [dist] catalogues=${c ? c.catalogue_count : 0} phyla=${c ? c.phylum.length : 0} class=${c && c.xDBclass}`);
      }
      await sleep(DELAY_MS);
    } else {
      console.log('  [dist] cached');
    }

    // 3. loci (global, no catalogue filter)
    if (g.include_loci) {
      const lociFile = `loci_${ko}.json`;
      if (fresh || !has(lociFile)) {
        const probe = await gc.apiGet('/catalogue/annotation/KEGG/info/locusList', { xDBid: ko, pageNum: 1, pageSize: 1 });
        const total = probe.json && probe.json.data ? probe.json.data.totalElements : 0;
        console.log(`  [loci] total=${total}`);
        await sleep(DELAY_MS);
        if (typeof total === 'number' && total > 0) {
          if (total > LOCI_CAP) {
            console.log(`  [loci] SKIP: ${total} > cap ${LOCI_CAP}`);
          } else {
            const { rows } = await fetchPages('/catalogue/annotation/KEGG/info/locusList', { xDBid: ko }, LOCI_CAP);
            save(lociFile, { total, content: rows });
            console.log(`  [loci] fetched ${rows.length}/${total}`);
          }
        } else {
          save(lociFile, { total: 0, content: [] });
        }
        await sleep(DELAY_MS);
      } else {
        console.log('  [loci] cached');
      }
    }

    // 4. genome list per catalogue
    for (const cat of catalogues) {
      const catName = cat.catalogueName;
      const gFile = `genomes_${ko}_${catName.replace(/[^A-Za-z0-9]+/g, '_')}.json`;
      if (fresh || !has(gFile)) {
        try {
          const { rows, total } = await fetchPages('/function/genomeList', {
            anno: 'KEGG', xDBname: ko, catalogueName: catName,
          }, null);
          save(gFile, { total, content: rows });
          if (total > 0) console.log(`  [genomes] ${catName}: ${total}`);
          await sleep(DELAY_MS);
        } catch (e) {
          console.log(`  [genomes] ${catName}: ERROR ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log(`  done ${ko}`);
  }
  console.log('\nALL DONE');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
