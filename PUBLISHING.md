# 发布流程

## 1. 准备 GitHub 仓库

1. 新建公共仓库：`doubao-auto-system-theme`。
2. 把本目录内容复制到仓库根目录。
3. 确认 `doubao-auto-system-theme.user.js` 中的 GitHub 链接指向 `estelledc/doubao-auto-system-theme`。
4. 提交初版：

```bash
git add README.md LICENSE CHANGELOG.md doubao-auto-system-theme.user.js .github greasyfork xiaohongshu assets
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

## 2. 发布 Greasy Fork

1. 打开 Greasy Fork，选择发布新脚本。
2. 上传或粘贴 `doubao-auto-system-theme.user.js`。
3. 描述使用 `greasyfork/description.md`。
4. 保存后安装一遍线上版本，确认能在豆包聊天页生效。

## 3. 发布小红书

1. 按 `assets/shot-list.md` 重新截图。
2. 按 `xiaohongshu/storyboard.md` 做 6 图。
3. 正文使用 `xiaohongshu/post.md`，发布前去掉不适合公开的内部信息。
4. 首条评论放安装说明和反馈方式。

## 4. 发布后维护

- 优先处理“文字看不清”“白块残留”“代码块错色”问题。
- 每次修复更新 `CHANGELOG.md`。
- 如果豆包改版导致选择器失效，先要求用户提供截图和 `__doubaoThemeAudit()` 输出，再修。
