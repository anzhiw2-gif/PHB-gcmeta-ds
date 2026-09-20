#!/usr/bin/env python3
"""
Fig. 1 — PHB degradation potential across gcMeta metagenome-assembled genomes.

Rendered with the nature-figure skill (Python backend). See QA notes in
fig1_qa_notes.txt. Source data: ../data/out/*.tsv.

Figure contract
---------------
Core conclusion:
  PHB-degradation potential is widespread in gcMeta: 18,297 of 109,586
  species-level representative MAGs carry at least one PHB-degradation gene,
  8,073 of them a bona fide phaZ depolymerase, with strong enrichment in
  aquatic biomes and Pseudomonadota, usually co-occurring with PHB synthesis.
Evidence chain (panels):
  a  global KO x biome distribution (hero; stated aggregation to 12 biome groups)
  b  tier abundance with PHB-synthesis co-occurrence (primary quantity)
  c  top catalogues (environmental stratification)
  d  top phyla (taxonomic stratification)
  e  depolymerase/hydrolase gene loci per KO (gene-level magnitude)
Archetype: quantitative grid with a full-width hero panel.
Backend: Python (matplotlib), saved as the nature-figure default.
Export: SVG (primary, editable text), PDF, TIFF 600 dpi, PNG 300 dpi.
"""

import os
import sys

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import matplotlib.ticker
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.transforms import ScaledTranslation

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKILL_SCRIPTS = os.path.join(ROOT, ".nature-skills", "skills", "nature-figure", "scripts")
sys.path.insert(0, SKILL_SCRIPTS)
from audit_panel_alignment import require_matplotlib_panel_alignment  # noqa: E402

OUT = os.path.join(HERE)
DATA = os.path.join(ROOT, "data", "out")

# ── MANDATORY font + SVG rules ────────────────────────────────────────────
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "DejaVu Sans", "Liberation Sans"],
    "svg.fonttype": "none",   # editable text in SVG
    "pdf.fonttype": 42,       # editable TrueType text in PDF
    "font.size": 7,
    "axes.spines.right": False,
    "axes.spines.top": False,
    "axes.linewidth": 0.8,
    "legend.frameon": False,
    "axes.titlesize": 7,
})

# ── palette (nature-figure PALETTE) ───────────────────────────────────────
BLUE = "#0F4D92"
TEAL = "#42949E"
NEUTRAL_LIGHT = "#CFCECE"
NEUTRAL_MID = "#767676"
NEUTRAL_DARK = "#4D4D4D"
RED_STRONG = "#B64342"

KO_LABELS = ["K05973\nphaZ", "K22249\nphaZ", "K22250\nphaZ", "K07518\ndimer hyd.", "K00019\n3HB-DH", "K01907\nAACS"]
KO_ORDER = ["K05973", "K22249", "K22250", "K07518", "K00019", "K01907"]
DEP_KO = ["K05973", "K22249", "K22250", "K07518"]

MM = 1 / 25.4  # millimetres to inches


def add_panel_label(ax, label, x=0, y=1, x_offset_pt=-4, y_offset_pt=3,
                    fontsize=8, color="black", fontweight="bold", va="bottom"):
    """Fixed physical-offset panel label (nature-figure api)."""
    offset = ScaledTranslation(x_offset_pt / 72, y_offset_pt / 72, ax.figure.dpi_scale_trans)
    ax.text(x, y, label, transform=ax.transAxes + offset, fontsize=fontsize,
            fontweight=fontweight, color=color, ha="left", va=va)


