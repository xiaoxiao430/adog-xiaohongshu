# 内置品牌与字体

- `example/assets/adog-logo.png`：沿用本项目 `public/brand/adog-logo.png` 的爱多格正式 Logo。
- `example/assets/xhs.jpg`：沿用本项目 `public/brand/xhs.png` 的小红书原始标识；源文件实际为 JPEG，按真实格式命名。
- `resources/yahei-ui.woff2`：由本项目已使用的微软雅黑原字体生成的字形子集，包含当前小组件界面、分享配置文字与已备20篇小红书文案。它只作审计副本，不放入可上传目录；`example/app.css`内嵌同一文件的data URL。没有改用其他字体。

小组件官方资源上传名单未列WOFF2，因此可上传目录没有独立字体文件，仅使用CSS内嵌。字体标识保留Microsoft YaHei；`scripts/rebuild-font.py`可用既有fontTools环境重建字形并同步CSS。小组件实际基础库是否加载该内嵌字体、手机是否使用该字体，仍须在官方IDE和真机核对。任意新增文案或本人输入超出子集时，需要补齐字形；不把系统自动补字当成已验证的微软雅黑，也不声称可控制小红书自身原生编辑器的字体。
