/* background.js */

// 读取并解析defaultSettings.json文件
function loadDefaultSettings() {
  return fetch(chrome.runtime.getURL('config/defaultSettings.json'))
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

// 响应请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'getSettings') {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse(settings);
    });
    return true;  // 表示将使用异步发送响应

  // VitsTTS 响应
  } else if (message.action === 'play_audio') {
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
      } else if (data.error) {
        sendResponse({ status: "error", error: data.error });
      }
    })
    .catch(error => sendResponse({ error: error.message }));
    return true;

  // 翻译响应
  } else if (message.action === "translate") {
    let translateFunction;
    switch (message.translator) {
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
        return true;
    }
    translateFunction(message.text, message.from, message.to)
      .then((translatedText) => {
        sendResponse({ translatedText: translatedText });
      })
      .catch((error) => {
        sendResponse({ translatedText: "翻译错误: " + error });
      });
    return true;
  }
});

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
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Origin": "https://m.youdao.com",
      "Pragma": "no-cache",
      "Referer": "https://m.youdao.com/translate",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
      "sec-ch-ua": '"Microsoft Edge";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    };

    const data = new URLSearchParams();
    data.append("inputtext", text);
    data.append("type", from + "2" + to);

    fetch("https://m.youdao.com/translate", {
      method: "POST",
      headers: headers,
      body: data,
      cookies: {
        "_yd_btn_fanyi_29": "true",
        "_yd_newbanner_day": "29",
      }
    })
    .then(response => response.text())
    .then(responseText => {
      const result = responseText.match(
        /<ul id="translateResult">[\s\S]*?<li>([\s\S]*?)<\/li>[\s\S]*?<\/ul>/
      );
      if (result && result[1]) {
        resolve(result[1].replace(/<\/?[^>]+(>|$)/g, ""));
      } else {
        reject("翻译结果未找到");
      }
    })
    .catch(error => {
      reject("接口请求错误 - " + error);
    });
  });
}