def main():
    genomes = pd.read_csv(os.path.join(DATA, "phb_degradation_genomes.tsv"), sep="\t")
    dist = pd.read_csv(os.path.join(DATA, "phb_deg_distribution_by_catalogue.tsv"), sep="\t")
    groups = pd.read_csv(os.path.join(DATA, "catalogue_groups.tsv"), sep="\t")

    # ---- panel a: KO x biome-group species counts (stated aggregation rule) ----
    group_of = {}
    for _, r in groups.iterrows():
        for c in str(r["catalogues"]).split(","):
            group_of[c.strip()] = r["catalogueGroup"]
    dist = dist.copy()
    dist["group"] = dist["catalogue"].map(group_of)
    heat = dist.groupby("group")[[k + "_species" for k in KO_ORDER]].sum()
    heat = heat.reindex(index=sorted(heat.index, key=lambda g: -heat.loc[g, "K05973_species"]))
    # pseudocount +1 guard so zero cells stay finite on the log10 scale
    heat_matrix = np.log10(np.maximum(heat.values, 0) + 1.0)

    # ---- panel b: tier x synthesis co-occurrence ----
    tier_rows = []
    for tier in (1, 2, 3):
        sub = genomes[genomes["tier"] == tier]
        synth = sub["synthKos"].fillna("").astype(str)
        with_phac = synth.str.contains("K03821").sum()
        with_other = (synth.str.len() > 0) & ~synth.str.contains("K03821")
        none_s = (~(synth.str.len() > 0)).sum()
        tier_rows.append((int(tier), len(sub), int(with_phac), int(with_other.sum()), int(none_s)))

    # ---- panel c: top catalogues (membership counts) ----
    memberships = {}
    for raw in genomes["catalogueName"].fillna("").astype(str):
        for c in raw.split(","):
            c = c.strip()
            if c:
                memberships[c] = memberships.get(c, 0) + 1
    top_cats = sorted(memberships.items(), key=lambda kv: -kv[1])[:10]

    # ---- panel d: top phyla ----
    phyla = {}
    for lin in genomes["lineage"].fillna("").astype(str):
        parts = [p for p in lin.split(";") if p.startswith("p__")]
        if parts:
            p = parts[0][3:]
            phyla[p] = phyla.get(p, 0) + 1
    top_phyla = sorted(phyla.items(), key=lambda kv: -kv[1])[:10]

    # ---- panel e: loci per depolymerase KO ----
    loci = pd.read_csv(os.path.join(DATA, "phb_degradation_loci.tsv"), sep="\t")
    loci_counts = loci["ko"].value_counts().reindex(DEP_KO).fillna(0).astype(int)

    # ---- figure & grid (double-column width: 180 mm) ----
    fig = plt.figure(figsize=(180 / 25.4, 155 / 25.4), dpi=300)
    gs = fig.add_gridspec(3, 2, height_ratios=[1.3, 1, 1], hspace=0.95, wspace=0.55,
                          left=0.10, right=0.97, top=0.97, bottom=0.09)
    ax_h = fig.add_subplot(gs[0, :])   # a hero heatmap
    ax_b = fig.add_subplot(gs[1, 0])   # b tier stacked
    ax_c = fig.add_subplot(gs[1, 1])   # c biomes
    ax_d = fig.add_subplot(gs[2, 0])   # d phyla
    ax_e = fig.add_subplot(gs[2, 1])   # e loci

    # ---- a: heatmap ----
    cmap = LinearSegmentedColormap.from_list("phb_seq", ["#FFFFFF", "#9DB9DD", BLUE])
    im = ax_h.imshow(heat_matrix, aspect="auto", cmap=cmap, vmin=0,
                     vmax=np.log10(heat.values.max() + 1))
    ax_h.set_yticks(range(len(heat.index)))
    ax_h.set_yticklabels(heat.index, fontsize=6.5)
    ax_h.set_xticks(range(len(KO_LABELS)))
    ax_h.set_xticklabels(KO_LABELS, fontsize=6.5)
    for _, s in ax_h.spines.items():
        s.set_visible(False)
    ax_h.grid(False)
    for (i, j), v in np.ndenumerate(heat.values):
        t = heat_matrix[i, j] / heat_matrix.max()
        color = "white" if t > 0.55 else "black"
        if v > 0:
            ax_h.text(j, i, f"{int(v):,}", ha="center", va="center", fontsize=6.4, color=color)
    cbar = fig.colorbar(im, ax=ax_h, fraction=0.028, pad=0.012)
    cbar.set_label("Species per biome group (log10 + 1)", fontsize=6.5)
    cbar.ax.tick_params(labelsize=6)
    add_panel_label(ax_h, "a", x_offset_pt=-4, y_offset_pt=2)

    # ---- b: tier stacked bars ----
    labels_b = ["Tier 1", "Tier 2", "Tier 3"]
    segs = np.array(tier_rows)[:, 2:]
    x = np.arange(3)
    bot = np.zeros(3)
    ax_b.bar(x, segs[:, 0], 0.62, bottom=bot, color=BLUE, label="With phaC")
    bot += segs[:, 0]
    ax_b.bar(x, segs[:, 1], 0.62, bottom=bot, color=NEUTRAL_MID, label="Other synthesis")
    bot += segs[:, 1]
    ax_b.bar(x, segs[:, 2], 0.62, bottom=bot, color=NEUTRAL_LIGHT, label="None")
    ymax_b = max(int(r[1]) for r in tier_rows)
    for i, (_, n, _, _, _) in enumerate(tier_rows):
        ax_b.text(i, n + ymax_b * 0.03, f"n = {n:,}", ha="center", fontsize=6.5, color=NEUTRAL_DARK)
    ax_b.set_xticks(x)
    ax_b.set_xticklabels(labels_b, fontsize=6.5)
    ax_b.set_ylabel("Genomes", fontsize=7)
    ax_b.set_ylim(0, ymax_b * 1.38)
    ax_b.tick_params(labelsize=6.5)
    ax_b.legend(fontsize=6, loc="upper center", bbox_to_anchor=(0.5, 1.0), ncol=3,
                handlelength=1.2, columnspacing=0.8)
    add_panel_label(ax_b, "b", x_offset_pt=-4, y_offset_pt=2)

    # ---- c: top catalogues ----
    names_c = [t[0] for t in top_cats][::-1]
    vals_c = np.array([t[1] for t in top_cats][::-1], dtype=float)
    ax_c.barh(np.arange(len(names_c)), vals_c, 0.62, color=BLUE)
    ax_c.set_yticks(np.arange(len(names_c)))
    ax_c.set_yticklabels(names_c, fontsize=6.5)
    ax_c.set_xlabel("Catalogue memberships", fontsize=7)
    ax_c.tick_params(labelsize=6.5)
    ax_c.set_xlim(0, vals_c.max() * 1.16)
    for i, v in enumerate(vals_c):  # right-aligned value column outside the bars
        ax_c.text(vals_c.max() * 1.135, i, f"{int(v):,}", ha="right", va="center",
                  fontsize=6, color=NEUTRAL_DARK)
    add_panel_label(ax_c, "c", x_offset_pt=-4, y_offset_pt=2)

    # ---- d: top phyla ----
    names_d = [t[0] for t in top_phyla][::-1]
    vals_d = np.array([t[1] for t in top_phyla][::-1], dtype=float)
    ax_d.barh(np.arange(len(names_d)), vals_d, 0.62, color=TEAL)
    ax_d.set_yticks(np.arange(len(names_d)))
    ax_d.set_yticklabels(names_d, fontsize=6.5)
    ax_d.set_xlabel("Genomes", fontsize=7)
    ax_d.tick_params(labelsize=6.5)
    ax_d.set_xlim(0, vals_d.max() * 1.16)
    for i, v in enumerate(vals_d):
        ax_d.text(vals_d.max() * 1.135, i, f"{int(v):,}", ha="right", va="center",
                  fontsize=6, color=NEUTRAL_DARK)
    add_panel_label(ax_d, "d", x_offset_pt=-4, y_offset_pt=2)

    # ---- e: loci per depolymerase KO (log) ----
    xs = np.arange(len(DEP_KO))
    loci_vals = np.maximum(loci_counts.values, 1)  # guard: log scale needs positive values
    ax_e.bar(xs, loci_vals, 0.55, color=BLUE)
    ax_e.set_yscale("log")
    ax_e.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"{v:,.0f}"))
    ax_e.set_xticks(xs)
    ax_e.set_xticklabels(["K05973\nphaZ PHB", "K22249\nphaZ PHO", "K22250\nphaZ PHO", "K07518\ndimer hyd."], fontsize=6.5)
    ax_e.set_ylabel("Gene loci (log)", fontsize=7)
    ax_e.tick_params(labelsize=6.5)
    for i, v in enumerate(loci_counts.values):
        ax_e.text(i, v * 1.55, f"{int(v):,}", ha="center", fontsize=6.5, color=NEUTRAL_DARK)
    add_panel_label(ax_e, "e", x_offset_pt=-4, y_offset_pt=2)

    # ---- final layout + alignment gate ----
    fig.tight_layout(pad=1.1)
    require_matplotlib_panel_alignment(
        fig,
        axes=[ax_h, ax_b, ax_c, ax_d, ax_e],
        panel_ids=["a", "b", "c", "d", "e"],
        row_groups=[["b", "c"], ["d", "e"]],
        column_groups=[["b", "d"], ["c", "e"]],
        json_out=os.path.join(OUT, "fig1_phb_degradation_gcmeta.alignment.json"),
        overlay_svg=os.path.join(OUT, "fig1_phb_degradation_gcmeta.alignment.svg"),
        tolerance_pt=1.5,
        gutter_tolerance_pt=1.5,
        strict=True,
    )

    base = os.path.join(OUT, "fig1_phb_degradation_gcmeta")
    fig.savefig(base + ".svg", bbox_inches="tight")
    fig.savefig(base + ".pdf", bbox_inches="tight")
    fig.savefig(base + ".tiff", dpi=600, bbox_inches="tight")
    fig.savefig(base + ".png", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print("saved:", base)


if __name__ == "__main__":
    main()
