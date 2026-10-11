# PHB-gcmeta-ds — 项目交接文档(给后续 agent 快速上手)

> 目标读者:接手本项目的其他 agent/协作者。本文是**自包含**的项目全景:看完即可复现、扩展或审阅全部工作。
> 详细说明见 `docs/`(01 背景 · 02 API 逆向 · 03 结果 · 04 组成);本文是索引 + 精华。

---

## 1. 项目一句话

在 **gcMeta(全球宏基因组目录)** 中,以 **PhaDED / PHA Depolymerase Engineering Database(DED)分类架构**为框架,检索**携带 PHB(聚羟基丁酸酯)降解相关基因的基因组**,输出可复现的检索管线、结果表与出版级图件。

- 仓库:https://github.com/anzhiw2-gif/PHB-gcmeta-ds
- 本地工作目录:`D:\PHB-gcmeta-ds`(Windows)

## 2. 核心结论(30 秒版)

- **18,297** 个物种级代表基因组携带 ≥1 个 PHB 降解相关 KO(占库内 109,586 个物种级基因组的 16.7%);
- 其中 **Tier 1 解聚酶阳性 = 8,073**(含 PHB 解聚酶 K05973 的 7,771,纯 PHO/mcl 解聚酶 302);
- **水体环境**富集(海洋 3,281、污水 1,871、淡水湖 1,833、淡水沉积物 1,377、饮用水 1,314),**Pseudomonadota 占 70.4%**(12,888);
- 基因层面 **K05973 位点 8,839 个**,远多于中长链 PHA 解聚酶(306/48);Tier 1 中 **99.1% 同时携带 PHB 合成基因** → "合成-降解一体";
- 库内 **真菌 = 0,古菌仅 1 个 Tier 1** → 降解能力几乎全在细菌。

## 3. 数据源与检索框架

### 3.1 数据库:gcMeta 2025
- 文献:Sun Y et al., *Nucleic Acids Res* 54(D1):D724-D733 (2026), doi:10.1093/nar/gkaf1115;平台 https://gcmeta.wdcm.org/
- 规模(API 实测,2026-09-20):基因组表 3,917,189 条记录;**50 个 biome 目录内 2,788,660 个 MAG**;物种级代表(95% ANI 聚类)109,586 个,63% 为新分类单元;biosample 127,760、项目 9,653。
- 注释体系:GTDB-Tk R220(分类)+ BAT/NCBI nr;Prokka 基因预测;DIAMOND(e ≤ 1e-5)比对 UniRef90/Swiss-Prot/COG;**KEGG KO** 用于功能检索。

### 3.2 检索框架:PhaDED / DED
- 文献:Knoll M et al., *BMC Bioinformatics* 10:89 (2009), doi:10.1186/1471-2105-10-89。
- DED 收录 587 条 PHA 解聚酶 → **8 超家族 / 38 同源家族**,每家族有 MSA + profile HMM;对应 Pfam **PF10503**(esterase PHB depolymerase)、**PF06850**(PHB depolymerase C-terminus)。
- 因 gcMeta 只存 KEGG KO 不存 DED 家族标签,本项目把 DED 架构**映射为 KEGG KO** 后检索(见 `config/phb_degradation_genes.tsv`)。

### 3.3 基因集(EC → KO 映射,已用 KEGG REST 逐一核实)

| DED 超家族/功能 | KO | 酶 | 层级 |
|---|---|---|---|
| 胞外 dPHASCL(含胞内 phaZ1)| K05973 | PHB 解聚酶 EC 3.1.1.75 | Tier 1 |
| 胞外 dPHAMCL(mcl) | K22249 / K22250 | PHO 解聚酶 EC 3.1.1.76 | Tier 1 |
| 胞内寡聚体水解 | K07518 | 3HB 二聚体水解酶 EC 3.1.1.22 | Tier 2 |
| 3HB 下游代谢 | K00019 / K01907 | 3HB 脱氢酶 / 乙酰乙酰-CoA 合成酶 | Tier 2 |
| (参照)PHB 合成 | K00626 / K00023 / K03821 | phaA / phaB / phaC | R(不参与分层)|

> ⚠️ 粒度损失:KEGG 不区分胞内/胞外解聚酶(K05973 两者都含)、DED 38 个家族多数无 KO 对应;要恢复 DED 分辨率需信号肽/结构域/HMM 分析(见 §9)。

### 3.4 Tier 分层规则(`src/aggregate_phb_genomes.js`)

```js
if (has K05973 | K22249 | K22250)              → Tier 1  // 解聚酶(直接证据)
else if (has K07518 | (K00019 && K01907))       → Tier 2  // 3HB 动员(中)
else                                            → Tier 3  // 仅通用基因(弱)
```

