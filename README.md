# AnonTranslator

用于阅读日文小说的段落复制、系统语音 / VITS / 火山语音朗读与多服务翻译工具。Chrome 扩展和 Tampermonkey 油猴脚本共用核心代码和设置界面。

## 快速使用

需要 Node.js 18 或更高版本。构建无需安装 npm 依赖：

```sh
npm run build
```

生成两个发行目标：

- **Chrome**：在 `chrome://extensions` 开启开发者模式，加载 `dist/chrome` 目录。
- **油猴**：安装 Tampermonkey，将 `dist/userscript/AnonTranslator.user.js` 的内容粘贴进新脚本并保存；在油猴菜单中选择 **AnonTranslator 设置**。

**已有 Chrome 扩展升级**：如果此前加载的就是这个项目目录，请构建后在扩展管理页面点击“重新加载”，继续使用原目录。构建会在项目根目录生成兼容入口 `manifest.json`，保留同一路径的扩展 ID，设置保存在 `chrome.storage.local`。随后刷新阅读页面。改为加载 `dist/chrome` 会被当成另一个未打包扩展，两者设置不会自动互通。

首次使用在设置中启用阅读工具。设置自动保存：开关、颜色和滑块实时更新，文本和数字输入有效时立即保存，无效输入保留上次有效值。断句按设置的标点逐句进行，不再按字数把多个句子合并。语音参数用于下一次朗读。

## 操作

| 操作 | 功能 |
| --- | --- |
| 左键点击段落 | 复制、朗读、翻译 |
| 右键点击句子 | 选中、复制、朗读、翻译该句 |
| ↑ / 2 / Num 2 | 上一段 |
| ↓ / 1 / Num 1 | 下一段 |
| 5 / Num 5 | 上一句 |
| 4 / Num 4 | 下一句 |
| F1 / Num 0 | 重读当前段落 |
| 空格 | 按当前句子 / 段落模式开始或停止自动阅读 |
| Esc | 停止朗读与自动阅读 |

左键切到段落模式：实线边框标记整段，操作整段文本，译文放在段落末尾。右键切到句子模式：所在段落使用虚线作为上下文，选中句子持续显示背景高亮，不再描边，操作该句文本，译文紧跟该句。鼠标移开后选中标记仍保留。

“忽略首尾符号对”现有独立开关，默认关闭；开启后才应用自定义符号对。“语音”栏统一包含系统语音、VITS 和火山语音，三个开关互斥；开启一个会自动关闭另外两个，也可以全部关闭。“把段落切成句子”默认开启：整段仍按段落复制、翻译和导航，朗读时依次合成并播放每句话，背景高亮跟随当前语音；关闭则一次朗读整段。停止或重新选择会取消后续句子的播放。

设置顶部使用 `docs/images/img2.jpg`（ON）与 `img3.jpg`（OFF），构建时内嵌到两个平台的设置界面，无需访问外部图片。直接点击图片右下角的 ON/OFF 文字切换总开关，透明点击区域随图片缩放，也可用键盘 Tab 聚焦后按空格切换。版本号从 `package.json` 自动生成；右上角太阳 / 月亮按钮切换主题，重置按钮经弹窗确认恢复全部默认设置并关闭工具。栏目条使用红色。

设置面板背景随亮暗模式切换。外观栏每行提供两个独立色块，左侧为日间、右侧为夜间；旧颜色保留为日间颜色。网页本身的背景由阅读网站控制。正常保存不显示文字提示，无效输入或保存失败仍显示原因。复制内容提示没有背景，文字为半透明。句子译文与段落译文一样，每个翻译器单独换行显示。

设置会记住上次使用的栏目，Chrome 弹窗和油猴设置再次打开时均恢复到该栏目。火山播放速度与系统语音一样使用滑竿，并显示当前倍速。

“自动滚动到段落/句子”会判断阅读区域内的实际文字位置，可见句子保持页面位置；普通短段按段落定位，长段按句子最小滚动。针对 TTsu 分页阅读器按原生翻页处理，避免句子居中破坏分页和书签位置；已处理的快捷键不会再次触发网页的方向键翻页。翻译插入仍会占用页面空间，极长的单句不会按固定字数拆开。

