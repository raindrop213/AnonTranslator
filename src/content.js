/* content.js */

/* ------------------------------------------------------------全局变量 */

// 最后点击的 <p> 标签
let lastClickedPtag = null;

// 标记声音是否已加载
let voicesLoaded = false;

// 目标标签
let target = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

// 红框消失延迟
let fade_away =  "75";

// 当声音列表变化时，设置 voicesLoaded 标志为 true
window.speechSynthesis.onvoiceschanged = function() {
    voicesLoaded = true;
};


/* ------------------------------------------------------------处理文本标签模块 */

// 清理文本，处理<ruby>标签，并且清除后边空格。
//（例）近接<ruby>戦闘<rt>せんとう</rt></ruby>   >>>   近接｜戦闘《せんとう》
function cleanText(htmlString, ignoreFurigana) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    if (ignoreFurigana) {
        div.querySelectorAll('rt, rp').forEach(tag => tag.remove());
    } else {
        div.querySelectorAll('ruby').forEach(ruby => {
            const rb = ruby.childNodes[0].textContent; // 获取 <ruby> 标签内的第一个文本节点
            const rt = ruby.querySelector('rt') ? ruby.querySelector('rt').textContent : '';
            // 转换格式，确保只包含必要的元素
            ruby.replaceWith(`｜${rb}《${rt}》`);
        });
    }

    let originalText = div.textContent || '';
    let trimmedText = originalText.trimStart();

    let leadingSpaces = originalText.substring(0, originalText.length - trimmedText.length);

    if (!trimmedText) {
        return { text: '-', space: leadingSpaces };
    }

    return { text: trimmedText.trim(), space: leadingSpaces };
}


/* ------------------------------------------------------------复制文本模块 */

// 复制文本到剪贴板
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log("Text copied to clipboard");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}


/* ------------------------------------------------------------语音模块 */

// 朗读文本(windowsTTS)
function windows_tts(text, callback) {
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

// 朗读文本(vitsTTS)
function vits_tts(text, callback) {
    chrome.storage.local.get(['model', 'vitsAPI', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max', 'streaming'], (data) => {
        const encodedText = encodeURIComponent(text); // 对文本进行编码
        const params = new URLSearchParams({
            id: data.vitsVoice,
            length: data.length,
            noise: data.noise,
            noisew: data.noisew,
            max: data.max,
            streaming: data.streaming
          });
          if (data.vitsLang !== 'auto') {
            params.append('lang', data.vitsLang);
          }
          const model = data.model.toLowerCase();

        const vitsAPI = data.vitsAPI;
        console.log(model, params.toString())
        const clip_url = `${vitsAPI}/voice/${model}?text=${encodedText}&${params.toString()}`; // 构建正确格式的 URL
        console.log(clip_url)

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

// 决定使用哪种 TTS 服务的函数
function readText(text) {
    chrome.storage.local.get(['useVITS'], (data) => {
        if (data.useVITS) {
            vits_tts(text);
        } else {
            windows_tts(text);
        }
    });
}


/* ------------------------------------------------------------用户界面交互模块 */

// 处理点击事件
function handleClick(event) {
    if (target.includes(event.target.nodeName)) {
        chrome.storage.local.get(['ignoreFurigana'], (data) => {

            // 调用复制文本的函数
            let copiedText = cleanText(event.target.innerHTML, data.ignoreFurigana).text;
            console.log(event.target.innerHTML);
            console.log(copiedText);
            chrome.runtime.sendMessage({ action: "requestCopyToClipboardState" }, (response) => {
                if (response.copyToClipboard) {
                    copyText(copiedText);
                }
            })

            // 调用朗读文本的函数
            let cleanedText = cleanText(event.target.innerHTML, true).text;
            chrome.runtime.sendMessage({ action: "requestReadTextState" }, (response) => {
                if (response.readText) {
                    readText(cleanedText);
                }
            });
        });
    }
}


// 为 target 标签添加红框，并绑定点击事件
function highlightAndCopyPtag(doc) {
    chrome.storage.local.get([
        'borderWidth', 'borderStyle', 'borderRadius', 'freeBorderColor'
    ], (data) => {
        doc.addEventListener('mouseenter', (event) => {
            if (target.includes(event.target.nodeName) && !event.target.classList.contains('highlighted')) {
                event.target.style.border = `${data.borderWidth} ${data.borderStyle} ${data.freeBorderColor}`;
                event.target.style.borderRadius = data.borderRadius;
                event.target.classList.add('highlighted');
                event.target.addEventListener('click', handleClick);
            }
        }, true);

        doc.addEventListener('mouseleave', (event) => {
            if (target.includes(event.target.nodeName) && event.target !== lastClickedPtag) {
                setTimeout(() => {
                    event.target.style.border = "";
                }, fade_away);
                event.target.classList.remove('highlighted');
                event.target.removeEventListener('click', handleClick);
            }
        }, true);
    })
}


// 为文档添加鼠标和键盘监听器
function addMouseListener(doc) {
    highlightAndCopyPtag(doc);
}

// 为主文档添加监听器
addMouseListener(document);


/* ------------------------------------------------------------网络通信模块 */

// 在脚本开始处添加 WebSocket 连接（vits tts需要用的）
let socket = null;
function connectWebSocket() {
    socket = new WebSocket('ws://localhost:8666');
    
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


/* ------------------------------------------------------------DOM 变更监听 */

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
