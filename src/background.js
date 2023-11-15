// background.js

let toggleSwitchState = false; // 默认状态为false
let removeRtState = true; // 默认移除rt标签的状态为true
let copyToClipboardState = true; // 默认开启复制到剪贴板功能

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case "toggleSwitch":
            toggleSwitchState = message.state;
            break;
        case "requestToggleState":
            sendResponse({ state: toggleSwitchState });
            break;
        case "updateRemoveRt":
            removeRtState = message.removeRt;
            break;
        case "requestRemoveRtState":
            sendResponse({ removeRt: removeRtState });
            break;
        case "updateCopyToClipboard":
            copyToClipboardState = message.copyToClipboard;
            break;
        case "requestCopyToClipboardState":
            sendResponse({ copyToClipboard: copyToClipboardState });
            break;
        case "openPopup":
            if (toggleSwitchState) {
                const selectedText = message.selectedText;
                const x = message.x;
                const y = message.y;
                const screenWidth = message.screenWidth;
                const screenHeight = message.screenHeight;
                const popupWidth = 400;
                const popupHeight = 300;

                // 计算窗口合适位置
                const xPosition = Math.min(x, screenWidth - popupWidth);
                const yPosition = Math.min(y, screenHeight - popupHeight);

                chrome.windows.create({
                    url: chrome.runtime.getURL(`case.html?selectedText=${selectedText}`),
                    type: "popup",
                    width: popupWidth,
                    height: popupHeight,
                    top: yPosition + 100,
                    left: xPosition,
                });
            }
    }
});
