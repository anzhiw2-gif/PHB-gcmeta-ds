# 背景:PHB 降解的生物学、PhaDED 分类架构与 gcMeta 数据库

## 1. 科学问题

聚羟基丁酸酯(Polyhydroxybutyrate, PHB)是研究最深入、最具代表性的短链聚羟基脂肪酸酯
(scl-PHA)。它既是微生物胞内的碳/能量储存物,也是可生物降解塑料的核心材料。
寻找"能降解 PHB 的微生物/基因组"是:

- **生态学问题**:哪些生境(biome)富集 PHB 降解者?它们如何参与全球碳循环?
- **资源问题**:哪些未培养微生物("微生物暗物质")携带 PHB 解聚酶(depolymerase, PhaZ)?
  这为生物塑料降解菌剂与酶的挖掘提供候选。

本项目的目标:在 **gcMeta(全球宏基因组目录)** 中,以 **PhaDED 分类架构**为参照,
系统检索携带 PHB 降解相关基因的基因组,并输出可复现的检索管线与结果表。

## 2. PHB 降解的生物化学路径

PHB 的微生物降解分为胞外与胞内两条路线,两者共享下游 3-羟基丁酸(3HB)代谢:

```
PHB 颗粒(天然/变性)
   │
   ├─[胞外] PhaZ 解聚酶 (EC 3.1.1.75 poly(3-hydroxybutyrate) depolymerase)
   │        水解为 3HB 单体/寡聚体 → 转运进入细胞
   │
   └─[胞内] PhaZ1 胞内解聚酶 (EC 3.1.1.75)
             └→ 3HB 寡聚体水解酶 phaY/phaZ2 (EC 3.1.1.22 hydroxybutyrate-dimer hydrolase)
                   └→ (R)-3-羟基丁酸 (3HB)
                        │
                        ├─ 3-羟基丁酸脱氢酶 BDH/bdhA (EC 1.1.1.30):3HB → 乙酰乙酸
                        └─ 乙酰乙酸-CoA 合成酶 AACS/acsA (EC 6.2.1.16):乙酰乙酸 → 乙酰乙酰-CoA
                             └→ 进入 β-氧化/中心代谢
```

- 经典模式菌:*Ralstonia eutropha* H16(*Cupriavidus necator*)、*Paucimonas lemoignei*、
  *Pseudomonas* spp.、*Bacillus megaterium*、*Streptomyces* spp. 等。
- 中长链 PHA(PHAMCL,如 PHO)由另一类 PhaZ(EC 3.1.1.76 poly(3-hydroxyoctanoate) depolymerase)降解。

## 3. PhaDED / PHA Depolymerase Engineering Database(DED)分类架构

本项目的检索框架参考 **PHA Depolymerase Engineering Database(DED;Knoll et al. 2009,
*BMC Bioinformatics* 10:89, doi:10.1186/1471-2105-10-89)**——目前对 PHA 解聚酶最系统的
序列-结构-功能分类架构(即本项目所称 "PhaDED 架构"):

- 收录 587 条 PHA 解聚酶序列,划分为 **8 个超家族(superfamilies)、38 个同源家族(homologous families)**,
  每个家族提供多序列比对(MSA)与 **profile HMM**:
  1. intracellular nPHASCL depolymerases(no lipase box)
  2. intracellular nPHASCL depolymerases(lipase box)
  3. intracellular nPHAMCL depolymerases
  4. periplasmatic PHA depolymerases
  5. extracellular dPHASCL depolymerases(catalytic domain type 1)
  6. extracellular dPHASCL depolymerases(catalytic domain type 2)
  7. extracellular nPHASCL depolymerases
  8. extracellular dPHAMCL depolymerases
- 共同特征:α/β 水解酶折叠、催化三联体 Ser-His-Asp、GxSxG "lipase box"、
  底物结合结构域(dPHASCL 特有)等。
- 对应 Pfam 家族:**PF10503**(Esterase PHB depolymerase)、**PF06850**(Bacterial PHB depolymerase C-terminus)。
- 应用:从新基因组中 *in silico* 鉴定、分类 PHA 解聚酶并预测其生化特性——正是本项目在
  gcMeta 宏基因组上要做的事。

由于 gcMeta 的功能注释以 KEGG/COG/Swiss-Prot/UniRef90 为主,本项目将 DED 各超家族
映射到 KEGG Orthology(见 `config/phb_degradation_genes.tsv`):

| DED 超家族/功能 | KEGG KO | 酶 |
|---|---|---|
| extracellular dPHASCL(含胞内 phaZ1)| K05973 | poly(3-hydroxybutyrate) depolymerase(EC 3.1.1.75)|
| extracellular dPHAMCL | K22249 / K22250 | poly(3-hydroxyoctanoate) depolymerase(EC 3.1.1.76)|
| intracellular 寡聚体水解 | K07518 | hydroxybutyrate-dimer hydrolase(EC 3.1.1.22)|
| 3HB 下游代谢 | K00019 | 3-hydroxybutyrate dehydrogenase(EC 1.1.1.30)|
| 3HB 下游代谢 | K01907 | acetoacetyl-CoA synthetase(EC 6.2.1.16)|
| (参照)PHB 合成 | K00626 / K00023 / K03821 | phaA / phaB / phaC |

