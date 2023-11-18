// content.js


// 定义一个标志来检测是否已经加载了声音，当声音列表变化时，设置标志为 true
let voicesLoaded = false;
window.speechSynthesis.onvoiceschanged = function() {
    voicesLoaded = true;
};


// 旧 函数：清理选中的文本，移除<rt>和<ruby>标签
function cleanSelectedText(selectedText, ignoreRT) {
    var div = document.createElement('div');
    div.innerHTML = selectedText;

    if (ignoreRT) {
        var rtElements = div.querySelectorAll('rt');
        rtElements.forEach(rt => rt.remove());
    }

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

// 旧 函数：选择文本
function selectText(doc) {
    doc.addEventListener('mouseup', (event) => {
        // 获取选中的文本
        const selection = doc.getSelection();
        if (!selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const container = document.createElement('div');
            container.appendChild(range.cloneContents());
            let selectedHtml = container.innerHTML;

            // 获取 removeRtState 的当前状态
            chrome.runtime.sendMessage({ action: "requestRemoveRtState" }, (response) => {
                let cleanText = cleanSelectedText(selectedHtml, response.ignoreRT);
                if (cleanText.trim().length > 0) {
                    
                    // 检查是否需要将文本复制到剪贴板
                    chrome.runtime.sendMessage({ action: "requestCopyToClipboardState" }, (response) => {
                        if (response.copyToClipboard) {
                            navigator.clipboard.writeText(cleanText).then(() => {
                                console.log("Text copied to clipboard");
                            }).catch(err => {
                                console.error('Failed to copy text: ', err);
                            });
                        }
                    });

                    // 发送 openPopup 消息
                    chrome.runtime.sendMessage({
                        action: 'openPopup',
                        selectedText: cleanText,
                        x: event.pageX + window.screenX,
                        y: event.pageY + window.screenY,
                        screenWidth: window.innerWidth,
                        screenHeight: window.innerHeight
                    });
                }
            });
        }
    });
}


// 函数：清理文本，移除<rt>和<ruby>标签
function cleanText(htmlString, ignoreRT) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    // 如果需要移除注音
    if (ignoreRT) {
        // 只移除 <rt> 标签
        div.querySelectorAll('rt').forEach(rt => rt.remove());
    }

    return div.textContent;
}

// 函数：点击后复制朗读
function handleClick(event) {
    if (event.target.nodeName === 'P') {
        chrome.storage.local.get('ignoreRT', (data) => {
            const text = cleanText(event.target.outerHTML, data.ignoreRT);

            // 复制文本
            chrome.runtime.sendMessage({ action: "requestCopyToClipboardState" }, (response) => {
                if (response.copyToClipboard) {
                    navigator.clipboard.writeText(text).then(() => {
                        console.log("Text copied to clipboard");
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                }
            });
                
            // 打断当前语音并播放新的语音
            window.speechSynthesis.cancel();
            
            // 朗读文本
            chrome.runtime.sendMessage({ action: "requestReadTextState" }, (response) => {
                if (response.readText) {
                    chrome.storage.local.get(['voiceName', 'rate', 'pitch'], (data) => {
                        const voiceName = data.voiceName || 'Microsoft Sayaka - Japanese (Japan)';
                        const rate = data.rate || 1;
                        const pitch = data.pitch || 1;
                        const utterance = new SpeechSynthesisUtterance(text);

                        // 设置语音、声调和速度
                        var voices = window.speechSynthesis.getVoices();
                        var desiredVoice = voices.find(voice => voice.name === voiceName);
                        if (desiredVoice) {
                            utterance.voice = desiredVoice;
                        }
                        utterance.pitch = pitch; // 范围从0到2
                        utterance.rate = rate; // 范围从0.1到10
                        
                        // 朗读开始
                        window.speechSynthesis.speak(utterance);
                    })
                }
            })
        })
    }
}

// 函数：添加红框
function highlightAndCopyPtag(doc) {
    doc.addEventListener('mouseenter', (event) => {
        if (event.target.nodeName === 'P' && !event.target.classList.contains('highlighted')) {
            event.target.style.border = "2px solid pink";
            event.target.classList.add('highlighted');
            event.target.addEventListener('click', handleClick);
        }
    }, true);

    doc.addEventListener('mouseleave', (event) => {
        if (event.target.nodeName === 'P') {
            event.target.style.border = "";
            event.target.classList.remove('highlighted');
            event.target.removeEventListener('click', handleClick);
        }
    }, true);
}



// 总开关：在文档中添加事件监听器
function addMouseListener(doc) {
    highlightAndCopyPtag(doc);
}

// 为主文档添加监听器
addMouseListener(document);


// 使用 MutationObserver 监听 DOM 变更
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'IFRAME') {
                    node.onload = () => {
                        try {
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
