/* content.js */

/* ------------------------------全局变量 */

// 最后点击的 <p> 标签
let lastClickedPtag = null;

// 是否处于自动阅读模式
let isAutoReading = false;

// 自动阅读模式下的阅读间隔时间（毫秒）
let readingInterval = 200;

// 标记声音是否已加载
let voicesLoaded = false;

// 目标标签
let target = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

// 框样式
let freeFrame = "1px double #E04F95"
let lastFrame = "1px double #029AD7"
let frameRadius = "8px"
let fade_away =  "75"

// 当声音列表变化时，设置 voicesLoaded 标志为 true
window.speechSynthesis.onvoiceschanged = function() {
    voicesLoaded = true;
};


/* ------------------------------文本模块 */


// 清理文本，移除 <rt> 和 <ruby> 标签，并且清除两边空格。
function cleanText(htmlString, ignoreRT) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    // 根据 ignoreRT 标志移除 <rt> 标签
    if (ignoreRT) {
        div.querySelectorAll('rt').forEach(rt => rt.remove());
    }
    return div.textContent.trim();
}

// 复制文本到剪贴板
function copyTextToClipboard(text, callback) {
    chrome.runtime.sendMessage({ action: "requestCopyToClipboardState" }, (response) => {
        if (response.copyToClipboard) {
            navigator.clipboard.writeText(text).then(() => {
                console.log("Text copied to clipboard");
                if (callback) callback();
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                if (callback) callback();
            });
        }
    });
}


/* ------------------------------语音模块 */



// 朗读文本(windowsTTS)
function windows_tts(text, callback) {
    chrome.runtime.sendMessage({ action: "requestReadTextState" }, (response) => {
        if (response.readText) {
            chrome.storage.local.get(['voiceName', 'rate', 'pitch'], (data) => {
                const utterance = new SpeechSynthesisUtterance(text);

                // 找到与用户设置匹配的语音
                var voices = window.speechSynthesis.getVoices();
                var selectedVoice = voices.find(voice => voice.name === data.voiceName);
                utterance.voice = selectedVoice;

                utterance.pitch = data.pitch || 1;
                utterance.rate = data.rate || 1;

                utterance.onend = () => {
                    if (callback) callback();
                }; // 如果callback存在，则创建回调函数callback

                window.speechSynthesis.cancel(); // 打断当前语音
                window.speechSynthesis.speak(utterance);
            });
        }
    });
}



// 朗读文本(vitsTTS)
function vits_tts(text, callback) {
    chrome.storage.local.get(['vitsAPI', 'vitsVoice', 'length', 'noise', 'noisew', 'max', 'streaming'], (data) => {
        const encodedText = encodeURIComponent(text); // 对文本进行编码
        const params = new URLSearchParams({
            id: data.vitsVoice,
            length: data.length,
            noise: data.noise,
            noisew: data.noisew,
            max: data.max,
            streaming: data.streaming
        });
        const vitsAPI = data.vitsAPI;
        const clip_url = `${vitsAPI}/voice/vits?text=${encodedText}&${params.toString()}`; // 构建正确格式的 URL

        if (socket.readyState === WebSocket.OPEN) {
            console.log(`这是新请求：${text}`)
            socket.send(JSON.stringify({ url: clip_url }));
        }

        // 监听WebSocket消息以获取语音流
        socket.onmessage = function(event) {
            try {
                const responseData = JSON.parse(event.data);
                
                if (responseData.status === "finished") {
                    console.log("Voice playback finished");
                    if (callback) callback();
                }
            } catch (error) {
                console.error("Error parsing WebSocket response:", error);
            }
        };
    })
}


// 复制并朗读指定标签的文本
function copyAndReadText(tag, callback) {
    chrome.storage.local.get(['ignoreRT', 'useVITS'], (data) => {
        let text = cleanText(tag.outerHTML, data.ignoreRT);
        if (data.useVITS) {
            // 使用 vits tts
            copyTextToClipboard(text, () => {
                vits_tts(text, callback);
            });
        } else {
            // 使用 windows tts
            copyTextToClipboard(text, () => {
                windows_tts(text, callback);
            });
        }
    });
}


/* ------------------------------自动阅读控制模块 */

// 函数：开始自动阅读
function startAutoReading() {
    isAutoReading = true;
    let currentTag = lastClickedPtag;

    function readNext() {
        if (!isAutoReading || !currentTag) return;

        applyBlueBorder(currentTag);
        copyAndReadText(currentTag, () => {
            // 设置延迟，然后读取下一个标签
            setTimeout(() => {
                currentTag = currentTag.nextElementSibling;
                while (currentTag && !target.includes(currentTag.nodeName)) {
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

// 处理键盘事件，实现自动阅读的开始和停止
function handleArrowKeyPress(event) {
    if (lastClickedPtag && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        stopAutoReading(); // 停止自动阅读

        let newTag = event.key === 'ArrowDown' ? lastClickedPtag.nextElementSibling : lastClickedPtag.previousElementSibling;

        // 确保新标签是一个 target 元素
        while (newTag && !target.includes(newTag.nodeName)) {
            newTag = event.key === 'ArrowDown' ? newTag.nextElementSibling : newTag.previousElementSibling;
        }

        if (newTag) {
            applyBlueBorder(newTag);
            copyAndReadText(newTag);
        }
    }
}


/* ------------------------------用户界面交互模块 */

// 处理点击事件：复制文本并朗读
function handleClick(event) {
    if (target.includes(event.target.nodeName)) {
        applyBlueBorder(event.target);
        copyAndReadText(event.target);
    }
}

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


// 为 target 标签添加红框，并绑定点击事件
function highlightAndCopyPtag(doc) {
    doc.addEventListener('mouseenter', (event) => {
        if (target.includes(event.target.nodeName) && !event.target.classList.contains('highlighted')) {
            event.target.style.border = freeFrame;
            event.target.style.borderRadius = frameRadius;
            event.target.classList.add('highlighted');
            event.target.addEventListener('click', handleClick);
        }
    }, true);

    doc.addEventListener('mouseleave', (event) => {
        if (target.includes(event.target.nodeName)) {
            setTimeout(() => {
                event.target.style.border = "";
            }, fade_away);
            event.target.classList.remove('highlighted');
            event.target.removeEventListener('click', handleClick);
        }
    }, true);
}


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


/* ------------------------------网络通信模块 */

// 在脚本开始处添加 WebSocket 连接（vits tts需要用的）
let socket = null;
function connectWebSocket() {
    socket = new WebSocket('ws://localhost:8765');
    
    socket.onopen = function(e) {
      console.log("[WebSocket] Connection established");
    };

    socket.onerror = function(error) {
      console.error(`[WebSocket] Error: ${error.message}`);
    };

    // socket.onclose = function(e) {
    //   console.log('WebSocket connection closed unexpectedly. Reconnecting...');
    //   setTimeout(connectWebSocket, 5000); // 5秒后重连
    // };
}

// 在脚本开始处初始化WebSocket连接
connectWebSocket();



/* ------------------------------DOM 变更监听 */

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
