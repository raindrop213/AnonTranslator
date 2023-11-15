chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openPopup") {
        const selectedText = request.selectedText;
        const x = request.x;
        const y = request.y;
        const screenWidth = request.screenWidth;
        const screenHeight = request.screenHeight;
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
