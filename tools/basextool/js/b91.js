/* b91.js — Base91（91 个可打印字符，最优打包，约 6.5 bit/字符，无压缩）
 * 采用与中文编解码器相同的通用 base-N 框架，保证严格的编解码往返一致性；
 * 字符集为 basE91 标准 91 个可打印 ASCII 字符，13 字节 → 16 字符（≈6.5 bit/字符）。
 */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var common = global.RstgCommon;

  // basE91 标准字母表（91 个可打印字符）
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
  var alphabet = common.arrayCodecMap(ALPHABET.split(""));

  var codec = common.makeBaseN(alphabet, {
    id: "b91",
    name: "Base91",
    desc: "Base91，91 个可打印 ASCII 字符，13 字节 → 16 字符，约 6.51 bit/字符。无压缩。",
    note: "比 Base64 省约 15% 体积，仍属 ASCII 安全字符集。",
    compressAvailable: false,
    charCap: 16   // 允许更大的字符块以获得最优打包（13 字节 → 16 字符）
  });
  C.register("b91", codec);
})(typeof window !== "undefined" ? window : globalThis);
