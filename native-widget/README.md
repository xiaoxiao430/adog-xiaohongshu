# 爱多格·联网小组件工程

本目录采用官方小组件框架，以`xhs.request`连接现有爱多格共享图库。单页直接显示当前一批3—5张照片及配稿，可换批、同图轮稿、修改，再由`post-note-button`带入顾客自己账号的原生编辑页。界面沿用紧凑蓝粉、原Logo与微软雅黑。

仓库提供可供官方IDE导入的应用源文件，复用模板的`ownAppId`仍为空、`enablePostNoteButton`仍为`false`。爱多格实际自有的小组件工程使用基础库3.151.0，已显示共享图库三张照片、对应文案和原生发布按钮；此前0.1.0已完成内部预览打包并生成官方测试码。

官方内部开发版本`0.1.0`已上传，并已设置为扫码体验版本；该体验入口仅供创建者和体验者使用。当前体验版仍是此前完成图片显示修复的版本，尚未换入调用准备接口、仅传`attemptId`的新版客户端源码。当前尚未提审或正式发布；此前内部预览测试码已交付，手机是否能将三图及当前稿件带入原生编辑页、微信顾客入口是否完整，仍待实测。

Studio v9后端已部署，0006、0007增量迁移及三项运行配置已完成；部署前后核对保留原42张图片、14批图文及已有使用记录，R2图片字节未变化。官方平台已接受本小组件的消息推送配置。新版0.1.1的13个公开应用文件已更新到实际自有GUI工程，原始项目配置字节不变，并已通过官方本地编译；0.1.1已通过官方打包上传，IDE显示“上传成功”，开放平台开发版本卡片已核对到0.1.1；官方扫码体验版本仍为0.1.0，线上`officialReady`仍未修改。模板的空身份与禁用状态不代表爱多格仍缺少WidgetID。

本次在官方IDE实际渲染页面核对，原生`XHS-POST-NOTE-BUTTON`已就绪，session仅含`attemptId`；三张媒体的URL及顺序与页面三图一致，标题9字、正文71字。只读后台核对同一准备记录的标题正文哈希、图片顺序及归属全部一致，记录仍为`prepared`、批次仍为`reserved`，未写入已用或下载日期，也未生成发布记录；推送收件数为0。这确认了真实发布按钮和服务端快照相符，手机原生编辑页的实际预填仍待验证。

## 结构与配置

当前源码的`config/api/publisher/page`采用ES module的`import/export`，所有相对导入显式带`.js`。这是针对实际IDE 2.0编译产物出现`require is not defined`及`fully specified`报错的兼容修复；官方require文档仍列出CommonJS支持，不将此修复说成平台一律只支持ESM。本地验证使用真实ESM模块链接且不提供`require/module`全局，验证脚本会按需启用Node的实验性VM模块；新版0.1.1已在实际IDE重新编译通过。

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

