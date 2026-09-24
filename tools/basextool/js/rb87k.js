/* rb87k.js — RstgBase87k（GB18030-2022 全汉字近似集 / Unicode CJK 全块，支持 LZ 压缩） */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var common = global.RstgCommon;

  // 约 9.4 万 CJK 汉字（GB18030-2022 全汉字的可靠近似：Unicode 全部 CJK 区块）
  var charset = common.buildCJKFull();
  var alphabet = common.arrayCodecMap(charset);
  var codec = common.makeBaseN(alphabet, {
    id: "rb87k",
    name: "RstgBase87k",
    desc: "GB18030-2022 全汉字近似集（Unicode 全部 CJK 区块）共 " + alphabet.size.toLocaleString("en-US") +
          " 个汉字，约 " + Math.log2(alphabet.size).toFixed(2) + " bit/字符。支持 LZ 压缩（默认最大）。",
    note: "使用 Unicode CJK 全块确定性生成，无需外部字表；覆盖绝大多数汉字。",
    compressAvailable: true
  });
  C.register("rb87k", codec);
})(typeof window !== "undefined" ? window : globalThis);
