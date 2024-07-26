/* content.js */

/* ------------------------------------------------------------全局变量 */

// 记录最后点击的段落
let lastClickedPtag = null;

// 记录当前高亮的句子
let currentHighlightedSentence = null;

// 是否处于自动阅读模式
let isAutoReading = false;

// 目标标签
let target = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

// 标记声音是否已加载（WindowsTTS）
let voicesLoaded = false;

// 当声音列表变化时，设置 voicesLoaded 标志为 true
window.speechSynthesis.onvoiceschanged = function() {
    voicesLoaded = true;
};

// 存储定时器的变量
let notificationTimeout;

// 创建并添加复制通知元素到文档
const copyNotification = document.createElement('div');
copyNotification.id = 'copy-notification';
document.body.appendChild(copyNotification);


/* ------------------------------------------------------------总开关 */

// 首先检查开关状态
chrome.storage.sync.get(['pluginSwitch'], (data) => {
    if (data.pluginSwitch) {
        // 启动鼠标和键盘监听器
        addMouseListener(document);
        // 配置并启动观察器
        observer.observe(document.body, { childList: true, subtree: true });
    }
});


/* ------------------------------------------------------------文本模块 */

// 分割成列表
function parseStringToArray(str) {
    return str.split('/'); // 将字符串按 `/` 分割并返回数组
}

// 清理文本
function cleanText(htmlString, symbolPairs) {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    // 移除 class 为 translation-div 的 div 标签
    div.querySelectorAll('.translation-div').forEach(translationDiv => {
        translationDiv.parentNode.removeChild(translationDiv);
    });

    // 移除所有 rp 标签，并将 rt 转换为括号
    div.querySelectorAll('ruby').forEach(ruby => {
        ruby.querySelectorAll('rp').forEach(rp => rp.remove());
        ruby.querySelectorAll('rt').forEach(rt => {
            const textNode = document.createTextNode(`(${rt.textContent})`);
            rt.parentNode.replaceChild(textNode, rt);
        });
    });

    let textFurigana = div.textContent;

    // 生成去除振假名的版本
    div.innerHTML = htmlString;
    // 移除 class 为 translation-div 的 div 标签
    div.querySelectorAll('.translation-div').forEach(translationDiv => {
        translationDiv.parentNode.removeChild(translationDiv);
    });

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

// 显示复制内容函数
function showCopyNotification(text) {
    const notification = document.getElementById('copy-notification');
    notification.textContent = `${text}`;
    notification.classList.add('show');

    // 清除之前的定时器
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    // 设置新的定时器
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 1000);
}

