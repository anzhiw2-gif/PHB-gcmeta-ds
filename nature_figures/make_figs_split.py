#!/usr/bin/env python3
"""
Split of the original 5-panel Fig. 1 into three single-claim figures
(nature-figure skill, Python backend):

  fig3a_split_tiers          Fig. 1 | How many     (tier counts + synthesis co-occurrence)
  fig3b_split_ecology        Fig. 2 | Where        (KO x biome heatmap + top biomes + top phyla)
  fig3c_split_genelevel      Fig. 3 | Which type   (depolymerase loci + KO species coverage)

Source data: ../data/out/*.tsv.
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

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "DejaVu Sans", "Liberation Sans"],
    "svg.fonttype": "none",
    "pdf.fonttype": 42,
    "font.size": 7,
    "axes.spines.right": False,
    "axes.spines.top": False,
    "axes.linewidth": 0.8,
    "legend.frameon": False,
})

BLUE = "#0F4D92"
TEAL = "#42949E"
NEUTRAL_LIGHT = "#CFCECE"
NEUTRAL_MID = "#767676"
NEUTRAL_DARK = "#4D4D4D"

KO_ORDER = ["K05973", "K22249", "K22250", "K07518", "K00019", "K01907"]
KO_TICK = ["K05973\nphaZ", "K22249\nphaZ", "K22250\nphaZ", "K07518\ndimer", "K00019\n3HB-DH", "K01907\nAACS"]
DEP_KO = ["K05973", "K22249", "K22250", "K07518"]


def add_panel_label(ax, label, x=0, y=1, x_offset_pt=-4, y_offset_pt=3,
                    fontsize=8, color="black", fontweight="bold", va="bottom"):
    offset = ScaledTranslation(x_offset_pt / 72, y_offset_pt / 72, ax.figure.dpi_scale_trans)
    ax.text(x, y, label, transform=ax.transAxes + offset, fontsize=fontsize,
            fontweight=fontweight, color=color, ha="left", va=va)


def export(fig, base, axes, panel_ids, row_groups, column_groups=None):
    fig.tight_layout(pad=1.1)
    kwargs = dict(
        json_out=base + ".alignment.json", overlay_svg=base + ".alignment.svg",
        tolerance_pt=1.5, gutter_tolerance_pt=1.5, strict=True,
    )
    if column_groups:
        kwargs["column_groups"] = column_groups
    require_matplotlib_panel_alignment(
        fig, axes=axes, panel_ids=panel_ids, row_groups=row_groups, **kwargs,
    )
    fig.savefig(base + ".svg", bbox_inches="tight")
    fig.savefig(base + ".pdf", bbox_inches="tight")
    fig.savefig(base + ".tiff", dpi=600, bbox_inches="tight")
    fig.savefig(base + ".png", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print("saved:", base)


def load():
    genomes = pd.read_csv(os.path.join(DATA, "phb_degradation_genomes.tsv"), sep="\t")
    dist = pd.read_csv(os.path.join(DATA, "phb_deg_distribution_by_catalogue.tsv"), sep="\t")
    groups = pd.read_csv(os.path.join(DATA, "catalogue_groups.tsv"), sep="\t")
    loci = pd.read_csv(os.path.join(DATA, "phb_degradation_loci.tsv"), sep="\t")
    return genomes, dist, groups, loci


def tier_synth(genomes):
    out = {}
    for t in (1, 2, 3):
        s = genomes.loc[genomes["tier"] == t, "synthKos"].fillna("").astype(str)
        out[t] = (int(s.str.contains("K03821").sum()),
                  int(((s.str.len() > 0) & ~s.str.contains("K03821")).sum()),
                  int((s.str.len() == 0).sum()))
    return out


def memberships(genomes):
    m = {}
    for raw in genomes["catalogueName"].fillna("").astype(str):
        for c in raw.split(","):
            c = c.strip()
            if c:
                m[c] = m.get(c, 0) + 1
    return m


def phyla(genomes):
    p = {}
    for lin in genomes["lineage"].fillna("").astype(str):
        for tok in lin.split(";"):
            if tok.startswith("p__"):
                p[tok[3:]] = p.get(tok[3:], 0) + 1
                break
    return p


# ---------------------------------------------------------------------------
def fig_split_tiers(genomes):
    """Fig. 1 | How many: tier counts (a) + synthesis co-occurrence (b)."""
    fig = plt.figure(figsize=(180 / 25.4, 60 / 25.4), dpi=300)
    gs = fig.add_gridspec(1, 2, wspace=0.6, left=0.10, right=0.97, top=0.93, bottom=0.16)
    ax_a = fig.add_subplot(gs[0, 0])
    ax_b = fig.add_subplot(gs[0, 1])

    tier_n = {t: int((genomes["tier"] == t).sum()) for t in (1, 2, 3)}
    vals = [tier_n[1], tier_n[2], tier_n[3]]
    ax_a.bar(np.arange(3), vals, 0.55, color=[BLUE, TEAL, NEUTRAL_MID])
    ax_a.set_xticks(np.arange(3))
    ax_a.set_xticklabels(["Tier 1\ndepolymerase", "Tier 2\n3HB mobilisation", "Tier 3\npartial"], fontsize=6.5)
    ax_a.set_ylabel("Genomes", fontsize=7)
    ax_a.set_ylim(0, max(vals) * 1.3)
    ax_a.tick_params(labelsize=6.5)
    for i, v in enumerate(vals):
        ax_a.text(i, v + max(vals) * 0.05, f"{v:,}", ha="center", fontsize=7, color=NEUTRAL_DARK)
    add_panel_label(ax_a, "a", x_offset_pt=-4, y_offset_pt=2)

    ts = tier_synth(genomes)
    bot = np.zeros(3)
    for si, (color, lab) in enumerate([(BLUE, "With phaC"), (NEUTRAL_MID, "Other synthesis"),
                                       (NEUTRAL_LIGHT, "None")]):
        seg = np.array([ts[1][si], ts[2][si], ts[3][si]], dtype=float)
        ax_b.bar(np.arange(3), seg, 0.55, bottom=bot, color=color, label=lab)
        bot += seg
    ax_b.set_xticks(np.arange(3))
    ax_b.set_xticklabels(["Tier 1", "Tier 2", "Tier 3"], fontsize=6.5)
    ax_b.set_ylabel("Genomes", fontsize=7)
    ax_b.set_ylim(0, float(bot.max()) * 1.55)
    ax_b.tick_params(labelsize=6.5)
    ax_b.legend(fontsize=6, loc="upper center", ncol=3, handlelength=1.2, columnspacing=1.0)
    add_panel_label(ax_b, "b", x_offset_pt=-4, y_offset_pt=2)

    export(fig, os.path.join(OUT, "fig3a_split_tiers"),
           [ax_a, ax_b], ["a", "b"], [["a", "b"]])


def fig_split_ecology(genomes, dist, groups):
    """Fig. 2 | Where: KO x biome heatmap (a) + top biomes (b) + top phyla (c)."""
    fig = plt.figure(figsize=(180 / 25.4, 120 / 25.4), dpi=300)
    gs = fig.add_gridspec(2, 2, height_ratios=[1.35, 1], hspace=0.9, wspace=0.6,
                          left=0.10, right=0.97, top=0.97, bottom=0.10)
    ax_a = fig.add_subplot(gs[0, :])
    ax_b = fig.add_subplot(gs[1, 0])
    ax_c = fig.add_subplot(gs[1, 1])

    group_of = {}
    for _, r in groups.iterrows():
        for c in str(r["catalogues"]).split(","):
            group_of[c.strip()] = r["catalogueGroup"]
    d = dist.copy()
    d["group"] = d["catalogue"].map(group_of)
    heat = d.groupby("group")[[k + "_species" for k in KO_ORDER]].sum()
    heat = heat.reindex(index=sorted(heat.index, key=lambda g: -heat.loc[g, "K05973_species"]))
    hm = np.log10(np.maximum(heat.values, 0) + 1.0)

    cmap = LinearSegmentedColormap.from_list("phb_seq", ["#FFFFFF", "#9DB9DD", BLUE])
    im = ax_a.imshow(hm, aspect="auto", cmap=cmap, vmin=0, vmax=hm.max())
    ax_a.set_yticks(range(len(heat.index)))
    ax_a.set_yticklabels(heat.index, fontsize=6.5)
    ax_a.set_xticks(range(len(KO_TICK)))
    ax_a.set_xticklabels(KO_TICK, fontsize=6.5)
    for s in ax_a.spines.values():
        s.set_visible(False)
    for (i, j), v in np.ndenumerate(heat.values):
        if v > 0:
            ax_a.text(j, i, f"{int(v):,}", ha="center", va="center", fontsize=6.4,
                      color="white" if hm[i, j] / hm.max() > 0.55 else "black")
    cbar = fig.colorbar(im, ax=ax_a, fraction=0.025, pad=0.01)
    cbar.set_label("Species per biome group (log10 + 1)", fontsize=6.5)
    cbar.ax.tick_params(labelsize=6)
    add_panel_label(ax_a, "a", x_offset_pt=-4, y_offset_pt=2)

    top_cats = sorted(memberships(genomes).items(), key=lambda kv: -kv[1])[:10]
    names = [t[0] for t in top_cats][::-1]
    vals = np.array([t[1] for t in top_cats][::-1], dtype=float)
    ax_b.barh(np.arange(len(names)), vals, 0.62, color=BLUE)
    ax_b.set_yticks(np.arange(len(names)))
    ax_b.set_yticklabels(names, fontsize=6.5)
    ax_b.set_xlim(0, vals.max() * 1.18)
    ax_b.set_ylim(-0.8, len(names) - 0.2)
    ax_b.set_xlabel("Catalogue memberships", fontsize=7)
    ax_b.tick_params(labelsize=6.5)
    for i, v in enumerate(vals):
        ax_b.text(vals.max() * 1.155, i, f"{int(v):,}", ha="right", va="center", fontsize=6,
                  color=NEUTRAL_DARK)
    add_panel_label(ax_b, "b", x_offset_pt=-4, y_offset_pt=2)

    top_phy = sorted(phyla(genomes).items(), key=lambda kv: -kv[1])[:10]
    names = [t[0] for t in top_phy][::-1]
    vals = np.array([t[1] for t in top_phy][::-1], dtype=float)
    ax_c.barh(np.arange(len(names)), vals, 0.62, color=TEAL)
    ax_c.set_yticks(np.arange(len(names)))
    ax_c.set_yticklabels(names, fontsize=6.5)
    ax_c.set_xlim(0, vals.max() * 1.18)
    ax_c.set_ylim(-0.8, len(names) - 0.2)
    ax_c.set_xlabel("Genomes", fontsize=7)
    ax_c.tick_params(labelsize=6.5)
    for i, v in enumerate(vals):
        ax_c.text(vals.max() * 1.155, i, f"{int(v):,}", ha="right", va="center", fontsize=6,
                  color=NEUTRAL_DARK)
    add_panel_label(ax_c, "c", x_offset_pt=-4, y_offset_pt=2)

    export(fig, os.path.join(OUT, "fig3b_split_ecology"),
           [ax_a, ax_b, ax_c], ["a", "b", "c"], [["b", "c"]])


def fig_split_genelevel(dist, loci):
    """Fig. 3 | Which type: depolymerase loci (a) + KO species coverage (b)."""
    fig = plt.figure(figsize=(180 / 25.4, 65 / 25.4), dpi=300)
    gs = fig.add_gridspec(1, 2, wspace=0.7, left=0.10, right=0.97, top=0.93, bottom=0.20)
    ax_a = fig.add_subplot(gs[0, 0])
    ax_b = fig.add_subplot(gs[0, 1])

    loci_counts = loci["ko"].value_counts().reindex(DEP_KO).fillna(0).astype(int)
    xs = np.arange(len(DEP_KO))
    vals = np.maximum(loci_counts.values, 1)
    ax_a.bar(xs, vals, 0.55, color=BLUE)
    ax_a.set_yscale("log")
    ax_a.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"{v:,.0f}"))
    ax_a.set_xticks(xs)
    ax_a.set_xticklabels(["K05973\nphaZ PHB", "K22249\nphaZ PHO", "K22250\nphaZ PHO", "K07518\ndimer hyd."], fontsize=6.5)
    ax_a.set_ylabel("Gene loci (log)", fontsize=7)
    ax_a.set_ylim(top=vals.max() * 8)
    ax_a.tick_params(labelsize=6.5)
    trans_a = matplotlib.transforms.blended_transform_factory(ax_a.transData, ax_a.transAxes)
    for i, v in enumerate(loci_counts.values):
        ax_a.text(i, 0.89, f"{int(v):,}", transform=trans_a, ha="center", va="center",
                  fontsize=6.5, color=NEUTRAL_DARK)
    add_panel_label(ax_a, "a", x_offset_pt=-4, y_offset_pt=2)

    ko_sp = {k: int(dist[k + "_species"].sum()) for k in KO_ORDER}
    xs = np.arange(len(KO_ORDER))
    vals = np.maximum([ko_sp[k] for k in KO_ORDER], 1)
    ax_b.bar(xs, vals, 0.55, color=BLUE)
    ax_b.set_yscale("log")
    ax_b.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"{v:,.0f}"))
    ax_b.set_xticks(xs)
    ax_b.set_xticklabels(KO_TICK, fontsize=6.5)
    ax_b.set_ylabel("Species (log)", fontsize=7)
    ax_b.set_ylim(top=vals.max() * 8)
    ax_b.tick_params(labelsize=6.5)
    trans_b = matplotlib.transforms.blended_transform_factory(ax_b.transData, ax_b.transAxes)
    for i, k in enumerate(KO_ORDER):
        ax_b.text(i, 0.89, f"{ko_sp[k]:,}", transform=trans_b, ha="center", va="center",
                  fontsize=6.5, color=NEUTRAL_DARK)
    add_panel_label(ax_b, "b", x_offset_pt=-4, y_offset_pt=2)

    export(fig, os.path.join(OUT, "fig3c_split_genelevel"),
           [ax_a, ax_b], ["a", "b"], [["a", "b"]])


def main():
    genomes, dist, groups, loci = load()
    fig_split_tiers(genomes)
    fig_split_ecology(genomes, dist, groups)
    fig_split_genelevel(dist, loci)


if __name__ == "__main__":
    main()
