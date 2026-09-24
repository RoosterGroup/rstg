/* rb2500.js — RstgBase2500（GB2312 一级汉字前 2500 个，支持 LZ 压缩） */
(function (global) {
  "use strict";
  var C = global.RstgCodecs;
  var common = global.RstgCommon;

  var charset = common.buildGB2312(2500);            // 一级汉字前 2500 个
  var alphabet = common.arrayCodecMap(charset);
  var codec = common.makeBaseN(alphabet, {
    id: "rb2500",
    name: "RstgBase2500",
    desc: "GB2312 一级汉字前 2500 个，约 11.29 bit/字符（理论极限 log₂2500 ≈ 11.288 bit）。支持 LZ 压缩（默认最大）。",
    note: "沿用原 Base2500 字母表（一级汉字前 2500 字），统一为可压缩格式。",
    compressAvailable: true
  });
  C.register("rb2500", codec);
})(typeof window !== "undefined" ? window : globalThis);
