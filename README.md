# PHB-gcmeta-ds

**在 gcMeta(全球宏基因组目录)中,以 PhaDED(PHA Depolymerase Engineering Database,DED)
分类架构为参照,检索 PHB(聚羟基丁酸酯)降解相关基因组。**

- 数据库:gcMeta 2025 —— 2,756,886 个 MAG、50 个 biome 目录、109,586 个物种级代表基因组
  (Sun et al., *Nucleic Acids Res* 54:D724-D733, 2026; doi:10.1093/nar/gkaf1115; https://gcmeta.wdcm.org/)
- 检索框架:PHA Depolymerase Engineering Database(DED)—— 8 超家族 / 38 同源家族解聚酶分类
  (Knoll et al., *BMC Bioinformatics* 10:89, 2009; doi:10.1186/1471-2105-10-89),映射到 KEGG KO
- 方法:逆向 gcMeta 官方前端 REST API(含 AES+RSA 参数加密协议),程序化全量检索

## 目录结构

```
├── config/
│   └── phb_degradation_genes.tsv   # PhaDED 架构 → KEGG KO 的基因集(可替换/扩展)
├── src/
│   ├── gcmeta_client.js            # gcMeta 加密 API 客户端(Node 内置 crypto,零依赖)
│   ├── query_gcmeta_phb.js         # 主查询:分布 + 位点 + 基因组(缓存到 data/raw/)
│   └── aggregate_phb_genomes.js    # 汇总成基因组级结果表 + 分级 tiering
├── docs/
│   ├── 01_background.md            # 背景:PHB 降解生物学 + PhaDED 架构 + gcMeta
│   ├── 02_gcmeta_api.md            # gcMeta API 逆向工程文档(协议、端点、踩坑)
│   └── 03_results.md               # 结果解读
└── data/
    ├── raw/                        # 原始 API 响应缓存(不入库)
    └── out/                        # 结果表(TSV/JSON)
```

## 快速开始

```bash
# 依赖:Node.js >= 18(零第三方依赖)
node src/query_gcmeta_phb.js        # 查询 gcMeta(自动缓存到 data/raw/,可断点续跑)
node src/aggregate_phb_genomes.js   # 汇总 → data/out/*.tsv|json
```

常用参数:

```bash
node src/query_gcmeta_phb.js --ko K05973     # 只查询单个 KO
node src/query_gcmeta_phb.js --fresh         # 忽略缓存重查
```

## 检索的基因集(核心)

| KO | 酶 | EC | DED 超家族 | 层级 |
|---|---|---|---|---|
| K05973 | PHB 解聚酶 phaZ | 3.1.1.75 | 胞外 dPHASCL(催化域 type 1/2)+ 胞内 phaZ1 | Tier 1 |
| K22249 | PHO/PHA_MCL 解聚酶 phaZ | 3.1.1.76 | 胞外 dPHAMCL | Tier 1 |
| K22250 | PHO/PHA_MCL 解聚酶 phaZ | 3.1.1.76 | 胞外 dPHAMCL | Tier 1 |
| K07518 | 3HB 二聚体水解酶 | 3.1.1.22 | 胞内寡聚体水解 | Tier 2 |
| K00019 | 3-羟基丁酸脱氢酶 BDH | 1.1.1.30 | 3HB 下游代谢 | Tier 2 |
| K01907 | 乙酰乙酰-CoA 合成酶 | 6.2.1.16 | 3HB 下游代谢 | Tier 2 |
| K00626/K00023/K03821 | phaA/phaB/phaC | — | PHB 合成(参照,非降解) | R |

完整基因集与注释见 `config/phb_degradation_genes.tsv`。

## 结果分级(tiering)

- **Tier 1 —— 解聚酶阳性**:含 K05973 / K22249 / K22250,具有直接的 PHB/PHO 解聚能力;
- **Tier 2 —— 3HB 动员**:含 K07518 或(K00019 + K01907),具备完整的 3HB 利用通路;
- **Tier 3 —— 部分**:仅含个别下游基因(如只有 BDH);
- 同时标注 PHB 合成基因(phaA/phaB/phaC),区分"降解者 vs 生产者"。

## 主要结果(摘要)

见 `docs/03_results.md` 与 `data/out/`:

- `phb_degradation_genomes.tsv` —— 携带 PHB 降解基因的基因组全表(分类、生境、质量、KO 组合、tier)
- `phb_degradation_loci.tsv` —— 解聚酶基因的位点级证据(基因组、坐标、GTDB 谱系)
- `phb_deg_distribution_by_catalogue.tsv` —— 每个 KO 在 50 个目录的物种数分布
- `phb_deg_summary.json` —— 汇总统计

## 合规说明

- 数据来源 gcMeta(https://gcmeta.wdcm.org/),请在发表时引用其论文(doi:10.1093/nar/gkaf1115);
- API 为公开数据的程序化访问,脚本内置 300 ms 请求间隔;请勿用于大规模爬取;
- 若你所用 "PhaDED" 指其它具体数据库/工具,替换 `config/phb_degradation_genes.tsv` 即可复用管线。

## 许可

代码:MIT(如适用)。数据所有权归 gcMeta / 原始数据提交者。
