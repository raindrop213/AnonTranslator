/* content.js */

/* ------------------------------------------------------------全局变量 */

// 最后点击的 <p> 标签
let lastClickedPtag = null;

// 记录当前高亮的句子
let currentHighlightedSentence = null;

// 是否处于自动阅读模式
let isAutoReading = false;

// 目标标签
let target = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

// 标记声音是否已加载
let voicesLoaded = false;

// 当声音列表变化时，设置 voicesLoaded 标志为 true
window.speechSynthesis.onvoiceschanged = function() {
    voicesLoaded = true;
};

function parseStringToArray(str) {
    return str.split('/'); // 将字符串按 `/` 分割并返回数组
}

/* ------------------------------------------------------------文本模块 */

// 获取下一个或上一个非空标签
function getValidTag(currentTag, direction = 'down') {
    let tag = direction === 'down' ? currentTag.nextElementSibling : currentTag.previousElementSibling;
    while (tag && (!target.includes(tag.nodeName) || !tag.textContent.trim())) {
        tag = direction === 'down' ? tag.nextElementSibling : tag.previousElementSibling;
    }
    return tag;
}


// 清理文本
function cleanText(htmlString, symbolPairs) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    // 生成带有振假名的版本
    div.querySelectorAll('ruby').forEach(ruby => {
        const rb = ruby.querySelector('rb').textContent;
        const rt = ruby.querySelector('rt').textContent;
        const parentNode = ruby.parentNode;
        parentNode.replaceChild(document.createTextNode(`${rb}(${rt})`), ruby);
    });

    let textFurigana = div.textContent;

    // 生成去除振假名的版本
    div.innerHTML = htmlString;
    div.querySelectorAll('rt, rp').forEach(tag => tag.remove());

    let originalText = div.textContent;
    let trimmedText = originalText.trimStart();

    // 截取前导空格部分（包括全角和半角空格）
    let leadingSpaces = originalText.substring(0, originalText.length - trimmedText.length);

    // 如果去除两边空格后的文本为空，则返回 '-'
    if (!trimmedText) {
        return { text: '-', textFurigana: '-', space: leadingSpaces, symbolPair: null };
    }

    let finalText = trimmedText.trim();

    // 遍历 symbolPairs 数组，检查首尾是否有符号对
    let hasEnclosingSymbols = symbolPairs.some(pair => {
        return finalText.startsWith(pair[0]) && finalText.endsWith(pair[1]);
    });

    let symbolPair = null;
    if (hasEnclosingSymbols) {
        symbolPair = symbolPairs.find(pair => {
            return finalText.startsWith(pair[0]) && finalText.endsWith(pair[1]);
        });

        finalText = finalText.substring(symbolPair[0].length, finalText.length - symbolPair[1].length).trim();
        textFurigana = textFurigana.substring(symbolPair[0].length, textFurigana.length - symbolPair[1].length).trim();
    } else {
        textFurigana = textFurigana.trim();
    }

    return { text: finalText, textFurigana: textFurigana, space: leadingSpaces, symbolPair: symbolPair };
}

// 复制文本到剪贴板
function copyTextToClipboard(text, callback) {
    chrome.storage.sync.get('copy', (data) => {
        if (data.copy) {
            navigator.clipboard.writeText(text).then(() => {
                console.log(`Copy: ${text}`);
                if (callback) callback();
            }).catch(err => {
                console.log('Failed to copy text: ', err);
                if (callback) callback();
            });
        }
    });
}


/* ------------------------------------------------------------语音模块 */

