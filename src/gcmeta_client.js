#!/usr/bin/env node
/**
 * gcMeta API client (reverse-engineered from the official SPA, https://gcmeta.wdcm.org/)
 *
 * Request encryption protocol (mirrors gcmeta front-end, module "C3Fh"/"7SzJ"):
 *   1. GET /gcmetaapi/crypto/public-key  -> { publicKey: AES-128-CBC(PEM, key=iv="1234567890123456") }
 *   2. payload = JSON.stringify({ data: <params>, timestamp: Date.now(), nonce: <16 rand chars> + "gcmeta" })
 *   3. payload bytes RSA-encrypted (PKCS#1 v1.5) in 245-byte chunks with the server public key
 *   4. concatenated ciphertext -> base64url -> encodeURIComponent -> sent as query param "encryptedData"
 *
 * Endpoints whose URL contains "/gcmetaapi/" and not "/download/" require encryption
 * whenever non-empty params are passed (e.g. /genome/list, /down/list are plain when param-less).
 *
 * Data source: Sun Y et al. "gcMeta 2025: a global repository of metagenome-assembled genomes..."
 * Nucleic Acids Res 54(D1):D724-D733 (2026), doi:10.1093/nar/gkaf1115
 */
'use strict';

const crypto = require('crypto');

const BASE = 'https://gcmeta.wdcm.org/gcmetaapi';
const AES_KEY = '1234567890123456';
const AES_IV = '1234567890123456';
const RSA_CHUNK = 245; // 2048-bit RSA, PKCS#1 v1.5
const NONCE_TYPE = 'gcmeta';

let _publicKeyPem = null;

function randomNonce(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function wrapPem(raw) {
  const cleaned = raw.replace(/\s+/g, '');
  if (cleaned.includes('BEGIN PUBLIC KEY')) return raw;
  const lines = cleaned.match(/.{1,64}/g) || [cleaned];
  return '-----BEGIN PUBLIC KEY-----\n' + lines.join('\n') + '\n-----END PUBLIC KEY-----';
}

async function fetchPublicKey() {
  const r = await fetch(BASE + '/crypto/public-key');
  if (!r.ok) throw new Error('public key fetch failed: ' + r.status);
  const j = await r.json();
  let pem = j.publicKey;
  if (!pem) throw new Error('no publicKey in response');
  // server sends PEM AES-encrypted; try to decrypt, fall back to plain PEM
  try {
    const d = crypto.createDecipheriv('aes-128-cbc', Buffer.from(AES_KEY, 'utf8'), Buffer.from(AES_IV, 'utf8'));
    pem = Buffer.concat([d.update(Buffer.from(pem, 'base64')), d.final()]).toString('utf8');
  } catch (_e) { /* keep as-is */ }
  _publicKeyPem = wrapPem(pem);
  return _publicKeyPem;
}

function encryptParams(params) {
  if (!_publicKeyPem) throw new Error('public key not loaded; call init()');
  // NB: "data" must be the JSON *string* of the params (mirrors SPA: JSON.stringify(JSON.stringify(params)) )
  const payload = JSON.stringify({ data: JSON.stringify(params), timestamp: Date.now(), nonce: randomNonce() + NONCE_TYPE });
  const buf = Buffer.from(payload, 'utf8');
  const chunks = [];
  for (let i = 0; i < buf.length; i += RSA_CHUNK) {
    chunks.push(crypto.publicEncrypt(
      { key: _publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
      buf.subarray(i, i + RSA_CHUNK)));
  }
  return encodeURIComponent(Buffer.concat(chunks).toString('base64url'));
}

/** Encrypted API GET: path like "/function/genomeList", params object. */
async function apiGet(path, params = {}) {
  const hasParams = params && Object.keys(params).length > 0;
  let url = BASE + path;
  if (hasParams) url += '?encryptedData=' + encryptParams(params);
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); } catch (_e) { j = { _raw: txt }; }
  return { status: r.status, json: j };
}

/** Encrypted API POST. */
async function apiPost(path, params = {}) {
  const body = { encryptedData: encryptParams(params) };
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); } catch (_e) { j = { _raw: txt }; }
  return { status: r.status, json: j };
}

/** Paginated helper: keeps calling pageNum until page exhausted; returns all rows. */
async function apiGetAll(path, baseParams = {}, pageSize = 50, maxPages = 500) {
  const rows = [];
  for (let page = 1; page <= maxPages; page++) {
    const { status, json } = await apiGet(path, { ...baseParams, pageNum: page, pageSize });
    if (status !== 200) throw new Error(path + ' page ' + page + ' -> HTTP ' + status + ': ' + JSON.stringify(json).slice(0, 300));
    const content = json && json.data && json.data.content;
    if (!content) break;
    rows.push(...content);
    if (content.length < pageSize || json.data.last) break;
  }
  return rows;
}

async function init() {
  await fetchPublicKey();
}

module.exports = { BASE, init, apiGet, apiPost, apiGetAll, fetchPublicKey };
