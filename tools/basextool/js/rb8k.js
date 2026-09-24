/* rb8k.js — RstgBase8k（GB2312 一级+二级 共 6763 个汉字，支持 LZ 压缩） */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var common = global.RstgCommon;

  var charset = common.buildGB2312(0);               // 一级(3755)+二级(3008) = 6763 个
  var alphabet = common.arrayCodecMap(charset);
  var codec = common.makeBaseN(alphabet, {
    id: "rb8k",
    name: "RstgBase8k",
    desc: "GB2312 一级+二级汉字共 6763 个（全中文一二三级文字），约 12.72 bit/字符。支持 LZ 压缩（默认最大）。",
    note: "字母表实际 6763 字（一级 3755 + 二级 3008），标签沿用 RstgBase8k。",
    compressAvailable: true
  });
  C.register("rb8k", codec);
})(typeof window !== "undefined" ? window : globalThis);
