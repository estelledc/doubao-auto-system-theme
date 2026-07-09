# Greasy Fork 发布检查清单

- [ ] 确认脚本元信息里的 GitHub 链接指向 `estelledc/doubao-auto-system-theme`。
- [ ] 确认 `@license MIT` 存在。
- [ ] 确认 `@match` 只有 `https://www.doubao.com/chat/*`。
- [ ] 确认没有外链加载主体逻辑。
- [ ] 确认没有广告、统计追踪、远程执行代码。
- [ ] 运行 `node --check doubao-auto-system-theme.user.js`。
- [ ] 在深色系统下打开豆包聊天页，运行 `__doubaoThemeAudit()`。
- [ ] 在浅色系统下确认页面恢复豆包原生浅色表现。
- [ ] Greasy Fork 描述中写明“非官方脚本”。
- [ ] GitHub issue 链接可打开。
