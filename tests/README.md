# 测试

测试分三类，使用合成文本与模拟接口，不读取个人书籍，不发送真实网络请求。

| 文件 | 检查内容 |
| --- | --- |
| `api.test.mjs` | Google、有道、VITS、火山的请求与响应；413、429、缓存、取消、跨域及授权；共用版本规则、提交标题发布条件与版本提示；平台产物入口 |
| `interface.mjs` | 两个平台的布局、日夜主题、开关头图、即刻保存、栏目记忆、语音互斥、滑杆、授权、确认重置，以及版本提示与重试 |
| `pages.mjs` | 五种阅读页的提取、振假名、段句导航、译文位置、重复选择、原文恢复，以及分页和按句朗读 |
| `fixtures/` | 五个小型 HTML 样例，可直接打开查看结构；正文均为合成文本 |
| `helpers/` | 加载源码、模拟平台边界与创建独立浏览器页面 |
| `browser.mjs` | 浏览器测试入口；每个用例新建页面，失败保存截图并继续其他用例 |

```sh
npm test             # 构建 + 接口和平台产物验证；无需安装依赖
npm run test:browser # 构建 + 界面和阅读页验证
```

浏览器测试需要已安装的 Chrome 和 Playwright：`npm install --no-save --package-lock=false playwright`。也可用环境变量 `PLAYWRIGHT_MODULE` 指向已有 Playwright 模块目录。截图保存在忽略提交的 `test-results/`。

## 网页样例

| 样例 | 保留的关键结构 |
| --- | --- |
| TTsu | `.book-content` 与 CSS 分栏、竖排、原生箭头翻页、大段跨页 |
| Bibi | `.spread > iframe.item`，章节通过 blob URL 加载 |
| Calibre-Web | `#viewer .epub-container .epub-view iframe`，模拟 EPUB 章节文档 |
| Kakuyomu | `.widget-episodeBody` 内的段落、ruby、内联强调和 br |
| Syosetu | `.js-novel-text.p-novel__text` 内的段落、ruby、空行和 br |

样例复现关键 DOM 和布局，不是完整网站镜像。两个平台都执行构建产物；Chrome API、GM API、剪贴板、系统语音和服务响应由测试模拟。子框架中显式加载脚本，因此通过测试不代表 Chrome/Tampermonkey 实际注入、跨来源权限和脚本管理器配置也已验证。发布前仍需在真实阅读页刷新扩展后检查一次。

界面断言检查布局与状态，截图用于人工检查，不做容易受字体或浏览器版本影响的逐像素比较。接口测试验证请求协议与异常处理；真实服务可用性由 `scripts/probe-services.mjs`、`probe-vits.mjs`、`probe-huoshan.mjs` 单独诊断。
