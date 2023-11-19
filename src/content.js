/* content.js */

/* --------------------------------------------全局变量 */

// 最后点击的 <p> 标签
let lastClickedPtag = null;

// 是否处于自动阅读模式
let isAutoReading = false;

// 自动阅读模式下的阅读间隔时间（毫秒）
let readingInterval = 200;

// 标记声音是否已加载
let voicesLoaded = false;

// 框样式
let freeFrame = "2px double #E04F95"
let lastFrame = "2px double #029AD7"
let frameRadius = "5px"


/* --------------------------------------------声音加载检测 */

// 当声音列表变化时，设置 voicesLoaded 标志为 true
window.speechSynthesis.onvoiceschanged = function() {
    voicesLoaded = true;
};


/* --------------------------------------------文本清理函数 */

// 清理文本，移除 <rt> 和 <ruby> 标签
function cleanText(htmlString, ignoreRT) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    // 根据 ignoreRT 标志移除 <rt> 标签
    if (ignoreRT) {
        div.querySelectorAll('rt').forEach(rt => rt.remove());
    }

    return div.textContent;
}


/* --------------------------------------------辅助函数 */

// 为指定标签添加蓝色边框
function applyBlueBorder(tag) {
    if (lastClickedPtag) {
        lastClickedPtag.style.border = "";
        lastClickedPtag.classList.remove('blue-highlighted');
    }
    tag.style.border = lastFrame;
    tag.style.borderRadius = frameRadius;
    tag.classList.add('blue-highlighted');
    lastClickedPtag = tag;
}


/* --------------------------------------------文本点击处理 */

// 处理点击事件：复制文本并朗读
function handleClick(event) {
    if (event.target.nodeName === 'P') {
        applyBlueBorder(event.target);
        chrome.storage.local.get('ignoreRT', (data) => {
            let text = cleanText(event.target.outerHTML, data.ignoreRT);

            // 移除两边的空格和缩进
            text = text.trim();

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


/* --------------------------------------------文本高亮及点击事件绑定 */

// 为 <p> 标签添加红框，并绑定点击事件
function highlightAndCopyPtag(doc) {
    doc.addEventListener('mouseenter', (event) => {
        if (event.target.nodeName === 'P' && !event.target.classList.contains('highlighted')) {
            event.target.style.border = freeFrame;
            event.target.style.borderRadius = frameRadius;
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


/* --------------------------------------------键盘事件处理 */

// 处理键盘事件，实现自动阅读的开始和停止
function handleArrowKeyPress(event) {
    if (lastClickedPtag && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        stopAutoReading(); // 停止自动阅读

        let newTag = event.key === 'ArrowDown' ? lastClickedPtag.nextElementSibling : lastClickedPtag.previousElementSibling;

        // 确保新标签是一个 <p> 元素
        while (newTag && newTag.nodeName !== 'P') {
            newTag = event.key === 'ArrowDown' ? newTag.nextElementSibling : newTag.previousElementSibling;
        }

        if (newTag) {
            applyBlueBorder(newTag);
            copyAndReadText(newTag);
        }
    }
}

// 复制并朗读指定标签的文本
function copyAndReadText(tag, callback) {
    chrome.storage.local.get('ignoreRT', (data) => {
        let text = cleanText(tag.outerHTML, data.ignoreRT);

        // 移除两边的空格和缩进
        text = text.trim();

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
                    
                    // 设置朗读结束的回调
                    utterance.onend = callback;

                    // 朗读开始
                    window.speechSynthesis.speak(utterance);
                })
            }
        })
    });
}


/* --------------------------------------------自动阅读控制 */

// 函数：开始自动阅读
function startAutoReading() {
    isAutoReading = true;
    let currentTag = lastClickedPtag;

    function readNext() {
        if (!isAutoReading || !currentTag) return;

        applyBlueBorder(currentTag);
        copyAndReadText(currentTag, () => {
            // 设置延迟，然后读取下一个 <p> 标签
            setTimeout(() => {
                currentTag = currentTag.nextElementSibling;
                while (currentTag && currentTag.nodeName !== 'P') {
                    currentTag = currentTag.nextElementSibling;
                }
                readNext();
            }, readingInterval);
        });
    }

    readNext();
}

// 函数：停止自动阅读
function stopAutoReading() {
    isAutoReading = false;
    window.speechSynthesis.cancel();
}


/* --------------------------------------------事件监听器添加 */

// 为文档添加鼠标和键盘监听器
function addMouseListener(doc) {
    highlightAndCopyPtag(doc);
    doc.addEventListener('keydown', handleArrowKeyPress);
    doc.addEventListener('keydown', function(event) {
        if (event.key === ' ') {
            if (isAutoReading) {
                stopAutoReading();
            } else {
                startAutoReading();
            }
            event.preventDefault();
        } else if (event.key === 'Escape') {
            stopAutoReading();
        }
    });
}

// 为主文档添加监听器
addMouseListener(document);


/* --------------------------------------------DOM 变更监听 */

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
