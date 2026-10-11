# AnonTranslator

用于浏览器阅读日语小说的文本复制、语音朗读（TTS）与翻译工具，支持 **Chrome 扩展** 和 **Tampermonkey 油猴脚本**。

![阅读操作演示（旧版）](assets/preview.gif)

## 使用场景

- 在线阅读：很多在线网站都可以直接用
  - [小説家になろう](https://syosetu.com/)
  - [カクヨム](https://kakuyomu.jp/)
  - [青空文庫](https://www.aozora.gr.jp/)（因为是纯文本没html标签所以不能正常工作。但可以使用 [青空助手](https://aohelp.club/) 下载epub或者html看 | [作者B站视频](https://www.bilibili.com/video/BV1Xa4y1h7MW/)）
  - [本人自用书库](https://ebook.raindrop213.com/)

- 下载党：用浏览器打开EPUB格式电子书
  - 管理：[Calibre-web](https://github.com/janeczku/calibre-web) 自建书库（前提是你已经用 [Calibre](https://calibre-ebook.com/) 存好电子书了）
  - 下载：Z-Lib就不用多说了，那你也可能还知道安娜的档案和各种DLRaw网站
  - 购买：[bookwalker](https://bookwalker.jp/)、[Amazon](https://www.amazon.co.jp/kindle-dbs/storefront) 和 [Rakuten](https://books.rakuten.co.jp/e-book/) ，其中bookwalker解锁（DeDRM）稍难点，另外两个解锁相对简单一点
  - 阅读：这里放一个简单好用的epub阅读器 [ッツ Ebook Reader](https://reader.ttsu.app)


## 安装插件

首次安装后**打开顶部总开关（ON/OFF）**，语音和翻译也需要分别开启。以下任选一种方式安装，另外也可以从 [Releases](https://github.com/raindrop213/AnonTranslator/releases/latest) 下载进行手动安装。

- Chrome 扩展
  - 从 [Chrome 商店](https://chromewebstore.google.com/detail/anontranslator/echegehpmakkcfcadfjljpcallkhpldi) 安装扩展，点击 “添加至 Chrome”。
  - 点击图标打开设置。
  - （若将扩展设为“仅在特定网站生效”，需要手动点击对应的“授权…接口”按钮来授权）

- Tampermonkey 油猴脚本
  - 安装 [Tampermonkey](https://www.tampermonkey.net/)，在 Chrome 的扩展详情中开启“允许用户脚本”（[官方说明](https://www.tampermonkey.net/faq.php?locale=zh&q=Q209)）。
  - 从 [Greasy Fork](https://greasyfork.org/zh-CN/scripts/599752-anontranslator) 安装脚本。
  - 刷新页面，点击油猴图标，通过 “AnonTranslator > 设置” 打开设置面板。
  - （若使用其他地址服务时弹出跨域授权提示，选择“总是允许此域名”）


## 默认操作

| 操作 | 功能 |
| --- | --- |
| 左键点击段落 | 标记、复制、朗读、翻译段落 |
| 右键点击句子 | 标记、复制、朗读、翻译句子 |
| ↑ / 2 / Num 2 | 上一段 |
| ↓ / 1 / Num 1 | 下一段 |
| 5 / Num 5 | 上一句 |
| 4 / Num 4 | 下一句 |
| F1 / Num 0 | 重读当前选择 |
| 空格 | 按当前段落 / 句子模式开始或暂停自动阅读 |
| Esc | 停止朗读与自动阅读 |

段落模式适合每段较短的轻小说，句子模式适合长段落；右键选择句子后，翻译与自动阅读按句子进行。“把段落切成句子”可控制段落朗读是否逐句播放。

默认拾取 `p`、`h1`–`h6` 标签。如果正文没有被选中，可在“复制 → 目标文本标签”添加页面使用的标签，例如 `p,h1,li,div`，用逗号分隔。这项设置同时用于复制、朗读、翻译和导航。默认忽略 ruby 振假名；关闭“忽略振假名”可在复制内容中保留读音。

## 项目结构

```text
src/
  reader/       阅读操作、文本拾取与阅读样式
  services/     语音、翻译与网络请求
  settings/     默认设置、设置面板与面板样式
  platform/     Chrome / 油猴适配、入口与扩展清单
assets/         图标与演示图片
build.mjs       两个平台共用的构建脚本
package.json    版本号与构建命令
dist/
  extension/    Chrome 扩展
  tampermonkey/ AnonTranslator.user.js
```

两个平台共用一套功能代码，版本统一读取 `package.json`。修改代码请改 `src/`；`dist/` 每次构建重新生成。

## 开发与打包

安装 [Node.js](https://nodejs.org/)，在项目文件夹中打开终端。第一次安装依赖，以后修改代码后只需构建：

```sh
npm install
npm run build
```

---
![BG](assets/BG.png)
