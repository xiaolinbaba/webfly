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

  // 尝试多种选择器，优先选择文章主体内容
  const contentSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#content',
    '.markdown-body',
    '.post-body',
    '.blog-content',
    '.blog-post',
    '[class*="Post_content"]',
    '[class*="blog-details"]',
    '[class*="RichText"]',
    '.prose',
    '[class*="article"]',
    '[class*="post"]',
    '[id*="article"]',
    '[id*="post"]'
  ];

  let article = null;
  let maxScore = 0;

  // 先尝试标准选择器
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const textLength = element.innerText?.trim().length || 0;
      if (textLength > 100) {
        article = element;
        break;
      }
    }
  }

  // 如果没找到，使用智能检测：找文本密度最高的元素
  if (!article) {
    const candidates = document.querySelectorAll('div, section, article');

    for (const candidate of candidates) {
      // 跳过明显的非内容区域
      const classList = candidate.className.toLowerCase();
      const id = candidate.id.toLowerCase();
      if (classList.includes('nav') || classList.includes('header') ||
        classList.includes('footer') || classList.includes('sidebar') ||
        id.includes('nav') || id.includes('header') || id.includes('footer')) {
        continue;
      }

      // 计算文本密度分数
      const textLength = candidate.innerText?.trim().length || 0;
      const childrenCount = candidate.children.length || 1;
      const score = textLength / Math.sqrt(childrenCount);

      if (score > maxScore && textLength > 200) {
        maxScore = score;
        article = candidate;
      }
    }
  }

  // 如果还是没找到合适的容器，使用 body
  if (!article) {
    article = document.body;
  }

  // 克隆节点以避免修改原始DOM
  const clone = article.cloneNode(true);

  // 移除不需要的元素
  const unwantedSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    '.sidebar',
    '.advertisement',
    '.ads',
    '.comments',
    '.related-posts',
    '.share-buttons',
    '.social-share',
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="banner"]',
    '[role="contentinfo"]'
  ];

  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // 提取文本并保留段落结构
  function extractTextWithParagraphs(element) {
    let text = '';
    const blockElements = new Set([
      'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'LI', 'TR', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'PRE'
    ]);

    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent.trim();
        if (content) {
          text += content + ' ';
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName;

        // 遍历子节点
        for (const child of node.childNodes) {
          traverse(child);
        }

        // 块级元素后添加换行
        if (blockElements.has(tagName)) {
          text = text.trim() + '\n\n';
        }
      }
    }

    traverse(element);
    return text.trim().replace(/\n{3,}/g, '\n\n'); // 最多保留两个换行
  }

  const content = extractTextWithParagraphs(clone)
    .slice(0, 50000); // 限制长度

  return {
    title,
    url,
    content,
    selectedText: window.getSelection().toString()
  };
}

