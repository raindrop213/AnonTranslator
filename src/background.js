// background.js

let toggleState = true;
let readTextState = true;
let copyToClipboardState = true;
let translatState = true;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "updateToggle":
      toggleState = message.toggle;
      break;
    case "requestToggleState":
      sendResponse({ toggle: toggleState });
      break;

    case "updateReadText":
      readTextState = message.readText;
      break;
    case "requestReadTextState":
      sendResponse({ readText: readTextState });
      break;

    case "updateCopyToClipboard":
      copyToClipboardState = message.copyToClipboard;
      break;
    case "requestCopyToClipboardState":
      sendResponse({ copyToClipboard: copyToClipboardState });
      break;

    case "updateTranslat":
      translatState = message.translat;
      break;
    case "requestTranslatState":
      sendResponse({ translat: translatState });
      break;

    // 监听弹窗位置
    // case "openPopup":
    //     if (toggleState && caseSwitchState) {
    //         const selectedText = message.selectedText;
    //         const x = message.x;
    //         const y = message.y;
    //         const screenWidth = message.screenWidth;
    //         const screenHeight = message.screenHeight;
    //         const popupWidth = 400;
    //         const popupHeight = 300;

    //         // 计算窗口合适位置
    //         const xPosition = Math.min(x, screenWidth - popupWidth);
    //         const yPosition = Math.min(y, screenHeight - popupHeight);

    //         chrome.windows.create({
    //             url: chrome.runtime.getURL(`case.html?selectedText=${selectedText}`),
    //             type: "popup",
    //             width: popupWidth,
    //             height: popupHeight,
    //             top: yPosition + 100,
    //             left: xPosition,
    //         });
    //     }
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
function deeplTranslate(query, from, to) {
  return new Promise((resolve, reject) => {
    const sourceLanguage = langMap.get(from);
    const targetLanguage = langMap.get(to);

    if (!targetLanguage) {
      reject("不支持该语种");
      return;
    }

    const source_lang = sourceLanguage || "ja";
    const target_lang = targetLanguage || "zh";
    const translate_text = query || "";

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
        .then((response) => {
          if (!response.ok) {
            throw new Error('网络请求失败，状态码：' + response.status);
          }
          return response.json();
        })
        .then((data) => {
          if (data.error) {
            throw new Error('API 错误：' + data.error.message);
          }
          resolve(data.result.texts[0].text);
        })
        .catch((error) => {
          // 检查错误对象是否包含特定属性
          let errorMessage = error.message || "未知错误";
          // 如果错误对象是一个空对象，提供一个通用错误信息
          if (Object.keys(error).length === 0) {
            errorMessage = "接口请求出现错误，但未提供具体错误信息";
          }
          reject(errorMessage);
        });
    } else {
      reject("没有提供翻译文本");
    }
  });
}

// Google API
function googleTranslate(query, from, to) {
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
function youdaoTranslate(query, from, to) {
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
          sendResponse({ error: "未知的翻译服务" });
          return;
      }
  
      translateFunction(request.text, request.from, request.to)
        .then(translation => sendResponse({ translation: translation }))
        .catch(error => {
          console.error("翻译错误: ", error);
          sendResponse({ error: error });
        });
  
      return true; // 异步响应
    }
  });

