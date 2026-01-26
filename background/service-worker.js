// WebFly Background Service Worker

// 点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// 设置侧边栏行为
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 监听来自 content script 和 sidepanel 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    // 获取当前标签页并注入脚本获取内容
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: extractPageContent
          });
          sendResponse({ success: true, data: results[0].result });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }
    });
    return true; // 保持消息通道开放
  }

  if (message.type === 'GET_SELECTED_TEXT') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
          });
          sendResponse({ success: true, data: results[0].result });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }
    });
    return true;
  }
});

// 提取页面内容的函数
function extractPageContent() {
  const title = document.title;
  const url = window.location.href;

  // 获取主要文本内容
  const article = document.querySelector('article') || document.querySelector('main') || document.body;

  // 移除脚本和样式标签
  const clone = article.cloneNode(true);
  clone.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .ads').forEach(el => el.remove());

  // 获取纯文本
  const content = clone.innerText
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000); // 限制长度

  return {
    title,
    url,
    content,
    selectedText: window.getSelection().toString()
  };
}

// 扩展安装或更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装，初始化默认设置
    chrome.storage.sync.set({
      providers: [],
      activeProviderId: null,
      prompts: [
        {
          id: 'default-summary',
          name: 'summary',
          icon: '',
          content: '总结此页面的内容，根据网页的具体内容，用你认为最佳的方式输出总结结果。\n请注意不要遗漏任何重要信息。\n\n输出格式要求：使用标题来组织内容结构，分多个段落。但尽量少用列表符号(如-、*、1.2.3.)、少用加粗、少用分割线。\n\n页面标题：{{title}}\n页面链接：{{url}}\n页面内容：{{content}}'
        },
        {
          id: 'default-translation',
          name: 'translation',
          icon: '',
          content: '请尊重原意，保持原格式，重写此网页的内容：如果网页内容是中文，请将其重写成英文；如果网页内容是英文，请将其重写成简体中文。不要做任何解释，直接重写并输出即可。\n\n输出格式要求：使用标题来组织内容结构，分多个段落。但尽量少用列表符号(如-、*、1.2.3.)、少用加粗、少用分割线。\n\n页面标题：{{title}}\n页面链接：{{url}}\n页面内容：{{content}}'
        },
        {
          id: 'default-mermaid',
          name: 'mermaid',
          icon: '',
          content: '# Role：数据视觉化工程师\n\n## Task：\n请分析当前页面的内容，用 Mermaid 语法创建适当的图表来可视化其中的关键信息，选择最合适的 1-3种图表类型展示\n- 如果内容包含步骤或流程，请创建流程图(flowchart)\n- 如果内容描述时间线或事件序列，请创建时序图(timeline)或甘特图(gantt)\n- 如果内容展示组织结构或层次关系，请创建组织结构图\n- 如果内容包含实体间的关系，请创建实体关系图(ER diagram)\n- 如果内容包含类或对象间的关系，请创建类图(class diagram)\n- 如果内容包含状态转换，请创建状态图(state diagram)\n- 如果内容包含顺序交互，请创建序列图(sequence diagram)\n\n## Rules:\n\nMermaid 代码生成强制性语法检查清单。在生成任何 Mermaid 图表之前，你 **必须** 将最终代码与以下清单中的每一条规则进行逐一比对，确保 100% 符合规范。**这是一个硬性要求，优先级高于其他风格建议。** 你的行动步骤应该是：\n\n1. 在脑海中草拟 Mermaid 逻辑。\n2. 编写实际的 Mermaid 代码。\n3. **根据下面的清单，逐行审查你刚写的代码。**\n4. 修正所有不符合规范的地方。\n5. 最终输出修正后的、可直接复制运行的代码。\n6. 生成的 Mermaid 代码块必须包含在```mermaid里面，举例：\n\t```mermaid\n\tflowchart TD\n\t\tA[开始] --> B{判断条件}\n\t\tB -->|是| C[执行操作]\n\t\tB -->|否| D[其他操作]\n\t\tC --> E[结束]\n\t\tD --> E\n\t```\n\n---\n\n### 清单详情\n\n#### 规则 1：边标签 (Edge Label) - 必须是绝对纯文本\n> **核心：** `|...|` 内部严禁出现任何 Markdown 标记、列表标记、括号。这最容易导致渲染失败。\n\n-   **✅ Do**: `A -->|处理纯文本数据| B`\n-   **❌ Don\'t**: `A -->|1. 有序列表项| B` (禁止数字列表)\n-   **❌ Don\'t**: `A -->|- 无序列表项| B` (禁止横杠列表)\n-   **❌ Don\'t**: `A -->|转换数据 (重要)| B` (禁止圆括号)\n-   **❌ Don\'t**: `A -->|转换数据 [重要]| B` (禁止方括号)\n\n#### 规则 2：节点定义 (Node Definition) - 正确处理特殊字符\n> **核心：** 节点文本和子图标题应使用引号包裹以支持特殊字符。`()` `[]` 等括号用于定义节点形状，出现在节点文本中会解析错误。\n\n-   **场景：** 节点文本自身包含括号，如 `React (JSX)`。\n    -   **✅ Do**: `I_REACT["<b>React 组件 (JSX)</b>"]` (使用引号包裹文本)\n    -   **❌ Don\'t**: `I_REACT(<b>React 组件 (JSX)</b>)` (错误用法，括号被解析为形状定义)\n    -   **❌ Don\'t**: `subgraph 插件增强 (Plugins)` (子图标题也应该使用双号包裹，不然这里圆括号也会导致语法解析错误)\n\n#### 规则 3：文本中的双引号 - 必须转义\n> **核心：** 在节点文本内的引号要使用 `&quot;` 来表示双引号。\n\n-   **✅ Do**: `A[一个包含 &quot;引号&quot; 的节点]`\n-   **❌ Don\'t**: `A[一个包含 "引号" 的节点]`\n\n#### 规则 4：格式化 - 必须使用 HTML 标签\n> **核心：** 换行、加粗等所有格式化都应使用 HTML 标签，不要使用 Markdown。\n\n-   **✅ Do (高可靠性)**: `A["<b>加粗</b>和<code>代码</code><br>这是新一行"]`\n-   **❌ Don\'t (普遍无效)**: `C["# 这是一个标题"]`\n-   **❌ Don\'t (普遍无效)**: ``C["`const` 表示常量"]``\n-   **⚠️ Warn (结果不一致)**: `B["虽然 **Markdown 加粗** 可能碰巧能用，但应避免"]`\n\n#### 规则 5：参与者、消息标签字段禁止使用 HTML 标签（如 `<b>`, `<code>`）\n> **新增规则（重点）**  \n> 在时序图等 Mermaid 语法中，`participant` 的显示名（`as` 后），以及消息描述区域（`:` 后面的内容），**禁止使用 `<b>`, `<code>` 等 HTML 标签**。这些标签在多数环境不会生效，反而会被原样输出或导致解析兼容性问题。  \n> -   **✅ Do**: `participant A as 客户端`\n> -   **❌ Don\'t**: `participant A as <b>客户端</b>`\n> -   **✅ Do**: `A->>B: 1. 请求建立连接`\n> -   **❌ Don\'t**: `A->>B: 1. <code>请求建立连接</code>`\n\n网页内容：\n{{content}}'
        }
      ],
      theme: 'auto'
    });
  }
});
