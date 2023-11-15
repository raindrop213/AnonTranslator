// 当页面加载完毕时，请求当前开关状态
document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ action: "requestToggleState" }, (response) => {
        document.getElementById('toggle-switch').checked = response.state;
    });
});

// 监听复选框的状态变化
document.getElementById('toggle-switch').addEventListener('change', function () {
    chrome.runtime.sendMessage({ action: "toggleSwitch", state: this.checked });
});