// 朗读文本(windowsTTS)
function windows_tts(text, callback) {
    chrome.storage.sync.get(['winVoice', 'rate', 'pitch'], (data) => {
        const utterance = new SpeechSynthesisUtterance(text);

        // 找到与用户设置匹配的语音
        var voices = window.speechSynthesis.getVoices();
        var selectedVoice = voices[data.winVoice];
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
    chrome.storage.sync.get(['vitsAPI', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max', 'streaming'], (data) => {
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

        const vitsAPI = data.vitsAPI;
        const clip_url = `http://127.0.0.1:${vitsAPI}/voice/vits?text=${encodedText}&${params.toString()}`; // 构建正确格式的 URL

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ url: clip_url }));
        }

        // 监听WebSocket消息以获取语音流
        socket.onmessage = function(event) {
            try {
                const responseData = parseStringToArray(event.data);
                
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
    chrome.storage.sync.get([
        'ignoreFurigana', 'symbolPairs', 'useVITS', 'useWindowsTTS'
    ], (data) => {
        let originalContent = tag.cloneNode(true); // 克隆节点，以便不修改原始内容
        let translationDivs = originalContent.querySelectorAll('.translation-div');
        translationDivs.forEach(div => div.remove()); // 移除翻译部分

        let textObj = cleanText(originalContent.innerHTML, parseStringToArray(data.symbolPairs));
        let textToCopy = data.ignoreFurigana ? textObj.text : textObj.textFurigana;
        

        if (data.useVITS) {
            copyTextToClipboard(textToCopy);
            vits_tts(textObj.text, callback);
        } else if (data.useWindowsTTS) {
            copyTextToClipboard(textToCopy);
            windows_tts(textObj.text, callback);
        } else {
            copyTextToClipboard(textToCopy);
            setTimeout(callback, 10);
        }
    });
}

// 复制并朗读指定标签的文本的句子
function copyAndReadSentence(tag) {
    chrome.storage.sync.get(['ignoreFurigana', 'symbolPairs', 'useVITS', 'useWindowsTTS'], (data) => {
        let textObj = cleanText(tag.innerHTML, parseStringToArray(data.symbolPairs));
        let textToCopy = data.ignoreFurigana ? textObj.text : textObj.textFurigana;

        if (data.useVITS) {
            copyTextToClipboard(textToCopy);
            vits_tts(textObj.text);
        } else if (data.useWindowsTTS) {
            copyTextToClipboard(textToCopy);
            windows_tts(textObj.text);
        } else {
            copyTextToClipboard(textToCopy);
        }
    });
}



/* ------------------------------------------------------------自动阅读控制模块 */

// 函数：开始自动阅读
function startAutoReading() {
    isAutoReading = true;
    let currentTag = lastClickedPtag;

    function readNext() {
        chrome.storage.sync.get(['readingInterval'], (data) => {
            if (!isAutoReading || !currentTag) return;
    
            applyBlueBorder(currentTag);
    
            if (currentTag) {
                copyAndReadText(currentTag, () => {
                    // 设置延迟，然后读取下一个标签
                    setTimeout(() => {
                        currentTag = getValidTag(currentTag, "down");
                        readNext();
                    }, data.readingInterval);
                });
                translate(currentTag);
            }
        })
    }

    readNext();
}

// 函数：停止自动阅读
function stopAutoReading() {
    isAutoReading = false;
    window.speechSynthesis.cancel();
}


/* ------------------------------------------------------------翻译模块 */

// 发送消息到背景脚本并获取翻译结果
function requestTranslation(tag, text, fromLang, toLang, translator, color, callback) {
    chrome.runtime.sendMessage({ 
        action: "translate", 
        text: text, 
        from: fromLang, 
        to: toLang, 
        translator: translator
    }, function(response) {
        const translationDiv = tag.querySelector('.translation-div');
        const p = document.createElement('div');
        p.style.color = color;
        if (text !== '-') {
            if (callback) {
                callback(response.translatedText, p);
            } else {
                p.textContent = response.translatedText;
            }
        } else {
            p.textContent = '-';
        }
        translationDiv.appendChild(p);
    });
}

// 翻译文本并显示结果
function translate(tag) {
    chrome.storage.sync.get([
        'symbolPairs',
        'google', 'googleFrom', 'googleTo', 'googleColor',
        'deepl', 'deeplFrom', 'deeplTo', 'deeplColor',
        'youdao', 'youdaoFrom', 'youdaoTo', 'youdaoColor'
    ], (data) => {
        let textObj = cleanText(tag.innerHTML, parseStringToArray(data.symbolPairs));

        // 先检查标签中是否已经存在翻译
        if ((data.deepl || data.google) && !tag.querySelector('.translation-div')) {
            const translationDiv = document.createElement('div');
            translationDiv.className = 'translation-div';
            tag.appendChild(translationDiv);

            const translatedTextCallback = (translatedText, p) => {
                if (textObj.symbolPair) {
                    p.textContent = textObj['space'] + textObj.symbolPair[0] + translatedText + textObj.symbolPair[1];
                } else {
                    p.textContent = textObj['space'] + translatedText;
                }
            };

            console.log(`Translate: ${textObj['text']}`)
            if (data.google) {
                requestTranslation(tag, textObj['text'], data.googleFrom, data.googleTo, "google", data.googleColor, translatedTextCallback);
            }
            if (data.deepl) {
                requestTranslation(tag, textObj['text'], data.deeplFrom, data.deeplTo, "deepl", data.deeplColor, translatedTextCallback);
            }
            if (data.youdao) {
                requestTranslation(tag, textObj['text'], data.youdaoFrom, data.youdaoTo, "youdao", data.youdaoColor, translatedTextCallback);
            }
        }
    });
}


/* ------------------------------------------------------------用户界面交互模块 */

// 处理点击事件
function handleClick(event) {
    let targetElement = event.target;

    // 向上遍历DOM树，找到包含点击元素的目标标签（处理点击文字不触发情况）
    while (targetElement && !target.includes(targetElement.nodeName)) {
        targetElement = targetElement.parentElement;
    }

    // 检查目标元素是否包含图片
    if (targetElement && target.includes(targetElement.nodeName) && !targetElement.querySelector('img')) {
        applyBlueBorder(targetElement);
        copyAndReadText(targetElement);
        translate(targetElement);

    // 清除当前选择
    } else {
        if (lastClickedPtag) {
            lastClickedPtag.style.border = "";
            lastClickedPtag.classList.remove('blue-highlighted');

            const existingTranslations = lastClickedPtag.querySelectorAll('.translation-div');
            existingTranslations.forEach(div => div.remove());
            lastClickedPtag = null;
        }
    }
}

// 为指定标签添加蓝色边框
function applyBlueBorder(tag) {
    // 如果有上一个被点击的标签且不是当前标签
    if (lastClickedPtag && lastClickedPtag !== tag) {
        // 移除上一个标签的翻译内容
        const existingTranslations = lastClickedPtag.querySelectorAll('.translation-div');
        existingTranslations.forEach(div => div.remove());

        // 移除上一个蓝框
        lastClickedPtag.style.border = "";
        lastClickedPtag.classList.remove('blue-highlighted');
    }

    // 为当前标签应用蓝框
    chrome.storage.sync.get([
        'borderWidth', 'borderStyle', 'borderRadius', 'selectedBorderColor', 'scrollIntoView'
    ], (data) => {
        tag.style.border = `${data.borderWidth} ${data.borderStyle} ${data.selectedBorderColor}`;
        tag.style.borderRadius = data.borderRadius;
        tag.classList.add('blue-highlighted');
        lastClickedPtag = tag; // 更新最后点击的标签

        tag.scrollIntoView({ behavior: data.scrollIntoView, block: 'center', inline: 'start'});
    });
}


// 为 target 标签添加红框，并绑定点击事件
function highlightAndCopyPtag(doc) {
    chrome.storage.sync.get([
        'borderWidth', 'borderStyle', 'borderRadius', 'freeBorderColor', 'sentenceThreshold', 'sentenceDelimiters'
    ], (data) => {
        doc.addEventListener('mouseenter', (event) => {
            if (target.includes(event.target.nodeName) && !event.target.classList.contains('highlighted') && event.target.textContent.trim()) {
                event.target.style.border = `${data.borderWidth} ${data.borderStyle} ${data.freeBorderColor}`;
                event.target.style.borderRadius = data.borderRadius;
                event.target.classList.add('highlighted');
                event.target.addEventListener('click', handleClick);

                // 分割句子并用 <span> 标签包裹
                if (!event.target.classList.contains('split-sentences') && !event.target.querySelector('img, a')) {
                    const sentences = splitSentences(event.target.innerHTML, data.sentenceThreshold, parseStringToArray(data.sentenceDelimiters));
                    event.target.innerHTML = sentences;
                    event.target.classList.add('split-sentences');
                }
            }
        }, true);

        doc.addEventListener('mouseleave', (event) => {
            if (target.includes(event.target.nodeName) && event.target !== lastClickedPtag) {
                setTimeout(() => {
                    event.target.style.border = "";
                }, data.fade);
                event.target.classList.remove('highlighted');
                event.target.removeEventListener('click', handleClick);
            }
        }, true);
    });
}





// 分割句子的函数
function splitSentences(text, sentenceThreshold, sentenceDelimiters) {

    const escapedDelimiters = sentenceDelimiters.join('').replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"); // 转义正则表达式特殊字符
    const sentenceEndings = new RegExp(`([${escapedDelimiters}])`, 'g');
    let parts = text.split(sentenceEndings);

    // 合并分割的句子和标点符号
    let sentences = [];
    for (let i = 0; i < parts.length; i += 2) {
        let sentence = parts[i];
        if (i + 1 < parts.length) {
            sentence += parts[i + 1];
        }
        sentences.push(sentence);
    }

    // 控制句子长度
    let mergedSentences = [];
    let tempSentence = '';

    sentences.forEach(sentence => {
        if (tempSentence.length + sentence.length > sentenceThreshold) {
            if (tempSentence.length === 0) {
                mergedSentences.push(`<span class="sentence">${sentence}</span>`);
            } else {
                mergedSentences.push(`<span class="sentence">${tempSentence}</span>`);
                tempSentence = sentence;
            }
        } else {
            tempSentence += sentence;
        }
    });

    // 添加最后一个句子
    if (tempSentence.length > 0) {
        mergedSentences.push(`<span class="sentence">${tempSentence}</span>`);
    }

    return mergedSentences.join('');
}




// 为文档添加鼠标和键盘监听器
function addMouseListener(doc) {
    chrome.storage.sync.get(['sentenceColor'], (data) => {
        highlightAndCopyPtag(doc);

        // 键盘事件，包括箭头键和数字键盘 0
        doc.addEventListener('keydown', function(event) {
            if (lastClickedPtag) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    stopAutoReading(); // 停止自动阅读
                    
                    // 确保新标签是一个 target 元素并且有文本内容
                    let newTag = event.key === 'ArrowDown' ? getValidTag(lastClickedPtag, "down") : getValidTag(lastClickedPtag, "up");
        
                    if (newTag) {
                        applyBlueBorder(newTag);
                        copyAndReadText(newTag);
                        translate(newTag);
                    }
                } else if (event.keyCode === 48 || event.keyCode === 96 || event.keyCode === 112) { // 检查F1、主键盘小键盘的 0
                    copyAndReadText(lastClickedPtag); // 朗读当前选中的标签
                }
            }
        });

        // 自动朗读键盘事件
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

        // 使用 mousedown 事件监听鼠标中键
        doc.addEventListener('mousedown', function(event) {
            if (event.button === 1) { // 检查鼠标中键
                if (currentHighlightedSentence) {
                    copyAndReadSentence(currentHighlightedSentence); // 传递HTML内容以便处理振假名
                }
                event.preventDefault(); // 防止默认行为
            }
        });

        doc.addEventListener('mouseover', (event) => {
            if (event.target.classList.contains('sentence')) {
                event.target.style.backgroundColor = data.sentenceColor; // 设置背景颜色
                currentHighlightedSentence = event.target; // 设置当前高亮的句子
            }
        });

        doc.addEventListener('mouseout', (event) => {
            if (event.target.classList.contains('sentence')) {
                event.target.style.backgroundColor = ''; // 清除背景颜色
                currentHighlightedSentence = null; // 清除当前高亮的句子
            }
        });
    });
}



// 为主文档添加监听器
addMouseListener(document);


/* ------------------------------------------------------------网络通信模块 */

// 在脚本开始处添加 WebSocket 连接（vits tts需要用的）
let socket = null;
function connectWebSocket() {
    chrome.storage.sync.get(['clipAPI'], (data) => {
        socket = new WebSocket(`ws://127.0.0.1:${data.clipAPI}`);

        socket.onopen = function(e) {
        console.log("[WebSocket] Connection established");
        };

        socket.onerror = function(error) {
        console.log(`[WebSocket] Error: ${error.message}`);
        };

        // socket.onclose = function(e) {
        //   console.log('WebSocket connection closed unexpectedly. Reconnecting...');
        //   setTimeout(connectWebSocket, 5000); // 5秒后重连
        // };
    })
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
                            console.log('Error adding listener to iframe:', e);
                        }
                    };
                }
            });
        }
    });
});

// 配置并启动观察器
observer.observe(document.body, { childList: true, subtree: true });
