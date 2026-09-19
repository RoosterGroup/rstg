const SAVE_START_STRING = "AntimatterDimensionsSavefileFormatAAB";
const SAVE_END_STRING = "EndOfSavefile";

const forms = {
  input: /** @type {HTMLInputElement} */ (document.getElementById("save-input")),
  output: /** @type {HTMLInputElement} */ (document.getElementById("save-output"))
};

forms.input.addEventListener("keyup", updateOutput);
forms.output.addEventListener("keyup", updateInput);

function updateInput() {
  let inValue;
  try {
    inValue = encode(forms.output.value);
  } catch (e) {
    inValue = e+"";
  }
  forms.input.value = inValue;
}
function updateOutput() {
  let outValue;
  try {
    outValue = decode(forms.input.value);
  } catch (e) {
    outValue = e+"";
  }
  forms.output.value = outValue;
}
updateOutput();

function encode(str) {
  str = new TextEncoder().encode(str);
  str = pako.deflate(str);
  str = Array.from(str).map(i => String.fromCharCode(i)).join("");
  str = btoa(str);
  str = str.replace(/=+$/gu, "").replace(/0/gu, "0a").replace(/\+/gu, "0b").replace(/\//gu, "0c");
  str = SAVE_START_STRING + str + SAVE_END_STRING;
  return str;
}
function decode(str) {
  str = str
    .replace(new RegExp("^" + SAVE_START_STRING), "")
    .replace(new RegExp(SAVE_END_STRING + "$"), "");
  str = str.replace(/0b/gu, "+").replace(/0c/gu, "/").replace(/0a/gu, "0");
  str = atob(str);
  str = Uint8Array.from(Array.from(str).map(i => i.charCodeAt(0)));
  str = pako.inflate(str);
  str = new TextDecoder().decode(str);
  return str;
}
