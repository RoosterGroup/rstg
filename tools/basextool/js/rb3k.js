/* rb3k.js — RstgBase3k（GB2312 一级汉字全 3755 个，支持 LZ 压缩） */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var common = global.RstgCommon;

  var charset = common.buildGB2312(3755);            // 一级汉字全 3755 个
  var alphabet = common.arrayCodecMap(charset);
  var codec = common.makeBaseN(alphabet, {
    id: "rb3k",
    name: "RstgBase3k",
    desc: "GB2312 一级汉字全 3755 个，约 11.87 bit/字符（理论极限 log₂3755 ≈ 11.875 bit）。支持 LZ 压缩（默认最大）。",
    note: "对应原 Base3755（一级汉字全 3755 字），统一为可压缩格式。",
    compressAvailable: true
  });
  C.register("rb3k", codec);
})(typeof window !== "undefined" ? window : globalThis);
