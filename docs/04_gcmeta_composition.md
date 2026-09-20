# gcMeta 基因组组成(API 实测)

> 数据来源:gcMeta REST API 直接查询,2026-09-20 实测。
> 脚本:`src/query_gcmeta_composition.js`、`src/query_gcmeta_domain_split.js`;
> 原始结果:`data/out/gcmeta_composition.json`、`data/out/gcmeta_domain_breakdown.json`。
> 所有数字为**精确计数**(`/genome/list` 的 `totalElements` 分域过滤),不是抽样估计。

## 1. 细菌 vs 古菌:三个口径

| 口径 | 细菌 | 古菌 | 合计 | 古菌占比 |
|---|---|---|---|---|
| **全部基因组表**(`/genome/list`) | **3,846,768** | **69,812** | 3,917,189 | **1.78%** |
| **50 个 biome 目录内** | 2,755,984 | 43,167 | 2,799,151 | 1.54% |
| **物种级代表(已表征物种)** | 63,003 | 3,660 | 66,663 | **5.49%** |
| 物种级代表(新物种) | 84,483 | 4,117 | 88,600 | 4.65% |
| 物种级合计(155,263 条,跨目录重复计入) | 147,486 | 7,777 | 155,263 | 5.01% |

**真菌/真核:0**(`Domain=Eukaryota` 与 `Domain=Fungi` 均为 0;见第 4 节)。

要点:

- **细菌占绝对多数**:全部基因组表 98.2%,50 个目录内 98.5%;
- **古菌在物种层级被"放大"**:只占 MAG 的 1.8%,却占已表征物种的 5.5%——
  因为细菌 MAG 冗余度极高(Human Gut 单目录 166 万 MAG 只对应 ~1 万物种),
  而古菌每物种的平均 MAG 数更低;
- 42/50 个目录含至少 1 个古菌 MAG;**完全没有古菌的 8 个目录全部是动物/人体来源**:
  Cat Gut、Dog Gut、Atlantic salmon Gut、Zebrafish Gut、Human Vaginal、Bear Oral、
  Giant panda Gut、Vulture Gut;
- 其他规模指标:基因组表 3,917,189 条记录,其中无域标注 ~609(0.02%);
  biosample 127,760、项目 9,653;域筛选项中的 "Novel Species"(81,397)是**新物种标记**
  而非域(实测 `D_name` 只有 Bacteria / Archaea 两值)。

## 2. 古菌在各生境中的分布(强烈富集于极端/海洋环境)

| biome group | MAG 总数 | 其中古菌 | 古菌占比 |
|---|---|---|---|
| Human | 2,184,900 | 6,509 | 0.30% |
| Large Livestock | 679,870 | 11,671 | 1.72% |
| **Marine** | 232,312 | **20,094** | **8.65%** |
| Animals | 169,847 | 140 | 0.08% |
| Environments | 127,393 | 8,882 | 6.97% |
| Poultry | 93,205 | 661 | 0.71% |
| **Extreme Environments** | 56,834 | **8,474** | **14.91%** |
| Freshwater | 50,787 | 143 | 0.28% |
| Wild Animals | 36,977 | 358 | 0.97% |
| Domestic Animals | 24,411 | 1 | 0.00% |
| Plant Rhizosphere | 2,827 | 71 | 2.51% |
| Fish | 2,795 | 0 | 0.00% |
| 合计(12 组) | 3,662,158 | 57,004 | 1.56% |

目录级(古菌 MAG 数最多的 12 个目录):

| 目录 | 古菌 MAG | 细菌 MAG | 古菌占比 |
|---|---|---|---|
| Marine Seawater | 9,657 | 118,494 | 7.54% |
| Human Gut | 5,577 | 1,652,859 | 0.34% |
| Pig Gut | 3,576 | 216,936 | 1.62% |
| Cattle Gut | 3,136 | 130,187 | 2.35% |
| Pressure Habitat | 2,342 | 7,528 | **23.73%** |
| Acid Habitat | 2,158 | 6,270 | **25.61%** |
| Hydrothermal Vent | 1,957 | 6,783 | 22.39% |
| Acid Mine Drainage | 1,897 | 5,516 | 25.59% |
| Saline Lake | 1,658 | 12,812 | 11.46% |
| Goat Gut | 1,313 | 71,479 | 1.80% |
| Hot Habitat | 1,243 | 6,473 | 16.11% |
| Groundwater | 1,198 | 4,351 | 21.59% |

→ 极端环境目录里古菌占 1/4 左右,而人体肠道只有 0.34%(绝对数仍不小,5,577 个 MAG)。

## 3. 其他组成维度

- **生境结构**:宿主相关生境主导全库——Human 组 2,184,900(Human Gut 单目录 1,658,433,
  为最大目录)、Large Livestock 679,870、Animals 169,847、Poultry 93,205、
  Wild+Domestic Animals 61,388、Fish 2,795;环境类:Marine 232,312、Environments 127,393、
  Extreme Environments 56,834、Freshwater 50,787、Plant Rhizosphere 2,827;
- **记录归属**:12 个 biome group 内合计 3,662,158 条,剩余约 25.5 万条未归入任何 group;
- **分类学注释体系**:GTDB R220(`d__Bacteria` / `d__Archaea`,无真核)+ BAT/NCBI nr;
  注释覆盖示例(Marine Seawater 目录):KEGG 9,125 条、CARD 641、CAZy 551、MGEs 476、
  VFs 441、Defense Systems 235、BGC 67。

## 4. 为什么真菌是 0

gcMeta 的构库流程是**原核专用**:

```
宏基因组 reads → BBDuk 质控 → SPAdes/MEGAHIT 组装 → MetaWRAP 分箱(MaxBin2/CONCOCT/MetaBAT2)
   → CheckM 质控(完整度 ≥50%,污染 ≤10%)   ← CheckM 标记集仅覆盖细菌/古菌
   → GTDB-Tk R220 分类                       ← GTDB 本身不含真核
```

真菌/其他真核生物在原始宏基因组 reads 中存在,但过不了 CheckM 质控(无真核标记基因),
也不会被 GTDB 分类,因此**不会成为 gcMeta 中的基因组条目**。
需要真菌 PHB 降解者时,应换资源或流程:JGI MycoCosm、NCBI RefSeq Fungi、FungalTraits;
或真核感知分箱(EukRep、EukCC、metaeuk)+ BUSCO 质控。

## 5. 对 PHB 检索的意义

| 指标 | Bacteria | Archaea |
|---|---|---|
| 携带 PHB 降解相关 KO 的基因组 | 18,088 | **209** |
| **Tier 1(解聚酶阳性)** | 8,072 | **1** |
| Tier 3(仅通用下游基因) | 8,614 | 208 |

- 古菌命中以通用下游基因为主:K01907(119)、K00019(89),**仅 1 个 K05973(PHB 解聚酶)**;
- 古菌命中门水平:Halobacteriota 97、Thermoproteota 47、Asgardarchaeota 41、Thermoplasmatota 19;
- 古菌命中生境:Saline-alkaline Habitat 86、Saline Lake 48、Hot Habitat 42、Marine Sediment 39。

**结论**:gcMeta 中古菌占 MAG 的 1.8%、物种的 5.5%,但**几乎不携带 PHB 解聚酶**
(仅 1 个 Tier 1);Tier 1 的 8,073 个解聚酶阳性基因组实际上全部是细菌。
这与已知生物学一致——古菌以 PHB **合成**(PhaC/PhaE)见长,解聚酶证据稀少。