// 扩展安装或更新时的处理
chrome.runtime.onInstalled.addListener(async (details) => {
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
          content: '总结此页面的内容，不要遗漏重要信息。\n用Markdown格式输出（语言用简体中文）。\n\n- 避免生硬的引导语或过于 AI 化的词，如：本文介绍了…、作者提出了…、原文大意是…、作者坦言… 等。\n- 避免术语堆砌与长难句；避免空洞套话与过多副词。\n- 避免使用过多 Markdown 加粗、避免过多项目符号。\n\n页面标题：{{title}}\n页面链接：{{url}}\n页面内容：{{content}}'
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
          content: '# Role：数据视觉化工程师\n\n## Task：\n请分析当前页面的内容，用 Mermaid 语法创建适当的图表来可视化其中的关键信息，选择最合适的 1-3种图表类型展示\n- 如果内容包含步骤或流程，请创建流程图(flowchart)\n- 如果内容描述时间线或事件序列，请创建时序图(timeline)或甘特图(gantt)\n- 如果内容展示组织结构或层次关系，请创建组织结构图\n- 如果内容包含实体间的关系，请创建实体关系图(ER diagram)\n- 如果内容包含类或对象间的关系，请创建类图(class diagram)\n- 如果内容包含状态转换，请创建状态图(state diagram)\n- 如果内容包含顺序交互，请创建序列图(sequence diagram)\n\n## Rules:\n\nMermaid 代码生成强制性语法检查清单。在生成任何 Mermaid 图表之前，你必须将最终代码与以下清单中的每一条规则进行逐一比对，确保 100% 符合规范。这是一个硬性要求，优先级高于其他风格建议。你的行动步骤应该是：\n\n1. 在脑海中草拟 Mermaid 逻辑。\n2. 编写实际的 Mermaid 代码。\n3. **根据下面的清单，逐行审查你刚写的代码。**\n4. 修正所有不符合规范的地方。\n5. 最终输出修正后的、可直接复制运行的代码。\n6. 生成的 Mermaid 代码块必须包含在```mermaid里面，举例：\n\t```mermaid\n\tflowchart TD\n\t\tA[开始] --> B{判断条件}\n\t\tB -->|是| C[执行操作]\n\t\tB -->|否| D[其他操作]\n\t\tC --> E[结束]\n\t\tD --> E\n\t```\n\n\n### 语法检查\n\n#### 规则 1：边标签 (Edge Label) - 必须是绝对纯文本\n> **核心：** `|...|` 内部严禁出现任何 Markdown 标记、列表标记、括号。这最容易导致渲染失败。\n\n-   **✅ Do**: `A -->|处理纯文本数据| B`\n-   **❌ Don\'t**: `A -->|1. 有序列表项| B` (禁止数字列表)\n-   **❌ Don\'t**: `A -->|- 无序列表项| B` (禁止横杠列表)\n-   **❌ Don\'t**: `A -->|转换数据 (重要)| B` (禁止圆括号)\n-   **❌ Don\'t**: `A -->|转换数据 [重要]| B` (禁止方括号)\n\n#### 规则 2：节点定义 (Node Definition) - 正确处理特殊字符\n> **核心：** 节点文本和子图标题应使用引号包裹以支持特殊字符。`()` `[]` 等括号用于定义节点形状，出现在节点文本中会解析错误。\n\n-   **场景：** 节点文本自身包含括号，如 `React (JSX)`。\n    -   **✅ Do**: `I_REACT[\"<b>React 组件 (JSX)</b>\"]` (使用引号包裹文本)\n    -   **❌ Don\'t**: `I_REACT(<b>React 组件 (JSX)</b>)` (错误用法，括号被解析为形状定义)\n    -   **❌ Don\'t**: `subgraph 插件增强 (Plugins)` (子图标题也应该使用双号包裹，不然这里圆括号也会导致语法解析错误)\n\n#### 规则 3：文本中的双引号 - 必须转义\n> **核心：** 在节点文本内的引号要使用 `&quot;` 来表示双引号。\n\n-   **✅ Do**: `A[一个包含 &quot;引号&quot; 的节点]`\n-   **❌ Don\'t**: `A[一个包含 "引号" 的节点]`\n\n#### 规则 4：格式化 - 必须使用 HTML 标签\n> **核心：** 换行、加粗等所有格式化都应使用 HTML 标签，不要使用 Markdown。\n\n-   **✅ Do (高可靠性)**: `A[\"<b>加粗</b>和<code>代码</code><br>这是新一行\"]`\n-   **❌ Don\'t (普遍无效)**: `C[\"# 这是一个标题\"]`\n-   **❌ Don\'t (普遍无效)**: ``C[\"`const` 表示常量\"]``\n-   **⚠️ Warn (结果不一致)**: `B[\"虽然 **Markdown 加粗** 可能碰巧能用，但应避免\"]`\n\n#### 规则 5：参与者、消息标签字段禁止使用 HTML 标签（如 `<b>`, `<code>`）\n> **新增规则（重点）**  \n> 在时序图等 Mermaid 语法中，`participant` 的显示名（`as` 后），以及消息描述区域（`:` 后面的内容），**禁止使用 `<b>`, `<code>` 等 HTML 标签**。这些标签在多数环境不会生效，反而会被原样输出或导致解析兼容性问题。  \n> -   **✅ Do**: `participant A as 客户端`\n> -   **❌ Don\'t**: `participant A as <b>客户端</b>`\n> -   **✅ Do**: `A->>B: 1. 请求建立连接`\n> -   **❌ Don\'t**: `A->>B: 1. <code>请求建立连接</code>`\n\n\n## 输出格式\n直接输出 mermaid 代码（内容总是用简体中文），不用做任何解释\n\n\n## 内容\n\n页面标题：{{title}}\n页面链接：{{url}}\n页面内容：{{content}}'
        }
      ],
      theme: 'auto'
    });
  } else if (details.reason === 'update') {
    // 扩展更新时，更新默认 Prompt 内容
    chrome.storage.sync.get(['prompts'], (result) => {
      const prompts = result.prompts || [];

      // 定义新的 Prompt 模板
      const newPromptTemplates = {
        'default-summary': '总结此页面的内容，不要遗漏重要信息。\n用Markdown格式输出（语言用简体中文）。\n\n- 避免生硬的引导语或过于 AI 化的词，如：本文介绍了…、作者提出了…、原文大意是…、作者坦言… 等。\n- 避免术语堆砌与长难句；避免空洞套话与过多副词。\n- 避免使用过多 Markdown 加粗、避免过多项目符号。\n\n页面标题：{{title}}\n页面链接：{{url}}\n页面内容：{{content}}',
        'default-mermaid': '# Role：数据视觉化工程师\n\n## Task：\n请分析当前页面的内容，用 Mermaid 语法创建适当的图表来可视化其中的关键信息，选择最合适的 1-3种图表类型展示\n- 如果内容包含步骤或流程，请创建流程图(flowchart)\n- 如果内容描述时间线或事件序列，请创建时序图(timeline)或甘特图(gantt)\n- 如果内容展示组织结构或层次关系，请创建组织结构图\n- 如果内容包含实体间的关系，请创建实体关系图(ER diagram)\n- 如果内容包含类或对象间的关系，请创建类图(class diagram)\n- 如果内容包含状态转换，请创建状态图(state diagram)\n- 如果内容包含顺序交互，请创建序列图(sequence diagram)\n\n## Rules:\n\nMermaid 代码生成强制性语法检查清单。在生成任何 Mermaid 图表之前，你必须将最终代码与以下清单中的每一条规则进行逐一比对，确保 100% 符合规范。这是一个硬性要求，优先级高于其他风格建议。你的行动步骤应该是：\n\n1. 在脑海中草拟 Mermaid 逻辑。\n2. 编写实际的 Mermaid 代码。\n3. **根据下面的清单，逐行审查你刚写的代码。**\n4. 修正所有不符合规范的地方。\n5. 最终输出修正后的、可直接复制运行的代码。\n6. 生成的 Mermaid 代码块必须包含在```mermaid里面，举例：\n\t```mermaid\n\tflowchart TD\n\t\tA[开始] --> B{判断条件}\n\t\tB -->|是| C[执行操作]\n\t\tB -->|否| D[其他操作]\n\t\tC --> E[结束]\n\t\tD --> E\n\t```\n\n\n### 语法检查\n\n#### 规则 1：边标签 (Edge Label) - 必须是绝对纯文本\n> **核心：** `|...|` 内部严禁出现任何 Markdown 标记、列表标记、括号。这最容易导致渲染失败。\n\n-   **✅ Do**: `A -->|处理纯文本数据| B`\n-   **❌ Don\'t**: `A -->|1. 有序列表项| B` (禁止数字列表)\n-   **❌ Don\'t**: `A -->|- 无序列表项| B` (禁止横杠列表)\n-   **❌ Don\'t**: `A -->|转换数据 (重要)| B` (禁止圆括号)\n-   **❌ Don\'t**: `A -->|转换数据 [重要]| B` (禁止方括号)\n\n#### 规则 2：节点定义 (Node Definition) - 正确处理特殊字符\n> **核心：** 节点文本和子图标题应使用引号包裹以支持特殊字符。`()` `[]` 等括号用于定义节点形状，出现在节点文本中会解析错误。\n\n-   **场景：** 节点文本自身包含括号，如 `React (JSX)`。\n    -   **✅ Do**: `I_REACT[\"<b>React 组件 (JSX)</b>\"]` (使用引号包裹文本)\n    -   **❌ Don\'t**: `I_REACT(<b>React 组件 (JSX)</b>)` (错误用法，括号被解析为形状定义)\n    -   **❌ Don\'t**: `subgraph 插件增强 (Plugins)` (子图标题也应该使用双号包裹，不然这里圆括号也会导致语法解析错误)\n\n#### 规则 3：文本中的双引号 - 必须转义\n> **核心：** 在节点文本内的引号要使用 `&quot;` 来表示双引号。\n\n-   **✅ Do**: `A[一个包含 &quot;引号&quot; 的节点]`\n-   **❌ Don\'t**: `A[一个包含 "引号" 的节点]`\n\n#### 规则 4：格式化 - 必须使用 HTML 标签\n> **核心：** 换行、加粗等所有格式化都应使用 HTML 标签，不要使用 Markdown。\n\n-   **✅ Do (高可靠性)**: `A[\"<b>加粗</b>和<code>代码</code><br>这是新一行\"]`\n-   **❌ Don\'t (普遍无效)**: `C[\"# 这是一个标题\"]`\n-   **❌ Don\'t (普遍无效)**: ``C[\"`const` 表示常量\"]``\n-   **⚠️ Warn (结果不一致)**: `B[\"虽然 **Markdown 加粗** 可能碰巧能用，但应避免\"]`\n\n#### 规则 5：参与者、消息标签字段禁止使用 HTML 标签（如 `<b>`, `<code>`）\n> **新增规则（重点）**  \n> 在时序图等 Mermaid 语法中，`participant` 的显示名（`as` 后），以及消息描述区域（`:` 后面的内容），**禁止使用 `<b>`, `<code>` 等 HTML 标签**。这些标签在多数环境不会生效，反而会被原样输出或导致解析兼容性问题。  \n> -   **✅ Do**: `participant A as 客户端`\n> -   **❌ Don\'t**: `participant A as <b>客户端</b>`\n> -   **✅ Do**: `A->>B: 1. 请求建立连接`\n> -   **❌ Don\'t**: `A->>B: 1. <code>请求建立连接</code>`\n\n\n## 输出格式\n直接输出 mermaid 代码（内容总是用简体中文），不用做任何解释\n\n\n## 内容\n\n页面标题：{{title}}\n页面链接：{{url}}\n页面内容：{{content}}'
      };

      // 更新对应的默认 Prompt
      const updatedPrompts = prompts.map(prompt => {
        if (newPromptTemplates[prompt.id]) {
          return { ...prompt, content: newPromptTemplates[prompt.id] };
        }
        return prompt;
      });

      // 保存更新后的 Prompt
      chrome.storage.sync.set({ prompts: updatedPrompts });
    });
  }
});