> 说明:若你所说的 "PhaDED" 指另一具体数据库/论文(例如某个 2025-2026 年的新工具),
> 只需替换 `config/phb_degradation_genes.tsv` 即可复用整条管线。

## 4. gcMeta:全球宏基因组目录

gcMeta(Sun et al., "gcMeta 2025: a global repository of metagenome-assembled genomes
enabling cross-ecosystem microbial discovery and function research",
*Nucleic Acids Research* 54(D1):D724-D733 (2026), doi:10.1093/nar/gkaf1115,
平台: https://gcmeta.wdcm.org/ ):

- **2,756,886 个 MAG**(metagenome-assembled genomes),来自 104,266 个样本、
  50 个生境目录(biome catalogues):人类/动物/植物肠道、海洋、淡水、土壤、极端环境等。
- 物种级代表基因组(95% ANI 聚类)109,586 个,其中 63%(69,248)为未表征新分类单元;
  注释基因 3.17 亿(含 7,490 万新基因)。
- 注释体系:GTDB R220 分类、Prokka 基因预测、DIAMOND 比对 UniRef90/Swiss-Prot/COG、
  KEGG/CAZy/MetaCyc 代谢注释、antiSMASH BGC、CARD/ARG、VFDB、MGE、DefenseFinder 等。
- 平台提供:目录浏览、分类树、功能模块(跨目录功能基因比较)、高级检索、
  在线分析管线、AI-ready 数据集,以及**全量 MAG 序列与元数据的批量下载**
  (https://gcmeta.wdcm.org/download,实际文件服务器为 open.nmdc.cn)。

本项目通过逆向 gcMeta 官方前端的 REST API(见 `docs/02_gcmeta_api.md`)实现
全自动化、可复现的程序化检索,而非手动网页点击。

## 5. 检索策略

1. **基因集**:以 PhaDED/DED 架构为框架,选取 6 个 PHB 降解 KO + 3 个 PHB 合成参照 KO。
2. **分布普查**:对每个 KO 查询其在 50 个目录中的物种分布(`/function/annotation/chart/list/KEGG`)。
3. **位点级证据**:对解聚酶类 KO 拉取全部命中位点(locus),含基因组 ID、坐标、GTDB 谱系
   (`/catalogue/annotation/KEGG/info/locusList`)。
4. **基因组级汇总**:对每个 KO × 每个目录拉取携带该 KO 的基因组列表及其质量/分类元数据
   (`/function/genomeList`),合并成"基因组 × 基因"矩阵。
5. **分级(tiering)**:
   - **Tier 1(解聚酶阳性)**:携带 K05973 / K22249 / K22250 —— 直接的 PHB/PHO 解聚能力;
   - **Tier 2(3HB 动员)**:无解聚酶但携带 K07518 或(K00019 + K01907)—— 完整的 3HB 利用;
   - **Tier 3(部分)**:仅携带个别下游基因。
   - 另标注 PHB 合成基因(phaA/phaB/phaC)以区分"降解者 vs 生产者"。
6. **产物**:基因组结果表、位点表、目录分布表与汇总统计(`data/out/`)。

## 6. 主要参考文献

- Knoll M, Hamm TM, Wagner F, Martinez V, Pleiss J (2009) The PHA Depolymerase Engineering Database:
  A systematic analysis tool for the diverse family of polyhydroxyalkanoate (PHA) depolymerases.
  *BMC Bioinformatics* 10:89. doi:10.1186/1471-2105-10-89
- Sun Y, Chen Q, Fan G, Sun Q, Zhou Q, Zhang J, Nie J, Ma J, Wu L (2026) gcMeta 2025: a global repository
  of metagenome-assembled genomes enabling cross-ecosystem microbial discovery and function research.
  *Nucleic Acids Research* 54(D1):D724-D733. doi:10.1093/nar/gkaf1115
- Jendrossek D, Handrick R (2002) Microbial degradation of polyhydroxyalkanoates.
  *Annu Rev Microbiol* 56:403-432. doi:10.1146/annurev.micro.56.012302.160838
- Kanehisa M, et al. KEGG: https://www.kegg.jp/ (map00650 Butanoate metabolism; KOs 见本页表格)
- Martinez V, et al. (2015) A journey from the textbook: PHB depolymerases and 3HB metabolism.
  *J Mol Microbiol Biotechnol* — 综述 3HB 代谢
- Abe T, et al. (2005) Properties of a novel intracellular poly(3-hydroxybutyrate) depolymerase (PhaZd).
  *J Bacteriol* 187:6982-6990 (R. eutropha 胞内解聚酶系统)