段落键始终以当前所在段落为基准，跳到相邻段落并切回段落模式。句子键在当前句后 / 前移动，到边界后跨入相邻段落；如果当前选中整段，下一句先选择这段第一句，上一句先选择这段最后一句。重读和自动阅读跟随当前模式。句子模式适合长段落，段落模式适合每段很短的轻小说。

设置里的“快捷键”分组可以录制组合键、恢复默认或手工填写按键代码；备用键用 `/` 分隔，清空可禁用。主键盘 `Digit4` 与小键盘 `Numpad4` 是不同键位。跨操作重复键会提示冲突并保留旧值；要交换两个操作的键位，先清空其中一个。

输入框、可编辑区域、链接和设置面板中的操作不会触发阅读快捷键。目标文本为 `p`、`h1`–`h6`。句子可以跨多个嵌套的 span、em、b 和 ruby；ruby 保持整体，振假名不参与断句。段落中的交互元素会跳过句子包装，避免改变其行为。

系统语音来自当前浏览器的 SpeechSynthesis，不局限于 Windows。VITS 的“服务地址”填写完整 HTTP / HTTPS 地址，例如 `http://127.0.0.1:23456`，末尾有无 `/` 均可；也支持局域网主机、域名和服务路径前缀。获取音频后在浏览器播放，已移除 8666 播放桥接依赖。声音列表只从运行服务的 `/voice/speakers` 获取，已删除内置 VITS 列表；获取失败时显示原因并禁用声音选择，可点击“刷新声音列表”重试。原声音 ID 不在新列表时自动选择首个声音。分段参数正确映射为 `segment_size`。Esc、换段 / 换句、关闭插件都会立即停止当前浏览器音频，并丢弃已过时的合成响应。服务端仍可能继续计算已提交的请求。流式选项控制服务端响应，本插件获取完整音频后播放。

