// popup.js

// 当页面加载完毕时，请求当前开关状态
document.addEventListener('DOMContentLoaded', () => {
    // 读取版本号
    const version = chrome.runtime.getManifest().version;
    document.getElementById('extension-version').textContent = `Anon ${version}`;

    // 请求 toggle-switch 的当前状态
    chrome.runtime.sendMessage({ action: "requestToggleState" }, (response) => {
        document.getElementById('toggle-switch').checked = response.state;
    });

    // 请求 remove-rt 的当前状态
    chrome.runtime.sendMessage({ action: "requestRemoveRtState" }, (response) => {
        document.getElementById('remove-rt').checked = response.removeRt;
    });

    // 请求 copy-to-clipboard 的当前状态
    chrome.runtime.sendMessage({ action: "requestCopyToClipboardState" }, (response) => {
        document.getElementById('copy-to-clipboard').checked = response.copyToClipboard;
    });
});

// 监听 toggle-switch 的状态变化
document.getElementById('toggle-switch').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "toggleSwitch", state: this.checked });
});

// 监听 remove-rt 的状态变化
document.getElementById('remove-rt').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "updateRemoveRt", removeRt: this.checked });
});

// 监听 copy-to-clipboard 的状态变化
document.getElementById('copy-to-clipboard').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "updateCopyToClipboard", copyToClipboard: this.checked });
});
