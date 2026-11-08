# 爱多格·小红书原生图文发布工程

核对日期：2026-11-07。此目录提供小红书原生小程序的完整应用源码、品牌和微软雅黑字形，以及接入既有爱多格后台的逻辑。游客进入后直接看到小红书库的一批照片和对应现成稿，可换批、换文案、修改文字，再由官方 `post-note-button` 带入小红书原生编辑页。

发笔记的是每位顾客自己的小红书账号，店方只提供图文。顾客不选商家、不登录商家号、不以商家主页作为发布入口。开发者登录平台是开通承载工具的一次操作，与顾客发布账号分开；小工具候选路线也允许由普通个人创作者开通，不要求爱多格专业号。小程序路线的正式主体和类目仍按实际平台要求核对。

**尚无自己的小程序 AppID，未在官方 IDE 构建、真机打开原生编辑页或发布笔记。** 默认 `ownAppId: ''`、`enablePostNoteButton: false`，因此“去发布”明确显示待开通，不能冒充已跑通。拥有官方账号不等于已有自己的小程序身份。本次没有注册身份、上传小程序、部署、借用参考二维码的身份或替客户发帖，也没有修改线上 `publishing.officialReady`。

## 文件与官方 IDE

```text
example/
  app.js / app.json / app.css           小程序入口、全局配置及内嵌微软雅黑
  config.js                            公开AppID、功能开关、爱多格API
  assets/                              爱多格Logo、小红书标识、真实字体字形
  lib/api.js                           原生游客Bearer、XHS库取批、请求中止
  lib/publisher.js                     官方图文参数和发布前检查
  pages/publish/index.{js,json,xhsml,css} 单页游客界面、改稿与预留续期
scripts/prepare-ide-project.mjs         与官方IDE生成的真实配置合并，不猜AppID字段
verify-example.mjs                     本地语法、接口合同与页面生命周期测试
```

这是 `.xhsml/.css` 小红书工程，未使用微信的 WXML/WXSS，也没有第三方发布 SDK。官方组件为内置组件，不需要 `usingComponents` 下载包。