- 依据 = 基因在降解通路中的**位置与特异性**:解聚酶直接水解聚合物(特异);K07518 底物直接来自 PHB 解聚产物;K00019/K01907 是通用代谢基因(K00019 遍布 50/50 目录、12,857 物种),必须同时出现才算完整下游。
- 实测验证:Tier 2/3 中解聚酶 KO 全部为 0;phaC 比例沿 Tier 1→3 单调下降(80.7%→45.9%→25.1%),独立印证分层。

## 4. 关键技术:gcMeta API 逆向(本项目最大工作量)

gcMeta 是 Vue SPA,无公开 API 文档;**任何带非空参数的请求都要 AES+RSA 加密**。协议已完整还原(`docs/02_gcmeta_api.md`),要点:

1. `GET /gcmetaapi/crypto/public-key` → `publicKey` 是 **AES-128-CBC(key=iv="1234567890123456")** 加密的 RSA 公钥 PEM,解密后得到 2048-bit 公钥;
2. 载荷 = `JSON.stringify({"data": JSON.stringify(参数), "timestamp": Date.now(), "nonce": <16位随机> + "gcmeta"})`(**data 必须是字符串化 JSON**,否则报 `2001 参数解密失败`);
3. 载荷按 **245 字节/段**做 RSA PKCS#1 v1.5 加密,密文拼接;
4. base64url + `encodeURIComponent` → 作为查询参数 `?encryptedData=...` 发送;
5. 响应为明文 JSON;错误码:1005 加密格式错、2001 参数解密失败、1004 公钥错等。

- 实现:`src/gcmeta_client.js`(零依赖,只用 Node 内置 `crypto`)。
- 批量下载(免 API):`https://open.nmdc.cn/specail_data/gcmeta/Mags/Archive/<目录名空格转_>/<文件名>`,文件清单来自 `GET /down/list`(该端点无参数、明文)。

**常用端点**(详见 docs/02):`/catalogue/catalogueList`、`/down/list`、`/function/annotation/chart/list/KEGG`(KO×目录物种分布)、`/function/genomeList`(含某 KO 的基因组,需 `anno=KEGG&xDBname=<KO>&catalogueName=`)、`/catalogue/annotation/KEGG/info/locusList`(位点级,可全局)、`/genome/list`(Domain/catalogueGroup 过滤)、`/catalogue/overview/rank`(物种级域构成)。

## 5. 代码结构与复现

```
config/phb_degradation_genes.tsv   基因集(DED→KO,tier 列)
src/gcmeta_client.js               加密 API 客户端(零依赖)
src/query_gcmeta_phb.js            主查询:分布+位点+基因组 → data/raw/ 缓存
src/aggregate_phb_genomes.js       聚合+分层 → data/out/*.tsv|json
src/query_gcmeta_composition.js    域/生境组成 → gcmeta_composition.json
src/query_gcmeta_domain_split.js   细菌/古菌三口径拆分 → gcmeta_domain_breakdown.json
src/make_visualizations.js         SVG 图 + report.html(零依赖)
nature_figures/make_nature_figure.py       Fig.1(5 面板,出版级)
nature_figures/make_fig2_panels.py         Fig.2(8 面板)
nature_figures/make_figs_split.py          Fig.1 拆分为 3 张单结论图
docs/01..04                           背景 / API / 结果 / 组成
data/out/                             结果(已入库)
```

**复现三步**(Node ≥18,零第三方依赖):
```bash
node src/query_gcmeta_phb.js        # 查询(自动缓存到 data/raw/,可断点续跑;--ko K05973 / --fresh)
node src/aggregate_phb_genomes.js   # 聚合+分层
node src/make_visualizations.js     # SVG + HTML 报告
```
出版级图件另需 Python(matplotlib/numpy/pandas)+ nature-figure 技能(见 §7)。

## 6. 结果文件(data/out/,已提交)

| 文件 | 内容 |
|---|---|
| `phb_degradation_genomes.tsv` | 18,297 行:基因组级(genomeNo、GTDB 谱系、生境、质量、完整度、KO 组合、tier、合成标记)|
| `phb_degradation_loci.tsv` | 9,894 行:解聚酶/水解酶位点(genomeId、contig、坐标、locusid)|
| `phb_deg_distribution_by_catalogue.tsv` | 每个 KO × 50 目录的物种数 |
| `phb_deg_summary.json` | 汇总统计 |
| `catalogue_groups.tsv` | 50 目录 → 12 biome group 映射 |
| `gcmeta_composition.json` / `gcmeta_domain_breakdown.json` | 组成审计(域/生境/古菌)|
| `report.html` + `figures/*.svg` | 自包含可视化报告 |

