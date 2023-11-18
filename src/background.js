// background.js


let toggleState = true;
let readTextState = true;
let copyToClipboardState = true;
let caseSwitchState = true;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {

        case "updateToggle":
            toggleState = message.toggle;
            break;
        case "requestToggleState":
            sendResponse({ toggle: toggleState });
            break;

        case "updateReadText":
            readTextState = message.readText;
            break;
        case "requestReadTextState":
            sendResponse({ readText: readTextState });
            break;

        case "updateCopyToClipboard":
            copyToClipboardState = message.copyToClipboard;
            break;
        case "requestCopyToClipboardState":
            sendResponse({ copyToClipboard: copyToClipboardState });
            break;

        case "updateCaseSwitch":
            caseSwitchState = message.caseSwitch;
            break;
        case "requestCaseSwitchState":
            sendResponse({ caseSwitch: caseSwitchState });
            break;
        
        // 监听弹窗位置
        case "openPopup":
            if (toggleState && caseSwitchState) {
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
