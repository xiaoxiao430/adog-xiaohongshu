# 爱多格 · 小红书小工具预览候选

`preview-package/` 是用于验证“小工具 → 小红书原生编辑页”最后一跳的离线运行源码，共10个文件。工具作者的开发授权与每位顾客自己的发布账号分开。

静态打包检查和正式版 CLI 本地 dry-run 已通过；**官方上传、创服平台模拟器、Android／iOS手机编辑器尚未验证，未提审或发布。** 普通浏览器没有小红书容器 SDK 时，发布按钮保持禁用；浏览器运行不能证明原生发布可用。

此候选只有3张示意图和对应备稿，可修改文字、同图换稿。它没有共享库存、后台上传或跨顾客下载记录，**不是正式顾客二维码入口**，不能替代现有扫码工具。

包内保留原始爱多格Logo、微软雅黑子集和3张完整原PNG，图片及文案含AI说明。SDK使用按原宽高Canvas转码的临时副本；源PNG中的C2PA／caBX元数据不保证完整传到运行时文件。真机验证仍需核对画面、AI说明、内容预填及取消返回。

## 打包这10个文件

从仓库根目录执行以下命令。输出文件须不存在；已有同名文件时请改用新文件名。仅列出的10个文件进入ZIP，`index.html`直接位于ZIP根目录，**本README不进入上传包**。仓库不另存ZIP，避免重复体积。

```sh
cd native-minitool/preview-package
python3 - <<'PYZIP'
from zipfile import ZipFile, ZIP_DEFLATED
files = (
    "index.html", "app.js", "style.css", "data.js", "mini_tool.json",
    "assets/adog-logo.png", "assets/yahei.woff2",
    "assets/photos/01.png", "assets/photos/02.png", "assets/photos/03.png",
)
with ZipFile("../aidog-preview.zip", "x", compression=ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(name, arcname=name)
PYZIP
```

后续须在获得官方管理授权后上传同一候选包，先完成创服平台模拟器验证，再分别进行Android和iOS真机扫码验证；实际看到本人编辑器中的图文后，才能判断原生最后一跳是否可用。当前源码交付不代表官方平台已上线。
