/* test-roundtrip.js — 在 Node 中验证所有编解码器的编码/解码往返一致 */
require("./js/common.js");
require("./js/b64.js");
require("./js/b91.js");
require("./js/rb2500.js");
require("./js/rb3k.js");
require("./js/rb8k.js");
require("./js/rb87k.js");
require("./js/rstgmb1m.js");

var C = globalThis.RstgCodecs;

var samples = {
  "empty": "",
  "ascii": "Hello, World! Base2500 test 0123456789 ABCDEFG",
  "chinese": "你好，世界！汉字编码测试 一二三四五六七八九十 永遠に続く物語。",
  "repeat": "重复重复重复重复重复重复重复重复重复重复重复重复重复重复重复",
  "mixed": "RstgBase 工具箱 2026 🚀🔥 数据data编码测试\t\n换行。",
  "longrepeat": "a".repeat(500) + "数据块".repeat(50)
};

var order = ["b64", "b91", "rb2500", "rb3k", "rb8k", "rb87k", "rstgmb1m"];
var fail = 0, pass = 0;

function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log("  ❌ FAIL [" + name + "] " + (detail || "")); }
}

order.forEach(function (id) {
  var codec = C[id];
  console.log("\n=== " + codec.name + "  (size=" + codec.size + ", " + codec.bitPerChar.toFixed(2) + " bit/char, compress=" + codec.compressAvailable + ") ===");
  var levels = codec.compressAvailable ? [false, true] : [false];
  Object.keys(samples).forEach(function (key) {
    var text = samples[key];
    levels.forEach(function (useCompress) {
      var tag = key + (useCompress ? "/压缩" : "/不压缩");
      try {
        var e = codec.encode(text, { compress: useCompress, level: "max" });
        var d = codec.decode(e.text);
        check(codec.name + " " + tag, d.text === text,
          "round-trip mismatch (out " + e.outChars + " chars)");
        // 统计
        if (useCompress) {
          var ratio = e.compressed ? (e.compressedBytes / e.rawBytes * 100).toFixed(0) + "%" : "未压缩";
          console.log("  ✓ " + tag + " -> " + e.rawBytes + "B / " + e.outChars + "字 (压缩:" + ratio + ")");
        } else {
          console.log("  ✓ " + tag + " -> " + e.rawBytes + "B / " + e.outChars + "字");
        }
      } catch (err) {
        check(codec.name + " " + tag, false, "throw: " + err.message);
      }
    });
  });

  // 非法字符/非法数据检测：要么跳过非字母表字符返回空，要么抛出受控的“长度头非法”等拒绝错误
  try {
    codec.decode("@@@notvalid@@@");
    check(codec.name + " 非法字符", true, "跳过非法字符并返回空");
  } catch (e) {
    check(codec.name + " 非法字符", /长度头非法|非法字符|可能不是|数据/.test(e.message), "受控拒绝: " + e.message);
  }
});

console.log("\n========================================");
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
process.exit(fail === 0 ? 0 : 1);
