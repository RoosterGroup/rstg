/* b64.js — 标准 Base64 (RFC 4648)，无压缩 */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var ENC = new TextEncoder();
  var DEC = new TextDecoder("utf-8");
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var IDX = (function () { var m = {}; for (var i = 0; i < B64.length; i++) m[B64[i]] = i; return m; })();

  function encode(text) {
    var bytes = ENC.encode(text);
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i];
      var b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      var b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      var n = (b0 << 16) | (b1 << 8) | b2;
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
      out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
      out += i + 2 < bytes.length ? B64[n & 63] : "=";
    }
    return { text: out, rawBytes: bytes.length, outChars: out.length, compressed: false };
  }

  function decode(text) {
    var s = text.replace(/[^A-Za-z0-9+/=]/g, "").replace(/=+$/, "");
    if (s === "") return { text: "", rawBytes: 0, outChars: 0, compressed: false };
    var bytes = [];
    for (var i = 0; i < s.length; i += 4) {
      var c0 = IDX[s[i]];
      var c1 = IDX[s[i + 1]];
      var c2 = i + 2 < s.length ? IDX[s[i + 2]] : -1;
      var c3 = i + 3 < s.length ? IDX[s[i + 3]] : -1;
      if (c0 === undefined || c1 === undefined) throw new Error("非法 Base64 字符");
      var n = (c0 << 18) | (c1 << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3);
      bytes.push((n >> 16) & 255);
      if (c2 >= 0) bytes.push((n >> 8) & 255);
      if (c3 >= 0) bytes.push(n & 255);
    }
    var out = DEC.decode(new Uint8Array(bytes));
    return { text: out, rawBytes: bytes.length, outChars: Array.from(out).length, compressed: false };
  }

  C.register("b64", {
    id: "b64",
    name: "Base64",
    size: 64,
    bitPerChar: 6,
    compressAvailable: false,
    desc: "标准 Base64（RFC 4648），每 3 字节 → 4 字符，6 bit/字符，带 = 填充。无压缩。",
    note: "通用性最强，但体积最大（编码后约为原始 4/3）。",
    chunkChars: 4,   // 3 字节 → 4 字符
    alphaPreview: B64.slice(0, 60),
    encode: encode,
    decode: decode
  });
})(typeof window !== "undefined" ? window : globalThis);
