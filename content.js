// 函数：清理选中的文本，移除<rt>和<ruby>标签
function cleanSelectedText(selectedText) {
    // 创建一个新的div元素，用于临时存储HTML内容
    var div = document.createElement('div');
    div.innerHTML = selectedText; // 将选中的HTML内容设置到这个div中

    // 移除所有的<rt>元素及其内容
    var rtElements = div.querySelectorAll('rt');
    rtElements.forEach(rt => rt.remove());

    // 移除所有的<ruby>元素但保留它们的文本内容
    var rubyElements = div.querySelectorAll('ruby');
    rubyElements.forEach(ruby => {
        // 将ruby标签中的文本移动到外部，并删除ruby标签本身
        while (ruby.firstChild) {
            ruby.parentNode.insertBefore(ruby.firstChild, ruby);
        }
        ruby.remove();
    });

    // 返回清理后的文本
    return div.textContent || div.innerText || "";
}

// 函数：在文档中添加事件监听器
function addMouseListener(doc) {
    doc.addEventListener('mouseup', (event) => {
        // 获取选中的文本
        const selection = doc.getSelection();
        if (!selection.isCollapsed) { // 检查是否有文本被选中
            // 获取选中内容的HTML字符串
            const range = selection.getRangeAt(0);
            const container = document.createElement('div');
            container.appendChild(range.cloneContents());
            let selectedHtml = container.innerHTML;

            // 清理选中的文本
            let cleanText = cleanSelectedText(selectedHtml);
            if (cleanText.trim().length > 0) {
                // 如果清理后的文本不为空，则发送消息
                chrome.runtime.sendMessage({
                    action: 'openPopup',
                    selectedText: cleanText,
                    x: event.pageX + window.screenX,
                    y: event.pageY + window.screenY,
                    screenWidth: window.innerWidth,
                    screenHeight: window.innerHeight
                });
            }
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
