// popup.js

// 当页面加载完毕时，请求当前开关状态
document.addEventListener('DOMContentLoaded', () => {
    // 请求toggle-switch的当前状态
    chrome.runtime.sendMessage({ action: "requestToggleState" }, (response) => {
        document.getElementById('toggle-switch').checked = response.state;
    });

    // 请求remove-rt的当前状态
    chrome.runtime.sendMessage({ action: "requestRemoveRtState" }, (response) => {
        document.getElementById('remove-rt').checked = response.removeRt;
    });
});


// 监听复选框的状态变化

// 监听toggle-switch的状态变化
document.getElementById('toggle-switch').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "toggleSwitch", state: this.checked });
});

// 监听remove-rt的状态变化
document.getElementById('remove-rt').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "updateRemoveRt", removeRt: this.checked });
});