/* common.js — 共享工具：字符集构建、LZ 压缩、通用 base-N 编解码框架、注册表
 * 所有编解码器均依赖本文件。本文件不依赖任何 DOM 接口，可在浏览器与 Node 中运行。
 */
(function (global) {
  "use strict";

  var ENC = new TextEncoder();
  var DEC = new TextDecoder("utf-8");

  /* ---------------------------------------------------------
   *  注册表
   * ------------------------------------------------------- */
  var registry = {};
  function register(id, codec) {
    codec.id = id;
    registry[id] = codec;
  }
  // 非枚举，避免被 Object.keys(registry) 当作编解码器
  Object.defineProperty(registry, "register", { value: register, enumerable: false });

  /* ---------------------------------------------------------
   *  字符集构建
   * ------------------------------------------------------- */

  // 尝试获取 GBK 解码器（现代浏览器均支持；Node 若带全量 ICU 也支持）
  function tryGBK() {
    try {
      if (typeof TextDecoder === "undefined") return null;
      var d = new TextDecoder("gbk", { fatal: true });
      d.decode(new Uint8Array([0xB0, 0xA1])); // 烟雾测试
      return d;
    } catch (e) {
      return null;
    }
  }

  // 构建 GB2312 一级(3755)+二级(3008) 汉字表，按区位顺序排列。
  // limit 存在时只取前 limit 个（一级汉字前 limit 个）。
  function buildGB2312(limit) {
    var dec = tryGBK();
    var list = [];
    if (dec) {
      for (var hi = 0xB0; hi <= 0xF7; hi++) {
        for (var lo = 0xA1; lo <= 0xFE; lo++) {
          if (hi === 0xD7 && lo > 0xF9) continue; // 0xD7FA~0xD7FE 为空
          var ch;
          try { ch = dec.decode(new Uint8Array([hi, lo])); }
          catch (e) { continue; }
          if (ch && ch.length === 1 && ch !== "￾") {
            list.push(ch);
            if (limit && list.length >= limit) return list;
          }
        }
      }
      if (list.length) return list;
    }
    // 回退：用 Unicode CJK 统一表意文字前缀（保证任何环境都能工作）
    return buildCJKPrefix(limit || 6763, 0x4E00);
  }

  function buildCJKPrefix(count, start) {
    var list = [];
    for (var i = 0; i < count; i++) list.push(String.fromCodePoint(start + i));
    return list;
  }

  // GB18030-2022 全汉字近似集：Unicode 全部 CJK 区块（约 9.4 万），确定性、无需外部数据。
  function buildCJKFull() {
    var ranges = [
      [0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF],
      [0x20000, 0x2A6DF], [0x2A700, 0x2B73F], [0x2B740, 0x2B81F],
      [0x2B820, 0x2CEAF], [0x2CEB0, 0x2EBEF], [0x2F800, 0x2FA1F],
      [0x30000, 0x3134F]
    ];
    var list = [];
    for (var r = 0; r < ranges.length; r++) {
      for (var cp = ranges[r][0]; cp <= ranges[r][1]; cp++) {
        if (cp >= 0xD800 && cp <= 0xDFFF) continue;
        list.push(String.fromCodePoint(cp));
      }
    }
    return list;
  }

  // 由字符数组构建 索引<->字符 映射
  function arrayCodecMap(chars) {
    var map = new Map();
    for (var i = 0; i < chars.length; i++) map.set(chars[i], i);
    return {
      size: chars.length,
      indexToChar: function (d) { return chars[d]; },
      charToIndex: function (ch) { var v = map.get(ch); return v === undefined ? -1 : v; }
    };
  }

  /* ---------------------------------------------------------
   *  varint (LEB128)
   * ------------------------------------------------------- */
  function writeVarint(arr, value) {
    if (value < 0) value = 0;
    while (value >= 128) {
      arr.push((value % 128) | 0x80);
      value = Math.floor(value / 128);
    }
    arr.push(value & 0x7F);
  }
  function readVarint(data, pos) {
    var value = 0, mult = 1;
    for (;;) {
      if (pos >= data.length) throw new Error("varint 被截断");
      var b = data[pos++];
      value += (b & 0x7F) * mult;
      if ((b & 0x80) === 0) break;
      mult *= 128;
      if (mult > 9007199254740992) throw new Error("varint 过大");
    }
    return { value: value, pos: pos };
  }

  /* ---------------------------------------------------------
   *  LZ77 / LZSS 压缩（等级可选）
   *  窗口 32KB，最小匹配 3，最大匹配 258，15bit 距离 + 8bit 长度。
   *  位流：1bit 标志 + (字面量 8bit | 匹配: 15bit 距离 + 8bit 长度偏移)
   * ------------------------------------------------------- */
  var LZ = (function () {
    var MIN_MATCH = 3, MAX_MATCH = 258, WINDOW = 32768;
    var HASH_BITS = 16, HASH_SIZE = 1 << HASH_BITS, HASH_MASK = HASH_SIZE - 1;
    var CHAIN = { quick: 64, normal: 512, max: 4096 };

    function compress(data, level) {
      level = level || "max";
      var maxChain = CHAIN[level] || CHAIN.max;
      var n = data.length;
      if (n === 0) return new Uint8Array(0);

      var out = [];
      var cur = 0, nbits = 0;
      function writeBit(b) { cur = (cur << 1) | b; nbits++; if (nbits === 8) { out.push(cur & 0xFF); cur = 0; nbits = 0; } }
      function writeBits(v, nb) { for (var i = nb - 1; i >= 0; i--) writeBit((v >>> i) & 1); }

      var head = new Int32Array(HASH_SIZE); head.fill(-1);
      var prev = new Int32Array(n); prev.fill(-1);
      function hashAt(p) {
        var h = (data[p] << 16) ^ (data[p + 1] << 8) ^ data[p + 2];
        h = Math.imul(h, 0x9E3779B1);
        return (h >>> 16) & HASH_MASK;
      }

      var i = 0;
      while (i < n) {
        var bestLen = 0, bestDist = 0;
        var maxLen = Math.min(MAX_MATCH, n - i);
        if (maxLen >= MIN_MATCH) {
          var h = hashAt(i);
          var cand = head[h];
          var limit = i - WINDOW; if (limit < 0) limit = 0;
          var chain = 0;
          while (cand >= limit && chain < maxChain) {
            if (data[cand + bestLen] === data[i + bestLen]) {
              var len = 0;
              while (len < maxLen && data[cand + len] === data[i + len]) len++;
              if (len > bestLen) { bestLen = len; bestDist = i - cand; if (len === maxLen) break; }
            }
            cand = prev[cand]; chain++;
          }
        }
        if (bestLen >= MIN_MATCH) {
          writeBit(1);
          writeBits(bestDist - 1, 15);
          writeBits(bestLen - MIN_MATCH, 8);
          for (var k = 0; k < bestLen; k++) {
            var p2 = i + k;
            if (p2 + 2 < n) { var ph = hashAt(p2); prev[p2] = head[ph]; head[ph] = p2; }
          }
          i += bestLen;
        } else {
          writeBit(0);
          writeBits(data[i], 8);
          if (i + 2 < n) { var ih = hashAt(i); prev[i] = head[ih]; head[ih] = i; }
          i++;
        }
      }
      if (nbits > 0) { cur = cur << (8 - nbits); out.push(cur & 0xFF); }
      return new Uint8Array(out);
    }

    function decompress(data, expectedLen) {
      var out = new Uint8Array(expectedLen);
      var outPos = 0, pos = 0, cur = 0, nbits = 0;
      function readBit() {
        if (nbits === 0) { if (pos >= data.length) throw new Error("压缩数据被截断"); cur = data[pos++]; nbits = 8; }
        nbits--; return (cur >> nbits) & 1;
      }
      function readBits(nb) { var v = 0; for (var i = 0; i < nb; i++) v = (v << 1) | readBit(); return v; }
      while (outPos < expectedLen) {
        if (readBit() === 0) {
          out[outPos++] = readBits(8);
        } else {
          var dist = readBits(15) + 1;
          var len = readBits(8) + MIN_MATCH;
          var src = outPos - dist;
          if (src < 0) throw new Error("压缩数据损坏（距离越界）");
          for (var k = 0; k < len && outPos < expectedLen; k++) out[outPos++] = out[src++];
        }
      }
      return out;
    }

    return { compress: compress, decompress: decompress };
  })();

  /* ---------------------------------------------------------
   *  通用 base-N 编解码器（支持可选 LZ 压缩 + 变长长度头）
   *  alphabet: { size, indexToChar(d), charToIndex(ch) }
   *  opts: { id, name, desc, note, compressAvailable, maxChunk, charCap }
   * ------------------------------------------------------- */
  function makeBaseN(alphabet, opts) {
    var N = alphabet.size;
    var indexToChar = alphabet.indexToChar;
    var charToIndex = alphabet.charToIndex;

    function neededChars(s) {
      var need = 1n;
      for (var k = 0; k < s; k++) need <<= 8n; // 2^(8s)
      var c = 1, prod = BigInt(N);
      while (prod < need) { prod *= BigInt(N); c++; if (c > 64) break; }
      return c;
    }

    var maxChunk = opts.maxChunk || 24;
    var cap = opts.charCap || 8;
    var charsForSize = [];
    for (var s = 1; s <= maxChunk; s++) charsForSize[s] = neededChars(s);
    var B = 1;
    for (var s2 = 1; s2 <= maxChunk; s2++) {
      if (charsForSize[s2] <= cap) B = s2; else break;
    }
    if (B < 1) B = 1;

    function headerDigits(T) {
      if (T === 0) return [0];
      var t = T, arr = [];
      while (t > 0) { arr.unshift(t % N); t = Math.floor(t / N); }
      return arr;
    }

    function toChars(digits) {
      var out = "";
      for (var i = 0; i < digits.length; i++) out += indexToChar(digits[i]);
      return out;
    }

    function toDigits(bytes) {
      var L = bytes.length, digits = [], pos = 0;
      while (pos < L) {
        var size = Math.min(B, L - pos);
        var v = 0n;
        for (var k = 0; k < size; k++) v = (v << 8n) | BigInt(bytes[pos + k]);
        var c = charsForSize[size];
        var tmp = new Array(c);
        for (var k = c - 1; k >= 0; k--) { tmp[k] = Number(v % BigInt(N)); v /= BigInt(N); }
        for (var k = 0; k < c; k++) digits.push(tmp[k]);
        pos += size;
      }
      return digits;
    }

    function buildPayload(utf8, useCompress, level) {
      if (useCompress) {
        var comp = LZ.compress(utf8, level);
        if (comp.length > 0 && comp.length < utf8.length) {
          var payload = [1];
          writeVarint(payload, utf8.length);
          for (var i = 0; i < comp.length; i++) payload.push(comp[i]);
          return { payload: new Uint8Array(payload), compressed: true, compBytes: comp.length };
        }
      }
      var payload2 = [0];
      writeVarint(payload2, utf8.length);
      for (var j = 0; j < utf8.length; j++) payload2.push(utf8[j]);
      return { payload: new Uint8Array(payload2), compressed: false, compBytes: utf8.length };
    }

    function encode(text, o) {
      var utf8 = ENC.encode(text);
      var useCompress = !!o && o.compress && opts.compressAvailable;
      var level = (o && o.level) || "max";
      var bp = buildPayload(utf8, useCompress, level);
      var T = bp.payload.length;
      var hd = headerDigits(T);
      var digits = [hd.length - 1];
      for (var i = 0; i < hd.length; i++) digits.push(hd[i]);
      var pd = toDigits(bp.payload);
      for (var j = 0; j < pd.length; j++) digits.push(pd[j]);
      var out = toChars(digits);
      return {
        text: out,
        rawBytes: utf8.length,
        payloadBytes: T,
        compressed: bp.compressed,
        compressedBytes: bp.compBytes,
        outChars: Array.from(out).length
      };
    }

    function decode(text, o) {
      // 注意：Base1M 等全 Unicode 字母表包含空白码点，不能按 \s 整体剥离；
      // 改为逐字符跳过“不在字母表中”的字符（用户粘贴带入的空白/换行会被忽略，
      // 而字母表内的空白码点则保留为有效数据）。
      var digits = [];
      var it = text[Symbol.iterator]();
      var step;
      while (!(step = it.next()).done) {
        var idx = charToIndex(step.value);
        if (idx < 0) continue;
        digits.push(idx);
      }
      if (digits.length < 1) return { text: "", rawBytes: 0, compressed: false, outChars: 0 };

      var p = 0;
      var h = digits[p++];
      if (h > 10) throw new Error("长度头非法，这段文字可能不是本工具的编码结果");
      var nd = h + 1;
      if (p + nd > digits.length) throw new Error("数据不完整（长度头被截断）");
      var T = 0;
      for (var k = 0; k < nd; k++) T = T * N + digits[p++];
      if (T > 200 * 1024 * 1024) throw new Error("声明的数据长度过大：" + T + " 字节");

      var remaining = digits.length - p;
      var maxBytes = Math.floor(remaining / charsForSize[B]) * B + B;
      if (T > maxBytes) throw new Error("长度头与数据量不符（可能数据损坏）");

      if (T === 0) {
        if (p !== digits.length) throw new Error("末尾存在多余的字符");
        return { text: "", rawBytes: 0, compressed: false, outChars: 0 };
      }

      var bytes = new Uint8Array(T);
      var i = 0;
      while (i < T) {
        var size = Math.min(B, T - i);
        var c = charsForSize[size];
        if (p + c > digits.length) throw new Error("数据不完整（正文被截断）");
        var v = 0n;
        for (var j = 0; j < c; j++) v = v * BigInt(N) + BigInt(digits[p++]);
        if (v >= (1n << BigInt(8 * size))) throw new Error("数值越界，数据可能已损坏");
        for (var q = size - 1; q >= 0; q--) { bytes[i + q] = Number(v & 255n); v >>= 8n; }
        i += size;
      }
      if (p !== digits.length) throw new Error("末尾存在多余的字符");

      var flag = bytes[0];
      var r = readVarint(bytes, 1);
      var origLen = r.value;
      var pos = r.pos;
      var dataBytes;
      if (flag === 0) {
        dataBytes = bytes.subarray(pos);
        if (dataBytes.length !== origLen) throw new Error("长度校验失败（声明 " + origLen + "，实际 " + dataBytes.length + "）");
      } else if (flag === 1) {
        dataBytes = LZ.decompress(bytes.subarray(pos), origLen);
      } else {
        throw new Error("未知的压缩标志位：" + flag);
      }
      var outStr = DEC.decode(dataBytes);
      return { text: outStr, rawBytes: origLen, compressed: flag === 1, outChars: Array.from(outStr).length };
    }

    // 字母表预览（前 60 个字符）
    var alphaPreview = "";
    for (var ap = 0; ap < Math.min(60, N); ap++) alphaPreview += indexToChar(ap);

    return {
      id: opts.id,
      name: opts.name,
      size: N,
      bitPerChar: Math.log2(N),
      compressAvailable: !!opts.compressAvailable,
      desc: opts.desc,
      note: opts.note || "",
      B: B,
      chunkChars: charsForSize[B],
      alphaPreview: alphaPreview,
      encode: encode,
      decode: decode
    };
  }

  global.RstgCommon = {
    ENC: ENC,
    DEC: DEC,
    register: register,
    registry: registry,
    buildGB2312: buildGB2312,
    buildCJKPrefix: buildCJKPrefix,
    buildCJKFull: buildCJKFull,
    arrayCodecMap: arrayCodecMap,
    writeVarint: writeVarint,
    readVarint: readVarint,
    LZ: LZ,
    makeBaseN: makeBaseN
  };
  global.RstgCodecs = registry;

})(typeof window !== "undefined" ? window : globalThis);
