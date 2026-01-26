# WebFly - AI 网页助手

一个强大的 Chrome 浏览器扩展，通过 AI 模型智能处理网页内容。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特性

- 🤖 **多模型支持** - 支持 OpenAI、Gemini、DeepSeek、通义千问等多个 AI 模型
- 💬 **侧边栏对话** - 流畅的聊天界面，支持流式响应和 Markdown 渲染
- 📝 **快捷操作** - 预置总结、翻译、解释等 Prompt 模板，可自定义添加
- 🌐 **智能提取** - 自动提取网页核心内容，过滤广告和无关元素
- 💾 **历史记录** - 按 URL 独立保存对话历史，切换网页自动清空
- 🎨 **现代设计** - 支持浅色/深色主题，蓝色配色方案

## 📦 安装

### 从源码安装

1. 克隆仓库
```bash
git clone https://github.com/xiaolinbaba/webfly.git
cd webfly
```

2. 在 Chrome 中加载扩展
   - 打开 `chrome://extensions/`
   - 开启 **开发者模式**
   - 点击 **加载已解压的扩展程序**
   - 选择项目目录

## 🚀 使用指南

### 1. 配置 API

首次使用需要配置 AI 模型提供商：

1. 点击浏览器工具栏的 WebFly 图标
2. 点击右上角设置按钮 ⚙️
3. 选择 **模型提供商** 标签
4. 点击 **添加提供商**
5. 选择提供商类型（OpenAI/Gemini/DeepSeek/Qwen等）
6. 输入 API Key 和默认模型
7. 保存

### 2. 使用快捷操作

- **总结** 📝 - 一键总结当前网页内容
- **翻译** 🌐 - 中英文互译
- **解释** 💡 - 通俗易懂地解释内容

### 3. 自定义 Prompt

在设置中可以创建自己的快捷操作：

- 设置 Prompt 名称和图标
- 使用变量：`{{content}}`（网页内容）、`{{selection}}`（选中文本）、`{{title}}`（页面标题）、`{{url}}`（页面URL）

## 🛠️ 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无框架依赖
- **Chrome Storage API** - 本地数据存储
- **Marked.js** - Markdown 渲染
- **OpenAI 兼容 API** - 支持多种 AI 模型

## 📝 支持的 AI 提供商

| 提供商 | Base URL |
|--------|----------|
| OpenAI | `https://api.openai.com/v1` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| 自定义 | 用户自定义 URL |

## 🔒 隐私安全

- ✅ API Key 仅存储在用户本地
- ✅ 不上传任何数据到第三方服务器
- ✅ 聊天历史本地存储
- ✅ 开源代码，可审计

## 📖 开发说明

项目结构：

```
webfly/
├── manifest.json           # 扩展配置
├── icons/                  # 图标资源
├── background/            # 后台服务
│   └── service-worker.js
├── content/               # 内容脚本
│   └── content.js
└── sidepanel/             # 侧边栏界面
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── components/        # 组件
    │   ├── chat.js
    │   └── quick-actions.js
    └── lib/               # 工具库
        ├── api.js
        ├── storage.js
        ├── markdown.js
        └── marked.min.js
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License

## 👨‍💻 作者

[@xiaolinbaba](https://github.com/xiaolinbaba)

---

**如果觉得这个项目有帮助，请给个 ⭐Star 支持一下！**