// 复制文本到剪贴板
function copyTextToClipboard(text, callback) {
    chrome.storage.sync.get(['copy', 'showCopyContent'], (data) => {
        if (data.copy) {
            if (document.hasFocus()) { // 检查当前文档是否聚焦
                navigator.clipboard.writeText(text).then(() => {
                    console.log(`Copy: ${text}`);
                    if (data.showCopyContent) {
                        showCopyNotification(text); // 显示复制通知
                    }
                    if (callback) callback();
                }).catch(err => {
                    console.log('Failed to copy text: ', err);
                    if (callback) callback();
                });
            } else {
                console.log('Document is not focused, cannot copy text.');
                if (callback) callback();
            }
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
    chrome.storage.sync.get(['clipAPI', 'vitsAPI', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max', 'streaming'], (data) => {
        const encodedText = encodeURIComponent(text);
        const params = new URLSearchParams({
            id: data.vitsVoice,
            lang: data.vitsLang,
            length: data.length,
            noise: data.noise,
            noisew: data.noisew,
            max: data.max,
            streaming: data.streaming,
            format: 'mp3'
        });
        const clipAPI = data.clipAPI;
        const vitsAPI = data.vitsAPI;
        const vits_url = `http://127.0.0.1:${vitsAPI}/voice/vits?text=${encodedText}&${params.toString()}`; // 构建正确格式的 URL

        // 将请求发送到background script
        chrome.runtime.sendMessage({ action: 'play_audio', vits_url: vits_url, clipAPI: clipAPI }, (response) => {
            if (response.status === "completed" && callback) {
                callback();
            }
        });
    });
}

// 复制并朗读指定标签的文本
function copyAndReadText(tag, callback) {
    chrome.storage.sync.get([
        'ignoreFurigana', 'symbolPairs', 'useVITS', 'useWindowsTTS'
    ], (data) => {
        let textObj = cleanText(tag.innerHTML, parseStringToArray(data.symbolPairs));
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
    chrome.storage.sync.get([
        'ignoreFurigana', 'symbolPairs', 'useVITS', 'useWindowsTTS'
    ], (data) => {
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
    lastClickedPtag.querySelectorAll('.translation-div').forEach(div => div.remove());

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
        if (!translationDiv) {
            console.log('Translation div not found.');
            return;
        }
        if (response && response.translatedText) {
            const p = document.createElement('div');
            p.style.color = color;
            if (callback) {
                callback(response.translatedText, p);
            } else {
                p.textContent = response.translatedText;
            }
            translationDiv.appendChild(p);
        } else {
            console.log('Translation error or no text returned.', response);
        }
    });
}

// 翻译文本并显示结果
function translate(tag) {
    chrome.storage.sync.get([
        'symbolPairs',
        'google', 'googleFrom', 'googleTo', 'googleColor',
        'deepl', 'deeplFrom', 'deeplTo', 'deeplColor',
        'youdao', 'youdaoFrom', 'youdaoTo', 'youdaoColor',
        'caiyun', 'caiyunFrom', 'caiyunTo', 'caiyunColor',
    ], (data) => {
        let textObj = cleanText(tag.innerHTML, parseStringToArray(data.symbolPairs));

        // 先检查标签中是否已经存在翻译
        if ((data.deepl || data.google || data.youdao || data.caiyun) && !tag.querySelector('.translation-div')) {
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
            if (data.youdao) {
                requestTranslation(tag, textObj['text'], data.youdaoFrom, data.youdaoTo, "youdao", data.youdaoColor, translatedTextCallback);
            }
            if (data.deepl) {
                requestTranslation(tag, textObj['text'], data.deeplFrom, data.deeplTo, "deepl", data.deeplColor, translatedTextCallback);
            }
            if (data.caiyun) {
                requestTranslation(tag, textObj['text'], data.caiyunFrom, data.caiyunTo, "caiyun", data.caiyunColor, translatedTextCallback);
            }
        }
    });
}


/* ------------------------------------------------------------用户界面交互模块 */

// 获取下一个或上一个非空标签
function getValidTag(currentTag, direction = 'down') {
    let tag = direction === 'down' ? currentTag.nextElementSibling : currentTag.previousElementSibling;
    while (tag && (!target.includes(tag.nodeName) || !tag.textContent.trim())) {
        tag = direction === 'down' ? tag.nextElementSibling : tag.previousElementSibling;
    }
    return tag;
}

// 分割句子的函数
function splitSentences(text, sentenceThreshold, sentenceDelimiters) {
    // 创建一个临时的div元素来处理HTML字符串
    const div = document.createElement('div');
    div.innerHTML = text;

    // 移除所有的 <span> 标签，但保留其内部内容
    const spans = div.querySelectorAll('span');
    spans.forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
    });

    // 获取清理后的文本
    const cleanText = div.innerHTML;

    // 分割句子
    const escapedDelimiters = sentenceDelimiters.join('').replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"); // 转义正则表达式特殊字符
    const sentenceEndings = new RegExp(`([${escapedDelimiters}])`, 'g');
    let parts = cleanText.split(sentenceEndings);

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

// 处理点击事件
function handleClick(event) {
    stopAutoReading(); // 停止自动阅读

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
            lastClickedPtag.style.outline = "";
            lastClickedPtag.classList.remove('blue-highlighted');
            lastClickedPtag = null;
        }
    }
}

// 为指定标签添加激活框
function applyBlueBorder(tag) {
    chrome.storage.sync.get([
        'borderWidth', 'borderStyle', 'borderRadius', 'selectedBorderColor', 'scrollSwitch', 'scrollIntoView', 'sentenceThreshold', 'sentenceDelimiters'
    ], (data) => {

        // 如果有上一个被点击的标签且不是当前标签
        if (lastClickedPtag && lastClickedPtag !== tag) {
            // 移除上一个标签的翻译内容
            lastClickedPtag.querySelectorAll('.translation-div').forEach(div => div.remove());
            // 移除上一个激活框
            lastClickedPtag.style.outline = "";
            lastClickedPtag.classList.remove('blue-highlighted');
        }

        // 检查并分割句子
        if (!tag.classList.contains('split-sentences') && !tag.querySelector('img, a')) {
            const sentences = splitSentences(tag.innerHTML, data.sentenceThreshold, parseStringToArray(data.sentenceDelimiters));
            tag.innerHTML = sentences;
            tag.classList.add('split-sentences');
        }

        // 为当前标签应用激活框
        tag.classList.add('blue-highlighted');
        lastClickedPtag = tag; // 更新最后点击的标签
        tag.style.outline = `${data.borderWidth} ${data.borderStyle} ${data.selectedBorderColor}`;
        tag.style.borderRadius = data.borderRadius;
        
        // 检查标签是否超出当前窗口大小，如果超过则跳过scrollIntoView.
        const tagRect = tag.getBoundingClientRect();
        if (data.scrollSwitch && tagRect.width <= window.innerWidth && tagRect.height <= window.innerHeight) {
            tag.scrollIntoView({ behavior: data.scrollIntoView, block: 'center', inline: 'center'});
        }
    });
}

// 为指定标签添加预选框，并绑定点击事件
function highlightAndCopyPtag(doc) {
    chrome.storage.sync.get([
        'borderWidth', 'borderStyle', 'borderRadius', 'freeBorderColor', 'sentenceThreshold', 'sentenceDelimiters'
    ], (data) => {
        doc.addEventListener('mouseenter', (event) => {
            if (target.includes(event.target.nodeName) && !event.target.classList.contains('highlighted') && !event.target.classList.contains('blue-highlighted') && event.target.textContent.trim()) {
                // 为当前标签应用激活框
                event.target.classList.add('highlighted');
                event.target.addEventListener('click', handleClick);
                event.target.style.outline = `${data.borderWidth} ${data.borderStyle} ${data.freeBorderColor}`;
                event.target.style.borderRadius = data.borderRadius;
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
                event.target.removeAttribute('style');
                event.target.classList.remove('highlighted');
                event.target.removeEventListener('click', handleClick);
            }
        }, true);
    });
}

// 为文档添加鼠标和键盘监听器
function addMouseListener(doc) {
    chrome.storage.sync.get(['sentenceColor', 'extraImage'], (data) => {
        highlightAndCopyPtag(doc);

        // 键盘事件，包括箭头键和数字键盘 0
        doc.addEventListener('keydown', function(event) {
            if (lastClickedPtag) {
                if (event.keyCode === 40 || event.keyCode === 97 || event.keyCode === 38 || event.keyCode === 98) {
                    stopAutoReading(); // 停止自动阅读
                    
                    // 确保新标签是一个 target 元素并且有文本内容
                    let newTag = event.keyCode === 40 || event.keyCode === 97 ? getValidTag(lastClickedPtag, "down") : getValidTag(lastClickedPtag, "up");
        
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

        // 框内阻止默认的右键菜单弹出
        doc.addEventListener('contextmenu', function(event) {
            if (event.target.classList.contains('sentence') || event.target.classList.contains('highlighted') || event.target.classList.contains('blue-highlighted')) {
                event.preventDefault(); // 阻止右键菜单的默认行为
            }
        });

        // 使用 mousedown 事件监听鼠标右键
        doc.addEventListener('mousedown', function(event) {
            if (event.button === 2) { // 检查鼠标
                stopAutoReading();
                if (currentHighlightedSentence) {
                    copyAndReadSentence(currentHighlightedSentence); // 传递HTML内容以便处理振假名
                }
            }
        });

        doc.addEventListener('mouseover', (event) => {
            if (event.target.classList.contains('sentence')) {
                event.target.style.backgroundColor = data.sentenceColor; // 设置背景颜色
                currentHighlightedSentence = event.target; // 设置当前高亮的句子
            }

            // 检查标签是否包含 img 或 svg>image 但不包含 a ，打开大图
            if (data.extraImage && event.target.nodeName !== 'A' && (event.target.querySelector('img') || event.target.querySelector('svg image'))) {
                const img = event.target.querySelector('img');
                const svgImage = event.target.querySelector('svg image');

                if (img && (!img.parentElement || img.parentElement.nodeName !== 'A')) {
                    img.style.cursor = 'pointer';

                    // 检查是否已经有点击事件监听器
                    if (!img.hasAttribute('data-click-listener-added')) {
                        img.addEventListener('click', function() {
                            window.open(img.src, '_blank');
                        });
                        img.setAttribute('data-click-listener-added', 'true');
                    }
                }

                if (svgImage && (!svgImage.parentElement || svgImage.parentElement.nodeName !== 'A')) {
                    svgImage.style.cursor = 'pointer';

                    // 检查是否已经有点击事件监听器
                    if (!svgImage.hasAttribute('data-click-listener-added')) {
                        svgImage.addEventListener('click', function() {
                            window.open(svgImage.getAttribute('xlink:href'), '_blank');
                        });
                        svgImage.setAttribute('data-click-listener-added', 'true');
                    }
                }
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

