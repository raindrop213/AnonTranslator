async function translate(content) {
    const proxy = {
        https: "http://127.0.0.1:7890",
        http: "http://127.0.0.1:7890"
    };

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
    data.append("q", content);
    data.append("from", "ja");
    data.append("to", "zh-CHS");

    try {
        const response = await fetch("https://aidemo.youdao.com/trans", {
            method: "POST",
            headers: headers,
            body: data,
            // Use proxy settings if needed
            // proxy: proxy // Uncomment this if your environment supports proxy settings in fetch
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();
        return json.translation[0];
    } catch (error) {
        console.error("Translation error:", error);
    }
}

// Usage
translate("こんにちは、世界！").then(translatedText => {
    console.log(translatedText);
});
