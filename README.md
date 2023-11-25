# **AnonTranslator**
![tips](https://raw.githubusercontent.com/raindrop213/AnonTranslator/main/img/icon128.png)
<h3>
<ruby>千早<rt>ちはや</rt></ruby>
<ruby>愛音<rt>あのん</rt></ruby>
</h3>
A chrome extension for light novel reading

多功能TTS啃生肉，追踪鼠标位置的文本标签，复制到剪切板时去除振假名（Furigana）

**日文轻小说 - Chrome插件/扩展 - 烤肉**

![tips](https://raw.githubusercontent.com/raindrop213/AnonTranslator/main/img/preview2.gif)

---

### **插件安装**
- [AnonTranslator](https://github.com/raindrop213/AnonTranslator/releases/tag/%E6%AD%A3%E5%BC%8F%E7%89%88) （在等Chrome审核，暂时先从这里下载吧）
- 加载插件后，首先右键插件到选项页面先设置保存一下才能用，然后刷新一下页面就能用啦；
- vitsTTS需要额外下载：
  - [vitsTTS整合包](https://github.com/raindrop213/AnonTranslator/releases/tag/%E6%AD%A3%E5%BC%8F%E7%89%88) 下载解压后打开 <kbd>RD213.bat</kbd> 需要刷新一下浏览器页面程序就会自动挂上（里面包含所需的模型，还加了个接口让插件与vits进行网络通信，所以放在哪里都行。请按照里面的步骤操作吧！该 API 来自项目 [vits-simple-api](https://github.com/Artrajz/vits-simple-api) 我用的是 [0.5.3](https://github.com/Artrajz/vits-simple-api/releases/tag/0.5.3)，感谢该项目的开发人员！！！）


### **使用说明**
1. 点击标签可以朗读文本和复制到剪切板，所以通过剪切板可以搭配 [LunaTranslator](https://github.com/HIllya51/LunaTranslator)（多方翻译、语素分析）或者 [Yomichan](https://chromewebstore.google.com/detail/yomichan/ogmnaimimemjmbakcfefmnahgdfhfami)（语素分析、Anki）；
2. 键盘方向键 <kbd>↑</kbd> 上一句 和 <kbd>↓</kbd> 上一句，并且可以触发复制和朗读；
3. 空格键 <kbd>Backspace</kbd> 一句接一句播放；
4. 请配合 [Calibre-web](https://github.com/janeczku/calibre-web) 使用（当然使用它的前提是你已经用 [Calibre](https://calibre-ebook.com/) 存好电子书了，最好用的书籍管理软件！！！）；
5. 由于是在 Calibre-web 进行测试，别的阅读器不一定能用。因为默认提取  \<p\> \<h1\> \<h2\> \<h3\> 标签，有些不规范的电子书可能不适用。（有时间的话可以适配一下，有时间的话......）。

### **常见问题**
1. 浏览器中无法使用空格？ 答：因为是自动朗动用的，所以建议去插件管理对特定网站使用比较好；
2. 翻译返回“接口请求错误 - {}”？ 答：移除之后重新加载插件可以解决。

### **开发计划**
- ~~去除振假名（假名注音）~~
- ~~WindowsTTS~~
- ~~vitsTTS~~
- ~~自动朗读~~
- 翻译（~~DeepL~~、Google）
- 词典（moji、weblio、小学馆）
- 日本語形態素解析（MeCab、moji）
- 联动Anki


### **日文资源**
1. 在线阅读：[カクヨム](https://kakuyomu.jp/)、[小説家になろう](https://syosetu.com/)【轻小说】；
2. 下载：Z-Library 就不用多说了，那你也可能知道 [安娜的档案](https://zh.annas-archive.gs/)，BitTorrent站 [nyaa](https://nyaa.si/) ；
3. 在线阅读（非标准格式）：[青空文庫](https://www.aozora.gr.jp/)【很多文学作品。这网站很出名啦！整本书都会放在同一页，比较好扒】（需要你会做epub，右键查看页面源码，然后拷贝到epub，快速匹配替换加标签就行了）；
4. 电子书购买：[amazon](https://www.amazon.co.jp/kindle-dbs/storefront)、[bookwalker](https://bookwalker.jp/) 和 [Rakuten](https://books.rakuten.co.jp/e-book/) ，这些电子书破解下载到本地都需要用到 Calibre 的插件。（amazon的kindle破解步骤复杂一点，初步解出来的不是原图，要解原图然后再替换有点麻烦的说。听说另外两个破解相对无脑一点？）

---

**其他**

<details>
  <summary>vits整合包中可用语音</summary>
[0] ja 綾地寧々;  [1] ja 因幡めぐる;  [2] ja 朝武芳乃;  [3] ja 常陸茉子;  [4] ja ムラサメ;  [5] ja 鞍馬小春;  [6] ja 在原七海;  [7] ja 金色の闇;  [8] ja モモ;  [9] ja ナナ;  [10] ja 結城美柑;  [11] ja 古手川唯;  [12] ja 黒咲芽亜;  [13] ja ネメシス;  [14] ja 村雨静;  [15] ja セリーヌ;  [16] ja ララ;  [17] ja 天条院沙姫;  [18] ja 西連寺春菜;  [19] ja ルン;  [20] ja メイ;  [21] ja 霧崎恭子;  [22] ja 籾岡里紗;  [23] ja 沢田未央;  [24] ja ティアーユ;  [25] ja 九条凛;  [26] ja 藤崎綾;  [27] ja 結城華;  [28] ja 御門涼子;  [29] ja アゼンダ;  [30] ja 夕崎梨子;  [31] ja 結城梨斗;  [32] ja ペケ;  [33] ja 猿山ケンイチ;  [34] ja レン;  [35] ja 校長;  [36] ja ルイズ;  [37] ja ティファニア;  [38] ja イルククゥ;  [39] ja アンリエッタ;  [40] ja タバサ;  [41] ja シエスタ;  [42] ja ハルナ;  [43] ja 少女リシュ;  [44] ja リシュ;  [45] ja アキナ;  [46] ja クリス;  [47] ja カトレア;  [48] ja エレオノール;  [49] ja モンモランシー;  [50] ja リーヴル;  [51] ja キュルケ;  [52] ja ウェザリー;  [53] ja サイト;  [54] ja ギーシュ;  [55] ja コルベール;  [56] ja オスマン;  [57] ja デルフリンガー;  [58] ja テクスト;  [59] ja ダンプリメ;  [60] ja ガレット;  [61] ja スカロン;  [62] ja 和泉妃愛;  [63] ja 常盤華乃;  [64] ja 錦あすみ;  [65] ja 鎌倉詩桜;  [66] ja 竜閑天梨;  [67] ja 和泉里;  [68] ja 新川広夢;  [69] ja 聖莉々子;  [70] ja 矢来美羽;  [71] ja 布良梓;  [72] ja エリナ;  [73] ja 稲叢莉音;  [74] ja ニコラ;  [75] ja 荒神小夜;  [76] ja 大房ひよ里;  [77] ja 淡路萌香;  [78] ja アンナ;  [79] ja 倉端直太;  [80] ja 枡形兵馬;  [81] ja 扇元樹;  [82] zh/ja 綾地寧々;  [83] zh/ja 在原七海;  [84] zh/ja 小茸;  [85] zh/ja 唐乐吟;  [86] zh/ja 特别周;  [87] zh/ja 无声铃鹿;  [88] zh/ja 东海帝皇（帝宝，帝王）;  [89] zh/ja 丸善斯基;  [90] zh/ja 富士奇迹;  [91] zh/ja 小栗帽;  [92] zh/ja 黄金船;  [93] zh/ja 伏特加;  [94] zh/ja 大和赤骥;  [95] zh/ja 大树快车;  [96] zh/ja 草上飞;  [97] zh/ja 菱亚马逊;  [98] zh/ja 目白麦昆;  [99] zh/ja 神鹰;  [100] zh/ja 好歌剧;  [101] zh/ja 成田白仁;  [102] zh/ja 鲁道夫象征（皇帝）;  [103] zh/ja 气槽;  [104] zh/ja 爱丽数码;  [105] zh/ja 星云天空;  [106] zh/ja 玉藻十字;  [107] zh/ja 美妙姿势;  [108] zh/ja 琵琶晨光;  [109] zh/ja 摩耶重炮;  [110] zh/ja 曼城茶座;  [111] zh/ja 美浦波旁;  [112] zh/ja 目白赖恩;  [113] zh/ja 菱曙;  [114] zh/ja 雪中美人;  [115] zh/ja 米浴;  [116] zh/ja 艾尼斯风神;  [117] zh/ja 爱丽速子（爱丽快子）;  [118] zh/ja 爱慕织姬;  [119] zh/ja 稻荷一;  [120] zh/ja 胜利奖券;  [121] zh/ja 空中神宫;  [122] zh/ja 荣进闪耀;  [123] zh/ja 真机伶;  [124] zh/ja 川上公主;  [125] zh/ja 黄金城（黄金城市）;  [126] zh/ja 樱花进王;  [127] zh/ja 采珠;  [128] zh/ja 新光风;  [129] zh/ja 东商变革;  [130] zh/ja 超级小海湾;  [131] zh/ja 醒目飞鹰（寄寄子）;  [132] zh/ja 荒漠英雄;  [133] zh/ja 东瀛佐敦;  [134] zh/ja 中山庆典;  [135] zh/ja 成田大进;  [136] zh/ja 西野花;  [137] zh/ja 春丽（乌拉拉）;  [138] zh/ja 青竹回忆;  [139] zh/ja 微光飞驹;  [140] zh/ja 美丽周日;  [141] zh/ja 待兼福来;  [142] zh/ja mr cb（cb先生）;  [143] zh/ja 名将怒涛（名将户仁）;  [144] zh/ja 目白多伯;  [145] zh/ja 优秀素质;  [146] zh/ja 帝王光辉;  [147] zh/ja 待兼诗歌剧;  [148] zh/ja 生野狄杜斯;  [149] zh/ja 目白善信;  [150] zh/ja 大拓太阳神;  [151] zh/ja 双涡轮（两立直，两喷射，二锅头，逆喷射）;  [152] zh/ja 里见光钻（萨托诺金刚石）;  [153] zh/ja 北部玄驹;  [154] zh/ja 樱花千代王;  [155] zh/ja 天狼星象征;  [156] zh/ja 目白阿尔丹;  [157] zh/ja 八重无敌;  [158] zh/ja 鹤丸刚志;  [159] zh/ja 目白光明;  [160] zh/ja 成田拜仁（成田路）;  [161] zh/ja 也文摄辉;  [162] zh/ja 小林历奇;  [163] zh/ja 北港火山;  [164] zh/ja 奇锐骏;  [165] zh/ja 苦涩糖霜;  [166] zh/ja 小小蚕茧;  [167] zh/ja 骏川手纲（绿帽恶魔）;  [168] zh/ja 秋川弥生（小小理事长）;  [169] zh/ja 乙名史悦子（乙名记者）;  [170] zh/ja 桐生院葵;  [171] zh/ja 安心泽刺刺美;  [172] zh/ja 樫本理子;  [173] zh/ja 神里绫华（龟龟）;  [174] zh/ja 琴;  [175] zh/ja 空（空哥）;  [176] zh/ja 丽莎;  [177] zh/ja 荧（荧妹）;  [178] zh/ja 芭芭拉;  [179] zh/ja 凯亚;  [180] zh/ja 迪卢克;  [181] zh/ja 雷泽;  [182] zh/ja 安柏;  [183] zh/ja 温迪;  [184] zh/ja 香菱;  [185] zh/ja 北斗;  [186] zh/ja 行秋;  [187] zh/ja 魈;  [188] zh/ja 凝光;  [189] zh/ja 可莉;  [190] zh/ja 钟离;  [191] zh/ja 菲谢尔（皇女）;  [192] zh/ja 班尼特;  [193] zh/ja 达达利亚（公子）;  [194] zh/ja 诺艾尔（女仆）;  [195] zh/ja 七七;  [196] zh/ja 重云;  [197] zh/ja 甘雨（椰羊）;  [198] zh/ja 阿贝多;  [199] zh/ja 迪奥娜（猫猫）;  [200] zh/ja 莫娜;  [201] zh/ja 刻晴;  [202] zh/ja 砂糖;  [203] zh/ja 辛焱;  [204] zh/ja 罗莎莉亚;  [205] zh/ja 胡桃;  [206] zh/ja 枫原万叶（万叶）;  [207] zh/ja 烟绯;  [208] zh/ja 宵宫;  [209] zh/ja 托马;  [210] zh/ja 优菈;  [211] zh/ja 雷电将军（雷神）;  [212] zh/ja 早柚;  [213] zh/ja 珊瑚宫心海（心海，扣扣米）;  [214] zh/ja 五郎;  [215] zh/ja 九条裟罗;  [216] zh/ja 荒泷一斗（一斗）;  [217] zh/ja 埃洛伊;  [218] zh/ja 申鹤;  [219] zh/ja 八重神子（神子）;  [220] zh/ja 神里绫人（绫人）;  [221] zh/ja 夜兰;  [222] zh/ja 久岐忍;  [223] zh/ja 鹿野苑平藏;  [224] zh/ja 提纳里;  [225] zh/ja 柯莱;  [226] zh/ja 多莉;  [227] zh/ja 云堇;  [228] zh/ja 纳西妲（草神）;  [229] zh/ja 深渊使徒;  [230] zh/ja 妮露;  [231] zh/ja 赛诺;  [232] zh/ja 债务处理人;  [233] zh/ja 坎蒂丝;  [234] zh/ja 真弓快车;  [235] zh/ja 秋人;  [236] zh/ja 望族;  [237] zh/ja 艾尔菲;  [238] zh/ja 艾莉丝;  [239] zh/ja 艾伦;  [240] zh/ja 阿洛瓦;  [241] zh/ja 天野;  [242] zh/ja 天目十五;  [243] zh/ja 愚人众-安德烈;  [244] zh/ja 安顺;  [245] zh/ja 安西;  [246] zh/ja 葵;  [247] zh/ja 青木;  [248] zh/ja 荒川幸次;  [249] zh/ja 荒谷;  [250] zh/ja 有泽;  [251] zh/ja 浅川;  [252] zh/ja 麻美;  [253] zh/ja 凝光助手;  [254] zh/ja 阿托;  [255] zh/ja 竺子;  [256] zh/ja 百识;  [257] zh/ja 百闻;  [258] zh/ja 百晓;  [259] zh/ja 白术;  [260] zh/ja 贝雅特丽奇;  [261] zh/ja 丽塔;  [262] zh/ja 失落迷迭;  [263] zh/ja 缭乱星棘;  [264] zh/ja 伊甸;  [265] zh/ja 伏特加女孩;  [266] zh/ja 狂热蓝调;  [267] zh/ja 莉莉娅;  [268] zh/ja 萝莎莉娅;  [269] zh/ja 八重樱;  [270] zh/ja 八重霞;  [271] zh/ja 卡莲;  [272] zh/ja 第六夜想曲;  [273] zh/ja 卡萝尔;  [274] zh/ja 姬子;  [275] zh/ja 极地战刃;  [276] zh/ja 布洛妮娅;  [277] zh/ja 次生银翼;  [278] zh/ja 理之律者%26希儿;  [279] zh/ja 理之律者;  [280] zh/ja 迷城骇兔;  [281] zh/ja 希儿;  [282] zh/ja 魇夜星渊;  [283] zh/ja 黑希儿;  [284] zh/ja 帕朵菲莉丝;  [285] zh/ja 不灭星锚;  [286] zh/ja 天元骑英;  [287] zh/ja 幽兰黛尔;  [288] zh/ja 派蒙bh3;  [289] zh/ja 爱酱;  [290] zh/ja 绯玉丸;  [291] zh/ja 德丽莎;  [292] zh/ja 月下初拥;  [293] zh/ja 朔夜观星;  [294] zh/ja 暮光骑士;  [295] zh/ja 格蕾修;  [296] zh/ja 留云借风真君;  [297] zh/ja 梅比乌斯;  [298] zh/ja 仿犹大;  [299] zh/ja 克莱因;  [300] zh/ja 圣剑幽兰黛尔;  [301] zh/ja 妖精爱莉;  [302] zh/ja 特斯拉zero;  [303] zh/ja 苍玄;  [304] zh/ja 若水;  [305] zh/ja 西琳;  [306] zh/ja 戴因斯雷布;  [307] zh/ja 贝拉;  [308] zh/ja 赤鸢;  [309] zh/ja 镇魂歌;  [310] zh/ja 渡鸦;  [311] zh/ja 人之律者;  [312] zh/ja 爱莉希雅;  [313] zh/ja 天穹游侠;  [314] zh/ja 琪亚娜;  [315] zh/ja 空之律者;  [316] zh/ja 薪炎之律者;  [317] zh/ja 云墨丹心;  [318] zh/ja 符华;  [319] zh/ja 识之律者;  [320] zh/ja 特瓦林;  [321] zh/ja 维尔薇;  [322] zh/ja 芽衣;  [323] zh/ja 雷之律者;  [324] zh/ja 断罪影舞;  [325] zh/ja 阿波尼亚;  [326] zh/ja 榎本;  [327] zh/ja 厄尼斯特;  [328] zh/ja 恶龙;  [329] zh/ja 范二爷;  [330] zh/ja 法拉;  [331] zh/ja 愚人众士兵;  [332] zh/ja 愚人众士兵a;  [333] zh/ja 愚人众士兵b;  [334] zh/ja 愚人众士兵c;  [335] zh/ja 愚人众a;  [336] zh/ja 愚人众b;  [337] zh/ja 飞飞;  [338] zh/ja 菲利克斯;  [339] zh/ja 女性跟随者;  [340] zh/ja 逢岩;  [341] zh/ja 摆渡人;  [342] zh/ja 狂躁的男人;  [343] zh/ja 奥兹;  [344] zh/ja 芙萝拉;  [345] zh/ja 跟随者;  [346] zh/ja 蜜汁生物;  [347] zh/ja 黄麻子;  [348] zh/ja 渊上;  [349] zh/ja 藤木;  [350] zh/ja 深见;  [351] zh/ja 福本;  [352] zh/ja 芙蓉;  [353] zh/ja 古泽;  [354] zh/ja 古田;  [355] zh/ja 古山;  [356] zh/ja 古谷昇;  [357] zh/ja 傅三儿;  [358] zh/ja 高老六;  [359] zh/ja 矿工冒;  [360] zh/ja 元太;  [361] zh/ja 德安公;  [362] zh/ja 茂才公;  [363] zh/ja 杰拉德;  [364] zh/ja 葛罗丽;  [365] zh/ja 金忽律;  [366] zh/ja 公俊;  [367] zh/ja 锅巴;  [368] zh/ja 歌德;  [369] zh/ja 阿豪;  [370] zh/ja 狗三儿;  [371] zh/ja 葛瑞丝;  [372] zh/ja 若心;  [373] zh/ja 阿山婆;  [374] zh/ja 怪鸟;  [375] zh/ja 广竹;  [376] zh/ja 观海;  [377] zh/ja 关宏;  [378] zh/ja 蜜汁卫兵;  [379] zh/ja 守卫1;  [380] zh/ja 傲慢的守卫;  [381] zh/ja 害怕的守卫;  [382] zh/ja 贵安;  [383] zh/ja 盖伊;  [384] zh/ja 阿创;  [385] zh/ja 哈夫丹;  [386] zh/ja 日语阿贝多（野岛健儿）;  [387] zh/ja 日语埃洛伊（高垣彩阳）;  [388] zh/ja 日语安柏（石见舞菜香）;  [389] zh/ja 日语神里绫华（早见沙织）;  [390] zh/ja 日语神里绫人（石田彰）;  [391] zh/ja 日语白术（游佐浩二）;  [392] zh/ja 日语芭芭拉（鬼头明里）;  [393] zh/ja 日语北斗（小清水亚美）;  [394] zh/ja 日语班尼特（逢坂良太）;  [395] zh/ja 日语坎蒂丝（柚木凉香）;  [396] zh/ja 日语重云（齐藤壮马）;  [397] zh/ja 日语柯莱（前川凉子）;  [398] zh/ja 日语赛诺（入野自由）;  [399] zh/ja 日语戴因斯雷布（津田健次郎）;  [400] zh/ja 日语迪卢克（小野贤章）;  [401] zh/ja 日语迪奥娜（井泽诗织）;  [402] zh/ja 日语多莉（金田朋子）;  [403] zh/ja 日语优菈（佐藤利奈）;  [404] zh/ja 日语菲谢尔（内田真礼）;  [405] zh/ja 日语甘雨（上田丽奈）;  [406] zh/ja 日语（畠中祐）;  [407] zh/ja 日语鹿野院平藏（井口祐一）;  [408] zh/ja 日语空（堀江瞬）;  [409] zh/ja 日语荧（悠木碧）;  [410] zh/ja 日语胡桃（高桥李依）;  [411] zh/ja 日语一斗（西川贵教）;  [412] zh/ja 日语凯亚（鸟海浩辅）;  [413] zh/ja 日语万叶（岛崎信长）;  [414] zh/ja 日语刻晴（喜多村英梨）;  [415] zh/ja 日语可莉（久野美咲）;  [416] zh/ja 日语心海（三森铃子）;  [417] zh/ja 日语九条裟罗（濑户麻沙美）;  [418] zh/ja 日语丽莎（田中理惠）;  [419] zh/ja 日语莫娜（小原好美）;  [420] zh/ja 日语纳西妲（田村由加莉）;  [421] zh/ja 日语妮露（金元寿子）;  [422] zh/ja 日语凝光（大原沙耶香）;  [423] zh/ja 日语诺艾尔（高尾奏音）;  [424] zh/ja 日语奥兹（增谷康纪）;  [425] zh/ja 日语派蒙（古贺葵）;  [426] zh/ja 日语琴（斋藤千和）;  [427] zh/ja 日语七七（田村由加莉）;  [428] zh/ja 日语雷电将军（泽城美雪）;  [429] zh/ja 日语雷泽（内山昂辉）;  [430] zh/ja 日语罗莎莉亚（加隈亚衣）;  [431] zh/ja 日语早柚（洲崎绫）;  [432] zh/ja 日语散兵（柿原彻也）;  [433] zh/ja 日语申鹤（川澄绫子）;  [434] zh/ja 日语久岐忍（水桥香织）;  [435] zh/ja 日语女士（庄子裕衣）;  [436] zh/ja 日语砂糖（藤田茜）;  [437] zh/ja 日语达达利亚（木村良平）;  [438] zh/ja 日语托马（森田成一）;  [439] zh/ja 日语提纳里（小林沙苗）;  [440] zh/ja 日语温迪（村濑步）;  [441] zh/ja 日语香菱（小泽亚李）;  [442] zh/ja 日语魈（松冈祯丞）;  [443] zh/ja 日语行秋（皆川纯子）;  [444] zh/ja 日语辛焱（高桥智秋）;  [445] zh/ja 日语八重神子（佐仓绫音）;  [446] zh/ja 日语烟绯（花守由美里）;  [447] zh/ja 日语夜兰（远藤绫）;  [448] zh/ja 日语宵宫（植田佳奈）;  [449] zh/ja 日语云堇（小岩井小鸟）;  [450] zh/ja 日语钟离（前野智昭）;  [451] zh/ja 杰克;  [452] zh/ja 阿吉;  [453] zh/ja 江舟;  [454] zh/ja 鉴秋;  [455] zh/ja 嘉义;  [456] zh/ja 纪芳;  [457] zh/ja 景澄;  [458] zh/ja 经纶;  [459] zh/ja 景明;  [460] zh/ja 晋优;  [461] zh/ja 阿鸠;  [462] zh/ja 酒客;  [463] zh/ja 乔尔;  [464] zh/ja 乔瑟夫;  [465] zh/ja 约顿;  [466] zh/ja 乔伊斯;  [467] zh/ja 居安;  [468] zh/ja 君君;  [469] zh/ja 顺吉;  [470] zh/ja 纯也;  [471] zh/ja 重佐;  [472] zh/ja 大岛纯平;  [473] zh/ja 蒲泽;  [474] zh/ja 勘解由小路健三郎;  [475] zh/ja 枫;  [476] zh/ja 枫原义庆;  [477] zh/ja 荫山;  [478] zh/ja 甲斐田龍馬;  [479] zh/ja 海斗;  [480] zh/ja 惟神晴之介;  [481] zh/ja 鹿野奈奈;  [482] zh/ja 卡琵莉亚;  [483] zh/ja 凯瑟琳;  [484] zh/ja 加藤信悟;  [485] zh/ja 加藤洋平;  [486] zh/ja 胜家;  [487] zh/ja 茅葺一庆;  [488] zh/ja 和昭;  [489] zh/ja 一正;  [490] zh/ja 一道;  [491] zh/ja 桂一;  [492] zh/ja 庆次郎;  [493] zh/ja 阿贤;  [494] zh/ja 健司;  [495] zh/ja 健次郎;  [496] zh/ja 健三郎;  [497] zh/ja 天理;  [498] zh/ja 杀手a;  [499] zh/ja 杀手b;  [500] zh/ja 木南杏奈;  [501] zh/ja 木村;  [502] zh/ja 国王;  [503] zh/ja 木下;  [504] zh/ja 北村;  [505] zh/ja 清惠;  [506] zh/ja 清人;  [507] zh/ja 克列门特;  [508] zh/ja 骑士;  [509] zh/ja 小林;  [510] zh/ja 小春;  [511] zh/ja 康拉德;  [512] zh/ja 大肉丸;  [513] zh/ja 琴美;  [514] zh/ja 宏一;  [515] zh/ja 康介;  [516] zh/ja 幸德;  [517] zh/ja 高善;  [518] zh/ja 梢;  [519] zh/ja 克罗索;  [520] zh/ja 久保;  [521] zh/ja 九条镰治;  [522] zh/ja 久木田;  [523] zh/ja 昆钧;  [524] zh/ja 菊地君;  [525] zh/ja 久利须;  [526] zh/ja 黑田;  [527] zh/ja 黑泽京之介;  [528] zh/ja 响太;  [529] zh/ja 岚姐;  [530] zh/ja 兰溪;  [531] zh/ja 澜阳;  [532] zh/ja 劳伦斯;  [533] zh/ja 乐明;  [534] zh/ja 莱诺;  [535] zh/ja 莲;  [536] zh/ja 良子;  [537] zh/ja 李当;  [538] zh/ja 李丁;  [539] zh/ja 小乐;  [540] zh/ja 灵;  [541] zh/ja 小玲;  [542] zh/ja 琳琅a;  [543] zh/ja 琳琅b;  [544] zh/ja 小彬;  [545] zh/ja 小德;  [546] zh/ja 小楽;  [547] zh/ja 小龙;  [548] zh/ja 小吴;  [549] zh/ja 小吴的记忆;  [550] zh/ja 理正;  [551] zh/ja 阿龙;  [552] zh/ja 卢卡;  [553] zh/ja 洛成;  [554] zh/ja 罗巧;  [555] zh/ja 北风狼;  [556] zh/ja 卢正;  [557] zh/ja 萍姥姥;  [558] zh/ja 前田;  [559] zh/ja 真昼;  [560] zh/ja 麻纪;  [561] zh/ja 真;  [562] zh/ja 愚人众-马克西姆;  [563] zh/ja 女性a;  [564] zh/ja 女性b;  [565] zh/ja 女性a的跟随者;  [566] zh/ja 阿守;  [567] zh/ja 玛格丽特;  [568] zh/ja 真理;  [569] zh/ja 玛乔丽;  [570] zh/ja 玛文;  [571] zh/ja 正胜;  [572] zh/ja 昌信;  [573] zh/ja 将司;  [574] zh/ja 正人;  [575] zh/ja 路爷;  [576] zh/ja 老章;  [577] zh/ja 松田;  [578] zh/ja 松本;  [579] zh/ja 松浦;  [580] zh/ja 松坂;  [581] zh/ja 老孟;  [582] zh/ja 孟丹;  [583] zh/ja 商人随从;  [584] zh/ja 传令兵;  [585] zh/ja 米歇尔;  [586] zh/ja 御舆源一郎;  [587] zh/ja 御舆源次郎;  [588] zh/ja 千岩军教头;  [589] zh/ja 千岩军士兵;  [590] zh/ja 明博;  [591] zh/ja 明俊;  [592] zh/ja 美铃;  [593] zh/ja 美和;  [594] zh/ja 阿幸;  [595] zh/ja 削月筑阳真君;  [596] zh/ja 钱眼儿;  [597] zh/ja 森彦;  [598] zh/ja 元助;  [599] zh/ja 理水叠山真君;  [600] zh/ja 理水疊山真君;  [601] zh/ja 朱老板;  [602] zh/ja 木木;  [603] zh/ja 村上;  [604] zh/ja 村田;  [605] zh/ja 永野;  [606] zh/ja 长野原龙之介;  [607] zh/ja 长濑;  [608] zh/ja 中野志乃;  [609] zh/ja 菜菜子;  [610] zh/ja 楠楠;  [611] zh/ja 成濑;  [612] zh/ja 阿内;  [613] zh/ja 宁禄;  [614] zh/ja 牛志;  [615] zh/ja 信博;  [616] zh/ja 伸夫;  [617] zh/ja 野方;  [618] zh/ja 诺拉;  [619] zh/ja 纪香;  [620] zh/ja 诺曼;  [621] zh/ja 修女;  [622] zh/ja 纯水精灵;  [623] zh/ja 小川;  [624] zh/ja 小仓澪;  [625] zh/ja 冈林;  [626] zh/ja 冈崎绘里香;  [627] zh/ja 冈崎陆斗;  [628] zh/ja 奥拉夫;  [629] zh/ja 老科;  [630] zh/ja 鬼婆婆;  [631] zh/ja 小野寺;  [632] zh/ja 大河原五右卫门;  [633] zh/ja 大久保大介;  [634] zh/ja 大森;  [635] zh/ja 大助;  [636] zh/ja 奥特;  [637] zh/ja 派蒙;  [638] zh/ja 派蒙2;  [639] zh/ja 病人a;  [640] zh/ja 病人b;  [641] zh/ja 巴顿;  [642] zh/ja 派恩;  [643] zh/ja 朋义;  [644] zh/ja 围观群众;  [645] zh/ja 围观群众a;  [646] zh/ja 围观群众b;  [647] zh/ja 围观群众c;  [648] zh/ja 围观群众d;  [649] zh/ja 围观群众e;  [650] zh/ja 铜雀;  [651] zh/ja 阿肥;  [652] zh/ja 兴叔;  [653] zh/ja 老周叔;  [654] zh/ja 公主;  [655] zh/ja 彼得;  [656] zh/ja 乾子;  [657] zh/ja 芊芊;  [658] zh/ja 乾玮;  [659] zh/ja 绮命;  [660] zh/ja 杞平;  [661] zh/ja 秋月;  [662] zh/ja 昆恩;  [663] zh/ja 雷电影;  [664] zh/ja 兰道尔;  [665] zh/ja 雷蒙德;  [666] zh/ja 冒失的帕拉德;  [667] zh/ja 伶一;  [668] zh/ja 玲花;  [669] zh/ja 阿仁;  [670] zh/ja 家臣们;  [671] zh/ja 梨绘;  [672] zh/ja 荣江;  [673] zh/ja 戎世;  [674] zh/ja 浪人;  [675] zh/ja 罗伊斯;  [676] zh/ja 如意;  [677] zh/ja 凉子;  [678] zh/ja 彩香;  [679] zh/ja 酒井;  [680] zh/ja 坂本;  [681] zh/ja 朔次郎;  [682] zh/ja 武士a;  [683] zh/ja 武士b;  [684] zh/ja 武士c;  [685] zh/ja 武士d;  [686] zh/ja 珊瑚;  [687] zh/ja 三田;  [688] zh/ja 莎拉;  [689] zh/ja 笹野;  [690] zh/ja 聪美;  [691] zh/ja 聪;  [692] zh/ja 小百合;  [693] zh/ja 散兵;  [694] zh/ja 害怕的小刘;  [695] zh/ja 舒伯特;  [696] zh/ja 舒茨;  [697] zh/ja 海龙;  [698] zh/ja 世子;  [699] zh/ja 谢尔盖;  [700] zh/ja 家丁;  [701] zh/ja 商华;  [702] zh/ja 沙寅;  [703] zh/ja 阿升;  [704] zh/ja 柴田;  [705] zh/ja 阿茂;  [706] zh/ja 式大将;  [707] zh/ja 清水;  [708] zh/ja 志村勘兵卫;  [709] zh/ja 新之丞;  [710] zh/ja 志织;  [711] zh/ja 石头;  [712] zh/ja 诗羽;  [713] zh/ja 诗筠;  [714] zh/ja 石壮;  [715] zh/ja 翔太;  [716] zh/ja 正二;  [717] zh/ja 周平;  [718] zh/ja 舒杨;  [719] zh/ja 齐格芙丽雅;  [720] zh/ja 女士;  [721] zh/ja 思勤;  [722] zh/ja 六指乔瑟;  [723] zh/ja 愚人众小兵d;  [724] zh/ja 愚人众小兵a;  [725] zh/ja 愚人众小兵b;  [726] zh/ja 愚人众小兵c;  [727] zh/ja 吴老五;  [728] zh/ja 吴老二;  [729] zh/ja 滑头鬼;  [730] zh/ja 言笑;  [731] zh/ja 吴老七;  [732] zh/ja 士兵h;  [733] zh/ja 士兵i;  [734] zh/ja 士兵a;  [735] zh/ja 士兵b;  [736] zh/ja 士兵c;  [737] zh/ja 士兵d;  [738] zh/ja 士兵e;  [739] zh/ja 士兵f;  [740] zh/ja 士兵g;  [741] zh/ja 奏太;  [742] zh/ja 斯坦利;  [743] zh/ja 掇星攫辰天君;  [744] zh/ja 小头;  [745] zh/ja 大武;  [746] zh/ja 陶义隆;  [747] zh/ja 杉本;  [748] zh/ja 苏西;  [749] zh/ja 嫌疑人a;  [750] zh/ja 嫌疑人b;  [751] zh/ja 嫌疑人c;  [752] zh/ja 嫌疑人d;  [753] zh/ja 斯万;  [754] zh/ja 剑客a;  [755] zh/ja 剑客b;  [756] zh/ja 阿二;  [757] zh/ja 忠胜;  [758] zh/ja 忠夫;  [759] zh/ja 阿敬;  [760] zh/ja 孝利;  [761] zh/ja 鹰司进;  [762] zh/ja 高山;  [763] zh/ja 九条孝行;  [764] zh/ja 毅;  [765] zh/ja 竹内;  [766] zh/ja 拓真;  [767] zh/ja 卓也;  [768] zh/ja 太郎丸;  [769] zh/ja 泰勒;  [770] zh/ja 手岛;  [771] zh/ja 哲平;  [772] zh/ja 哲夫;  [773] zh/ja 托克;  [774] zh/ja 大boss;  [775] zh/ja 阿强;  [776] zh/ja 托尔德拉;  [777] zh/ja 旁观者;  [778] zh/ja 天成;  [779] zh/ja 阿大;  [780] zh/ja 蒂玛乌斯;  [781] zh/ja 提米;  [782] zh/ja 户田;  [783] zh/ja 阿三;  [784] zh/ja 一起的人;  [785] zh/ja 德田;  [786] zh/ja 德长;  [787] zh/ja 智树;  [788] zh/ja 利彦;  [789] zh/ja 胖乎乎的旅行者;  [790] zh/ja 藏宝人a;  [791] zh/ja 藏宝人b;  [792] zh/ja 藏宝人c;  [793] zh/ja 藏宝人d;  [794] zh/ja 阿祇;  [795] zh/ja 恒雄;  [796] zh/ja 露子;  [797] zh/ja 话剧团团长;  [798] zh/ja 内村;  [799] zh/ja 上野;  [800] zh/ja 上杉;  [801] zh/ja 老戴;  [802] zh/ja 老高;  [803] zh/ja 老贾;  [804] zh/ja 老墨;  [805] zh/ja 老孙;  [806] zh/ja 天枢星;  [807] zh/ja 老云;  [808] zh/ja 有乐斋;  [809] zh/ja 丑雄;  [810] zh/ja 乌维;  [811] zh/ja 瓦京;  [812] zh/ja 菲尔戈黛特;  [813] zh/ja 维多利亚;  [814] zh/ja 薇尔;  [815] zh/ja 瓦格纳;  [816] zh/ja 阿外;  [817] zh/ja 侍女;  [818] zh/ja 瓦拉;  [819] zh/ja 望雅;  [820] zh/ja 宛烟;  [821] zh/ja 琬玉;  [822] zh/ja 战士a;  [823] zh/ja 战士b;  [824] zh/ja 渡辺;  [825] zh/ja 渡部;  [826] zh/ja 阿伟;  [827] zh/ja 文璟;  [828] zh/ja 文渊;  [829] zh/ja 韦尔纳;  [830] zh/ja 王扳手;  [831] zh/ja 武沛;  [832] zh/ja 晓飞;  [833] zh/ja 辛程;  [834] zh/ja 星火;  [835] zh/ja 星稀;  [836] zh/ja 辛秀;  [837] zh/ja 秀华;  [838] zh/ja 阿旭;  [839] zh/ja 徐刘师;  [840] zh/ja 矢部;  [841] zh/ja 八木;  [842] zh/ja 山上;  [843] zh/ja 阿阳;  [844] zh/ja 颜笑;  [845] zh/ja 康明;  [846] zh/ja 泰久;  [847] zh/ja 安武;  [848] zh/ja 矢田幸喜;  [849] zh/ja 矢田辛喜;  [850] zh/ja 义坚;  [851] zh/ja 莺儿;  [852] zh/ja 盈丰;  [853] zh/ja 宜年;  [854] zh/ja 银杏;  [855] zh/ja 逸轩;  [856] zh/ja 横山;  [857] zh/ja 永贵;  [858] zh/ja 永业;  [859] zh/ja 嘉久;  [860] zh/ja 吉川;  [861] zh/ja 义高;  [862] zh/ja 用高;  [863] zh/ja 阳太;  [864] zh/ja 元蓉;  [865] zh/ja 玥辉;  [866] zh/ja 毓华;  [867] zh/ja 有香;  [868] zh/ja 幸也;  [869] zh/ja 由真;  [870] zh/ja 结菜;  [871] zh/ja 韵宁;  [872] zh/ja 百合;  [873] zh/ja 百合华;  [874] zh/ja 尤苏波夫;  [875] zh/ja 裕子;  [876] zh/ja 悠策;  [877] zh/ja 悠也;  [878] zh/ja 于嫣;  [879] zh/ja 柚子;  [880] zh/ja 老郑;  [881] zh/ja 正茂;  [882] zh/ja 志成;  [883] zh/ja 芷巧;  [884] zh/ja 知易;  [885] zh/ja 支支;  [886] zh/ja 周良;  [887] zh/ja 珠函;  [888] zh/ja 祝明;  [889] zh/ja 祝涛
</details>


![tips](https://raw.githubusercontent.com/raindrop213/AnonTranslator/main/img/cover.png)