VITS 参数依据 [vits-simple-api 的接口文档](https://github.com/Artrajz/vits-simple-api#api)。本次已用运行中的本地服务实测 804 个声音及声音 0 的 MP3 合成，并在无头 Chrome 中播放生成的真实音频、验证停止。

火山语音使用提供的 `huoshantts.py` 中的公开接口，发送文本与声音 ID，再播放返回的 MP3。首次使用可在“语音”栏点击“授权 火山语音 接口”。已实测日语测试句约 560ms 返回音频，并在浏览器中验证播放和停止。

火山的“播放速度”支持 0.5–2 倍，默认 1 倍，调整立即作用于正在播放的音频并保留音调。这是浏览器播放变速，不改变服务端合成速度。火山声音列表直接定义在 `src/core/settings.js`，无需单独的声音 JSON 文件。

翻译只保留 Google 与有道，DeepL / 彩云的界面、请求代码、默认配置与域名授权均已移除。有道长文本按标点分块串行请求，若仍遇到 HTTP 413，自动继续缩小块并按顺序合并译文；已实测原先 413 的 840 字文本成功返回译文。

阅读页的翻译以最新选择为准：150ms 内连续切换只启动最后一个任务；新选择中止旧网络请求及后续分块，不必等待旧段落排队。不同页面互不取消，成功译文仍缓存。Google 使用 translateHtml 入口。

同时启用两个翻译器时，有道先发起并显示在第一行，Google 显示在第二行。两个服务并发请求，谁先完成就更新自己的译文，不等待另一个服务。Chrome 使用后台 fetch，油猴使用 GM_xmlhttpRequest，实际网络调度由浏览器和脚本管理器处理。

Google 固定使用 translateHtml 接口：POST https://translate-pa.googleapis.com/v1/translateHtml，发送 protobuf JSON 和 google.py 中同样的网站客户端 Key，读取返回数组并解码 HTML 实体。旧网页接口、JSON 备用入口和对应测速代码已移除。保留分块、最新选择优先、成功缓存及 HTTP 429 后暂停一分钟。

## 项目结构

```text
src/
  config/       默认参数
  core/         设置与快捷键、文本句子、滚动定位、阅读状态、音频播放、接口服务
  platform/     Chrome / GM API 适配与 Chrome manifest 模板
  ui/           两个平台共用的设置面板、样式
  entries/      Chrome 后台 / 内容 / 弹窗与油猴启动入口
assets/img/     扩展图标
scripts/        无依赖构建脚本
tests/          逻辑、构建和浏览器回归
docs/           分析记录、历史截图
dist/           生成的 Chrome 与油猴安装文件（不手动编辑）
manifest.json   构建生成的原目录加载入口（不手动编辑）
```

源文件在构建时按明确顺序组合为严格模式闭包，通过闭包内的 `App` 对象共享公开函数，不向网页暴露全局变量。没有打包器依赖、运行时远程依赖或第二套业务代码。新增功能优先放在 `core`；平台能力只放在 `platform`；界面只放在 `ui`。版本号仅修改 `package.json` 后重新构建。

## 平台差异

### Chrome 仅在指定网站生效时的翻译权限

Chrome 的网站访问限制同时影响阅读页面的脚本注入与后台跨域请求。只加入阅读网站、没有加入翻译接口域名时，可能出现 `Failed to fetch`。重新加载扩展后，在“翻译”栏点击“授权 Google 接口”或“授权 有道 接口”，允许 Chrome 提示中的具体服务域名，再重新选择文本。VITS 和火山语音的接口授权放在“语音”栏。无需把网站访问改成“所有网站”。

授权范围分别为 `translate-pa.googleapis.com`、`m.youdao.com`、当前填写的 VITS 主机及 `translate.volcengine.com`；更换 VITS 主机后，在“语音”栏点击“授权 VITS 接口”，只请求该主机访问权限。油猴版本可通过管理器确认自定义主机的连接权限；也可以在 Chrome 的指定网站列表手工添加所用的接口地址。后台请求前检查实际权限，缺失时给出明确提示。新接口域名需要单独授权，旧 Google 域名授权不能替代。已有接口权限但连接失败时仍会提示检查网络 / 代理，权限授权不能解决服务端限流、断网等问题。

Chrome 支持在用户点击时请求被扣留的必要域名权限，见 [permissions.request](https://developer.chrome.com/docs/extensions/reference/api/permissions#method-request)；后台跨域请求也需要域名权限，见 [Chrome 跨域请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)。

| 能力 | Chrome 扩展 | 油猴脚本 |
| --- | --- | --- |
| 设置存储 | `chrome.storage.local` | 各配置项使用 `GM_getValue` / `GM_setValue` |
| 页面更新 | `chrome.storage.onChanged` | `GM_addValueChangeListener` |
| 跨域请求 | 后台 service worker + host permissions | `GM_xmlhttpRequest` + `@connect` |
| 剪贴板 | Clipboard API + clipboardWrite 权限 | `GM_setClipboard` |
| 设置入口 | 扩展弹窗 | 油猴菜单 + Shadow DOM 侧栏 |
| 子框架 | manifest 中 all_frames，按可注入的 frame 独立运行 | 按脚本管理器匹配规则在各 frame 中运行 |

Chrome 与油猴的设置彼此独立；Chrome 的设置改为本地保存后不再自动跨设备同步。跨框架不共享当前选中段落。浏览器内部页面、不可访问的框架和受限页面不保证支持。阅读本地 HTML 时，需要在浏览器 / 脚本管理器中允许访问文件 URL。

开发依据：[Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)、[Chrome 跨域请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)、[Tampermonkey API](https://www.tampermonkey.net/documentation.php)。

## 验证

```sh
npm test
```

自动构建后执行逻辑与产物测试。浏览器回归需要额外准备 Playwright 和可用的 Chrome：

```sh
npm install --no-save playwright
npm run test:browser
```

也可通过 `PLAYWRIGHT_MODULE` 指向已有 Playwright 安装目录。浏览器测试以 Chrome / GM API 模拟对象加载实际生成脚本，检查段落 / 句子导航、句后译文、快捷键录制、符号开关、日夜主题、嵌套 markup、逐句朗读与停止，以及按 TTsu 布局重建的长段跨页场景；不操作现有浏览器配置，不发真实翻译请求。测试截图位于 `test-results/`。实际安装的扩展与 Tampermonkey 授权仍需在使用环境确认。

手工网络诊断脚本（会向相应服务发送固定测试文本）：

```sh
node scripts/probe-services.mjs                 # 使用当前 Google / 有道实现测试翻译
node scripts/probe-services.mjs --youdao-fixed  # 验证分块后的长文本有道翻译
node scripts/probe-vits.mjs                     # 本地声音列表与 MP3 合成
```

详细问题与重构说明见 [项目分析](docs/analysis.md)。

原作者：raindrop213；MIT License。
