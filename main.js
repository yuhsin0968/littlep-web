// 小P 網頁版主程式（之後會把 Swift 的預測邏輯慢慢搬進來）

console.log("小P 網頁版啟動完成！");

// 先寫一個小工具，測試網頁有正常運作
const logArea = document.getElementById("logArea");
if (logArea) {
    logArea.textContent = "系統已啟動，之後會在這裡顯示小P 的運算與提示訊息。";
}
