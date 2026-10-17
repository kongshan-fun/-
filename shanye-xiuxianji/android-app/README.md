# 山野修仙记 V30 Android Debug APK

这是从原 V30 HTML 完整游戏封装的 Capacitor Android 工程，独立于原仓库已有游戏分支。

## 云端 APK
进入仓库 Actions → Build Shanye Android APK → 最新成功运行 → Artifacts → shanye-xiuxianji-v30-debug-apk，下载 ZIP 并解压得到 app-debug.apk。

该文件使用 Android 调试签名，仅供安装测试，不是 TapTap 可直接发布的正式签名包。

## 构建
Node 22 / JDK 17 / Android SDK；运行 npm install、npx cap add android、npx cap sync android、cd android && ./gradlew assembleDebug。

## 数据说明
本地存档存于 Android WebView 的 localStorage，APK 卸载可能清除全部数据；暂未完成旧浏览器存档迁移、正式签名及设备实测，重要档位请先导出 JSON。
