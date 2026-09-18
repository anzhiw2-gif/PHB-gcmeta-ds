#!/usr/bin/env node
/**
 * Aggregate gcMeta PHB-degradation query results into genome-level tables.
 *
 * Inputs : data/raw/*.json produced by src/query_gcmeta_phb.js
 * Outputs: data/out/phb_degradation_genomes.tsv
 *          data/out/phb_degradation_loci.tsv
 *          data/out/phb_deg_summary.json
 *          data/out/phb_deg_distribution_by_catalogue.tsv
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'data', 'out');
const GENE_SET = path.join(ROOT, 'config', 'phb_degradation_genes.tsv');

const DEPOLYMERASE_KOS = ['K05973', 'K22249', 'K22250'];       // tier 1
const MOBILIZATION_KOS = ['K07518', 'K00019', 'K01907'];       // tier 2
const DEG_KOS = [...DEPOLYMERASE_KOS, ...MOBILIZATION_KOS];
const SYNTH_KOS = ['K00626', 'K00023', 'K03821'];

function loadGeneSet() {
  const lines = fs.readFileSync(GENE_SET, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const head = lines[0].replace(/^\uFEFF/, '').split('\t');
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split('\t');
    const row = {};
    head.forEach((h, j) => { row[h] = v[j]; });
    map[row.ko] = row;
  }
  return map;
}

function ls(prefix) {
  return fs.readdirSync(RAW).filter(f => f.startsWith(prefix) && f.endsWith('.json'));
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const geneSet = loadGeneSet();

  // ---- genome-level presence (from genomes_<KO>_<cat>.json) ----
  const genomeMap = new Map(); // genomeNo -> record
  for (const f of ls('genomes_')) {
    const m = f.match(/^genomes_(K\d+)_(.+)\.json$/);
    if (!m) continue;
    const ko = m[1];
    const cat = m[2].replace(/_/g, ' ');
    const data = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    for (const row of data.content || []) {
      const gno = row.genomeNo;
      if (!genomeMap.has(gno)) {
        genomeMap.set(gno, {
          genomeNo: gno,
          speciesGenomeNo: row.speciesGenomeNo || '',
          taxonomy: row.taxonomy || '',
          lineage: row.lineage || '',
          biorank: row.biorank || '',
          D_name: row.D_name || '',
          size: row.size || '',
          gc: row.gc || '',
          contig: row.contig || '',
          completeness: row.completeness || '',
          contamination: row.contamination || '',
          quality: row.quality || '',
          type: row.type || '',
          OTU: row.OTU || '',
          OTU_status: row.OTU_status || '',
          runNo: row.runNo || '',
          sampleNo: row.sampleNo || '',
          projectNo: row.projectNo || '',
          catalogueGroup: row.catalogueGroup || '',
          catalogueName: row.catalogueName || cat,
          degKos: {}, synthKos: {}, nLoci: {},
        });
      }
      const rec = genomeMap.get(gno);
      rec.degKos[ko] = (rec.degKos[ko] || 0) + 1;
      if (SYNTH_KOS.includes(ko)) rec.synthKos[ko] = (rec.synthKos[ko] || 0) + 1;
      if (rec.catalogueName !== row.catalogueName) rec.catalogueName += ';' + row.catalogueName;
    }
  }
  console.log(`[aggregate] genomes with any queried KO: ${genomeMap.size}`);

  // ---- gene-level loci (from loci_<KO>.json) ----
  const lociRows = [];
  for (const f of ls('loci_')) {
    const ko = f.match(/^loci_(K\d+)\.json$/)[1];
    const data = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    for (const row of data.content || []) {
      lociRows.push({
        ko, genomeId: row.genomeId, locusid: row.locusid, contigId: row.contigId,
        sStart: row.sStart, eEnd: row.eEnd, orient: row.orient,
        gtdb_mini_taxonomy: row.gtdb_mini_taxonomy || '', gtdb_lineage: row.gtdb_lineage || '',
      });
      if (genomeMap.has(row.genomeId)) {
        const rec = genomeMap.get(row.genomeId);
        rec.nLoci[ko] = (rec.nLoci[ko] || 0) + 1;
      } else {
        // loci without a genomeList record (should be rare): add minimal record
        genomeMap.set(row.genomeId, {
          genomeNo: row.genomeId, speciesGenomeNo: '', taxonomy: row.gtdb_mini_taxonomy || '',
          lineage: row.gtdb_lineage || '', biorank: '', D_name: '', size: '', gc: '', contig: '',
          completeness: '', contamination: '', quality: '', type: '', OTU: '', OTU_status: '',
          runNo: '', sampleNo: '', projectNo: '', catalogueGroup: '', catalogueName: '',
          degKos: {}, synthKos: {}, nLoci: { [ko]: 1 },
        });
      }
    }
  }
  console.log(`[aggregate] loci rows: ${lociRows.length}`);

  // ---- tiering ----
  const genomes = [...genomeMap.values()];
  for (const rec of genomes) {
    const deg = Object.keys(rec.degKos).filter(k => DEG_KOS.includes(k));
    rec.hasDepolymerase = DEPOLYMERASE_KOS.some(k => deg.includes(k));
    rec.hasMobilization = MOBILIZATION_KOS.some(k => deg.includes(k));
    rec.degKosList = deg.sort().join(';');
    rec.nDegKos = deg.length;
    rec.hasSynth = Object.keys(rec.synthKos).some(k => SYNTH_KOS.includes(k));
    rec.synthKosList = Object.keys(rec.synthKos).sort().join(';');
    if (rec.hasDepolymerase) rec.tier = 1;
    else if (rec.degKos.K07518 || (rec.degKos.K00019 && rec.degKos.K01907)) rec.tier = 2;
    else rec.tier = 3;
  }

  const degGenomes = genomes.filter(g => g.nDegKos > 0).sort((a, b) =>
    (a.tier - b.tier) || (b.nDegKos - a.nDegKos) || (a.genomeNo < b.genomeNo ? -1 : 1));

  // ---- outputs ----
  const tsvHead = ['genomeNo', 'speciesGenomeNo', 'taxonomy', 'lineage', 'biorank', 'D_name',
    'catalogueGroup', 'catalogueName', 'quality', 'completeness', 'contamination', 'size', 'gc',
    'contig', 'type', 'OTU', 'OTU_status', 'projectNo', 'sampleNo', 'runNo',
    'tier', 'nDegKos', 'degKos', 'nDepolymeraseLoci', 'depolymeraseLoci', 'synthKos'];
  const esc = (v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
  const lines = [tsvHead.join('\t')];
  for (const g of degGenomes) {
    const depLoci = DEPOLYMERASE_KOS.map(k => (g.nLoci[k] || 0) + 'x' + k).filter(x => !x.startsWith('0x'));
    lines.push([
      g.genomeNo, g.speciesGenomeNo, esc(g.taxonomy), esc(g.lineage), g.biorank, g.D_name,
      g.catalogueGroup, esc(g.catalogueName), g.quality, g.completeness, g.contamination,
      g.size, g.gc, g.contig, g.type, g.OTU, g.OTU_status, g.projectNo, g.sampleNo, g.runNo,
      g.tier, g.nDegKos, g.degKosList, depLoci.reduce((a, b) => a + (parseInt(b) || 0), 0),
      depLoci.join(','), g.synthKosList,
    ].map(esc).join('\t'));
  }
  const gOut = path.join(OUT, 'phb_degradation_genomes.tsv');
  fs.writeFileSync(gOut, lines.join('\n') + '\n');

  const lociLines = ['ko\tgenomeId\tlocusid\tcontigId\tsStart\teEnd\torient\tgtdb_mini_taxonomy\tgtdb_lineage'];
  for (const l of lociRows) {
    lociLines.push([l.ko, l.genomeId, l.locusid, l.contigId, l.sStart, l.eEnd, l.orient,
      esc(l.gtdb_mini_taxonomy), esc(l.gtdb_lineage)].map(esc).join('\t'));
  }
  fs.writeFileSync(path.join(OUT, 'phb_degradation_loci.tsv'), lociLines.join('\n') + '\n');

  // distribution per catalogue
  const distMap = {};
  for (const f of ls('dist_')) {
    const ko = f.match(/^dist_(K\d+)\.json$/)[1];
    const data = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    for (const row of data.content || []) {
      for (const cl of row.catalogueList || []) {
        if (cl.catalogue == null) continue;
        const key = cl.catalogue;
        if (!distMap[key]) distMap[key] = {};
        distMap[key][ko] = {
          speciesCount: cl.speciesCount == null ? 0 : cl.speciesCount,
          novelSpeciesCount: cl.novelSpeciesCount == null ? 0 : cl.novelSpeciesCount,
          xDBclass: row.xDBclass, xDBname: row.xDBname,
        };
      }
    }
  }
  const distLines = ['catalogue\t' + DEG_KOS.map(k => `${k}_species\t${k}_novelSpecies`).join('\t')];
  for (const [cat, kos] of Object.entries(distMap).sort()) {
    const cells = [cat];
    for (const k of DEG_KOS) {
      const v = kos[k];
      cells.push(v ? v.speciesCount : 0, v ? v.novelSpeciesCount : 0);
    }
    distLines.push(cells.join('\t'));
  }
  fs.writeFileSync(path.join(OUT, 'phb_deg_distribution_by_catalogue.tsv'), distLines.join('\n') + '\n');

  // summary
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  const byCat = {};
  const phylumCounts = {};
  for (const g of degGenomes) {
    tierCounts[g.tier]++;
    const cat = String(g.catalogueName).split(';')[0];
    byCat[cat] = (byCat[cat] || 0) + 1;
    const phy = String(g.lineage).split(';')[1] || 'unknown';
    phylumCounts[phy] = (phylumCounts[phy] || 0) + 1;
  }
  const summary = {
    totalGenomesWithDegKOs: degGenomes.length,
    tierCounts,
    depolymeraseGenomes: degGenomes.filter(g => g.hasDepolymerase).length,
    producerGenomesAmongDegraders: degGenomes.filter(g => g.hasSynth).length,
    byCatalogue: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    topPhyla: Object.entries(phylumCounts).sort((a, b) => b[1] - a[1]).slice(0, 20),
    lociTotal: lociRows.length,
  };
  fs.writeFileSync(path.join(OUT, 'phb_deg_summary.json'), JSON.stringify(summary, null, 2));

  console.log('[aggregate] tier1 (depolymerase):', tierCounts[1]);
  console.log('[aggregate] tier2 (3HB mobilization):', tierCounts[2]);
  console.log('[aggregate] tier3 (partial):', tierCounts[3]);
  console.log('[aggregate] wrote:', gOut);
}

main();