## 7. 图件(nature_figures/,已提交)

出版级图件用 **nature-figure 技能**(https://github.com/Yuan1z0825/nature-skills,Python 后端)绘制,每一张都过了四重 QA(源码预检 / 面板对齐 1.5pt strict / PDF 字形下限 ≥5pt / 渲染碰撞审计),QA 结果与缺陷修复记录在对应的 `*_qa_notes.txt`、`*_legend.txt`、`*.alignment.json`、`*.collision-audit.json`。

- `fig1_phb_degradation_gcmeta.*` — Fig.1(5 面板:热图 / tier / 生境 / 门 / 位点)
- `fig2_phb_degradation_panels.*` — Fig.2(8 面板)
- `fig3a_split_tiers.*` / `fig3b_split_ecology.*` / `fig3c_split_genelevel.*` — 拆分为"有多少 / 在哪里 / 什么类型"三张
- 依赖安装:PyMuPDF 已解压到 `D:\PHB-gcmeta-ds\.venv_pkgs`(gitignored),运行审计时 `$env:PYTHONPATH="D:\PHB-gcmeta-ds\.venv_pkgs"`。

## 8. 环境与工具链(Windows,重要坑点)

- Node v24.17.0、Python 3.12.10(matplotlib 3.11.0 / numpy 2.4.6 / pandas 3.0.3)、git 2.54.0、pip 25.0.1、uv 0.11.18。
- **git 走 HTTPS 必须用 openssl 后端**:`git config http.sslBackend openssl`(默认 schannel 报 `SEC_E_NO_CREDENTIALS`)。
- **网络**:Node `fetch` 可用;`curl.exe` / `Invoke-WebRequest` 因 TLS 失败;pip 直连 PyPI 极慢 → 用 Node 下载 wheel 后 `pip install --target .venv_pkgs` 或直接 `Expand-Archive` 解压。
- **沙箱**:仅能写工作区 `D:\PHB-gcmeta-ds`(及临时区);`venv` 创建失败(ensurepip);**PowerShell 的 `Set-Content` 会把 UTF-8 写坏** → 改文件用 write 工具或显式 `-Encoding UTF8`。
- GitHub 推送需 PAT(用户提供过,已在会话中以明文出现,**建议用户轮换**);仓库 remote 为 `origin`。
- 本项目图片为 SVG/PDF/PNG(TIFF 600dpi 本地生成、已 gitignore,因 65MB)。

## 9. 已知局限与后续方向(接手前必读)

**局限(诚实声明)**:
- 是**注释级检索**(基于 gcMeta 的 DIAMOND KO 注释),**不是序列级/HMM 验证**;无 identity/覆盖度/E-value;K05973 混胞内/胞外;DED 38 家族多数无 KO 对应。
- 是**基因组潜力**(基因存在性),**无表达/丰度证据**。
- 库内无真菌;古菌仅 1 个 Tier 1。
- Fig.1 热图按 biome group 聚合物种数,跨目录会重复计入;K22249/K22250 每行数值相同(共注释),不能当两条独立证据。

**后续方向(建议顺序)**:
1. **序列级验证**:对 Tier 1 的 8,839 个 K05973 位点取序列(`/sequence/download` 或 open.nmdc.cn 的 MAG 包),用 Pfam PF10503/PF06850 + DED 家族 HMM 跑 `hmmsearch`;
2. **DED 超家族细化**:信号肽(SignalP)+ 催化域 type1/type2 判定,把 K05973 拆回胞内/胞外;
3. **正交交叉验证**:调 `/genome/annotation/lucusAnnoList` 看 K05973 位点是否同时被 Swiss-Prot/COG(COG4553)标为 PHB depolymerase;
4. **严格 PHB 口径**:把 K22249/K22250 移出 Tier 1(Tier 1 → 7,771);
5. **真菌 PHB 降解者**:换 NCBI RefSeq Fungi / JGI MycoCosm。

## 10. 参考文献(引用用)

- Sun Y et al. 2026. gcMeta 2025. *Nucleic Acids Res* 54:D724-D733. doi:10.1093/nar/gkaf1115
- Knoll M et al. 2009. PHA Depolymerase Engineering Database. *BMC Bioinformatics* 10:89. doi:10.1186/1471-2105-10-89
- Jendrossek D, Handrick R. 2002. Microbial degradation of polyhydroxyalkanoates. *Annu Rev Microbiol* 56:403-432. doi:10.1146/annurev.micro.56.012302.160838
- KEGG: https://www.kegg.jp/(map00650 Butanoate metabolism;KOs 见 §3.3)
