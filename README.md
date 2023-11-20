# **AnonTranslator**
![tips](https://raw.githubusercontent.com/raindrop213/AnonTranslator/main/img/icon128.png)
<h3>
<ruby>千早<rt>ちはや</rt></ruby>
<ruby>愛音<rt>あのん</rt></ruby>
</h3>
A chrome extension for light novel reading

多功能TTS啃生肉，复制到剪切板时去除振假名（Furigana）

**日文轻小说 - Chrome插件/扩展 - 烤肉**

---

### **插件安装**
1. 下载最新release - 加载已解压的扩展程序
2. vitsTTS需要额外下载：1. [整合包]()（来自项目[vits-simple-api](https://github.com/Artrajz/vits-simple-api)，整合包包含模型，加了个接口与插件通信）


### **使用说明**
1. 点击标签可以朗读文本和复制到剪切板，所以通过剪切板可以搭配 [Yomichan](https://chromewebstore.google.com/detail/yomichan/ogmnaimimemjmbakcfefmnahgdfhfami) 使用Anki和语素分析。
2. 请配合 [Calibre-web](https://github.com/janeczku/calibre-web) 使用（当然使用它的前提是你已经用 [Calibre](https://calibre-ebook.com/) 存好电子书了，最好用的书籍管理软件！！！）
3. 由于是在 Calibre-web 进行测试，别的阅读器不一定能用。因为默认提取  \<p\> \<h1\> \<h2\> \<h3\> 标签，有些不规范的电子书可能不适用。（有时间的话可以适配一下，有时间的话......）


### **开发计划**
- ~~去除振假名（假名注音）~~
- ~~WindowsTTS~~
- EdgeTTS
- ~~vitsTTS~~
- ~~自动朗读~~
- 翻译（DeepL、有道、moji）
- 日本語形態素解析（MeCab、moji、gpt）
- 联动 Anki


### **资源**
1. 免费在线阅读：[カクヨム](https://kakuyomu.jp/)、[小説家になろう](https://syosetu.com/)【轻小说】
2. 免费下载：Z-Library 就不用多说了，那你也可能知道 [安娜的档案](https://zh.annas-archive.gs/)，BitTorrent站 [nyaa](https://nyaa.si/)
2. 免费在线阅读（非标准格式）：[青空文庫](https://www.aozora.gr.jp/)【很多文学作品。这网站很出名啦！整本书都会放在同一页，比较好扒】。（需要你会做epub的话可以右键查看页面源码，然后拷贝到epub，快速匹配替换加标签就行了。）
3. 电子书购买：[amazon](https://www.amazon.co.jp/kindle-dbs/storefront)、[bookwalker](https://bookwalker.jp/) 和 [Rakuten](https://books.rakuten.co.jp/e-book/) ，这些电子书破解下载到本地都需要用到 Calibre 的插件。（amazon的kindle破解步骤复杂一点，初步解出来的不是原图，要解原图然后再替换有点麻烦的说。听说另外两个破解相对无脑一点？）

---

**其他**
<details>
  <summary>vits可用语音</summary>
[0] ja 綾地寧々;
[1] ja 因幡めぐる;
[2] ja 朝武芳乃;
[3] ja 常陸茉子;
[4] ja ムラサメ;
[5] ja 鞍馬小春;
[6] ja 在原七海;
[7] ja 金色の闇;
[8] ja モモ;
[9] ja ナナ;
[10] ja 結城美柑;
[11] ja 古手川唯;
[12] ja 黒咲芽亜;
[13] ja ネメシス;
[14] ja 村雨静;
[15] ja セリーヌ;
[16] ja ララ;
[17] ja 天条院沙姫;
[18] ja 西連寺春菜;
[19] ja ルン;
[20] ja メイ;
[21] ja 霧崎恭子;
[22] ja 籾岡里紗;
[23] ja 沢田未央;
[24] ja ティアーユ;
[25] ja 九条凛;
[26] ja 藤崎綾;
[27] ja 結城華;
[28] ja 御門涼子;
[29] ja アゼンダ;
[30] ja 夕崎梨子;
[31] ja 結城梨斗;
[32] ja ペケ;
[33] ja 猿山ケンイチ;
[34] ja レン;
[35] ja 校長;
[36] ja ルイズ;
[37] ja ティファニア;
[38] ja イルククゥ;
[39] ja アンリエッタ;
[40] ja タバサ;
[41] ja シエスタ;
[42] ja ハルナ;
[43] ja 少女リシュ;
[44] ja リシュ;
[45] ja アキナ;
[46] ja クリス;
[47] ja カトレア;
[48] ja エレオノール;
[49] ja モンモランシー;
[50] ja リーヴル;
[51] ja キュルケ;
[52] ja ウェザリー;
[53] ja サイト;
[54] ja ギーシュ;
[55] ja コルベール;
[56] ja オスマン;
[57] ja デルフリンガー;
[58] ja テクスト;
[59] ja ダンプリメ;
[60] ja ガレット;
[61] ja スカロン;
[62] ja 和泉妃愛;
[63] ja 常盤華乃;
[64] ja 錦あすみ;
[65] ja 鎌倉詩桜;
[66] ja 竜閑天梨;
[67] ja 和泉里;
[68] ja 新川広夢;
[69] ja 聖莉々子;
[70] ja 矢来美羽;
[71] ja 布良梓;
[72] ja エリナ;
[73] ja 稲叢莉音;
[74] ja ニコラ;
[75] ja 荒神小夜;
[76] ja 大房ひよ里;
[77] ja 淡路萌香;
[78] ja アンナ;
[79] ja 倉端直太;
[80] ja 枡形兵馬;
[81] ja 扇元樹;
[82] zh/ja 綾地寧々;
[83] zh/ja 在原七海;
[84] zh/ja 小茸;
[85] zh/ja 唐乐吟;
</details>


