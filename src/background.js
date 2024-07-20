// 读取并解析defaultSettings.json文件
function loadDefaultSettings() {
  return fetch(chrome.runtime.getURL('defaultSettings.json'))
    .then(response => response.json())
    .catch(error => {
      console.error("Error loading default settings:", error);
      return null;
    });
}

// 初始化设置
chrome.runtime.onInstalled.addListener(() => {
  loadDefaultSettings().then(defaultSettings => {
    if (defaultSettings) {
      chrome.storage.sync.set(defaultSettings, () => {
        console.log("Default settings saved.");
      });
    } else {
      console.error("Failed to load default settings.");
    }
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


/* ------------------------------------------------------------翻译请求模块 */

// DeepL API
function deeplTranslate(text, from, to) {
  return new Promise((resolve, reject) => {

    const getTimeStamp = (iCount) => {
      const ts = Date.now();
      if (iCount !== 0) {
        iCount = iCount + 1;
        return ts - (ts % iCount) + iCount;
      } else {
        return ts;
      }
    };

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
            source_lang_user_selected: from,
            target_lang: to,
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
    const query = encodeURIComponent(text);
    
    const url = `https://translate.google.com/m?sl=${from}&tl=${to}&hl=zh-CN&q=${query}`;

    fetch(url, {
      method: "GET",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
      }
    })
    .then(response => response.text())
    .then(text => {
      const regex = /<div class="result-container">([\s\S]*?)<\/div>/;
      const matches = text.match(regex);
      if (matches && matches[1]) {
        resolve(decodeURIComponent(matches[1].replace(/<\/?[^>]+(>|$)/g, "")));
      } else {
        reject("翻译结果未找到");
      }
    })
    .catch(error => {
      reject("接口请求错误 - " + error);
    });
  });
}

// Youdao API
function youdaoTranslate(text, from, to) {
  return new Promise((resolve, reject) => {
    const headers = {
        "authority": "aidemo.youdao.com",
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": "https://ai.youdao.com",
        "referer": "https://ai.youdao.com/",
        "sec-ch-ua": '"Chromium";v="106", "Google Chrome";v="106", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36"
    };

    const data = new URLSearchParams();
    data.append("q", text);
    data.append("from", from);
    data.append("to", to);

    fetch("https://aidemo.youdao.com/trans", {
        method: "POST",
        headers: headers,
        body: data,
    })
    .then(response => {
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(json => {
      if (json && json.translation && json.translation[0]) {
        resolve(json.translation[0]);
      } else {
        throw new Error(`Unexpected response format: ${JSON.stringify(json)}`);
      }
    })
    .catch(error => {
      reject("Translation error: " + error.message);
    });
  });
}

// 响应翻译请求
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "translate") {
    let translateFunction;

    switch (request.translator) {
      case "google":
        translateFunction = googleTranslate;
        break;
      case "deepl":
        translateFunction = deeplTranslate;
        break;
      case "youdao":
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
