# gcMeta 基因组组成(API 实测)

> 数据来源:gcMeta REST API 直接查询(`src/query_gcmeta_composition.js`,2026-09-20 实测),
> 原始结果:`data/out/gcmeta_composition.json`。所有数字为查询时的**精确计数**
> (`/genome/list` 的 `totalElements` 分域过滤),不是抽样估计。

## 1. 域(domain)组成

| 域 | MAG 记录数 | 占比 |
|---|---|---|
| Bacteria | 3,846,768 | 98.22% |
| Archaea | 69,812 | 1.78% |
| Eukaryota / Fungi | **0** | 0% |
| 无域标注 | ~609 | 0.02% |
| **合计** | **3,917,189** | 100% |

其他规模指标:

- 50 个 biome 目录内共 **2,788,660** 个 MAG(论文口径 2,756,886,一致);
- 各目录物种级代表基因组数之和 155,263(跨目录共享物种会重复计入;论文报告的全局物种级簇为 109,586);
- 样本(biosample)**127,760** 个;项目 9,653 个;
- 域选项中的 "Novel Species"(81,397)是**新物种标记**,不是域(D_name 实测只有 Bacteria/Archaea 两种取值)。

## 2. 为什么真菌是 0

gcMeta 的构库流程是**原核专用**:

```
宏基因组 reads → BBDuk 质控 → SPAdes/MEGAHIT 组装 → MetaWRAP 分箱(MaxBin2/CONCOCT/MetaBAT2)
   → CheckM 质控(complete ≥50%, contamination ≤10%)  ← CheckM 标记集仅覆盖细菌/古菌
   → GTDB-Tk R220 分类                                ← GTDB 本身不含真核
```

因此真菌/其他真核生物虽然在**原始宏基因组 reads 中存在**,但不会通过 CheckM 质控、
也不会被 GTDB 分类,最终**不会成为 gcMeta 中的基因组条目**。
需要真菌(或真核)PHB 降解者时,应改用其他资源或流程:
JGI MycoCosm / NCBI RefSeq Fungi、FungalTraits;或真核感知分箱(EukRep、EukCC、metaeuk)+ BUSCO 质控。

## 3. 生境(biome group)组成与古菌分布

| biome group | MAG 总数 | 其中 Archaea | 古菌占比 |
|---|---|---|---|
| Human | 2,184,900 | 6,509 | 0.30% |
| Large Livestock | 679,870 | 11,671 | 1.72% |
| Marine | 232,312 | 20,094 | **8.65%** |
| Animals | 169,847 | 140 | 0.08% |
| Environments | 127,393 | 8,882 | 6.97% |
| Poultry | 93,205 | 661 | 0.71% |
| Extreme Environments | 56,834 | 8,474 | **14.91%** |
| Freshwater | 50,787 | 143 | 0.28% |
| Wild Animals | 36,977 | 358 | 0.97% |
| Domestic Animals | 24,411 | 1 | 0.00% |
| Plant Rhizosphere | 2,827 | 71 | 2.51% |
| Fish | 2,795 | 0 | 0.00% |
| **合计(12 组)** | **3,662,158** | **57,004** | **1.56%** |

要点:

- **宿主相关生境主导**:Human 组占 60%(仅 Human Gut 一个目录就有 1,658,433 个 MAG),
  加上家畜/家禽/野生动物后宿主相关占约 3/4;
- **古菌高度富集于极端/海洋环境**:极端环境 14.9%、海洋 8.65%、环境类 6.97%,
  而人肠道仅 0.30%、鱼类与家养动物≈0;
- 12 组之外还有约 25.5 万个 MAG 未归入任何一个 biome group(表内总数 391.7 万 − 组内 366.2 万),
  其古菌约 1.28 万个(69,812 − 57,004)。

## 4. 古菌在本项目 PHB 检索结果中的位置

| 指标 | Bacteria | Archaea |
|---|---|---|
| 携带 PHB 降解相关 KO 的基因组 | 18,088 | **209** |
| Tier 1(解聚酶阳性) | 8,072 | **1** |
| Tier 2 | 1,402 | 0 |
| Tier 3(仅通用下游基因) | 8,614 | 208 |

- 古菌命中以通用下游基因为主:K01907(119)、K00019(89),**仅 1 个 K05973(PHB 解聚酶)**;
- 门水平:Halobacteriota 97、Thermoproteota 47、Asgardarchaeota 41、Thermoplasmatota 19;
- 生境:Saline-alkaline Habitat 86、Saline Lake 48、Hot Habitat 42、Marine Sediment 39、
  Pressure Habitat 28、Hot Spring 27;
- 生物学解释:古菌(尤其盐杆菌)以 PHB **合成**(PhaC/PhaE)见长,胞外/胞内 PHB
  **解聚酶**证据稀少,与检索结果一致——**古菌不是 gcMeta 中 PHB 降解能力的主要载体**。
