# **AnonTranslator**
![tips](img/icon128.png)

A chrome extension for light novel reading

啃小说生肉工具，获取浏览器中的段落或句子（通过提取网页中  \<p\> \<h1\> ~ \<h6\> \<img\>标签），并复制到剪切板

**Chrome插件/扩展**
![tips](img/preview.gif)

---

### **插件安装**
- AnonTranslator：① 直接 [Download ZIP](https://github.com/raindrop213/AnonTranslator/archive/refs/heads/main.zip)；② Chrome打开开发者模式；③ 加载已解压的扩展程序；
- [vitsTTS整合包](https://github.com/raindrop213/AnonTranslator/releases/v1.1.0)：下载解压后打开 <kbd>RD213.bat</kbd>（注：原项目来自 [vits-simple-api](https://github.com/Artrajz/vits-simple-api) 。该整合包里面包含所需的vits模型([vits-uma-genshin-honkai](https://huggingface.co/spaces/zomehwh/vits-uma-genshin-honkai))。能力有限，无论如何都绕不开限制，就加了个api来桥接插件･ﾟ･(つд`ﾟ)･ﾟ･ 主打一个能用就行）。

### **使用场景**
- 在线阅读：很多在线网站都可以用
  - [小説家になろう](https://syosetu.com/)；
  - [カクヨム](https://kakuyomu.jp/)；
  - [青空文庫](https://www.aozora.gr.jp/)（不能正常工作，因为是纯文本没html标签。但可以使用 [青空助手](https://aohelp.club/) 下载epub或者html看 | [作者B站视频](https://www.bilibili.com/video/BV1Xa4y1h7MW/)）；
  - [本人自用书库](https://ebook.raindrop213.info/)
- 下载党：EPUB / HTML 格式
  - 管理：[Calibre-web](https://github.com/janeczku/calibre-web) 自建书库（前提是你已经用 [Calibre](https://calibre-ebook.com/) 存好电子书了，最好用的书籍管理软件！！！）
  - 下载：Z-Lib就不用多说了，那你也可能还知道安娜的档案和各种DLRaw网站；[小説図書館](https://yonde.itazuraneko.org/)
  - 购买：[bookwalker](https://bookwalker.jp/)、[Amazon](https://www.amazon.co.jp/kindle-dbs/storefront) 和 [Rakuten](https://books.rakuten.co.jp/e-book/) ，其中bookwalker解锁（DeDRM）稍难点，另外两个解锁相对简单一点
  - 阅读：这里放一个简单好用的epub阅读器 [ッツ Ebook Reader](https://reader.ttsu.app)
  

### **使用说明**
1. 左键 <kbd>Left Click</kbd> 复制、朗读、翻译文本段落；
2. 右键 <kbd>right Click</kbd> 复制、朗读高亮句子；
3. 键盘 <kbd>Num 0</kbd> 或 <kbd>F1</kbd> 复制、朗读当前文本段落；
4. 空格键 <kbd>Backspace</kbd> 自动读书，一段接一段播放；
5. 方向键 <kbd>↑</kbd> 上一段 和 <kbd>↓</kbd> 下一段，并复制、朗读、翻译文本段落，也对应备用键位 <kbd>Num 2</kbd> 和 <kbd>Num 1</kbd>；

- 通过剪切板可以搭配 [LunaTranslator](https://github.com/HIllya51/LunaTranslator)（多方翻译、语素分析、快速查词、Anki；推荐！）

https://github.com/user-attachments/assets/169b6d31-6655-4f48-9dd9-80988322e62f

### **常见问题**
1. ※ 当插件设置成 <kbd>在特定网站上</kbd> 时翻译会失效！！<kbd>在所有网站上</kbd> 则没问题。我推荐在 <kbd>manifest.json</kbd> 中的 <kbd>matches</kbd> 硬设置使用插件的网页。如：
    ```
    "matches": [
      "http://localhost:8083/*",
      "http://127.0.0.1:8083/*",
      "https://kakuyomu.jp/*",
      "https://*.syosetu.com/*",
      "https://ebook.raindrop213.info/*",
      "https://reader.ttsu.app/*"
    ],
    ```
2. vits怎么用？ 答：放在哪里都行但请避免路径中含中文。打开 RD213.bat ，等小黑窗出现 127.0.0.1:23456 说明能用，使用时挂着别关。

### **开发计划**
- 提取（~~振假名、分割句子~~）
- 语音（~~WindowsTTS、VitsTTS~~）
- 翻译（~~Google、Youdao、DeepL~~、GPT接口）
- 词典（moji、weblio）
- 日本語形態素解析（MeCab）
- 联动 Anki

---
![tips](img/img1.png)