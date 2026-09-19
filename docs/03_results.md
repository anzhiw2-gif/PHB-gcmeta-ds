# 结果:gcMeta 中 PHB 降解相关基因组

> 生成时间:2026-09-18;数据源:gcMeta 2025(109,586 个物种级代表 MAG,50 个 biome 目录)。
> 检索基因集见 `config/phb_degradation_genes.tsv`(PhaDED/DED 架构 → KEGG KO)。
> 完整数据:`data/out/phb_degradation_genomes.tsv`(18,297 行)、`phb_degradation_loci.tsv`(9,894 行)、
> `phb_deg_distribution_by_catalogue.tsv`、`phb_deg_summary.json`。

## 1. 总体统计

| 指标 | 数值 |
|---|---|
| 携带 ≥1 个 PHB 降解相关 KO 的基因组 | **18,297** |
| └ Tier 1:解聚酶阳性(PHB/PHO depolymerase, K05973/K22249/K22250)| **8,073** |
| └ Tier 2:3HB 动员(K07518 或 K00019+K01907,无解聚酶)| 1,402 |
| └ Tier 3:部分(仅个别下游基因)| 8,822 |
| 解聚酶/水解酶基因位点(总)| **9,894** |
| └ K05973 phaZ(PHB 解聚酶)| 8,839 |
| └ K22249 / K22250(PHO 解聚酶)| 48 / 306 |
| └ K07518(3HB 二聚体水解酶)| 701 |
| 同时携带 PHB 合成基因(phaC 等)的降解基因组 | 17,170 |

**解读**:

- 8,073 个物种级代表基因组携带 PHB/PHA 解聚酶基因,其中绝大多数(8,839/9,894 位点)
  是 **K05973 phaZ(PHB 解聚酶,EC 3.1.1.75)**,对应 PhaDED 的胞外 dPHASCL 超家族(及胞内 phaZ1)。
- 携带 phaZ 的基因组几乎总是同时携带完整 3HB 代谢(K00019+K01907/K07518)与 PHB 合成
  基因(phaA/phaB/phaC),即 **"合成-降解一体"的 PHB 代谢完整型基因组**占主导;
  提示 PHB 降解能力在生态上常与胞内 PHB 循环耦合。
- K00019(3-羟基丁酸脱氢酶)遍布全部 50 个目录(44 个门),是通用代谢基因,单独出现
  不指示 PHB 降解能力(故归为 Tier 2/3 的组成部分而非证据核心)。

## 2. 生境分布(按目录)

PHB 降解基因组数量前 10 的目录:

| 目录(biome) | PHB 降解基因组数 |
|---|---|
| Marine Seawater | 3,281 |
| Wastewater | 1,871 |
| Freshwater Lake Water | 1,833 |
| Freshwater Sediment | 1,377 |
| Drinking Water | 1,314 |
| Marine Sediment | 882 |
| Freshwater Riverine | 494 |
| Human Skin | 488 |
| Agricultural Soil | 421 |
| Cattle Gut / Human Gut | 327 / 324 |

**解读**:水体环境(海洋、污水、淡水)显著富集 PHB 降解基因组,与文献一致——
PHB 解聚酶在富营养水体与活性污泥中丰度最高(Jendrossek & Handrick 2002;
废水处理系统是经典的 PHB 降解菌富集源,如 *Zoogloea*、*Comamonas* 等)。
土壤与动物肠道中同样有可观数量,提示 PHB 降解是跨生态系统的广泛性状。

## 3. 分类学分布(前 10 门)

| 门(GTDB) | PHB 降解基因组数 |
|---|---|
| Pseudomonadota | 12,888 |
| Actinomycetota | 1,768 |
| Desulfobacterota | 618 |
| Bacteroidota | 572 |
| Chloroflexota | 370 |
| Bacillota_A | 250 |
| Gemmatimonadota | 240 |
| Bacillota | 201 |
| Myxococcota | 192 |
| Acidobacteriota | 132 |

**解读**:Pseudomonadota(变形菌门)占 70%,其中 Burkholderiales 目
(*Cupriavidus*、*Comamonas*、*Zoogloea*、*Hydrogenophaga* 等)是已知的 PHB
代谢"旗舰"类群;Actinomycetota(*Streptomyces* 等)次之——两者与 DED 种子序列
(Knoll 2009 表 1)的宿主谱高度吻合,验证了检索的特异性。

## 4. 代表性命中基因组(示例,表前 10)

| genomeNo | 物种(GTDB) | 目录 | 完整度 | KO 组合 | 层级 |
|---|---|---|---|---|---|
| GCMeta_00001098 | *Cupriavidus metallidurans* | Human Gut | 98.8% | K05973+K07518+K00019+K01907(+phaABC) | 1 |
| GCMeta_00022405 | *Comamonas acidovorans* | Mouse Gut | 99.9% | K05973+K07518+K00019+K01907(+phaABC) | 1 |
| GCMeta_00200117 | *Zoogloea* sp. | Zebrafish Gut | 96.9% | K05973+K07518+K00019+K01907(+phaABC) | 1 |
| GCMeta_00121023 | *JAEUPI01* gen. nov.(Burkholderiaceae)| Agricultural Soil | — | K05973 ×2(位点级)| 1 |
| … | … | … | … | … | … |

> 位点级证据示例(Agricultural Soil,K05973):
> `GCMeta_00121023` contig `_00003` 32,673–33,890 bp(−链)locus `ABFEKDMJ_00220`,
> GTDB 谱系 Burkholderiaceae/g__JAEUPI01 —— 一个新属水平的 PHB 解聚酶携带者。

## 5. 局限与后续

- gcMeta 的注释基于 Prokka + DIAMOND(阈值 e-value ≤ 1e-5)的 KEGG/COG/Swiss-Prot 同源注释,
  属**注释层检索**;建议对重点候选做序列级验证(DED/Pfam HMM:PF10503、PF06850;
  或 DIAMOND 比对 Swiss-Prot 实验验证的 PhaZ)。
- MAG 完整性 ≥50% 的物种级代表基因组中,解聚酶基因可能位于未回收区域;
  可进一步下载原始 MAG(`https://open.nmdc.cn/specail_data/gcmeta/Mags/Archive/…`)
  用 `hmmsearch` 全序列扫描。
- K05973 同时代表胞外 dPHASCL 与胞内 phaZ1,区分二者需结构域分析
  (信号肽、底物结合结构域)——对应 PhaDED 的催化域 type 1/type 2 分类,可作为后续
  细化方向。
- 如需扩展到全部 PHAMCL 降解,可将 K22249/K22250 之外的更多 PhaZ 同源家族
  (DED 38 个同源家族的 profile HMM)加入基因集。

## 6. 复现

```bash
node src/query_gcmeta_phb.js      # 查询(断点续跑,缓存于 data/raw/)
node src/aggregate_phb_genomes.js # 汇总
```
