// background.js

// 初始设置值
const defaultSettings = {
  toggleSwitch: true,
  copy: true,
  ignoreFurigana: true,
  useVITS: false,
  useWindowsTTS: true,
  voiceName: '',
  rate: 1,
  pitch: 1,
  vitsAPI: 'http://127.0.0.1:23456',
  vitsAPIjson: 'http://127.0.0.1:23456/voice/speakers',
  vitsVoice: 342,
  vitsLang: 'ja',
  length: 1,
  noise: 0.33,
  noisew: 0.4,
  max: 50,
  streaming: false,
  from: 'ja',
  to: 'zh',
  google: false,
  googleColor: '#D4B102',
  deepl: true,
  deeplColor: '#9C512E',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderRadius: '8px',
  freeBorderColor: '#225D2E',
  selectedBorderColor: '#94B505'
};

// 初始化设置
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(defaultSettings, () => {
    console.log("Default settings saved.");
  });
});

// 接收消息并返回设置值
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse(settings);
    });
    return true;  // 表示将使用异步发送响应
  }
});



const supportedLanguages = [
  ["auto", "auto"],
  ["de", "DE"],
  ["en", "EN"],
  ["es", "ES"],
  ["fr", "FR"],
  ["it", "IT"],
  ["ja", "JA"],
  ["ko", "KO"],
  ["nl", "NL"],
  ["pl", "PL"],
  ["pt", "PT"],
  ["ru", "RU"],
  ["zh", "ZH"],
  ["zh", "ZH"],
  ["bg", "BG"],
  ["cs", "CS"],
  ["da", "DA"],
  ["el", "EL"],
  ["et", "ET"],
  ["fi", "FI"],
  ["hu", "HU"],
  ["lt", "LT"],
  ["lv", "LV"],
  ["ro", "RO"],
  ["sk", "SK"],
  ["sl", "SL"],
  ["sv", "SV"],
];
const langMap = new Map(supportedLanguages);

function getTimeStamp(iCount) {
  const ts = Date.now();
  if (iCount !== 0) {
    iCount = iCount + 1;
    return ts - (ts % iCount) + iCount;
  } else {
    return ts;
  }
}

// DeepL API
function deeplTranslate(text, from, to) {
  return new Promise((resolve, reject) => {
    const sourceLanguage = langMap.get(from);
    const targetLanguage = langMap.get(to);
    
    if (!targetLanguage) {
      reject("不支持该语种");
      return;
    }

    const source_lang = sourceLanguage || "ja";
    const target_lang = targetLanguage || "zh";
    const translate_text = text || "";

    if (translate_text !== "") {
      const url = "https://www2.deepl.com/jsonrpc";
      let id = (Math.floor(Math.random() * 99999) + 100000) * 1000;
      const post_data = {
        jsonrpc: "2.0",
        method: "LMT_handle_texts",
        params: {
          splitting: "newlines",
          lang: {
            source_lang_user_selected: source_lang,
            target_lang: target_lang,
          },
          texts: [{ text: translate_text, requestAlternatives: 3 }],
          timestamp: getTimeStamp(translate_text.split("i").length - 1),
        },
        id: id,
      };
      let post_str = JSON.stringify(post_data);
      if ((id + 5) % 29 === 0 || (id + 3) % 13 === 0) {
        post_str = post_str.replace('"method":"', '"method" : "');
      } else {
        post_str = post_str.replace('"method":"', '"method": "');
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: post_str,
      })
        .then((response) => response.json())
        .then((data) => resolve(data.result.texts[0].text))
        .catch((error) => {
          reject("接口请求错误 - " + JSON.stringify(error));
        });
    } else {
      reject("没有提供翻译文本");
    }
  });
}

// Google API
function googleTranslate(text, from, to) {
  return new Promise((resolve, reject) => {
    // 模拟异步操作，例如从 API 获取数据
    // 这里我们只是简单地返回一段文本
    const text = "谷歌翻译还没做好...";

    // 模拟成功获取翻译结果
    resolve(text);

    // 如果有任何错误，您可以使用 reject 来发送错误
    // 例如：reject("翻译服务不可用");
  });
}

// Youdao API
function youdaoTranslate(text, from, to) {
  return new Promise((resolve, reject) => {
    // 模拟异步操作，例如从 API 获取数据
    // 这里我们只是简单地返回一段文本
    const text = "有道翻译还没做好...";

    // 模拟成功获取翻译结果
    resolve(text);

    // 如果有任何错误，您可以使用 reject 来发送错误
    // 例如：reject("翻译服务不可用");
  });
}


// 响应翻译请求
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "translate") {
    let translateFunction;

    switch (request.translator) {
      case "Google":
        translateFunction = googleTranslate;
        break;
      case "Deepl":
        translateFunction = deeplTranslate;
        break;
      case "Youdao":
        translateFunction = youdaoTranslate;
        break;
      default:
        sendResponse({ translatedText: "不支持的翻译器" });
        return;
    }

    translateFunction(request.text, request.from, request.to)
      .then((translatedText) => {
        sendResponse({ translatedText: translatedText });
      })
      .catch((error) => {
        sendResponse({ translatedText: "翻译错误: " + error });
      });

    // 为了使异步消息处理有效，返回 true
    return true;
  }
});