脚本拒绝覆盖源目录、官方原工程或已有输出。不传AppID和预览标记时保留空身份及禁用状态；预览标记必须同时提供AppID，并且只改新输出目录。它不能授予平台权限，也不代表验收。官方IDE需核对项目类型、实际AppID、2.0架构编译和基础库；组件的`miniapp-session-info`最低要求为基础库3.120.x；整个工程还定义了`onShareChat/onCopyUrl`，因此须使用基础库≥3.150.0及客户端≥9.25验收。已在实际3.133.1运行库中确认这两个方法会阻止页面创建，官方3.150.0／3.151.0基库已解除这两项限制；不能只按session字段的最低版本配置整个工程。同时满足组件文档IDE≥2.3.1要求。[组件合同](https://miniapp.xiaohongshu.com/doc/DC530301)

## 共享图库与恢复

API固定使用现有`https://jmryqyx.cn/aidog-share`，调用[小组件request](https://miniapp.xiaohongshu.com/doc/DC531914)。保留后端原生客户端协议`GET /api/bootstrap?client=miniapp`，此处`client`不是AppID或产品类型。游客令牌只在内存及`Authorization: Bearer`请求头中；不放链接、分享参数或本地存储，不伪造Cookie、Origin、Referer。

[小组件网络使用说明](https://miniapp.xiaohongshu.com/doc/DC956503)明确服务器域名配置“不做限制”；[request文档](https://miniapp.xiaohongshu.com/doc/DC531914)要求HTTPS，并禁止自行设置Referer。本工程按小组件合同联网，不要求办理小程序服务器域名白名单。实际IDE现已通过HTTPS读取共享图文并完成服务端准备请求，手机网络仍单独实测。

取批固定`channel:xhs/platform:xhs`，不读取点评等其他库或私人相册。首次即用服务端对应配稿；换文案不重新取批、不动图，修改按批次和稿件保存。换批和返回首页保留各批改稿；预留到期前续租，返回页面时重新核实。断网、丢响应、身份过期、失效预留时保留当前图文并暂停原生按钮，待明确刷新成功后恢复；离页中止请求，迟到响应不覆盖页面。

媒体保持服务端原顺序和原图，使用短期HTTPS图片；原生组件要求图片响应为`Content-Disposition: inline`，相关真实响应与画质仍待实机核对。标题20、正文1000的限制不静默截断。保留具体经历、不满意之处和AI说明；不新增虚假经历。

### 服务端图文准备记录

当前源码在输入暂停约350毫秒后，通过已认证的`POST /api/packages/:id/native-attempt`准备当前稿，不增加顾客操作。服务端只接受本人有效预留的小红书批次，保存图片顺序、对象键、格式和大小，以及主人当前完整标题正文、稿号和租约版本；不保存图片签名URL或游客令牌。图片快照记录的是对象信息，不额外复制原图或声称核验了图片字节哈希。同一游客的相同请求键及相同快照幂等返回同一随机编号，不允许改写旧快照。

请求体为`{requestKey,copyId,title,body}`，标题最多20字、正文最多1000字，空白与原文均不裁改。返回`{attemptId,status:'prepared',appId,validUntil,snapshotHash}`；`validUntil`是当前预留期限，快照的保留期限另行管理。接口没有按编号读取其他顾客快照的公开入口。

按钮只有在当前批次、稿件和服务端准备结果匹配时才启用；`miniapp-session-info`仅传`{attemptId}`。改稿、换批或刷新会停用旧结果，迟到成功或失败不能覆盖新状态。准备失败保留图文，可使用原有“刷新本批”重试；图片加载和准备成功都不改库存、下载日期或发布记录。快照最长保留30天，并受相册删除期限限制；删除相册或批次时同步清除对应准备记录。

本项目Studio v9已应用`drizzle/0006_native_publish_attempts.sql`，并在服务端配置自己的24位`XHS_WIDGET_APP_ID`。复用本源码时也须先完成迁移及配置；该值不来自客户端，不能使用旧小工具或其他人的身份。缺配置时接口明确返回503，原生按钮保持不可用。官方体验版0.1.0尚未调用本轮新增准备接口。

### 推送接收代码与待核对状态

Studio v9已部署`lib/xhs-message-crypto.ts`和`lib/xhs-message-receiver.ts`。接收路径为`/api/xhs/events`，支持现有`PUBLIC_BASE_PATH`前缀；它独立验证官方消息签名、解密并严格核对自有AppID，Cookie、游客令牌和Origin都不能代替验签。相同推送信封重试幂等保存，缺配置、校验失败或持久化失败不会返回成功确认。公网与本机回环的GET地址验证均通过，坏签名返回400；管理员收件元数据接口及原有内部服务健康检查正常。

本项目已应用`drizzle/0007_xhs_message_receipts.sql`，配置`XHS_PUSH_TOKEN`、`XHS_PUSH_ENCODING_AES_KEY`及同一自有`XHS_WIDGET_APP_ID`；运行配置保存在权限0600的私有文件。小组件控制台`/mini-widget/<appId>/pushManage`的接收URL、Token及EncodingAESKey已通过正常页面填写并提交，平台现显示“配置信息”和“修改消息推送配置”，已接受本次配置。尚未收到真实NOTE_CHANGE，不能据地址验证或配置成功认定真实发布事件已经接通；真实密钥和私有二维码不写入仓库。

合法`NOTE_CHANGE`只保存为`unmatched`（待核对），其他合法事件记为`ignored`。解密原文私有保留30天并随清理任务删除；已有管理员认证保护的`GET /api/admin/xhs/receipts`只返回收件编号、事件、笔记编号、原始发布时间标量、字段路径和接收时间，不返回原文、OpenId、密文或签名。这里的收件不是已关联到本批素材的发布记录，准备接口和接收接口均不自动出库。

[组件文档](https://miniapp.xiaohongshu.com/doc/DC530301)说明自定义信息会随发布回调返回，但[NOTE_CHANGE文档](https://miniapp.xiaohongshu.com/doc/DC294446)仅列出Event、NoteId、AppId、OpenId及类型为date的PublishTime，没有明确自定义信息的封装字段，也没有指定PublishTime的JSON格式或单位。当前保留其原始标量，不猜测自定义`attemptId`所在字段，不自动匹配准备记录或归档素材。

原生组件只有文档所列`binderror`；点击、图片预取、进入编辑页、分享入口或返回本页均不记为已发布。当前不调用`consume/share-receipt`，不冒充已保存交付。后续须核对本组件真实验签、解密后的推送，再实现准备编号关联、重复事件处理及租约冲突规则，才能记录对应素材的真实原生发布；不能消耗其他游客后来取得的预留。

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

当前Widget记录为126项本地检查；服务端准备接口21项隔离检查、推送加解密18项检查及推送接收21项隔离检查另在项目根目录的`tests/native-xhs-attempts.mjs`、`tests/xhs-message-crypto.mjs`和`tests/xhs-message-receiver.mjs`中。加解密另通过workerd中的AES运行检查。这些检查没有收到真实平台推送，也没有替顾客发布笔记。

本地检查使用虚构接口和IDE元数据夹具，覆盖页面文件、体积、资源类型、原生媒体、令牌、共享双库范围、改稿恢复、租约、失败处理、退出、静态分享及元数据合并；新版0.1.1的官方本地编译和真实服务端快照一致性已另行核对。手机字体加载、原图读取及Android/iOS真机验收仍待完成。[LOCAL-CHECKS.json](LOCAL-CHECKS.json)记录本地检查当时的状态，部署和编译布尔值不作为实时状态；[CHECKLIST.md](CHECKLIST.md)区分实际已核对与待实测项目。官方本地编译、Studio v9上线和地址验证均不等于手机编辑页或微信链路已经通过。

新版0.1.1已上传开发版，未更换当前0.1.0扫码体验设置。先用已交付的官方体验码核对手机三图、当前标题正文、修改和取消返回，再切换新版联调发布回调，并验证官方短链及微信顾客入口。真实发布推送到达后再核对自定义信息封装和准备编号关联，完成素材使用记录；在此之前收件仍保持unmatched、不自动归档，正式提审和发布仍是后续阶段。
