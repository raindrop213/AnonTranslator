// contentjs
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
            streaming: data.streaming
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

// background.js
// 处理来自 content 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play_audio') {
        const vits_url = message.vits_url;
        const clipAPI = message.clipAPI;
  
        fetch(`http://127.0.0.1:${clipAPI}/play`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: vits_url })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "completed") {
                sendResponse({ status: "completed" });
            }
        })
        .catch(error => sendResponse({ error: error.message }));
  
        return true;
    }
  });
  


# clip-api.py

import requests
import pygame
from flask import Flask, request, jsonify
from io import BytesIO
from threading import Lock

app = Flask(__name__)

# 初始化pygame
pygame.init()

# 用于管理音频播放状态的锁
play_lock = Lock()

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "running"})

@app.route('/play', methods=['POST'])
def play_audio():
    data = request.json
    audio_url = data['url']

    try:
        # 下载音频文件
        response = requests.get(audio_url)
        audio_data = BytesIO(response.content)

        with play_lock:
            # 停止当前播放的音频
            if pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
                pygame.mixer.music.unload()

            # 加载新音频文件
            pygame.mixer.music.load(audio_data)

            # 播放新音频文件
            pygame.mixer.music.play()

            # 标记音乐播放结束事件
            MUSIC_END = pygame.USEREVENT + 1
            pygame.mixer.music.set_endevent(MUSIC_END)

        # 等待播放完成
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == MUSIC_END:
                    running = False
                    break

        return jsonify({"status": "completed"})
    except Exception as e:
        return jsonify({"error": str(e)})
    finally:
        with play_lock:
            # 确保播放状态被重置
            if pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
                print("播放状态被重置")
                pygame.mixer.music.unload()

if __name__ == '__main__':
    app.run(port=8666, debug=True)  # 默认为监听127.0.0.1



现在

前面是Chrome插件的js，后面是之前写过的clip-api.py（用来调用vits并且播放声音，最后播放完毕可以回调完成的信号，用来实现自动朗读）。就是说目前我会开两个api，一个vits返回的音频，一个是clip用来播放音频，要怎么修改api代码还有插件的content和background（因为content请求会有跨域问题，所以要传到background来发送和接受请求）代码能和WindowsTTS一样实现回调，然后自动朗读呢？