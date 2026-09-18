# gcMeta REST API(逆向工程文档)

> 官方平台 https://gcmeta.wdcm.org/ 是 Vue SPA,未公开 API 文档。本文档通过分析其前端
> bundle(`/static/js/app.*.js` 与 chunk)还原了 API 协议,供程序化检索使用。
> 实现代码见 `src/gcmeta_client.js`。**请遵守 gcMeta 的服务条款,控制请求频率。**

## 1. 基本信息

- API 基址:`https://gcmeta.wdcm.org/gcmetaapi`
- 批量数据下载(无需 API):`https://open.nmdc.cn/specail_data/gcmeta/Mags/Archive/<CatalogueName空格转_>/<文件名>`
  (文件清单由 `/gcmetaapi/down/list` 返回,如 `Agricultural_Soil_species-level_representative_MAGs.tar.gz`)
- 认证:公开数据无需登录。

## 2. 请求加密协议(关键)

凡 URL 含 `/gcmetaapi/`(且不含 `/download/`)**且携带非空参数**的请求,参数必须加密;
无参数请求(如 `/down/list`、`/catalogue/catalogueList`)可直接明文 GET。

协议(完全复刻官方前端):

1. `GET /gcmetaapi/crypto/public-key` → `{success, serverTime, publicKey}`,
   其中 `publicKey` 是 **AES-128-CBC 加密的 RSA 公钥 PEM**:
   `AES(key=iv="1234567890123456", CBC, PKCS7)`。
   解密后得到 `-----BEGIN PUBLIC KEY-----` 形式的 2048-bit RSA 公钥。
2. 构造载荷:`payload = {"data": JSON.stringify(参数对象), "timestamp": Date.now(), "nonce": <16位随机字母数字> + "gcmeta"}`
   (注意 `data` 是**字符串化的 JSON**,不是对象本身)。
3. RSA 加密:`payload` 的 UTF-8 字节按 **245 字节/段**(PKCS#1 v1.5,2048-bit 上限)分段加密,
   密文按字节拼接。
4. 编码:拼接密文 → base64url(`+`→`-`,`/`→`_`,去 `=`)→ `encodeURIComponent`。
5. 发送:GET 时作为查询参数 `?encryptedData=<上述编码>`;
   POST 时作为 JSON body `{"encryptedData": "<上述编码>"}`。
6. 响应:JSON 明文(无需解密)。
7. 错误码:`1001` 时间戳过期、`1002` nonce 重复、`1003` nonce 格式错、`1004` 公钥错、
   `1005` 加密格式错、`2001` 参数解密失败(通常意味着加密载荷结构不对)。

Node 实现(仅用内置 `crypto`):

```js
const crypto = require('crypto');
const KEY = Buffer.from('1234567890123456'), IV = Buffer.from('1234567890123456');
// 1. 解密公钥
const pem = crypto.createDecipheriv('aes-128-cbc', KEY, IV)
  .update(Buffer.from(publicKeyB64, 'base64')) + ...;
// 2-4. 加密参数
const payload = Buffer.from(JSON.stringify({ data: JSON.stringify(params), timestamp: Date.now(), nonce: rand16 + 'gcmeta' }));
let cipher = Buffer.alloc(0);
for (let i = 0; i < payload.length; i += 245)
  cipher = Buffer.concat([cipher, crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, payload.subarray(i, i + 245))]);
const q = '?encryptedData=' + encodeURIComponent(cipher.toString('base64url'));
```

## 3. 端点目录(本项目用到的)

| 端点 | 方法 | 参数(加密) | 说明 |
|---|---|---|---|
| `/crypto/public-key` | GET | 无 | 获取(加密的)RSA 公钥 |
| `/catalogue/catalogueList` | GET | `pageNum, pageSize` | 50 个 biome 目录(名称、基因组数、物种数) |
| `/catalogue/catalogueTree` | GET | — | 目录分组树 |
| `/down/list` | GET | 无 | 每目录的 MAG 批量文件清单(`total_file`, `species_file`, md5, 元数据) |
| `/function/annotation/chart/list/KEGG` | GET | `xDBid`(KO 号), `catalogueName`(逗号串), `pageNum, pageSize` | 该 KO 在各目录的物种数分布 + 门水平分布 + 通路类别 |
| `/function/classlist` | GET | `anno`(= `KEGG-Orthology` / `CARD` / `CAZy` / `BGCs` / `DS` / `MGEs` …) | 注释分类层级选项 |
| `/function/phylumList` | GET | `anno` | 含该注释的门列表 |
| `/function/genomeList` | GET | `anno`(=KEGG), `xDBname`(=KO), `catalogueName`(必填), `pageNum, pageSize` | **含该 KO 的基因组列表**(含质量/分类/来源元数据) |
| `/catalogue/annotation/KEGG/info/locusList` | GET | `xDBid`(=KO), 可选 `catalogueName/catalogueGroup`, `pageNum, pageSize` | **位点级命中**:genomeId、contig、坐标、locusid、GTDB 谱系 |
| `/catalogue/annotation/{anno}/info/locusInfo` | GET | `locusid, genomeNo, ...` | 单位点注释详情 |
| `/genome/overview/info` | GET | `genomeNo` | 单个基因组概览 |
| `/genome/annotation/lucusAnnoList` | GET | `locusId, genomeNo` | 某位点的全部注释 |
| `/genome/list` | GET | `catalogueName, genomeNo, Domain, ...` | 基因组检索(总览页) |
| `/genome/taxonList` | GET | `tax`(=Phylum/Class/...) | 分类下拉选项 |
| `/resource/resource2/functionTree` 等 | GET | — | 特色资源(跨目录基因/核心基因) |
| `/sequence/download` | POST | 加密 body | 序列下载(与 `/download/` 前缀文件代理不同) |

返回格式统一为 `{"data": <Spring Page 或数组>, "status": 0, "msg": "成功"}` 或 Spring Boot 错误 JSON。
分页字段:`pageNum`(1 起)、`pageSize`;响应含 `totalElements/totalPages/last`。

## 4. 实测要点(踩坑记录)

- `anno` 值必须是后端认可的名字:KEGG 功能注释在 `classlist` 用 `KEGG-Orthology`,
  在 `chart/list`/`genomeList` 用 `KEGG`;错误的值返回 `{"data":"anno is not exist"}`。
- `/function/genomeList` 缺 `catalogueName` 会返回 Spring 400(必填校验)。
- `/catalogue/annotation/KEGG/info/locusList` **可以不传** catalogueName(全局查询)。
- `chart/list` 传全部目录名(逗号串)时,`catalogueList` 返回每目录的 `speciesCount/novelSpeciesCount`;
  不传则为空数组,`phylum` 仍返回全局门分布。
- `/down/list` 无参数明文可用;带参数则需加密。
- `data` 字段必须是字符串化 JSON,否则报 `2001 参数解密失败`。
- 批量文件服务器 open.nmdc.cn 不需要 cookie;文件名中空格转 `_`。

## 5. 合规与礼貌

- 每次请求间延时 ≥300 ms(本项目脚本默认)。
- 原始响应缓存于 `data/raw/`,支持断点续跑(重跑自动跳过已有文件)。
- 数据仅用于研究;引用请注明 gcMeta 2025 论文(doi:10.1093/nar/gkaf1115)。
