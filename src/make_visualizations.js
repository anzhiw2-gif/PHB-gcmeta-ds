#!/usr/bin/env node
/**
 * Visualize PHB-degradation search results (data/out/*) as SVG figures and a
 * self-contained HTML report. Zero dependencies, works offline.
 *
 * Outputs: data/out/figures/*.svg, data/out/report.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'out');
const FIG = path.join(OUT, 'figures');
const GENOMES = path.join(OUT, 'phb_degradation_genomes.tsv');
const LOCI = path.join(OUT, 'phb_degradation_loci.tsv');
const DIST = path.join(OUT, 'phb_deg_distribution_by_catalogue.tsv');

const KO_NAMES = {
  K05973: 'phaZ PHB depolymerase (3.1.1.75)',
  K22249: 'phaZ PHO depolymerase (3.1.1.76)',
  K22250: 'phaZ PHO depolymerase (3.1.1.76)',
  K07518: '3HB-dimer hydrolase (3.1.1.22)',
  K00019: '3-hydroxybutyrate DH (1.1.1.30)',
  K01907: 'acetoacetyl-CoA synthetase (6.2.1.16)',
};
const KO_ORDER = ['K05973', 'K22249', 'K22250', 'K07518', 'K00019', 'K01907'];

// ---------- data loading ----------
function readTSV(p) {
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const head = lines[0].split('\t');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split('\t');
    const r = {};
    head.forEach((h, j) => { r[h] = v[j]; });
    rows.push(r);
  }
  return rows;
}

const genomes = readTSV(GENOMES);
const loci = readTSV(LOCI);
const distRows = readTSV(DIST);

// ---------- derived stats ----------
const tierCounts = { 1: 0, 2: 0, 3: 0 };
const catCounts = {};
const phylumCounts = {};
const qualityBins = new Array(10).fill(0); // tier1 completeness 50..100 step 5
const koLoci = {};
const synthByTier = { 1: { withPhaC: 0, withSynthNoPhaC: 0, noSynth: 0 }, 2: { withPhaC: 0, withSynthNoPhaC: 0, noSynth: 0 }, 3: { withPhaC: 0, withSynthNoPhaC: 0, noSynth: 0 } };

for (const g of genomes) {
  const tier = parseInt(g.tier);
  tierCounts[tier]++;
  // catalogue memberships: the API returns comma-joined names for multi-membership
  for (const c of String(g.catalogueName).split(/[,;]/)) {
    const cc = c.trim();
    if (cc) catCounts[cc] = (catCounts[cc] || 0) + 1;
  }
  const phy = (String(g.lineage).split(';').find(t => t.startsWith('p__')) || 'p__unknown').replace(/^p__/, '');
  phylumCounts[phy] = (phylumCounts[phy] || 0) + 1;
  const comp = parseFloat(g.completeness);
  if (tier === 1 && !isNaN(comp)) {
    const b = Math.min(9, Math.max(0, Math.floor((comp - 50) / 5)));
    qualityBins[b]++;
  }
  const hasPhaC = String(g.synthKos).includes('K03821');
  const hasSynth = String(g.synthKos).trim() !== '';
  if (hasPhaC) synthByTier[tier].withPhaC++;
  else if (hasSynth) synthByTier[tier].withSynthNoPhaC++;
  else synthByTier[tier].noSynth++;
}
for (const l of loci) koLoci[l.ko] = (koLoci[l.ko] || 0) + 1;

// per-KO species totals across catalogues (distribution table)
const koSpecies = {};
for (const r of distRows) {
  for (const k of KO_ORDER) {
    koSpecies[k] = (koSpecies[k] || 0) + (parseInt(r[k + '_species']) || 0);
  }
}
// heatmap matrix: catalogue x KO (log10 speciesCount)
const heatCats = distRows.map(r => r.catalogue);
const heatData = distRows.map(r => KO_ORDER.map(k => parseInt(r[k + '_species']) || 0));

const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
const topPhyla = Object.entries(phylumCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
const totalDeg = tierCounts[1] + tierCounts[2] + tierCounts[3];

// ---------- SVG helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function hbar({ labels, values, width = 760, color = '#1f77b4', title = '', xlabel = 'count', filename }) {
  const h = 60 + labels.length * 34;
  const plotL = 340, plotR = width - 60, plotT = 60, plotB = h - 40;
  const maxV = Math.max(...values, 1);
  const svg = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" font-family="Segoe UI,Arial,sans-serif">`);
  svg.push(`<text x="${width / 2}" y="28" font-size="19" font-weight="bold" text-anchor="middle">${esc(title)}</text>`);
  for (let i = 0; i < labels.length; i++) {
    const y = plotT + i * 34 + 12;
    const w = (values[i] / maxV) * (plotR - plotL);
    svg.push(`<text x="${plotL - 8}" y="${y + 4}" font-size="13" text-anchor="end">${esc(labels[i])}</text>`);
    svg.push(`<rect x="${plotL}" y="${y - 12}" width="${w}" height="20" rx="3" fill="${color}" opacity="0.88"/>`);
    svg.push(`<text x="${plotL + w + 6}" y="${y + 4}" font-size="12" fill="#333">${values[i].toLocaleString()}</text>`);
  }
  svg.push(`<text x="${(plotL + plotR) / 2}" y="${h - 12}" font-size="13" fill="#555" text-anchor="middle">${esc(xlabel)}</text>`);
  svg.push('</svg>');
  return writeFig(filename, svg.join('\n'));
}

function vbar({ labels, values, width = 760, height = 380, color = '#1f77b4', title = '', xlabel = '', ylabel = '', filename, log = false }) {
  const plotL = 90, plotR = width - 30, plotT = 60, plotB = height - 60;
  const svg = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI,Arial,sans-serif">`);
  svg.push(`<text x="${width / 2}" y="28" font-size="19" font-weight="bold" text-anchor="middle">${esc(title)}</text>`);
  const vals = log ? values.map(v => Math.log10(v + 1)) : values;
  const maxV = Math.max(...vals, 1e-9);
  const bw = (plotR - plotL) / labels.length;
  for (let i = 0; i < labels.length; i++) {
    const x = plotL + i * bw + bw * 0.18;
    const h = (vals[i] / maxV) * (plotB - plotT);
    svg.push(`<rect x="${x}" y="${plotB - h}" width="${bw * 0.64}" height="${h}" rx="3" fill="${color}" opacity="0.88"/>`);
    svg.push(`<text x="${x + bw * 0.32}" y="${plotB - h - 6}" font-size="12" text-anchor="middle" fill="#333">${values[i].toLocaleString()}</text>`);
    svg.push(`<text x="${x + bw * 0.32}" y="${plotB + 18}" font-size="12" text-anchor="middle">${esc(labels[i])}</text>`);
  }
  svg.push(`<text x="${plotL}" y="${height - 14}" font-size="13" fill="#555">${esc(xlabel)}</text>`);
  svg.push(`<text x="16" y="${(plotT + plotB) / 2}" font-size="13" fill="#555" text-anchor="middle" transform="rotate(-90 16 ${(plotT + plotB) / 2})">${esc(ylabel)}${log ? ' (log10)' : ''}</text>`);
  svg.push('</svg>');
  return writeFig(filename, svg.join('\n'));
}

function heatmap({ rows, cols, data, width = 900, cellH = 15, cellW = 130, title = '', filename }) {
  const plotL = 240, plotT = 50;
  const plotR = plotL + cols.length * cellW;
  const height = plotT + 60 + rows.length * cellH + 40;
  const svg = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI,Arial,sans-serif">`);
  svg.push(`<text x="${width / 2}" y="26" font-size="18" font-weight="bold" text-anchor="middle">${esc(title)}</text>`);
  const maxV = Math.max(1, ...data.flat());
  for (let i = 0; i < rows.length; i++) {
    svg.push(`<text x="${plotL - 8}" y="${plotT + 60 + i * cellH + 10}" font-size="12" text-anchor="end">${esc(rows[i])}</text>`);
    for (let j = 0; j < cols.length; j++) {
      const v = data[i][j];
      const t = Math.log10(v + 1) / Math.log10(maxV + 1);
      const color = `hsl(${215 - 215 * t}, ${60 + 30 * t}%, ${96 - 55 * t}%)`;
      svg.push(`<rect x="${plotL + j * cellW}" y="${plotT + 60 + i * cellH}" width="${cellW - 1}" height="${cellH - 1}" fill="${color}"/>`);
      if (v > 0) svg.push(`<text x="${plotL + j * cellW + cellW / 2}" y="${plotT + 60 + i * cellH + 10}" font-size="10" text-anchor="middle" fill="${t > 0.45 ? '#fff' : '#333'}">${v.toLocaleString()}</text>`);
    }
  }
  for (let j = 0; j < cols.length; j++) {
    svg.push(`<text x="${plotL + j * cellW + cellW / 2}" y="${plotT + 52}" font-size="11" text-anchor="middle">${esc(cols[j])}</text>`);
  }
  svg.push(`<text x="${plotL}" y="${height - 16}" font-size="12" fill="#555">species counts per catalogue (log10 colour scale; 0 = absent)</text>`);
  svg.push('</svg>');
  return writeFig(filename, svg.join('\n'));
}

function stacked({ labels, series, width = 620, height = 340, colors, title = '', filename }) {
  const plotL = 90, plotR = width - 30, plotT = 60, plotB = height - 50;
  const svg = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI,Arial,sans-serif">`);
  svg.push(`<text x="${width / 2}" y="28" font-size="18" font-weight="bold" text-anchor="middle">${esc(title)}</text>`);
  const totals = series[0].map((_, i) => series.reduce((a, s) => a + s[i], 0));
  const maxT = Math.max(...totals, 1);
  const bw = (plotR - plotL) / labels.length;
  for (let i = 0; i < labels.length; i++) {
    let y = plotB;
    for (let si = 0; si < series.length; si++) {
      const h = (series[si][i] / maxT) * (plotB - plotT);
      y -= h;
      svg.push(`<rect x="${plotL + i * bw + bw * 0.15}" y="${y}" width="${bw * 0.7}" height="${h}" fill="${colors[si]}"/>`);
      if (series[si][i] > 0) svg.push(`<text x="${plotL + i * bw + bw * 0.5}" y="${y + h / 2 + 4}" font-size="11" text-anchor="middle" fill="#fff">${series[si][i].toLocaleString()}</text>`);
    }
    svg.push(`<text x="${plotL + i * bw + bw * 0.5}" y="${plotB + 18}" font-size="12" text-anchor="middle">${esc(labels[i])}</text>`);
  }
  svg.push('</svg>');
  return writeFig(filename, svg.join('\n'));
}

function histogram({ data, labels, width = 700, height = 340, title = '', filename }) {
  const plotL = 80, plotR = width - 30, plotT = 60, plotB = height - 50;
  const maxV = Math.max(...data, 1);
  const bw = (plotR - plotL) / data.length;
  const svg = [];
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI,Arial,sans-serif">`);
  svg.push(`<text x="${width / 2}" y="28" font-size="18" font-weight="bold" text-anchor="middle">${esc(title)}</text>`);
  for (let i = 0; i < data.length; i++) {
    const h = (data[i] / maxV) * (plotB - plotT);
    svg.push(`<rect x="${plotL + i * bw + 2}" y="${plotB - h}" width="${bw - 4}" height="${h}" fill="#2c7fb8" opacity="0.9"/>`);
    svg.push(`<text x="${plotL + i * bw + bw / 2}" y="${plotB + 16}" font-size="10" text-anchor="middle">${esc(labels[i])}</text>`);
    if (data[i] > 0) svg.push(`<text x="${plotL + i * bw + bw / 2}" y="${plotB - h - 5}" font-size="10" text-anchor="middle" fill="#333">${data[i].toLocaleString()}</text>`);
  }
  svg.push('</svg>');
  return writeFig(filename, svg.join('\n'));
}

function writeFig(name, svg) {
  const p = path.join(FIG, name);
  fs.writeFileSync(p, svg);
  return p;
}

// ---------- figures ----------
fs.mkdirSync(FIG, { recursive: true });
const figs = [];

figs.push(vbar({
  labels: ['Tier 1\ndepolymerase', 'Tier 2\n3HB mobilization', 'Tier 3\npartial'],
  values: [tierCounts[1], tierCounts[2], tierCounts[3]],
  color: '#c0392b', title: `PHB-degradation genomes by tier (total ${totalDeg.toLocaleString()})`,
  xlabel: 'tier', ylabel: 'genomes', filename: 'chart_tiers.svg',
}));

figs.push(hbar({
  labels: topCats.map(c => c[0]), values: topCats.map(c => c[1]),
  color: '#2471a3', title: 'Top 15 biomes by PHB-degradation genome memberships',
  xlabel: 'catalogue memberships', filename: 'chart_catalogues.svg',
}));

figs.push(hbar({
  labels: topPhyla.map(p => p[0]), values: topPhyla.map(p => p[1]),
  color: '#1e8449', title: 'Top 12 phyla (GTDB) among PHB-degradation genomes',
  xlabel: 'genomes', filename: 'chart_phyla.svg',
}));

figs.push(vbar({
  labels: KO_ORDER, values: KO_ORDER.map(k => koSpecies[k] || 0),
  color: '#8e44ad', title: 'Species-level genomes carrying each PHB-degradation KO (all 50 catalogues)',
  xlabel: 'KO', ylabel: 'species', log: true, filename: 'chart_kos.svg',
}));

figs.push(vbar({
  labels: ['K05973\nphaZ PHB', 'K22249\nphaZ PHO', 'K22250\nphaZ PHO', 'K07518\ndimer hydrolase'],
  values: ['K05973', 'K22249', 'K22250', 'K07518'].map(k => koLoci[k] || 0),
  color: '#d35400', title: 'Gene loci (depolymerase / hydrolase) retrieved from gcMeta',
  xlabel: 'KO', ylabel: 'loci', log: true, filename: 'chart_loci.svg',
}));

figs.push(stacked({
  labels: ['Tier 1', 'Tier 2', 'Tier 3'],
  series: [
    [synthByTier[1].withPhaC, synthByTier[2].withPhaC, synthByTier[3].withPhaC],
    [synthByTier[1].withSynthNoPhaC, synthByTier[2].withSynthNoPhaC, synthByTier[3].withSynthNoPhaC],
    [synthByTier[1].noSynth, synthByTier[2].noSynth, synthByTier[3].noSynth],
  ],
  colors: ['#1f618d', '#7fb3d5', '#d5d8dc'],
  title: 'PHB synthesis genes in degradation-genome tiers (phaA/phaB/phaC)',
  filename: 'chart_synth_overlap.svg',
}));

figs.push(histogram({
  data: qualityBins,
  labels: ['50-55', '55-60', '60-65', '65-70', '70-75', '75-80', '80-85', '85-90', '90-95', '95-100'],
  title: 'Tier-1 (depolymerase-positive) genomes by CheckM completeness (%)',
  filename: 'chart_quality.svg',
}));

figs.push(heatmap({
  rows: heatCats, cols: KO_ORDER, data: heatData,
  title: 'PHB-degradation KO x biome catalogue (species counts)',
  filename: 'chart_heatmap.svg',
}));

// ---------- HTML report ----------
const topGenomes = [...genomes].sort((a, b) =>
  (parseInt(a.tier) - parseInt(b.tier)) || (parseInt(b.nDegKos) - parseInt(a.nDegKos)) ||
  ((parseFloat(b.completeness) || 0) - (parseFloat(a.completeness) || 0))).slice(0, 15);

const tableRows = topGenomes.map(g => `<tr>
  <td>${esc(g.genomeNo)}</td>
  <td><i>${esc(g.taxonomy.replace(/^s__/, ''))}</i></td>
  <td>${esc(g.catalogueName.split(/[,;]/)[0])}</td>
  <td>${esc(g.quality)}</td>
  <td>${esc(g.completeness)}</td>
  <td>${esc(g.degKos)}</td>
  <td>${esc(g.nDepolymeraseLoci)}</td>
  <td>${esc(g.synthKos)}</td>
</tr>`).join('\n');

const figBlocks = [
  ['chart_tiers.svg', '按层级统计'],
  ['chart_catalogues.svg', '生境分布'],
  ['chart_phyla.svg', '门水平分布'],
  ['chart_kos.svg', '各 KO 覆盖物种数'],
  ['chart_loci.svg', '解聚酶位点数'],
  ['chart_synth_overlap.svg', '与 PHB 合成基因的共现'],
  ['chart_quality.svg', 'Tier-1 基因组完整度'],
  ['chart_heatmap.svg', 'KO × 目录热图'],
].map(([f, cap]) => `<figure style="margin:18px 0;text-align:center;">
  <img src="figures/${f}" style="max-width:100%;border:1px solid #ddd;border-radius:6px;" alt="${cap}">
  <figcaption style="color:#555;font-size:13px;margin-top:6px;">${cap}</figcaption>
</figure>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gcMeta PHB 降解基因组检索 — 可视化报告</title>
<style>
 body{font-family:"Segoe UI","Microsoft YaHei",Arial,sans-serif;max-width:1000px;margin:0 auto;padding:24px;color:#222;}
 h1{font-size:26px;border-bottom:3px solid #c0392b;padding-bottom:10px;}
 h2{font-size:19px;margin-top:34px;color:#7b241c;}
 .cards{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0;}
 .card{flex:1 1 160px;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:8px;padding:14px;text-align:center;}
 .card .num{font-size:26px;font-weight:bold;color:#c0392b;}
 .card .lbl{font-size:12px;color:#555;margin-top:4px;}
 table{border-collapse:collapse;width:100%;font-size:13px;margin-top:10px;}
 th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}
 th{background:#f0f3f5;}
 .note{color:#666;font-size:12px;margin-top:8px;}
 code{background:#f2f2f2;padding:1px 5px;border-radius:3px;}
</style></head><body>
<h1>gcMeta 中 PHB 降解相关基因组 — 可视化报告</h1>
<p class="note">数据源:gcMeta 2025(Sun et al., NAR 54:D724-D733, doi:10.1093/nar/gkaf1115);
检索框架:PhaDED / PHA Depolymerase Engineering Database(Knoll et al. 2009)→ KEGG KO。
生成日期:2026-09-18。原始数据:<code>phb_degradation_genomes.tsv</code>、
<code>phb_degradation_loci.tsv</code>、<code>phb_deg_distribution_by_catalogue.tsv</code>。</p>

<div class="cards">
 <div class="card"><div class="num">${totalDeg.toLocaleString()}</div><div class="lbl">携带 PHB 降解基因的基因组</div></div>
 <div class="card"><div class="num">${tierCounts[1].toLocaleString()}</div><div class="lbl">Tier 1 · 解聚酶阳性</div></div>
 <div class="card"><div class="num">${tierCounts[2].toLocaleString()}</div><div class="lbl">Tier 2 · 3HB 动员</div></div>
 <div class="card"><div class="num">${tierCounts[3].toLocaleString()}</div><div class="lbl">Tier 3 · 部分</div></div>
 <div class="card"><div class="num">${Object.values(koLoci).reduce((a, b) => a + b, 0).toLocaleString()}</div><div class="lbl">解聚酶/水解酶位点</div></div>
</div>

${figBlocks}

<h2>代表性命中基因组(前 15)</h2>
<table>
<tr><th>genomeNo</th><th>物种 (GTDB)</th><th>主要目录</th><th>质量</th><th>完整度%</th><th>PHB 降解 KO</th><th>解聚酶位点</th><th>合成 KO</th></tr>
${tableRows}
</table>
<p class="note">注:目录为逗号/分号分隔的多目录归属的第一项;KO 缩写见 <code>config/phb_degradation_genes.tsv</code>。</p>

<p class="note" style="margin-top:26px;">复现:<code>node src/query_gcmeta_phb.js</code> → <code>node src/aggregate_phb_genomes.js</code> → <code>node src/make_visualizations.js</code></p>
</body></html>`;

const report = path.join(OUT, 'report.html');
fs.writeFileSync(report, html);

console.log('[viz] figures:', figs.length);
console.log('[viz] report:', report);
console.log('[viz] sanity:', JSON.stringify({
  tierCounts, totalDeg, koLoci, koSpecies,
  topCats: topCats.slice(0, 5), topPhyla: topPhyla.slice(0, 5),
  qualityBins,
  heatCatsN: heatCats.length,
}, null, 1));
