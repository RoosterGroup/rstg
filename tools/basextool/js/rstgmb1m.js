/* rstgmb1m.js — RstgMAX-Base1M（Unicode 全部标量字符，支持 LZ 压缩） */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var common = global.RstgCommon;

  // Unicode 标量值总数 = 0x110000 - 0x800（剔除代理区 D800~DFFF）= 1,112,064
  var N = 1112064;
  var alphabet = {
    size: N,
    // 索引 d -> 码点：0..0xD7FF 直映；0xD800.. 偏移 0x800 跳过代理区
    indexToChar: function (d) {
      var cp = d < 0xD800 ? d : d + 0x800;
      return String.fromCodePoint(cp);
    },
    // 码点 -> 索引（逆映射）
    charToIndex: function (ch) {
      var cp = ch.codePointAt(0);
      var d = cp < 0xD800 ? cp : cp - 0x800;
      return (d >= 0 && d < N) ? d : -1;
    }
  };

  var codec = common.makeBaseN(alphabet, {
    id: "rstgmb1m",
    name: "RstgMAX-Base1M",
    desc: "Unicode 全部标量字符（U+0000–U+10FFFF，剔除代理区 D800–DFFF）共 1,112,064 个，约 20.08 bit/字符。支持 LZ 压缩（默认最大）。",
    note: "覆盖全 Unicode（含各国文字/符号/emoji），体积效率最高；每个字符由码点直接计算，无需存储字表。",
    compressAvailable: true
  });
  C.register("rstgmb1m", codec);
})(typeof window !== "undefined" ? window : globalThis);
