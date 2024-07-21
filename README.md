# **AnonTranslator v1.1.0**
![tips](img/icon128.png)
<h3>
<ruby>千早<rt>ちはや</rt></ruby>
<ruby>愛音<rt>あのん</rt></ruby>
</h3>
A chrome extension for light novel reading

啃生肉工具，获取浏览器中的段落或句子，并复制到剪切板

**日文轻小说 - Chrome插件/扩展 - 烤肉**
![tips](img/preview3.png)

---

### **插件安装**
- [AnonTranslator](https://github.com/raindrop213/AnonTranslator)（直接 [Download ZIP](https://github.com/raindrop213/AnonTranslator/archive/refs/heads/main.zip)；Chrome打开开发者模式；加载已解压的扩展程序）
- [vitsTTS整合包](https://github.com/raindrop213/AnonTranslator/releases/latest)：
  下载解压后打开 <kbd>RD213.bat</kbd>（注：请避免路径中含中文，放在哪里都行。该 API 来自项目 [vits-simple-api](https://github.com/Artrajz/vits-simple-api) ，感谢该项目的开发人员！！！本整合包里面包含所需的模型。能力有限，无论如何都绕不开限制，就加了个api来桥接插件･ﾟ･(つд`ﾟ)･ﾟ･ 就是随意，能用就行）

### **使用场景**
1. 推荐配合 [Calibre-web](https://github.com/janeczku/calibre-web) 使用（当然使用它的前提是你已经用 [Calibre](https://calibre-ebook.com/) 存好电子书了，最好用的书籍管理软件！！！这里放一下我的[书库](https://ebook.raindrop213.info/)）；
2. 由于主要适配 Calibre-web，别的阅读器和网站不一定能用。插件默认提取网页中  \<p\> \<h1\> ~ \<h6\> \<img\>标签。这里放一个简单好用的阅读器 [ッツ Ebook Reader](https://reader.ttsu.app)

### **使用说明**
1. 点击 <kbd>Click</kbd> 文本段落就可以朗读和复制到剪切板；
2. 方向键 <kbd>↑</kbd> 上一段 和 <kbd>↓</kbd> 下一段，并触发复制和朗读，也对应备用键位 <kbd>Num 2</kbd> 和 <kbd>Num 1</kbd>；
3. 空格键 <kbd>Backspace</kbd> 自动读书，一段接一段播放；
4. 键盘 <kbd>Num 0</kbd> 或 <kbd>F1</kbd> 触发复制和朗读当前段落；
5. <kbd>鼠标中键</kbd> 复制和朗读高亮句子；

- 要恢复初始设置则重新加载插件。
- 通过剪切板可以搭配 [LunaTranslator](https://github.com/HIllya51/LunaTranslator)（多方翻译、语素分析、快速查词、Anki；推荐！）
- ※ 机器总是会犯错的，比如本插件中的用到的deepl效果就很差，youdao限速，建议用google。目前没有任何一款翻译器能完全正确翻译，即便是GPT4也时有翻错的；注音会出错；TTS也会出错；多去理解，多多查词，这只是个复制器/复读机，让你开始去读书。

https://github.com/raindrop213/AnonTranslator/assets/53202747/32f940ad-bf29-40da-ba10-a65f1fe166d6

### **常见问题**
1. ※ 当插件设置成 <kbd>在特定网站上</kbd> 时翻译会失效！<kbd>在所有网站上</kbd> 则没问题。还有个办法是在 <kbd>manifest.json</kbd> 中的 <code>matches</code> 中硬设置使用插件的网页。如：
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
2. vits怎么用？ 答：打开 RD213.bat ，等小黑窗出现 127.0.0.1:23456 说明能用，使用时请挂着别关。
3. 改键位？ 答：在src/content.js里的addMouseListener函数自行修改，附 [键位对照表](https://www.ecomcn.com/Website/show_id468.html)；

### **日文资源**
1. 在线阅读：各种在线网站都可以用，如 [カクヨム](https://kakuyomu.jp/)、[小説家になろう](https://syosetu.com/)。但在 [青空文庫](https://www.aozora.gr.jp/) 上面不能正常工作，因为是纯文本，没有标签（可使用 [AozoraZip2Mobi](https://github.com/ccneko-emitan/AozoraZip2Mobi) 制作青空文库的epub）；
2. 下载党：Z-Lib就不用多说了，那你也可能还知道安娜的档案和各种DLRaw网站；
3. 电子书购买：[bookwalker](https://bookwalker.jp/)、[Amazon](https://www.amazon.co.jp/kindle-dbs/storefront) 和 [Rakuten](https://books.rakuten.co.jp/e-book/) ，其中bookwalker解锁（DeDRM）稍难点，另外两个解锁相对简单一点，搜一搜就有了。

### **开发计划**
- ~~去除振假名（假名注音）~~
- ~~WindowsTTS~~
- ~~vitsTTS~~
- ~~自动朗读~~
- ~~翻译（Google、Youdao、DeepL）~~
- 词典（moji、weblio）
- 日本語形態素解析（MeCab）
- 联动Anki（提一下我另外写的一个小应用，除了普通文本内容，还能附带漫画截图：[anki-scene-memory](https://github.com/raindrop213/anki-scene-memory)）

---

**其他**
<details>
  <summary>推荐语音</summary>
  [342] zh/ja 日语雷电将军（泽城美雪）;
</details>

<details>
  <summary>vits整合包中可用语音</summary>
[0] zh/ja 特别周;
[1] zh/ja 无声铃鹿;
[2] zh/ja 东海帝皇（帝宝，帝王）;
[3] zh/ja 丸善斯基;
[4] zh/ja 富士奇迹;
[5] zh/ja 小栗帽;
[6] zh/ja 黄金船;
[7] zh/ja 伏特加;
[8] zh/ja 大和赤骥;
[9] zh/ja 大树快车;
[10] zh/ja 草上飞;
[11] zh/ja 菱亚马逊;
[12] zh/ja 目白麦昆;
[13] zh/ja 神鹰;
[14] zh/ja 好歌剧;
[15] zh/ja 成田白仁;
[16] zh/ja 鲁道夫象征（皇帝）;
[17] zh/ja 气槽;
[18] zh/ja 爱丽数码;
[19] zh/ja 星云天空;
[20] zh/ja 玉藻十字;
[21] zh/ja 美妙姿势;
[22] zh/ja 琵琶晨光;
[23] zh/ja 摩耶重炮;
[24] zh/ja 曼城茶座;
[25] zh/ja 美浦波旁;
[26] zh/ja 目白赖恩;
[27] zh/ja 菱曙;
[28] zh/ja 雪中美人;
[29] zh/ja 米浴;
[30] zh/ja 艾尼斯风神;
[31] zh/ja 爱丽速子（爱丽快子）;
[32] zh/ja 爱慕织姬;
[33] zh/ja 稻荷一;
[34] zh/ja 胜利奖券;
[35] zh/ja 空中神宫;
[36] zh/ja 荣进闪耀;
[37] zh/ja 真机伶;
[38] zh/ja 川上公主;
[39] zh/ja 黄金城（黄金城市）;
[40] zh/ja 樱花进王;
[41] zh/ja 采珠;
[42] zh/ja 新光风;
[43] zh/ja 东商变革;
[44] zh/ja 超级小海湾;
[45] zh/ja 醒目飞鹰（寄寄子）;
[46] zh/ja 荒漠英雄;
[47] zh/ja 东瀛佐敦;
[48] zh/ja 中山庆典;
[49] zh/ja 成田大进;
[50] zh/ja 西野花;
[51] zh/ja 春丽（乌拉拉）;
[52] zh/ja 青竹回忆;
[53] zh/ja 微光飞驹;
[54] zh/ja 美丽周日;
[55] zh/ja 待兼福来;
[56] zh/ja mr cb（cb先生）;
[57] zh/ja 名将怒涛（名将户仁）;
[58] zh/ja 目白多伯;
[59] zh/ja 优秀素质;
[60] zh/ja 帝王光辉;
[61] zh/ja 待兼诗歌剧;
[62] zh/ja 生野狄杜斯;
[63] zh/ja 目白善信;
[64] zh/ja 大拓太阳神;
[65] zh/ja 双涡轮（两立直，两喷射，二锅头，逆喷射）;
[66] zh/ja 里见光钻（萨托诺金刚石）;
[67] zh/ja 北部玄驹;
[68] zh/ja 樱花千代王;
[69] zh/ja 天狼星象征;
[70] zh/ja 目白阿尔丹;
[71] zh/ja 八重无敌;
[72] zh/ja 鹤丸刚志;
[73] zh/ja 目白光明;
[74] zh/ja 成田拜仁（成田路）;
[75] zh/ja 也文摄辉;
[76] zh/ja 小林历奇;
[77] zh/ja 北港火山;
[78] zh/ja 奇锐骏;
[79] zh/ja 苦涩糖霜;
[80] zh/ja 小小蚕茧;
[81] zh/ja 骏川手纲（绿帽恶魔）;
[82] zh/ja 秋川弥生（小小理事长）;
[83] zh/ja 乙名史悦子（乙名记者）;
[84] zh/ja 桐生院葵;
[85] zh/ja 安心泽刺刺美;
[86] zh/ja 樫本理子;
[87] zh/ja 神里绫华（龟龟）;
[88] zh/ja 琴;
[89] zh/ja 空（空哥）;
[90] zh/ja 丽莎;
[91] zh/ja 荧（荧妹）;
[92] zh/ja 芭芭拉;
[93] zh/ja 凯亚;
[94] zh/ja 迪卢克;
[95] zh/ja 雷泽;
[96] zh/ja 安柏;
[97] zh/ja 温迪;
[98] zh/ja 香菱;
[99] zh/ja 北斗;
[100] zh/ja 行秋;
[101] zh/ja 魈;
[102] zh/ja 凝光;
[103] zh/ja 可莉;
[104] zh/ja 钟离;
[105] zh/ja 菲谢尔（皇女）;
[106] zh/ja 班尼特;
[107] zh/ja 达达利亚（公子）;
[108] zh/ja 诺艾尔（女仆）;
[109] zh/ja 七七;
[110] zh/ja 重云;
[111] zh/ja 甘雨（椰羊）;
[112] zh/ja 阿贝多;
[113] zh/ja 迪奥娜（猫猫）;
[114] zh/ja 莫娜;
[115] zh/ja 刻晴;
[116] zh/ja 砂糖;
[117] zh/ja 辛焱;
[118] zh/ja 罗莎莉亚;
[119] zh/ja 胡桃;
[120] zh/ja 枫原万叶（万叶）;
[121] zh/ja 烟绯;
[122] zh/ja 宵宫;
[123] zh/ja 托马;
[124] zh/ja 优菈;
[125] zh/ja 雷电将军（雷神）;
[126] zh/ja 早柚;
[127] zh/ja 珊瑚宫心海（心海，扣扣米）;
[128] zh/ja 五郎;
[129] zh/ja 九条裟罗;
[130] zh/ja 荒泷一斗（一斗）;
[131] zh/ja 埃洛伊;
[132] zh/ja 申鹤;
[133] zh/ja 八重神子（神子）;
[134] zh/ja 神里绫人（绫人）;
[135] zh/ja 夜兰;
[136] zh/ja 久岐忍;
[137] zh/ja 鹿野苑平藏;
[138] zh/ja 提纳里;
[139] zh/ja 柯莱;
[140] zh/ja 多莉;
[141] zh/ja 云堇;
[142] zh/ja 纳西妲（草神）;
[143] zh/ja 深渊使徒;
[144] zh/ja 妮露;
[145] zh/ja 赛诺;
[146] zh/ja 债务处理人;
[147] zh/ja 坎蒂丝;
[148] zh/ja 真弓快车;
[149] zh/ja 秋人;
[150] zh/ja 望族;
[151] zh/ja 艾尔菲;
[152] zh/ja 艾莉丝;
[153] zh/ja 艾伦;
[154] zh/ja 阿洛瓦;
[155] zh/ja 天野;
[156] zh/ja 天目十五;
[157] zh/ja 愚人众-安德烈;
[158] zh/ja 安顺;
[159] zh/ja 安西;
[160] zh/ja 葵;
[161] zh/ja 青木;
[162] zh/ja 荒川幸次;
[163] zh/ja 荒谷;
[164] zh/ja 有泽;
[165] zh/ja 浅川;
[166] zh/ja 麻美;
[167] zh/ja 凝光助手;
[168] zh/ja 阿托;
[169] zh/ja 竺子;
[170] zh/ja 百识;
[171] zh/ja 百闻;
[172] zh/ja 百晓;
[173] zh/ja 白术;
[174] zh/ja 贝雅特丽奇;
[175] zh/ja 丽塔;
[176] zh/ja 失落迷迭;
[177] zh/ja 缭乱星棘;
[178] zh/ja 伊甸;
[179] zh/ja 伏特加女孩;
[180] zh/ja 狂热蓝调;
[181] zh/ja 莉莉娅;
[182] zh/ja 萝莎莉娅;
[183] zh/ja 八重樱;
[184] zh/ja 八重霞;
[185] zh/ja 卡莲;
[186] zh/ja 第六夜想曲;
[187] zh/ja 卡萝尔;
[188] zh/ja 姬子;
[189] zh/ja 极地战刃;
[190] zh/ja 布洛妮娅;
[191] zh/ja 次生银翼;
[192] zh/ja 理之律者%26希儿;
[193] zh/ja 理之律者;
[194] zh/ja 迷城骇兔;
[195] zh/ja 希儿;
[196] zh/ja 魇夜星渊;
[197] zh/ja 黑希儿;
[198] zh/ja 帕朵菲莉丝;
[199] zh/ja 不灭星锚;
[200] zh/ja 天元骑英;
[201] zh/ja 幽兰黛尔;
[202] zh/ja 派蒙bh3;
[203] zh/ja 爱酱;
[204] zh/ja 绯玉丸;
[205] zh/ja 德丽莎;
[206] zh/ja 月下初拥;
[207] zh/ja 朔夜观星;
[208] zh/ja 暮光骑士;
[209] zh/ja 格蕾修;
[210] zh/ja 留云借风真君;
[211] zh/ja 梅比乌斯;
[212] zh/ja 仿犹大;
[213] zh/ja 克莱因;
[214] zh/ja 圣剑幽兰黛尔;
[215] zh/ja 妖精爱莉;
[216] zh/ja 特斯拉zero;
[217] zh/ja 苍玄;
[218] zh/ja 若水;
[219] zh/ja 西琳;
[220] zh/ja 戴因斯雷布;
[221] zh/ja 贝拉;
[222] zh/ja 赤鸢;
[223] zh/ja 镇魂歌;
[224] zh/ja 渡鸦;
[225] zh/ja 人之律者;
[226] zh/ja 爱莉希雅;
[227] zh/ja 天穹游侠;
[228] zh/ja 琪亚娜;
[229] zh/ja 空之律者;
[230] zh/ja 薪炎之律者;
[231] zh/ja 云墨丹心;
[232] zh/ja 符华;
[233] zh/ja 识之律者;
[234] zh/ja 特瓦林;
[235] zh/ja 维尔薇;
[236] zh/ja 芽衣;
[237] zh/ja 雷之律者;
[238] zh/ja 断罪影舞;
[239] zh/ja 阿波尼亚;
[240] zh/ja 榎本;
[241] zh/ja 厄尼斯特;
[242] zh/ja 恶龙;
[243] zh/ja 范二爷;
[244] zh/ja 法拉;
[245] zh/ja 愚人众士兵;
[246] zh/ja 愚人众士兵a;
[247] zh/ja 愚人众士兵b;
[248] zh/ja 愚人众士兵c;
[249] zh/ja 愚人众a;
[250] zh/ja 愚人众b;
[251] zh/ja 飞飞;
[252] zh/ja 菲利克斯;
[253] zh/ja 女性跟随者;
[254] zh/ja 逢岩;
[255] zh/ja 摆渡人;
[256] zh/ja 狂躁的男人;
[257] zh/ja 奥兹;
[258] zh/ja 芙萝拉;
[259] zh/ja 跟随者;
[260] zh/ja 蜜汁生物;
[261] zh/ja 黄麻子;
[262] zh/ja 渊上;
[263] zh/ja 藤木;
[264] zh/ja 深见;
[265] zh/ja 福本;
[266] zh/ja 芙蓉;
[267] zh/ja 古泽;
[268] zh/ja 古田;
[269] zh/ja 古山;
[270] zh/ja 古谷昇;
[271] zh/ja 傅三儿;
[272] zh/ja 高老六;
[273] zh/ja 矿工冒;
[274] zh/ja 元太;
[275] zh/ja 德安公;
[276] zh/ja 茂才公;
[277] zh/ja 杰拉德;
[278] zh/ja 葛罗丽;
[279] zh/ja 金忽律;
[280] zh/ja 公俊;
[281] zh/ja 锅巴;
[282] zh/ja 歌德;
[283] zh/ja 阿豪;
[284] zh/ja 狗三儿;
[285] zh/ja 葛瑞丝;
[286] zh/ja 若心;
[287] zh/ja 阿山婆;
[288] zh/ja 怪鸟;
[289] zh/ja 广竹;
[290] zh/ja 观海;
[291] zh/ja 关宏;
[292] zh/ja 蜜汁卫兵;
[293] zh/ja 守卫1;
[294] zh/ja 傲慢的守卫;
[295] zh/ja 害怕的守卫;
[296] zh/ja 贵安;
[297] zh/ja 盖伊;
[298] zh/ja 阿创;
[299] zh/ja 哈夫丹;
[300] zh/ja 日语阿贝多（野岛健儿）;
[301] zh/ja 日语埃洛伊（高垣彩阳）;
[302] zh/ja 日语安柏（石见舞菜香）;
[303] zh/ja 日语神里绫华（早见沙织）;
[304] zh/ja 日语神里绫人（石田彰）;
[305] zh/ja 日语白术（游佐浩二）;
[306] zh/ja 日语芭芭拉（鬼头明里）;
[307] zh/ja 日语北斗（小清水亚美）;
[308] zh/ja 日语班尼特（逢坂良太）;
[309] zh/ja 日语坎蒂丝（柚木凉香）;
[310] zh/ja 日语重云（齐藤壮马）;
[311] zh/ja 日语柯莱（前川凉子）;
[312] zh/ja 日语赛诺（入野自由）;
[313] zh/ja 日语戴因斯雷布（津田健次郎）;
[314] zh/ja 日语迪卢克（小野贤章）;
[315] zh/ja 日语迪奥娜（井泽诗织）;
[316] zh/ja 日语多莉（金田朋子）;
[317] zh/ja 日语优菈（佐藤利奈）;
[318] zh/ja 日语菲谢尔（内田真礼）;
[319] zh/ja 日语甘雨（上田丽奈）;
[320] zh/ja 日语（畠中祐）;
[321] zh/ja 日语鹿野院平藏（井口祐一）;
[322] zh/ja 日语空（堀江瞬）;
[323] zh/ja 日语荧（悠木碧）;
[324] zh/ja 日语胡桃（高桥李依）;
[325] zh/ja 日语一斗（西川贵教）;
[326] zh/ja 日语凯亚（鸟海浩辅）;
[327] zh/ja 日语万叶（岛崎信长）;
[328] zh/ja 日语刻晴（喜多村英梨）;
[329] zh/ja 日语可莉（久野美咲）;
[330] zh/ja 日语心海（三森铃子）;
[331] zh/ja 日语九条裟罗（濑户麻沙美）;
[332] zh/ja 日语丽莎（田中理惠）;
[333] zh/ja 日语莫娜（小原好美）;
[334] zh/ja 日语纳西妲（田村由加莉）;
[335] zh/ja 日语妮露（金元寿子）;
[336] zh/ja 日语凝光（大原沙耶香）;
[337] zh/ja 日语诺艾尔（高尾奏音）;
[338] zh/ja 日语奥兹（增谷康纪）;
[339] zh/ja 日语派蒙（古贺葵）;
[340] zh/ja 日语琴（斋藤千和）;
[341] zh/ja 日语七七（田村由加莉）;
[342] zh/ja 日语雷电将军（泽城美雪）;
[343] zh/ja 日语雷泽（内山昂辉）;
[344] zh/ja 日语罗莎莉亚（加隈亚衣）;
[345] zh/ja 日语早柚（洲崎绫）;
[346] zh/ja 日语散兵（柿原彻也）;
[347] zh/ja 日语申鹤（川澄绫子）;
[348] zh/ja 日语久岐忍（水桥香织）;
[349] zh/ja 日语女士（庄子裕衣）;
[350] zh/ja 日语砂糖（藤田茜）;
[351] zh/ja 日语达达利亚（木村良平）;
[352] zh/ja 日语托马（森田成一）;
[353] zh/ja 日语提纳里（小林沙苗）;
[354] zh/ja 日语温迪（村濑步）;
[355] zh/ja 日语香菱（小泽亚李）;
[356] zh/ja 日语魈（松冈祯丞）;
[357] zh/ja 日语行秋（皆川纯子）;
[358] zh/ja 日语辛焱（高桥智秋）;
[359] zh/ja 日语八重神子（佐仓绫音）;
[360] zh/ja 日语烟绯（花守由美里）;
[361] zh/ja 日语夜兰（远藤绫）;
[362] zh/ja 日语宵宫（植田佳奈）;
[363] zh/ja 日语云堇（小岩井小鸟）;
[364] zh/ja 日语钟离（前野智昭）;
[365] zh/ja 杰克;
[366] zh/ja 阿吉;
[367] zh/ja 江舟;
[368] zh/ja 鉴秋;
[369] zh/ja 嘉义;
[370] zh/ja 纪芳;
[371] zh/ja 景澄;
[372] zh/ja 经纶;
[373] zh/ja 景明;
[374] zh/ja 晋优;
[375] zh/ja 阿鸠;
[376] zh/ja 酒客;
[377] zh/ja 乔尔;
[378] zh/ja 乔瑟夫;
[379] zh/ja 约顿;
[380] zh/ja 乔伊斯;
[381] zh/ja 居安;
[382] zh/ja 君君;
[383] zh/ja 顺吉;
[384] zh/ja 纯也;
[385] zh/ja 重佐;
[386] zh/ja 大岛纯平;
[387] zh/ja 蒲泽;
[388] zh/ja 勘解由小路健三郎;
[389] zh/ja 枫;
[390] zh/ja 枫原义庆;
[391] zh/ja 荫山;
[392] zh/ja 甲斐田龍馬;
[393] zh/ja 海斗;
[394] zh/ja 惟神晴之介;
[395] zh/ja 鹿野奈奈;
[396] zh/ja 卡琵莉亚;
[397] zh/ja 凯瑟琳;
[398] zh/ja 加藤信悟;
[399] zh/ja 加藤洋平;
[400] zh/ja 胜家;
[401] zh/ja 茅葺一庆;
[402] zh/ja 和昭;
[403] zh/ja 一正;
[404] zh/ja 一道;
[405] zh/ja 桂一;
[406] zh/ja 庆次郎;
[407] zh/ja 阿贤;
[408] zh/ja 健司;
[409] zh/ja 健次郎;
[410] zh/ja 健三郎;
[411] zh/ja 天理;
[412] zh/ja 杀手a;
[413] zh/ja 杀手b;
[414] zh/ja 木南杏奈;
[415] zh/ja 木村;
[416] zh/ja 国王;
[417] zh/ja 木下;
[418] zh/ja 北村;
[419] zh/ja 清惠;
[420] zh/ja 清人;
[421] zh/ja 克列门特;
[422] zh/ja 骑士;
[423] zh/ja 小林;
[424] zh/ja 小春;
[425] zh/ja 康拉德;
[426] zh/ja 大肉丸;
[427] zh/ja 琴美;
[428] zh/ja 宏一;
[429] zh/ja 康介;
[430] zh/ja 幸德;
[431] zh/ja 高善;
[432] zh/ja 梢;
[433] zh/ja 克罗索;
[434] zh/ja 久保;
[435] zh/ja 九条镰治;
[436] zh/ja 久木田;
[437] zh/ja 昆钧;
[438] zh/ja 菊地君;
[439] zh/ja 久利须;
[440] zh/ja 黑田;
[441] zh/ja 黑泽京之介;
[442] zh/ja 响太;
[443] zh/ja 岚姐;
[444] zh/ja 兰溪;
[445] zh/ja 澜阳;
[446] zh/ja 劳伦斯;
[447] zh/ja 乐明;
[448] zh/ja 莱诺;
[449] zh/ja 莲;
[450] zh/ja 良子;
[451] zh/ja 李当;
[452] zh/ja 李丁;
[453] zh/ja 小乐;
[454] zh/ja 灵;
[455] zh/ja 小玲;
[456] zh/ja 琳琅a;
[457] zh/ja 琳琅b;
[458] zh/ja 小彬;
[459] zh/ja 小德;
[460] zh/ja 小楽;
[461] zh/ja 小龙;
[462] zh/ja 小吴;
[463] zh/ja 小吴的记忆;
[464] zh/ja 理正;
[465] zh/ja 阿龙;
[466] zh/ja 卢卡;
[467] zh/ja 洛成;
[468] zh/ja 罗巧;
[469] zh/ja 北风狼;
[470] zh/ja 卢正;
[471] zh/ja 萍姥姥;
[472] zh/ja 前田;
[473] zh/ja 真昼;
[474] zh/ja 麻纪;
[475] zh/ja 真;
[476] zh/ja 愚人众-马克西姆;
[477] zh/ja 女性a;
[478] zh/ja 女性b;
[479] zh/ja 女性a的跟随者;
[480] zh/ja 阿守;
[481] zh/ja 玛格丽特;
[482] zh/ja 真理;
[483] zh/ja 玛乔丽;
[484] zh/ja 玛文;
[485] zh/ja 正胜;
[486] zh/ja 昌信;
[487] zh/ja 将司;
[488] zh/ja 正人;
[489] zh/ja 路爷;
[490] zh/ja 老章;
[491] zh/ja 松田;
[492] zh/ja 松本;
[493] zh/ja 松浦;
[494] zh/ja 松坂;
[495] zh/ja 老孟;
[496] zh/ja 孟丹;
[497] zh/ja 商人随从;
[498] zh/ja 传令兵;
[499] zh/ja 米歇尔;
[500] zh/ja 御舆源一郎;
[501] zh/ja 御舆源次郎;
[502] zh/ja 千岩军教头;
[503] zh/ja 千岩军士兵;
[504] zh/ja 明博;
[505] zh/ja 明俊;
[506] zh/ja 美铃;
[507] zh/ja 美和;
[508] zh/ja 阿幸;
[509] zh/ja 削月筑阳真君;
[510] zh/ja 钱眼儿;
[511] zh/ja 森彦;
[512] zh/ja 元助;
[513] zh/ja 理水叠山真君;
[514] zh/ja 理水疊山真君;
[515] zh/ja 朱老板;
[516] zh/ja 木木;
[517] zh/ja 村上;
[518] zh/ja 村田;
[519] zh/ja 永野;
[520] zh/ja 长野原龙之介;
[521] zh/ja 长濑;
[522] zh/ja 中野志乃;
[523] zh/ja 菜菜子;
[524] zh/ja 楠楠;
[525] zh/ja 成濑;
[526] zh/ja 阿内;
[527] zh/ja 宁禄;
[528] zh/ja 牛志;
[529] zh/ja 信博;
[530] zh/ja 伸夫;
[531] zh/ja 野方;
[532] zh/ja 诺拉;
[533] zh/ja 纪香;
[534] zh/ja 诺曼;
[535] zh/ja 修女;
[536] zh/ja 纯水精灵;
[537] zh/ja 小川;
[538] zh/ja 小仓澪;
[539] zh/ja 冈林;
[540] zh/ja 冈崎绘里香;
[541] zh/ja 冈崎陆斗;
[542] zh/ja 奥拉夫;
[543] zh/ja 老科;
[544] zh/ja 鬼婆婆;
[545] zh/ja 小野寺;
[546] zh/ja 大河原五右卫门;
[547] zh/ja 大久保大介;
[548] zh/ja 大森;
[549] zh/ja 大助;
[550] zh/ja 奥特;
[551] zh/ja 派蒙;
[552] zh/ja 派蒙2;
[553] zh/ja 病人a;
[554] zh/ja 病人b;
[555] zh/ja 巴顿;
[556] zh/ja 派恩;
[557] zh/ja 朋义;
[558] zh/ja 围观群众;
[559] zh/ja 围观群众a;
[560] zh/ja 围观群众b;
[561] zh/ja 围观群众c;
[562] zh/ja 围观群众d;
[563] zh/ja 围观群众e;
[564] zh/ja 铜雀;
[565] zh/ja 阿肥;
[566] zh/ja 兴叔;
[567] zh/ja 老周叔;
[568] zh/ja 公主;
[569] zh/ja 彼得;
[570] zh/ja 乾子;
[571] zh/ja 芊芊;
[572] zh/ja 乾玮;
[573] zh/ja 绮命;
[574] zh/ja 杞平;
[575] zh/ja 秋月;
[576] zh/ja 昆恩;
[577] zh/ja 雷电影;
[578] zh/ja 兰道尔;
[579] zh/ja 雷蒙德;
[580] zh/ja 冒失的帕拉德;
[581] zh/ja 伶一;
[582] zh/ja 玲花;
[583] zh/ja 阿仁;
[584] zh/ja 家臣们;
[585] zh/ja 梨绘;
[586] zh/ja 荣江;
[587] zh/ja 戎世;
[588] zh/ja 浪人;
[589] zh/ja 罗伊斯;
[590] zh/ja 如意;
[591] zh/ja 凉子;
[592] zh/ja 彩香;
[593] zh/ja 酒井;
[594] zh/ja 坂本;
[595] zh/ja 朔次郎;
[596] zh/ja 武士a;
[597] zh/ja 武士b;
[598] zh/ja 武士c;
[599] zh/ja 武士d;
[600] zh/ja 珊瑚;
[601] zh/ja 三田;
[602] zh/ja 莎拉;
[603] zh/ja 笹野;
[604] zh/ja 聪美;
[605] zh/ja 聪;
[606] zh/ja 小百合;
[607] zh/ja 散兵;
[608] zh/ja 害怕的小刘;
[609] zh/ja 舒伯特;
[610] zh/ja 舒茨;
[611] zh/ja 海龙;
[612] zh/ja 世子;
[613] zh/ja 谢尔盖;
[614] zh/ja 家丁;
[615] zh/ja 商华;
[616] zh/ja 沙寅;
[617] zh/ja 阿升;
[618] zh/ja 柴田;
[619] zh/ja 阿茂;
[620] zh/ja 式大将;
[621] zh/ja 清水;
[622] zh/ja 志村勘兵卫;
[623] zh/ja 新之丞;
[624] zh/ja 志织;
[625] zh/ja 石头;
[626] zh/ja 诗羽;
[627] zh/ja 诗筠;
[628] zh/ja 石壮;
[629] zh/ja 翔太;
[630] zh/ja 正二;
[631] zh/ja 周平;
[632] zh/ja 舒杨;
[633] zh/ja 齐格芙丽雅;
[634] zh/ja 女士;
[635] zh/ja 思勤;
[636] zh/ja 六指乔瑟;
[637] zh/ja 愚人众小兵d;
[638] zh/ja 愚人众小兵a;
[639] zh/ja 愚人众小兵b;
[640] zh/ja 愚人众小兵c;
[641] zh/ja 吴老五;
[642] zh/ja 吴老二;
[643] zh/ja 滑头鬼;
[644] zh/ja 言笑;
[645] zh/ja 吴老七;
[646] zh/ja 士兵h;
[647] zh/ja 士兵i;
[648] zh/ja 士兵a;
[649] zh/ja 士兵b;
[650] zh/ja 士兵c;
[651] zh/ja 士兵d;
[652] zh/ja 士兵e;
[653] zh/ja 士兵f;
[654] zh/ja 士兵g;
[655] zh/ja 奏太;
[656] zh/ja 斯坦利;
[657] zh/ja 掇星攫辰天君;
[658] zh/ja 小头;
[659] zh/ja 大武;
[660] zh/ja 陶义隆;
[661] zh/ja 杉本;
[662] zh/ja 苏西;
[663] zh/ja 嫌疑人a;
[664] zh/ja 嫌疑人b;
[665] zh/ja 嫌疑人c;
[666] zh/ja 嫌疑人d;
[667] zh/ja 斯万;
[668] zh/ja 剑客a;
[669] zh/ja 剑客b;
[670] zh/ja 阿二;
[671] zh/ja 忠胜;
[672] zh/ja 忠夫;
[673] zh/ja 阿敬;
[674] zh/ja 孝利;
[675] zh/ja 鹰司进;
[676] zh/ja 高山;
[677] zh/ja 九条孝行;
[678] zh/ja 毅;
[679] zh/ja 竹内;
[680] zh/ja 拓真;
[681] zh/ja 卓也;
[682] zh/ja 太郎丸;
[683] zh/ja 泰勒;
[684] zh/ja 手岛;
[685] zh/ja 哲平;
[686] zh/ja 哲夫;
[687] zh/ja 托克;
[688] zh/ja 大boss;
[689] zh/ja 阿强;
[690] zh/ja 托尔德拉;
[691] zh/ja 旁观者;
[692] zh/ja 天成;
[693] zh/ja 阿大;
[694] zh/ja 蒂玛乌斯;
[695] zh/ja 提米;
[696] zh/ja 户田;
[697] zh/ja 阿三;
[698] zh/ja 一起的人;
[699] zh/ja 德田;
[700] zh/ja 德长;
[701] zh/ja 智树;
[702] zh/ja 利彦;
[703] zh/ja 胖乎乎的旅行者;
[704] zh/ja 藏宝人a;
[705] zh/ja 藏宝人b;
[706] zh/ja 藏宝人c;
[707] zh/ja 藏宝人d;
[708] zh/ja 阿祇;
[709] zh/ja 恒雄;
[710] zh/ja 露子;
[711] zh/ja 话剧团团长;
[712] zh/ja 内村;
[713] zh/ja 上野;
[714] zh/ja 上杉;
[715] zh/ja 老戴;
[716] zh/ja 老高;
[717] zh/ja 老贾;
[718] zh/ja 老墨;
[719] zh/ja 老孙;
[720] zh/ja 天枢星;
[721] zh/ja 老云;
[722] zh/ja 有乐斋;
[723] zh/ja 丑雄;
[724] zh/ja 乌维;
[725] zh/ja 瓦京;
[726] zh/ja 菲尔戈黛特;
[727] zh/ja 维多利亚;
[728] zh/ja 薇尔;
[729] zh/ja 瓦格纳;
[730] zh/ja 阿外;
[731] zh/ja 侍女;
[732] zh/ja 瓦拉;
[733] zh/ja 望雅;
[734] zh/ja 宛烟;
[735] zh/ja 琬玉;
[736] zh/ja 战士a;
[737] zh/ja 战士b;
[738] zh/ja 渡辺;
[739] zh/ja 渡部;
[740] zh/ja 阿伟;
[741] zh/ja 文璟;
[742] zh/ja 文渊;
[743] zh/ja 韦尔纳;
[744] zh/ja 王扳手;
[745] zh/ja 武沛;
[746] zh/ja 晓飞;
[747] zh/ja 辛程;
[748] zh/ja 星火;
[749] zh/ja 星稀;
[750] zh/ja 辛秀;
[751] zh/ja 秀华;
[752] zh/ja 阿旭;
[753] zh/ja 徐刘师;
[754] zh/ja 矢部;
[755] zh/ja 八木;
[756] zh/ja 山上;
[757] zh/ja 阿阳;
[758] zh/ja 颜笑;
[759] zh/ja 康明;
[760] zh/ja 泰久;
[761] zh/ja 安武;
[762] zh/ja 矢田幸喜;
[763] zh/ja 矢田辛喜;
[764] zh/ja 义坚;
[765] zh/ja 莺儿;
[766] zh/ja 盈丰;
[767] zh/ja 宜年;
[768] zh/ja 银杏;
[769] zh/ja 逸轩;
[770] zh/ja 横山;
[771] zh/ja 永贵;
[772] zh/ja 永业;
[773] zh/ja 嘉久;
[774] zh/ja 吉川;
[775] zh/ja 义高;
[776] zh/ja 用高;
[777] zh/ja 阳太;
[778] zh/ja 元蓉;
[779] zh/ja 玥辉;
[780] zh/ja 毓华;
[781] zh/ja 有香;
[782] zh/ja 幸也;
[783] zh/ja 由真;
[784] zh/ja 结菜;
[785] zh/ja 韵宁;
[786] zh/ja 百合;
[787] zh/ja 百合华;
[788] zh/ja 尤苏波夫;
[789] zh/ja 裕子;
[790] zh/ja 悠策;
[791] zh/ja 悠也;
[792] zh/ja 于嫣;
[793] zh/ja 柚子;
[794] zh/ja 老郑;
[795] zh/ja 正茂;
[796] zh/ja 志成;
[797] zh/ja 芷巧;
[798] zh/ja 知易;
[799] zh/ja 支支;
[800] zh/ja 周良;
[801] zh/ja 珠函;
[802] zh/ja 祝明;
[803] zh/ja 祝涛 
</details>

![tips](img/img2.png)
