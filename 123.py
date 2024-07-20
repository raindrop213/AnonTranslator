<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Setting</title>
    <!-- <link rel="stylesheet" href="css/popup.css" /> -->
    <style>
      body {
        margin: 10px;
        padding: 5px;
        width: 400px;
      }

      .settings {
        margin: 5px;
      }

      input[type="text"] {
        width: 100%; /* 这里设置宽度 */
      }

      .save {
        font-size: 20px;
        color: #0a6b32;
        font-family: Georgia, 'Times New Roman', Times, serif;
        position: fixed; /* 固定位置 */
        top: 10px; /* 距离顶部10px */
        right: 10px; /* 距离右边10px */
        z-index: 1000; /* 确保按钮在最上层 */
      }
      .gift {
        height: 270px;
      }

      kbd {
        background-color: #0a6b32;
        color: white; /* 文字颜色为白色 */
        border: 2px solid #064a22; /* 深绿色边框 */
        border-radius: 4px; /* 圆角 */
        padding: 2px 6px; /* 内边距 */
        font-family: "Courier New", Courier, monospace; /* 等宽字体 */
      }

      /* 基本开关样式 */
      .switch {
        position: relative;
        display: inline-block;
        width: 70px;
        height: 34px;
      }

      /* 隐藏默认的checkbox */
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      /* 自定义滑块 */
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
      }

      .slider:before {
        position: absolute;
        content: "";
        height: 26px;
        width: 26px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
      }

      input:checked + .slider {
        background-color: #1c72e2;
      }

      input:focus + .slider {
        box-shadow: 0 0 1px #1c72e2;
      }

      input:checked + .slider:before {
        transform: translateX(35px);
      }

      /* 圆角滑块 */
      .slider.round {
        border-radius: 5px;
      }

      .slider.round:before {
        border-radius: 3px;
      }

      /* ON和OFF文字样式 */
      .slider .on,
      .slider .off {
        color: white;
        position: absolute;
        transform: translateY(-50%);
        top: 50%;
        font-size: 12px;
        font-family: Arial, sans-serif;
      }

      .slider .on {
        left: 10px;
        opacity: 0;
      }

      .slider .off {
        right: 10px;
        opacity: 1;
      }

      /* 当开关选中时改变文字的显示 */
      input:checked + .slider .on {
        opacity: 1;
      }

      input:checked + .slider .off {
        opacity: 0;
      }

      .text-h1 {
        font-size: 13px;
        color: #1ec2b4;
        font-family: Georgia, 'Times New Roman', Times, serif;
        margin-bottom: 0;
      }

      .text-s1 {
        font-size: 10px;
        color: #bdbdbd;
        margin: 5px 0;
      }

      .text-s2 {
        font-size: 10px;
        text-align: right;
        color: #bdbdbd;
        margin: 5px 0;
      }

      .tab {
        display: none;
      }

      .tab:checked + label + .tab-content {
        display: block;
      }

      .tabs {
        display: flex;
        flex-direction: column;
      }

      .tab-label {
        display: block;
        cursor: pointer;
        padding: 10px;
        margin-top: 5px;
        border: 1px solid #ccc;
        background-color: #3a7452;
        color: #ffffff;
      }

      .tab-label:hover {
        background-color: #0a6b32;
      }

      .tab-label-color {
        background-color: #8d8d8d;
      }

      .tab-label-color:hover {
        background-color: #636363;
      }

      .tab-content {
        display: none;
        border: 1px solid #ccc;
        margin-bottom: 5px;
        padding: 10px;
      }
    </style>
  </head>
  <body>
    <form id="settingsForm">
      <div class="settings">
        <label class="switch">
          <input type="checkbox" id="toggleSwitch" />
          <span class="slider round">
            <span class="on">ON</span>
            <span class="off">OFF</span>
          </span>
        </label>
      </div>

      <div class="settings">
        <p class="text-h1" id="extension-version"></p>
        <p class="text-s1" id="extension-author"></p>
      </div>
      <hr />

      <div class="tabs">
        <!-- Copy Tab -->
        <input type="radio" id="tab1" name="tab" class="tab" checked />
        <label for="tab1" class="tab-label">Copy <input type="checkbox" id="copy" class="title-switch" /></label>
        <div class="tab-content">
          <div class="settings">
            <label>Ignore Furigana: 忽略振假名 <input type="checkbox" id="ignoreFurigana" /></label>
          </div>
          <div class="settings">
            <label for="symbolPairs">Paragraph SymbolPairs: 忽略首尾符号对</label>
            <input type="text" id="symbolPairs" />
          </div>
          <div class="settings">
            <label for="sentenceDelimiters">Sentence Delimiters: 断句符号</label>
            <input type="text" id="sentenceDelimiters" />
          </div>
          <div class="settings">
            <label>Sentence Segmentation Threshold: 断句的字数阈值<input type="text" id="sentenceThreshold" /></label>
          </div>
        </div>

        <!-- TTS Tab -->
        <input type="radio" id="tab2" name="tab" class="tab" />
        <label for="tab2" class="tab-label">TTS</label>
        <div class="tab-content">
          <input type="radio" id="tabWindows" name="ttsTab" class="tab" checked />
          <label for="tabWindows" class="tab-label tab-label-color">Windows TTS <input type="checkbox" id="useWindowsTTS" class="title-switch" /></label>
          <div class="tab-content">
            <div class="settings">
              <label for="winVoice">Voice: 人物</label>
              <select id="winVoice"></select>
            </div>
            <div class="settings">
              <label for="rate">Rate (0 - 2): 语速</label>
              <input type="range" id="rate" min="0" max="2" step="0.1" />
            </div>
            <div class="settings">
              <label for="pitch">Pitch (0 - 2): 音调</label>
              <input type="range" id="pitch" min="0" max="2" step="0.1" />
            </div>
          </div>

          <input type="radio" id="tabVits" name="ttsTab" class="tab" />
          <label for="tabVits" class="tab-label tab-label-color">VITS TTS <input type="checkbox" id="useVITS" class="title-switch" /></label>
          <div class="tab-content">
            <div class="settings">
              需要下载：<a href="https://github.com/raindrop213/AnonTranslator/releases" target="_blank">vitsTTS整合包</a>
            </div>
            <div class="settings">
              <label for="clipAPI">API Clip: 桥接插件与vits的端口<input type="text" id="clipAPI"/></label>
            </div>
            <div class="settings">
              <label for="vitsAPI">API VITS: vits语音合成的端口<input type="text" id="vitsAPI"/></label>
            </div>
            <div class="settings">
              <label for="vitsVoice">Voice: 人物</label>
              <select id="vitsVoice"></select>
            </div>
            <div class="settings">
              <label for="vitsLang">Language: 语言</label>
              <select id="vitsLang">
                <option value="auto">auto</option>
                <option value="ja">ja</option>
                <option value="zh">zh</option>
              </select>
            </div>
            <div class="settings">
              <label for="length">Length (0 - 2): 语速</label>
              <input type="range" id="length" min="0" max="2" step="0.1"/>
            </div>
            <div class="settings">
              <label for="noise">Noise: 声音随机性</label>
              <input type="text" id="noise"/>
            </div>
            <div class="settings">
              <label for="noisew">NoiseW: 随机发声时长</label>
              <input type="text" id="noisew"/>
            </div>
            <div class="settings">
              <label for="max">Max: 文字分段处理阈值</label>
              <input type="text" id="max"/>
            </div>
            <div class="settings">
              <label>Streaming 流式传输 <input type="checkbox" id="streaming"/></label>
            </div>
          </div>
        </div>

        <!-- Translator Tab -->
        <input type="radio" id="tab3" name="tab" class="tab" />
        <label for="tab3" class="tab-label">Translator</label>
        <div class="tab-content">
          <input type="radio" id="tabgoogle" name="translatorTab" class="tab" checked />
          <label for="tabgoogle" class="tab-label tab-label-color">Google <input type="checkbox" id="google" checked /></label>
          <div class="tab-content">
            <div class="settings">
              <label>Google Color: <input type="color" id="googleColor" /></label>
            </div>
            <div class="settings">
              <label>From: 
                <select id="googleFrom">
                  <option value="auto">auto</option>
                  <option value="zh-CN">zh</option>
                  <option value="zh-TW">cht</option>
                  <option value="ja">ja</option>
                  <option value="en">en</option>
                </select>
              </label>
            </div>
            <div class="settings">
              <label>To: 
                <select id="googleTo">
                  <option value="zh-CN">zh</option>
                  <option value="zh-TW">cht</option>
                  <option value="ja">ja</option>
                  <option value="en">en</option>
                </select>
              </label>
            </div>
          </div>

          <input type="radio" id="tabDeepl" name="translatorTab" class="tab" checked />
          <label for="tabDeepl" class="tab-label tab-label-color">Deepl <input type="checkbox" id="deepl" checked /></label>
          <div class="tab-content">
            <div class="settings">
              <label>Deepl Color: <input type="color" id="deeplColor" /></label>
            </div>
            <div class="settings">
              <label>From: 
                <select id="deeplFrom">
                  <option value="auto">auto</option>
                  <option value="JA">ja</option>
                  <option value="EN">en</option>
                  <option value="ZH">zh</option>
                </select>
              </label>
            </div>
            <div class="settings">
              <label>To: 
                <select id="deeplTo">
                  <option value="ZH">zh</option>
                  <option value="JA">ja</option>
                  <option value="EN">en</option>
                </select>
              </label>
            </div>
          </div>

          <input type="radio" id="tabYoudao" name="translatorTab" class="tab" checked />
          <label for="tabYoudao" class="tab-label tab-label-color">Youdao <input type="checkbox" id="youdao" checked /></label>
          <div class="tab-content">
            <div class="settings">
              <label>Youdao Color: <input type="color" id="youdaoColor" /></label>
            </div>
            <div class="settings">
              <label>From: 
                <select id="youdaoFrom">
                  <option value="auto">auto</option>
                  <option value="ja">ja</option>
                  <option value="en">en</option>
                  <option value="zh-CHS">zh</option>
                  <option value="zh-CHT">cht</option>
                </select>
              </label>
            </div>
            <div class="settings">
              <label>To: 
                <select id="youdaoTo">
                  <option value="zh-CHS">zh</option>
                  <option value="zh-CHT">cht</option>
                  <option value="ja">ja</option>
                  <option value="en">en</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <!-- Style Tab -->
        <input type="radio" id="tab4" name="tab" class="tab" />
        <label for="tab4" class="tab-label">Style</label>
        <div class="tab-content">
          <div class="settings">
            <label>Border Width: <input type="text" id="borderWidth" /></label>
          </div>
          <div class="settings">
            <label>Border Style:
                <select id="borderStyle">
                <option value="none">None</option>
                <option value="solid">Solid</option>
                <option value="dotted">Dotted</option>
                <option value="dashed">Dashed</option>
                <option value="double">Double</option>
                <option value="groove">Groove</option>
                <option value="ridge">Ridge</option>
                <option value="inset">Inset</option>
                <option value="outset">Outset</option>
                </select>
            </label>
          </div>
          <div class="settings">
            <label>Border Radius: <input type="text" id="borderRadius" /></label>
          </div>
          <div class="settings">
            <label>Free Border Color: 指示框 <input type="color" id="freeBorderColor"/></label>
          </div>
          <div class="settings">
            <label>Selected Border Color: 被选中的框 <input type="color" id="selectedBorderColor"/></label>
          </div>
          <div class="settings">
            <label>Selected Sentence Color: 被选中的句子 <input type="color" id="sentenceColor"/></label>
          </div>
          <div class="settings">
            <label>Fade away: 延迟消失(ms) <input type="text" id="fade" /></label>
          </div>
          <div class="settings">
            <label>Scroll into view: 跳转到激活标签的过程 
              <select id="scrollIntoView">
                <option value="smooth">smooth</option>
                <option value="instant">instant</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Guide Tab -->
        <input type="radio" id="tab5" name="tab" class="tab" />
        <label for="tab5" class="tab-label">Guide</label>
        <div class="tab-content">
          <div>
            <h2>使用说明</h2>
            <p>① 点击 <kbd>Click</kbd> 文本段落就可以朗读和复制到剪切板；</p>
            <p>② 键盘方向键 <kbd>↑</kbd> 上一段 和 <kbd>↓</kbd> 下一段，并触发复制和朗读；</p>
            <p>③ 空格键 <kbd>Backspace</kbd> 自动读书，一段接一段播放；</p>
            <p>④ 键盘 <kbd>Num 0</kbd> 或 <kbd>F1</kbd> 触发复制和朗读当前段落；</p>
            <p>⑤ <kbd>鼠标中键</kbd> 复制和朗读高亮句子；</p>
            <br>
            <p>详细使用文档请浏览该项目<a href="https://github.com/raindrop213/AnonTranslator" target="_blank">仓库↗</a></p>
            <img src="img/gift.jpg" alt="感谢感谢！！！" class="gift">
          </div>
        </div>
        
      </div>
      <br>
      <button class="save" type="submit">Save Settings</button>
    </form>

    <script src="src/popup.js"></script>
  </body>
</html>


这是Chrome插件的popup窗口，当我重新打开的时候我希望可以在上一次退出的界面，还有google、Deepl、youdao这样的二级窗口是可以同时打开的，而不是像现在那样只能开一个。