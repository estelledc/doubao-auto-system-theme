# 豆包网页版自动深色模式

一个面向豆包聊天页的浏览器主题适配器：跟随系统深浅色、修复 SPA 主题漂移，并补齐侧栏、Markdown、代码块、输入区和浮层的可读性。

> **English summary:** A focused userscript that follows the operating-system theme, repairs SPA theme drift, and audits the readability of navigation, Markdown, code, and overlay surfaces.

[公开案例](https://estelledc.github.io/doubao-auto-system-theme/) · [Jason Hub](https://estelledc.github.io/) · [About](https://estelledc.github.io/about/) · [Resume](https://estelledc.github.io/resume/)

> 非豆包官方脚本。当前版本只覆盖 Chrome + Tampermonkey 与 `https://www.doubao.com/chat/*`；豆包前端改版后可能需要继续适配。

## 公开展示契约

公开页面把项目讲成一条可核验的适配链，而不是泛化成“完整深色模式”：

| 展示事实 | 源码依据 | 边界 |
|---|---|---|
| 当前版本 `1.0.0` | userscript metadata 与 `VERSION` 常量 | 不等于长期兼容承诺 |
| 同步 4 个主题属性 | `THEME_ATTRS` | 只描述当前实现 |
| 5 个延迟复核节点 | `VERIFY_DELAYS` | 不能替代真实页面回归 |
| 5 类页面审计表面 | `__doubaoThemeAudit()` 返回值 | 只覆盖当前可见 DOM |
| `@grant none` 且无网络请求 API | metadata 与静态契约检查 | 安装前仍应自行审查源码 |

**角色边界**：Jason 作为公开仓库维护者，负责问题边界、验证口径和版本发布；AI 与工程工具辅助选择器梳理、样式批处理、文档和自动检查。具体代码归属以 Git 历史为准，不从仓库所有权推断个人独立完成。

## 为什么做

深色适配不只是把背景改黑。单页应用启动、路由变化和异步渲染都可能重写主题状态；主背景变暗后，局部仍可能出现低对比文字、浅色代码顶栏或白色浮层。

这个脚本把问题拆成四步：

1. **Sense**：读取并监听 `prefers-color-scheme`。
2. **Synchronize**：同时同步 `html`、`body` 的主题属性、class 与 `color-scheme`。
3. **Repair**：只对已知表面做有边界的样式修补，不全局反色。
4. **Audit**：用 `__doubaoThemeAudit()` 输出主题状态、对比度和残留表面。

## 当前能力

- 系统切换浅色/深色时无需刷新页面。
- 监听主题属性漂移、路由变化、页面重新可见和启动后的异步渲染。
- 修复历史侧栏、Markdown 正文、表格、引用、行内代码与代码块。
- 修复输入区、菜单、弹窗和 toast 等常见浅色残留。
- 输出侧栏、正文、暗字岛、代码块和亮色岛五类审计数据。

## 不做什么

- 不使用 `filter: invert()` 粗暴反色。
- 不全局改写 `p`、`span` 或 `button`，避免误伤图片、品牌色与控件。
- 不读取、保存或上传聊天内容。
- 不支持豆包聊天页以外的页面。
- 不声称已有完整浏览器矩阵、安装量或长期稳定性证据。
- 不承诺永久适配豆包未来 UI 改版。

## 手动安装

1. 在 Chrome 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开 [`doubao-auto-system-theme.user.js`](doubao-auto-system-theme.user.js)。
3. 在 Tampermonkey 管理面板新建脚本，粘贴全文并保存。
4. 打开或刷新 [豆包聊天页](https://www.doubao.com/chat/)，切换系统外观。

需要排查时，在浏览器控制台运行：

```js
__doubaoThemeAudit()
```

## 本地查看案例页

```sh
python3 -m http.server 8000
```

打开 `http://localhost:8000/`。公开站点是项目说明与机制示意，不会加载豆包页面或聊天数据。

## 构建与验证

```sh
node --check doubao-auto-system-theme.user.js
node --check assets/showcase.js
python3 scripts/check_showcase.py
python3 scripts/build_site.py
python3 scripts/check_showcase.py --built
```

`check_showcase.py` 会验证：案例结构、SEO/JSON-LD、资源链接、1200×630 分享图、Jason DS v2、userscript 事实、隐私声明，以及所有第三方 GitHub Actions 是否固定到完整 commit SHA。

分享图可选重生成：

```sh
python3 -m pip install Pillow
python3 scripts/generate_og.py
```

## 反馈问题

请通过 [GitHub Issues](https://github.com/estelledc/doubao-auto-system-theme/issues) 提交，并尽量附上：

- 浏览器和 Tampermonkey 版本。
- 系统当前是浅色还是深色。
- 问题区域的脱敏截图。
- `__doubaoThemeAudit()` 的脱敏输出。

请勿上传聊天正文、头像、用户名、企业信息或其他私人内容。

## License

MIT。豆包名称与产品界面归其权利人所有；本项目与豆包官方无隶属或背书关系。
