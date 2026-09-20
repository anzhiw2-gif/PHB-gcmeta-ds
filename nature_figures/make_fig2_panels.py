#!/usr/bin/env python3
"""
Fig. 2 — anatomy of the gcMeta PHB-degradation genome set (8-panel sub-figure).

Rendered with the nature-figure skill (Python backend), same pipeline as Fig. 1.
Panel reading order a-h (letters follow the rendered layout):

  a  KO x biome-catalogue species heatmap (6 KOs x 50 catalogues, hero)
  b  tier counts (Tier 1 depolymerase / Tier 2 3HB mobilisation / Tier 3 partial)
  c  species-level genomes carrying each PHB-degradation KO
  d  top 15 biomes by catalogue membership
  e  top 12 GTDB phyla
  f  depolymerase / hydrolase gene loci per KO
  g  PHB-synthesis gene composition within each tier
  h  CheckM completeness distribution of Tier-1 genomes

Source data: ../data/out/*.tsv (src/query_gcmeta_phb.js + aggregate_phb_genomes.js).
"""

import os
import sys

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import matplotlib.ticker
import matplotlib.transforms
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.transforms import ScaledTranslation

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKILL_SCRIPTS = os.path.join(ROOT, ".nature-skills", "skills", "nature-figure", "scripts")
sys.path.insert(0, SKILL_SCRIPTS)
from audit_panel_alignment import require_matplotlib_panel_alignment  # noqa: E402

OUT = HERE
DATA = os.path.join(ROOT, "data", "out")

# -- MANDATORY font + SVG rules -------------------------------------------
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

BLUE = "#0F4D92"
TEAL = "#42949E"
NEUTRAL_LIGHT = "#CFCECE"
NEUTRAL_MID = "#767676"
NEUTRAL_DARK = "#4D4D4D"

KO_ORDER = ["K05973", "K22249", "K22250", "K07518", "K00019", "K01907"]
KO_TICK = ["K05973 phaZ", "K22249 phaZ", "K22250 phaZ", "K07518 dimer", "K00019 3HB-DH", "K01907 AACS"]
DEP_KO = ["K05973", "K22249", "K22250", "K07518"]

# short display names for the 50 heatmap columns (<= 11 characters so the vertical
# tick labels stay inside the hero panel); full names are in the legend and in
# data/out/phb_deg_distribution_by_catalogue.tsv
SHORT_CAT = {
    "Marine Seawater": "Marine SW",
    "Marine Sediment": "Marine sed",
    "Freshwater Lake Water": "FW lake",
    "Freshwater Sediment": "FW sed",
    "Freshwater Riverine": "FW river",
    "Saline-alkaline Habitat": "Saline-alk",
    "Saline Lake": "Saline lake",
    "Acid Mine Drainage": "Acid mine",
    "Wheat Rhizosphere": "Wheat rhiz",
    "Rice Rhizosphere": "Rice rhiz",
    "Bean Rhizosphere": "Bean rhiz",
    "Arabidopsis Rhizosphere": "Arabidopsis",
    "Giant panda Gut": "Panda gut",
    "Atlantic salmon Gut": "Salmon gut",
    "Wetlands Sediment": "Wetland sed",
    "Hydrothermal Vent": "Hydroth vent",
    "Pressure Habitat": "Pressure hab",
    "Drinking Water": "Drinking w",
    "Agricultural Soil": "Agri soil",
    "Zebrafish Gut": "Zebrafish",
    "Waterdeer Gut": "Waterdeer",
    "Dromedary Gut": "Dromedary",
    "Elephant Gut": "Elephant",
    "Chicken Gut": "Chicken",
    "Vulture Gut": "Vulture",
    "Buffalo Gut": "Buffalo",
}


def short_name(name):
    return SHORT_CAT.get(name, name[:11])


def add_panel_label(ax, label, x=0, y=1, x_offset_pt=-4, y_offset_pt=3,
                    fontsize=8, color="black", fontweight="bold", va="bottom"):
    offset = ScaledTranslation(x_offset_pt / 72, y_offset_pt / 72, ax.figure.dpi_scale_trans)
    ax.text(x, y, label, transform=ax.transAxes + offset, fontsize=fontsize,
            fontweight=fontweight, color=color, ha="left", va=va)


