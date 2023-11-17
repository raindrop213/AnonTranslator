// popup.js

// 当页面加载完毕时，请求当前开关状态
document.addEventListener('DOMContentLoaded', () => {
    // 读取元数据
    const version = chrome.runtime.getManifest().version;
    const name = chrome.runtime.getManifest().name;
    const author = chrome.runtime.getManifest().author;
    document.getElementById('extension-version').textContent = `${name} ${version}`;
    document.getElementById('extension-author').textContent = `By: ${author}`;

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
    // 请求 case-switch 的当前状态
    chrome.runtime.sendMessage({ action: "requestCaseSwitchState" }, (response) => {
        document.getElementById('case-switch').checked = response.caseSwitch;
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

// 监听 case-switch 的状态变化
document.getElementById('case-switch').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "updateCaseSwitch", caseSwitch: this.checked });
});