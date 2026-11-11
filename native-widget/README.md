# 爱多格·联网小组件工程

本目录采用官方小组件框架，以`xhs.request`连接现有爱多格共享图库。单页直接显示当前一批3—5张照片及配稿，可换批、同图轮稿、修改，再由`post-note-button`带入顾客自己账号的原生编辑页。界面沿用紧凑蓝粉、原Logo与微软雅黑。

当前交付是可供官方IDE导入的应用源文件。`ownAppId`为空、`enablePostNoteButton`为`false`；还没有真实小组件IDE元数据、官方编译或手机验证。没有登记、上传、发布或修改线上`officialReady`。取得自己实际的小组件AppID和IDE工程后再启用内部预览。

## 结构与配置

```text
example/                              可复制到官方小组件工程的应用文件
  app.js / app.json / app.css          单页配置、全局样式及内嵌字体
  config.js                           公开AppID、发布开关及既有服务地址
  assets/                             原Logo与小红书标识
  lib/api.js / publisher.js            共享API、原生发布参数
  pages/publish/index.{js,json,xhsml,css}
resources/yahei-ui.woff2               本地字体审计副本，不上传
scripts/prepare-ide-project.mjs        原样合并真实IDE元数据，检查本地体积
scripts/rebuild-font.py                重建微软雅黑并同步CSS
verify-example.mjs                    本地隔离合同与生命周期检查
```

[代码构成](https://miniapp.xiaohongshu.com/doc/DC602239)和[工程结构](https://miniapp.xiaohongshu.com/doc/DC923374)要求根目录有`app.js/app.json`；本工程页面使用同路径的JS、XHSML、JSON及CSS。[全局配置](https://miniapp.xiaohongshu.com/doc/DC071365)中的`pages`仍为数组，小组件只有第一项这一个可用页面；本工程只有`pages/publish/index`，保留`window/networkTimeout`，未添加`type/appType/entry/tabBar`。[页面配置](https://miniapp.xiaohongshu.com/doc/DC725583)仅设置标题。

[快速开始](https://miniapp.xiaohongshu.com/doc/DC145071)给出个人主体创建小组件流程。此工程不推断当前账号的审核状态，也不提供“个人测试小程序”创建说明。由账号持有人在实际控制台创建小组件后，在官方IDE选择“小组件项目”、填自己的真实AppID创建工程。[项目配置文档](https://miniapp.xiaohongshu.com/doc/DC543522)没有给出小组件类型及2.0开关的完整取值，脚本原样保留IDE生成的`project.config.json`，不猜写这些字段。

从包含本README的目录执行以下命令，将应用文件与真实IDE元数据合并到一个新目录：

```sh
node scripts/prepare-ide-project.mjs \
  --project /绝对路径/官方IDE已创建的小组件工程 \
  --out /绝对路径/新的爱多格小组件工程 \
  --app-id 自己实际的小组件AppID \
  --enable-native-preview
```

脚本拒绝覆盖源目录、官方原工程或已有输出。不传AppID和预览标记时保留空身份及禁用状态；预览标记必须同时提供AppID，并且只改新输出目录。它不能授予平台权限，也不代表验收。官方IDE需核对项目类型、实际AppID、2.0架构编译和基础库；当前使用`miniapp-session-info`，按基础库3.120.x及以上验收，同时满足组件文档IDE≥2.3.1、客户端≥8.53要求。[组件合同](https://miniapp.xiaohongshu.com/doc/DC530301)

## 共享图库与恢复

API固定使用现有`https://jmryqyx.cn/aidog-share`，调用[小组件request](https://miniapp.xiaohongshu.com/doc/DC531914)。保留后端原生客户端协议`GET /api/bootstrap?client=miniapp`，此处`client`不是AppID或产品类型。游客令牌只在内存及`Authorization: Bearer`请求头中；不放链接、分享参数或本地存储，不伪造Cookie、Origin、Referer。

取批固定`channel:xhs/platform:xhs`，不读取点评等其他库或私人相册。首次即用服务端对应配稿；换文案不联网、不动图，修改按批次和稿件保存。换批和返回首页保留各批改稿；预留到期前续租，返回页面时重新核实。断网、丢响应、身份过期、失效预留时保留当前图文并暂停原生按钮，待明确刷新成功后恢复；离页中止请求，迟到响应不覆盖页面。

媒体保持服务端原顺序和原图，使用短期HTTPS图片；原生组件要求图片响应为`Content-Disposition: inline`，相关真实响应与画质仍待实机核对。标题20、正文1000的限制不静默截断。保留具体经历、不满意之处和AI说明；不新增虚假经历。

原生组件只有文档所列`binderror`；点击、进入编辑页、分享入口或返回本页均不记为已发布。当前不调用`consume/share-receipt`，不冒充已保存交付或自动出库。真实发布自动归档需要另按小组件官方事件合同接入、校验后记录。

## 官方分享入口

按[Page文档](https://miniapp.xiaohongshu.com/doc/DC974753)实现`onShareAppMessage/onShareChat/onCopyUrl`。它们只返回公开首页路径及空query，不分享顾客令牌、当前原图签名地址或修改稿，也不换批或改库存。由小红书菜单执行分享或复制链接；本工程没有伪造链接，也不调用小程序的`/api/rmp/url`。

分享封面固定使用公开爱多格Logo：`onShareChat/onCopyUrl`显式设置`externalImageUrl`，站内卡片的`imageUrl`也固定为同一Logo，避免默认截取当前改稿页面；实际客户端行为仍待真机核对。

官方文档说明客户端8.56、基础库3.108.0起，“复制链接”可得到用于私信或站外分享的小组件短链。取得可分发版本后，在真实小红书菜单复制平台生成的链接，再核对微信、Android和iPhone扫码进入及原生图文预填；本地分享配置检查不代表这些链路已经通过。

[旧转发说明](https://miniapp.xiaohongshu.com/doc/DC660390)仍写有小组件站外分享限制，而[更新日志](https://miniapp.xiaohongshu.com/doc/DC600298)在基础库3.150.0、客户端9.25记录已放开分享能力限制。微信验收应使用9.25及以上真实客户端，取得自己的正式短链后核对实际结果；不能仅凭文档或复制链接成功就宣布微信完整链路可用。

## 体积、字体和本地检查

[小组件介绍](https://miniapp.xiaohongshu.com/doc/DC026740)原文限制单页面、单包不超过“2M”，未定义精确字节数。本工程可上传目录约0.33MB；合并脚本另设2MiB本地预算，最终以官方IDE编译和上传校验为准。三张照片来自共享API，不将整批原图打入包。

官方资源白名单没有WOFF2，所以可上传目录不含独立字体文件。`app.css`内嵌真实微软雅黑字形，`resources/`只留审计副本，两者逐字节一致；已覆盖当前界面、分享配置及20篇现成小红书文案所需字形。[小组件CSS文档](https://miniapp.xiaohongshu.com/doc/DC231869)未明确`@font-face`或data URI字体的运行支持，实际是否加载仍须IDE和手机核对，不能把系统补字当成微软雅黑，也不声称能控制小红书原生编辑器字体。见[ASSETS.md](ASSETS.md)。

```sh
node verify-example.mjs
```

检查只用本地虚构接口和IDE元数据夹具，覆盖页面文件、体积、资源类型、原生媒体、令牌、共享双库范围、改稿恢复、租约、失败处理、退出、静态分享及元数据合并。没有访问生产或小红书；不能替代官方编译、请求域名配置、字体加载、原图读取和Android/iOS真机验收。官方IDE工程就绪后按[CHECKLIST.md](CHECKLIST.md)记录实际结果。