1. 登录[官方平台](https://miniapp.xiaohongshu.com/)，先创建自己的**测试小程序**并取得测试 AppID，用于开发者手机内部验证。官方沙盒允许免审核测试，正式主体、类目及备案流程可以并行；实际账号的可用入口以控制台为准。测试小程序不能向普通顾客分发。[沙盒介绍](https://miniapp.xiaohongshu.com/doc/DC204112)及[上传与预览说明](https://miniapp.xiaohongshu.com/doc/DC483845)。用自己的 AppID 在官方 IDE 建项目，并选择基础库 **2.0 架构**编译。
2. 官方 IDE 会生成 `project.config.json`。本目录不虚构它的 AppID 字段或编译选项。把 `example/` 中的应用文件复制到新项目，保留 IDE 生成的配置；也可先切换到**包含本 README 的目录**，运行以下合并命令，得到独立新目录：

   ```sh
   node scripts/prepare-ide-project.mjs \
     --project /绝对路径/官方IDE已创建的项目 \
     --out /绝对路径/新的爱多格小程序目录 \
     --app-id 自己的公开AppID \
     --enable-native-preview
   ```

   脚本不覆盖已有工程，原样保留官方配置，不复制私有 IDE 设置；没有 `--app-id` 时保持为空。不传 `--enable-native-preview` 时仍保持发布开关为 `false`；传入该标记必须同时明确提供自己的 AppID，只在新输出工程启用内部原生预览。重新在官方 IDE 导入输出目录，核对项目真实身份与 `config.js` 一致。
3. `config.js` 已设置现有爱多格服务 `https://jmryqyx.cn/aidog-share`，与网页管理后台共用数据。按官方后台要求加入真实请求及图片域名；如接口未来返回其他图片域名，也必须在后台核对。
4. 取得自己的测试 AppID 后，可用 `--enable-native-preview`，或在自己的工程手动将 `enablePostNoteButton` 改为 `true`，开展官方 IDE 和授权测试账号的真机验证。该开关只启用内部测试，不代表已验收、已上线或 `officialReady`，也不能授予平台身份；平台若返回准入或配置问题，按真实报错处理。IDE≥2.3.1、客户端≥8.53；`miniapp-session-info` 需要基础库≥3.120.x，按这一较高要求验收。
5. 用 [CHECKLIST.md](CHECKLIST.md)记录实机结果。自己的正式入口与带图编辑器验证通过后，才能在主应用登记原生入口；仅填入 AppID 不足以将 `officialReady` 设为真。

没有 AppID 时，本地测试不需任何账号或密钥。实际导入和构建需要官方项目配置，因此本目录不会把没有官方身份的源码目录称为已编译的小程序。

当前 `post-note-button` 参数文档未列单独申请“发笔记白名单”的步骤，不把它当成额外的既定门槛。先以自己的测试 AppID 和官方最低版本做真机验证，再按平台实际返回的配置或准入要求处理。正式供顾客使用时仍须完成正式小程序的对应手续，取得自己的官方入口；不能把沙盒预览二维码印成顾客立牌。

## 与现有双库接口一致

```text
游客进入 → GET /api/bootstrap?client=miniapp（无浏览器Origin）
        → 内存保存guestToken，之后只放Authorization: Bearer头
        → POST /api/quick-share/start {channel:"xhs",platform:"xhs"}
        → 直接显示pack.materials + platformCopies.xhs第一稿
换文案  → 同批文案本地轮换1/N，照片不变，不联网
换图文  → start {channel:"xhs",platform:"xhs",currentId,next:true,skip}
续预留  → start {channel:"xhs",platform:"xhs",currentId}
去发布  → 官方post-note-button(title,content,media-info,miniapp-session-info)
        → 顾客在小红书原生编辑页自行核对、修改和最终发布
```

只使用 `channel=xhs / serviceType=general` 公共库。点评、美团、抖音的 `reviews` 库不会被当作小红书素材。顾客不用专属取图码、不选服务类型，也没有额外的“核对→确认使用→准备发布器”多步。此入口不提供私册解锁，仍须由既有后台保持私图权限，不能把私图改公共来方便传输。

文案优先读取返回的 `platformCopies.xhs`，兼容同一包的 `pack.platformCopies.xhs`，最后才兼容历史 `title/body`。同批修改按包和文案索引暂存内存；换批从其第一稿开始，再次浏览恢复该批自己的修改，不串图或串稿。输入超过官方标题20/正文1000限制时保留原文并阻止使用组件，不截断、不补写经历、不抹去不满意内容。页面提醒按本人实际修改，并按平台要求声明 AI 辅助内容。

API Bearer仅在内存，不放二维码、图片链接、日志或本地存储。401后清空旧令牌；下一次明确重试先重新取得游客身份。请求有15秒超时，页面退出中止 RequestTask，晚到的响应不能覆盖已离开的页面。断网或请求结果丢失时保留当前文字和照片；由于服务器可能已经换了预留，先暂停原生按钮，待成功刷新本批或换批后继续。

预留期限来自服务端 `reservedUntil`，到期前约一分钟续租；离开页面暂停定时器，返回时重新核对。过期或未核实预留时停用旧媒体参数。换批没有下一批时保持当前图文。预览、编辑、换文案和原生按钮本身都不调用下载、`consume` 或 `share-receipt`。

## 官方编辑器与库存记录

`media-info` 是 JSON 字符串：`{"image_resources":[{"url":"https://…"}]}`，顺序与三张照片一致。组件支持1—18张图，本工具按既有业务约定接收3—5张。传入可由组件直接读取的短期 HTTPS 签名原图，不携带顾客 Bearer 或 Cookie；服务器须返回图片类型和 `Content-Disposition: inline`。界面缩略图为 `aspectFit`，不裁掉画面或 AI 图示说明。网络、图片读取和手机实际画质仍须真机验证。

官方目前只列出客户端 `binderror`。这里没有 `bindsuccess`，没有把 `bindtap`、读到图片、打开页面或进入编辑器记成已发布。`miniapp-session-info` 只传包ID、文案ID及本次跟踪标识作为关联线索，不带身份凭证；线索本身不能授权归档。

旧例把 `/consume` 放在组件前，已移除：现有接口只有真实下载交付后才能消费，原生编辑器路径不能冒充“系统分享”或“手动确认保存”。因此本版原生流程只预留和续租，**不会自动归档为已下载/已发布**。是否取消发布也无法由现有客户端事件可靠得知，不能提前下架素材。

需要自动记录真实发布时，必须另接官方 `NOTE_CHANGE` 服务端事件，完成平台配置、接收与解密校验、防重放、幂等处理及包关联后再按真实语义记录。官方事件文档列出 NoteId/AppId/OpenId/PublishTime；组件文档说会回传 `miniapp-session-info`，但真实字段形式和校验方法仍须在自己的应用中核实。本目录未实现服务端回调，也没有伪造库存或发布结果。

## 本地验证和字体

在包含本 README 的目录执行：

```sh
node verify-example.mjs
```

本地测试覆盖原生请求头、双库隔离、首屏配稿、同图轮稿、改稿恢复、续租、失效/丢响应、退出中止、官方媒体 JSON、禁用身份状态和 IDE 配置合并。测试使用 `.invalid` 合成地址，不访问线上库存或小红书；它不能替代官方编译、真机取图、原生编辑器预填或最终发布。

`app.css` 通过 `@font-face` data URL 实际引用包内同一微软雅黑 WOFF2 子集，不是只写 family 名。字形源自项目既有微软雅黑，已在本地检查字体名称、现有页面和20篇备稿所需字形。**小红书基础库是否正确加载 CSS 内嵌字体、手机是否实际使用微软雅黑仍待官方 IDE 与真机核实**；新增文字超出子集时须更新字形或以平台允许方式加载完整授权字体，不得把设备自动补字当成已验证。资源说明见 [assets/README.md](example/assets/README.md)。

## 官方主源

- [post-note-button：媒体、参数、版本、binderror](https://miniapp.xiaohongshu.com/doc/DC530301)
- [官方 IDE：创建、导入、预览和上传](https://miniapp.xiaohongshu.com/doc/DC514746)
- [小程序代码结构与IDE生成的项目配置](https://miniapp.xiaohongshu.com/doc/DC451266)
- [xhs.request：HTTPS、请求头、超时和RequestTask](https://miniapp.xiaohongshu.com/doc/DC828470)
- [官方XHSML循环示例](https://miniapp.xiaohongshu.com/doc/DC404252)
- [NOTE_CHANGE服务端发布事件](https://miniapp.xiaohongshu.com/doc/DC294446)
- [主体、类目与接入流程](https://miniapp.xiaohongshu.com/doc/DC137160)

小程序能力与旧网页分享 SDK 是不同产品。此工程只使用公开官方组件，不使用未公开 Scheme、他人 AppID 或自动代发。

## 站外URL Link请求准备（2026-11-08）

`scripts/prepare-url-link-request.mjs`只校验并输出**脱敏请求准备记录**，不联网、不生成链接、不刷新凭证、不改`officialReady`。目前没有可执行的`create-url-link.mjs`生成器，不能把准备完成当成微信入口已接通。

已确认的官方合同：

- [调用凭证](https://miniapp.xiaohongshu.com/doc/DC010382)：`POST https://miniapp.xiaohongshu.com/api/rmp/token`，JSON body字段是`appid`和`secret`；响应为`data.access_token`及`expire_in`。新凭证会缩短旧凭证有效期，所以准备操作不会尝试获取凭证。
- [URL Link](https://miniapp.xiaohongshu.com/doc/DC274658)：`POST https://miniapp.xiaohongshu.com/api/rmp/url`；业务参数为`page_url`及可选`expire_interval`。默认页面`pages/publish/index`，不以`/`开头，路径含query最多1024字符；有效期不填默认365天，显式填写只接受1至365天。只允许短批次标识等路由参数，不将图片、成稿或凭据放入query。
- 该URL Link页列出公共参数`app_id`和`access_token`，但未明确其放在query、header还是body；[API简介](https://miniapp.xiaohongshu.com/doc/DC853803)仅说明POST body采用JSON，没有补齐此处。不能套用其他接口的`appid`query表，不能将小工具OAuth、其他AppID或自造deep link充作官方入口。因此当前明确保留`ready_to_send:false`、`link_generated:false`。

后续取得自己的小程序配置并确认上述鉴权传输合同后，再实现真正生成器。只有实际官方成功响应中的URL才能登记为`link_generated`；生成链接仍不代表微信拉起、Android/iOS或原生编辑器已验证。

配置只读取进程环境变量`XHS_MINIAPP_APP_ID`以及`XHS_MINIAPP_ACCESS_TOKEN`或`XHS_MINIAPP_APP_SECRET`，也可显式提供项目外、权限0600的私有JSON文件，字段为`app_id`以及`access_token`或`app_secret`。不扫描、复制现有小工具配置，不接受命令行凭据，不把配置写入本目录。环境变量优先。不要把真实凭据写进终端历史或仓库。

在包含本README的目录运行；以下路径是待自行配置的私有位置，并不是已存在的凭据：

```sh
node scripts/prepare-url-link-request.mjs \
  --config /绝对私有目录/miniapp.json \
  --query batch=group-3 --expire-days 14 \
  --out /绝对私有目录/url-link-preparation.json
node tests/url-link-contract.mjs
```

`--out`只保存脱敏准备记录，权限0600且不覆盖旧文件；不是官方链接。缺少配置明确退出，所有分支均不联网。七项本地检查覆盖已确认端点及字段、1024边界、短query与有效期、缺配置、业务失败不误报、凭据不泄露、私有文件权限与无网络调用。敏感query字段，以及误放在普通字段中的当前凭据（包括URL编码形式），均在写出前拒绝；只用虚构夹具，不表示平台生成或真机验证通过。
