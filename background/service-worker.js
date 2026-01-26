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
          name: '总结',
          icon: '📝',
          content: '请总结以下网页内容，用简洁明了的方式输出总结结果。\n请注意不要遗漏任何重要信息。\n\n网页内容：\n{{content}}'
        },
        {
          id: 'default-translate',
          name: '翻译',
          icon: '🌐',
          content: '请将以下内容翻译成中文（如果原文是中文则翻译成英文）。\n保持原文的格式和语气。\n\n内容：\n{{content}}'
        },
        {
          id: 'default-explain',
          name: '解释',
          icon: '💡',
          content: '请用通俗易懂的语言解释以下内容，帮助我理解其含义。\n\n内容：\n{{content}}'
        }
      ],
      theme: 'auto'
    });
  }
});
