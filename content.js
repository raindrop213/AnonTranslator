// 函数：在文档（包括 iframe）中添加事件监听器
function addMouseListener(doc) {
    doc.addEventListener('mouseup', (event) => {
        const selectedText = doc.getSelection().toString();
        if (selectedText) {
            const x = event.pageX + window.screenX;
            const y = event.pageY + window.screenY;
            chrome.runtime.sendMessage({
                action: 'openPopup',
                selectedText: selectedText,
                x: x,
                y: y,
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight
            });
        }
    });
}

// 为主文档添加监听器
addMouseListener(document);

// 使用 MutationObserver 监听 DOM 变更
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'IFRAME') {
                    // 确保 iframe 加载完成
                    node.onload = () => {
                        try {
                            // 为 iframe 添加监听器
                            addMouseListener(node.contentDocument || node.contentWindow.document);
                        } catch (e) {
                            console.error('Error adding listener to iframe:', e);
                        }
                    };
                }
            });
        }
    });
});

// 配置并启动观察器
observer.observe(document.body, { childList: true, subtree: true });