def main():
    genomes = pd.read_csv(os.path.join(DATA, "phb_degradation_genomes.tsv"), sep="\t")
    dist = pd.read_csv(os.path.join(DATA, "phb_deg_distribution_by_catalogue.tsv"), sep="\t")
    loci = pd.read_csv(os.path.join(DATA, "phb_degradation_loci.tsv"), sep="\t")

    # ---------- derived statistics ----------
    tier_n = {t: int((genomes["tier"] == t).sum()) for t in (1, 2, 3)}

    memberships = {}
    for raw in genomes["catalogueName"].fillna("").astype(str):
        for c in raw.split(","):
            c = c.strip()
            if c:
                memberships[c] = memberships.get(c, 0) + 1
    top_cats = sorted(memberships.items(), key=lambda kv: -kv[1])[:15]

    phyla = {}
    for lin in genomes["lineage"].fillna("").astype(str):
        parts = [p for p in lin.split(";") if p.startswith("p__")]
        if parts:
            phyla[parts[0][3:]] = phyla.get(parts[0][3:], 0) + 1
    top_phyla = sorted(phyla.items(), key=lambda kv: -kv[1])[:12]

    ko_species = {k: int(dist[k + "_species"].sum()) for k in KO_ORDER}
    loci_counts = loci["ko"].value_counts().reindex(DEP_KO).fillna(0).astype(int)

    synth = {t: [0, 0, 0] for t in (1, 2, 3)}
    for t in (1, 2, 3):
        s = genomes.loc[genomes["tier"] == t, "synthKos"].fillna("").astype(str)
        synth[t][0] = int(s.str.contains("K03821").sum())
        synth[t][1] = int(((s.str.len() > 0) & ~s.str.contains("K03821")).sum())
        synth[t][2] = int((s.str.len() == 0).sum())

    comp = pd.to_numeric(genomes.loc[genomes["tier"] == 1, "completeness"], errors="coerce").dropna()
    bins = np.arange(50, 105, 5)
    comp_hist, _ = np.histogram(comp, bins=bins)

    # heatmap: rows = 6 KOs, columns = 50 catalogues ordered by K05973 species count
    heat_df = dist.sort_values("K05973_species", ascending=False)
    heat_raw = heat_df[[k + "_species" for k in KO_ORDER]].values.astype(float)
    heat_mat = np.log10(np.maximum(heat_raw, 0) + 1.0).T   # (6 KOs) x (50 catalogues)

    # ---------- figure & grid ----------
    fig = plt.figure(figsize=(180 / 25.4, 175 / 25.4), dpi=300)
    gs = fig.add_gridspec(5, 2, height_ratios=[1.5, 0.9, 2.9, 0.9, 0.85], hspace=0.95, wspace=0.55,
                          left=0.09, right=0.975, top=0.975, bottom=0.075)
    ax_heat = fig.add_subplot(gs[0, :])   # a
    ax_b = fig.add_subplot(gs[1, 0])      # b  tiers
    ax_c = fig.add_subplot(gs[1, 1])      # c  KO species
    ax_d = fig.add_subplot(gs[2, 0])      # d  biomes (tall row)
    ax_e = fig.add_subplot(gs[2, 1])      # e  phyla  (tall row)
    ax_f = fig.add_subplot(gs[3, 0])      # f  loci
    ax_g = fig.add_subplot(gs[3, 1])      # g  synthesis composition
    ax_h = fig.add_subplot(gs[4, :])      # h  completeness histogram

    # ---------- a: KO x catalogue species heatmap ----------
    cmap = LinearSegmentedColormap.from_list("phb_seq", ["#FFFFFF", "#9DB9DD", BLUE])
    im = ax_heat.imshow(heat_mat, aspect="auto", cmap=cmap, vmin=0, vmax=heat_mat.max())
    ax_heat.set_yticks(range(len(KO_ORDER)))
    ax_heat.set_yticklabels(KO_TICK, fontsize=5.8)
    ax_heat.set_xticks(range(heat_mat.shape[1]))
    # thin tick labels (every 4th catalogue, vertical) so 50 columns stay legible;
    # all 50 columns are plotted and full names are in the source data
    ax_heat.set_xticklabels([short_name(n) if i % 4 == 0 else ""
                             for i, n in enumerate(heat_df["catalogue"])],
                            fontsize=5.6, rotation=90, ha="center", va="top")
    ax_heat.tick_params(axis="x", length=1.5, pad=1)
    for s in ax_heat.spines.values():
        s.set_visible(False)
    cbar = fig.colorbar(im, ax=ax_heat, fraction=0.02, pad=0.008)
    cbar.set_label("Species (log10 + 1)", fontsize=6.5)
    cbar.ax.tick_params(labelsize=6)
    add_panel_label(ax_heat, "a", x_offset_pt=-4, y_offset_pt=2)

    # ---------- b: tier counts ----------
    xs_b = np.arange(3)
    vals_b = [tier_n[1], tier_n[2], tier_n[3]]
    ax_b.bar(xs_b, vals_b, 0.6, color=[BLUE, TEAL, NEUTRAL_MID])
    ax_b.set_xticks(xs_b)
    ax_b.set_xticklabels(["Tier 1", "Tier 2", "Tier 3"], fontsize=6.5)
    ax_b.set_ylabel("Genomes", fontsize=7)
    ax_b.set_ylim(0, max(vals_b) * 1.28)
    ax_b.tick_params(labelsize=6.5)
    for i, v in enumerate(vals_b):
        ax_b.text(i, v + max(vals_b) * 0.06, f"{v:,}", ha="center", fontsize=6.5, color=NEUTRAL_DARK)
    add_panel_label(ax_b, "b", x_offset_pt=-4, y_offset_pt=2)

    # ---------- c: species per KO (log, values in a strip above the bars) ----------
    xs_c = np.arange(len(KO_ORDER))
    vals_c = np.maximum([ko_species[k] for k in KO_ORDER], 1)  # guard: log needs positivity
    ax_c.bar(xs_c, vals_c, 0.55, color=BLUE)
    ax_c.set_yscale("log")
    ax_c.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"{v:,.0f}"))
    ax_c.set_xticks(xs_c)
    ax_c.set_xticklabels(["K05973", "K22249", "K22250", "K07518", "K00019", "K01907"],
                         fontsize=5.8, rotation=45, ha="right", rotation_mode="anchor")
    ax_c.set_ylabel("Species (log)", fontsize=7)
    ax_c.set_ylim(top=vals_c.max() * 8)   # log headroom keeps bars clear of the value strip
    ax_c.tick_params(labelsize=6)
    trans_c = matplotlib.transforms.blended_transform_factory(ax_c.transData, ax_c.transAxes)
    for i, k in enumerate(KO_ORDER):
        ax_c.text(i, 0.89, f"{ko_species[k]:,}", transform=trans_c, ha="center", va="center",
                  fontsize=6, color=NEUTRAL_DARK)
    add_panel_label(ax_c, "c", x_offset_pt=-4, y_offset_pt=2)

    # ---------- d: top 15 biomes ----------
    names_d = [t[0] for t in top_cats][::-1]
    vals_d = np.array([t[1] for t in top_cats][::-1], dtype=float)
    ax_d.barh(np.arange(len(names_d)), vals_d, 0.62, color=BLUE)
    ax_d.set_yticks(np.arange(len(names_d)))
    ax_d.set_yticklabels(names_d, fontsize=5.8)
    ax_d.set_xlim(0, vals_d.max() * 1.18)
    ax_d.set_ylim(-0.8, len(names_d) - 0.2)  # keep the bottom value label clear of the spine
    ax_d.set_xlabel("Catalogue memberships", fontsize=6.5)
    ax_d.tick_params(labelsize=6)
    for i, v in enumerate(vals_d):
        ax_d.text(vals_d.max() * 1.155, i, f"{int(v):,}", ha="right", va="center",
                  fontsize=6, color=NEUTRAL_DARK)
    add_panel_label(ax_d, "d", x_offset_pt=-4, y_offset_pt=2)

    # ---------- e: top 12 phyla ----------
    names_e = [t[0] for t in top_phyla][::-1]
    vals_e = np.array([t[1] for t in top_phyla][::-1], dtype=float)
    ax_e.barh(np.arange(len(names_e)), vals_e, 0.62, color=TEAL)
    ax_e.set_yticks(np.arange(len(names_e)))
    ax_e.set_yticklabels(names_e, fontsize=5.8)
    ax_e.set_xlim(0, vals_e.max() * 1.18)
    ax_e.set_ylim(-0.8, len(names_e) - 0.2)
    ax_e.set_xlabel("Genomes", fontsize=6.5)
    ax_e.tick_params(labelsize=6)
    for i, v in enumerate(vals_e):
        ax_e.text(vals_e.max() * 1.155, i, f"{int(v):,}", ha="right", va="center",
                  fontsize=6, color=NEUTRAL_DARK)
    add_panel_label(ax_e, "e", x_offset_pt=-4, y_offset_pt=2)

    # ---------- f: loci per depolymerase KO (log, value strip) ----------
    xs_f = np.arange(len(DEP_KO))
    vals_f = np.maximum(loci_counts.values, 1)  # guard: log needs positivity
    ax_f.bar(xs_f, vals_f, 0.55, color=BLUE)
    ax_f.set_yscale("log")
    ax_f.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"{v:,.0f}"))
    ax_f.set_xticks(xs_f)
    ax_f.set_xticklabels(["K05973", "K22249", "K22250", "K07518"],
                         fontsize=5.8, rotation=45, ha="right", rotation_mode="anchor")
    ax_f.set_ylabel("Gene loci (log)", fontsize=7)
    ax_f.set_ylim(top=vals_f.max() * 8)
    ax_f.tick_params(labelsize=6)
    trans_f = matplotlib.transforms.blended_transform_factory(ax_f.transData, ax_f.transAxes)
    for i, v in enumerate(loci_counts.values):
        ax_f.text(i, 0.89, f"{int(v):,}", transform=trans_f, ha="center", va="center",
                  fontsize=6, color=NEUTRAL_DARK)
    add_panel_label(ax_f, "f", x_offset_pt=-4, y_offset_pt=2)

    # ---------- g: synthesis-gene composition per tier ----------
    xs_g = np.arange(3)
    bot = np.zeros(3)
    for si, (color, lab) in enumerate([(BLUE, "With phaC"), (NEUTRAL_MID, "Other synthesis"),
                                       (NEUTRAL_LIGHT, "None")]):
        seg = np.array([synth[1][si], synth[2][si], synth[3][si]], dtype=float)
        ax_g.bar(xs_g, seg, 0.5, bottom=bot, color=color, label=lab)
        bot += seg
    total_g = float(bot.max())
    ax_g.set_xticks(xs_g)
    ax_g.set_xticklabels(["Tier 1", "Tier 2", "Tier 3"], fontsize=6.5)
    ax_g.set_ylabel("Genomes", fontsize=7)
    ax_g.set_ylim(0, total_g * 1.65)  # clear band above the bars for the legend
    ax_g.tick_params(labelsize=6.5)
    ax_g.legend(fontsize=6, loc="upper center", ncol=3, handlelength=1.2, columnspacing=1.0)
    # totals are already shown in panel b; g shows composition only, so no n labels here
    add_panel_label(ax_g, "g", x_offset_pt=-4, y_offset_pt=2)

    # ---------- h: Tier-1 completeness histogram ----------
    xs_h = np.arange(len(comp_hist))
    ax_h.bar(xs_h, comp_hist, 0.78, color=BLUE)
    ax_h.set_xticks(xs_h)
    ax_h.set_xticklabels([f"{int(bins[i])}-{int(bins[i + 1])}" for i in range(len(comp_hist))],
                         fontsize=6)
    ax_h.set_xlabel("CheckM completeness (%)", fontsize=7)
    ax_h.set_ylabel("Tier-1 genomes", fontsize=7)
    ax_h.set_ylim(0, comp_hist.max() * 1.25)
    ax_h.tick_params(labelsize=6)
    for i, v in enumerate(comp_hist):
        ax_h.text(i, v + comp_hist.max() * 0.055, f"{int(v):,}", ha="center", fontsize=6,
                  color=NEUTRAL_DARK)
    add_panel_label(ax_h, "h", x_offset_pt=-4, y_offset_pt=2)

    # ---------- final layout + alignment gate ----------
    fig.tight_layout(pad=1.1)
    require_matplotlib_panel_alignment(
        fig,
        axes=[ax_heat, ax_b, ax_c, ax_d, ax_e, ax_f, ax_g, ax_h],
        panel_ids=["a", "b", "c", "d", "e", "f", "g", "h"],
        row_groups=[["b", "c"], ["d", "e"], ["f", "g"]],
        column_groups=[["b", "d", "f"], ["c", "e", "g"]],
        json_out=os.path.join(OUT, "fig2_phb_degradation_panels.alignment.json"),
        overlay_svg=os.path.join(OUT, "fig2_phb_degradation_panels.alignment.svg"),
        tolerance_pt=1.5,
        gutter_tolerance_pt=1.5,
        strict=True,
    )

    base = os.path.join(OUT, "fig2_phb_degradation_panels")
    fig.savefig(base + ".svg", bbox_inches="tight")
    fig.savefig(base + ".pdf", bbox_inches="tight")
    fig.savefig(base + ".tiff", dpi=600, bbox_inches="tight")
    fig.savefig(base + ".png", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print("saved:", base)


if __name__ == "__main__":
    main()
