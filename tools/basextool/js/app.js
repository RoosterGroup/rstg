/* app.js — RstgBase 工具箱界面逻辑 */
(function () {
  "use strict";

  var C = window.RstgCodecs;

  // 编解码器展示顺序
  var ORDER = ["b64", "b91", "rb2500", "rb3k", "rb8k", "rb87k", "rstgmb1m"];

  // DOM
  var codecSel  = document.getElementById("codec");
  var metaEl    = document.getElementById("meta");
  var compressWrap = document.getElementById("compressWrap");
  var useCompress  = document.getElementById("useCompress");
  var levelWrap = document.getElementById("levelWrap");
  var levelSel  = document.getElementById("level");
  var inputEl   = document.getElementById("input");
  var outputEl  = document.getElementById("output");
  var inCount   = document.getElementById("inCount");
  var outCount  = document.getElementById("outCount");
  var statusEl  = document.getElementById("status");
  var infoBody  = document.getElementById("infoBody");

  function fmt(n) { return (n == null ? 0 : n).toLocaleString("en-US"); }
  function currentCodec() { return C[codecSel.value]; }

  /* ---- 填充选择器 + 说明 ---- */
  function buildSelector() {
    ORDER.forEach(function (id) {
      var c = C[id];
      if (!c) return;
      var opt = document.createElement("option");
      opt.value = id;
      opt.textContent = c.name + "  ·  " + fmt(c.size) + " 字符";
      codecSel.appendChild(opt);
    });
  }

  function refreshInfo() {
    var c = currentCodec();
    if (!c) return;

    // 元信息徽章
    var comp = c.compressAvailable
      ? '<b>压缩</b> 可用' : '<b>压缩</b> 不支持';
    metaEl.innerHTML =
      "字母表 <b>" + fmt(c.size) + "</b><span class='sep'>|</span>" +
      "密度 <b>" + c.bitPerChar.toFixed(2) + "</b> bit/字符<span class='sep'>|</span>" +
      comp;

    // 压缩控件可用性
    var en = !!c.compressAvailable;
    useCompress.disabled = !en;
    compressWrap.style.opacity = en ? "1" : "0.4";
    levelWrap.style.opacity = en ? "1" : "0.4";
    if (!en) { useCompress.checked = false; }

    // 编码块信息
    var chunkText;
    if (c.id === "b64") chunkText = "每 3 字节 → 4 字符";
    else if (c.id === "b91") chunkText = "每 13 字节 → 16 字符";
    else chunkText = "每 " + c.B + " 字节 → " + c.chunkChars + " 字符";

    infoBody.innerHTML =
      "<p><span class='k'>名称：</span><b>" + c.name + "</b></p>" +
      "<p><span class='k'>说明：</span>" + c.desc + "</p>" +
      (c.note ? "<p><span class='k'>备注：</span>" + c.note + "</p>" : "") +
      "<p><span class='k'>字母表大小：</span>" + fmt(c.size) + " 个字符　" +
      "<span class='k'>信息密度：</span>" + c.bitPerChar.toFixed(2) + " bit/字符（理论极限约 " + c.bitPerChar.toFixed(3) + "）</p>" +
      "<p><span class='k'>打包：</span>" + chunkText +
      (c.compressAvailable ? "　<span class='k'>压缩：</span>内置 LZ（等级可选，默认最大）" : "　<span class='k'>压缩：</span>无") + "</p>" +
      "<p><span class='k'>字母表前 60 个字符：</span><br><span id='alphaPreview'>" +
      (c.alphaPreview || "") + "</span></p>";
  }

  /* ---- 状态 ---- */
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (type ? " " + type : "");
  }

  function updateCounts() {
    inCount.textContent  = Array.from(inputEl.value).length.toLocaleString("en-US") + " 字符";
    outCount.textContent = Array.from(outputEl.value).length.toLocaleString("en-US") + " 字符";
  }

  /* ---- 编码 ---- */
  function doEncode() {
    var c = currentCodec();
    var text = inputEl.value;
    if (text === "") { setStatus("请先输入要编码的内容。", "warn"); return; }
    try {
      var t0 = performance.now();
      var res = c.encode(text, { compress: useCompress.checked, level: levelSel.value });
      var t1 = performance.now();
      outputEl.value = res.text;
      updateCounts();
      var inCh = Array.from(text).length;
      var ratio = (res.compressed && res.rawBytes > 0)
        ? (res.compressedBytes / res.rawBytes * 100).toFixed(1) + "%" : null;
      var parts = [
        "✅ 编码完成：" + fmt(inCh) + " 字符 → UTF-8 " + fmt(res.rawBytes) + " 字节"
      ];
      if (c.compressAvailable) {
        parts.push(res.compressed
          ? "→ LZ 压缩后 " + fmt(res.compressedBytes) + " 字节（压缩率 " + ratio + "）"
          : "→ 压缩无收益，已关闭");
      }
      parts.push("→ 输出 " + fmt(res.outChars) + " 个字符（耗时 " + (t1 - t0).toFixed(1) + " ms）");
      setStatus(parts.join("　"), "ok");
    } catch (e) {
      setStatus("❌ 编码失败：" + e.message, "err");
    }
  }

  /* ---- 解码 ---- */
  function doDecode() {
    var c = currentCodec();
    var text = inputEl.value;
    if (text === "") { setStatus("请先输入要解码的内容。", "warn"); return; }
    try {
      var t0 = performance.now();
      var res = c.decode(text);
      var t1 = performance.now();
      outputEl.value = res.text;
      updateCounts();
      setStatus(
        "✅ 解码完成：" + fmt(Array.from(text).length) + " 个字符 → 还原 " +
        fmt(res.rawBytes) + " 字节" + (res.compressed ? "（经 LZ 解压）" : "") +
        " → 输出 " + fmt(res.outChars) + " 字符（耗时 " + (t1 - t0).toFixed(1) + " ms）",
        "ok"
      );
    } catch (e) {
      setStatus("❌ 解码失败：" + e.message, "err");
    }
  }

  /* ---- 按钮事件 ---- */
  document.getElementById("btnEncode").addEventListener("click", doEncode);
  document.getElementById("btnDecode").addEventListener("click", doDecode);

  document.getElementById("btnSwap").addEventListener("click", function () {
    var tmp = outputEl.value;
    if (tmp === "") { setStatus("输出为空，没有可交换的内容。", "warn"); return; }
    inputEl.value = tmp;
    outputEl.value = "";
    updateCounts();
    setStatus("已把输出内容移到输入框，可继续解码/编码。", "");
  });

  document.getElementById("btnCopy").addEventListener("click", function () {
    var v = outputEl.value;
    if (v === "") { setStatus("输出为空，没有可复制的内容。", "warn"); return; }
    function fallback() {
      outputEl.removeAttribute("readonly");
      outputEl.select();
      document.execCommand("copy");
      outputEl.setAttribute("readonly", "readonly");
      setStatus("📋 已复制到剪贴板。", "ok");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(function () {
        setStatus("📋 已复制到剪贴板。", "ok");
      }, fallback);
    } else { fallback(); }
  });

  document.getElementById("btnClear").addEventListener("click", function () {
    inputEl.value = "";
    outputEl.value = "";
    updateCounts();
    setStatus("已清空。", "");
    inputEl.focus();
  });

  document.getElementById("btnDemo").addEventListener("click", function () {
    inputEl.value =
      "RstgBase 工具箱 —— 你好，世界！Hello, World! 0123456789\n" +
      "压缩测试：重复重复重复重复重复重复重复重复重复重复重复重复\n" +
      "永遠に続く物語。数据data编码测试 🚀🔥";
    outputEl.value = "";
    updateCounts();
    setStatus("已填入示例文本，点击「编码 →」看看效果（中文/重复内容压缩收益明显）。", "");
  });

  codecSel.addEventListener("change", refreshInfo);
  useCompress.addEventListener("change", function () {
    levelWrap.style.opacity = useCompress.checked ? "1" : "0.4";
  });
  inputEl.addEventListener("input", updateCounts);
  inputEl.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doEncode(); }
  });

  /* ---- 初始化 ---- */
  buildSelector();
  refreshInfo();
  updateCounts();
  setStatus("就绪。当前字母表共 " + fmt(currentCodec().size) +
            " 个字符" + (currentCodec().compressAvailable ? "，内置 LZ 压缩（默认最大）。" : "。") +
            " 按 Ctrl+Enter 快速编码。", "");
})();
