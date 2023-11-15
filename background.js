// background.js

let toggleSwitchState = false; // 默认状态为false

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleSwitch") {
        toggleSwitchState = message.state;
    } else if (message.action === "requestToggleState") {
        sendResponse({ state: toggleSwitchState });
    } else if (message.action === "openPopup" && toggleSwitchState) { // 检查开关状态
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
});
