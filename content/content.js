// WebFly Content Script
// 在网页中运行，提取页面内容

(function () {
    'use strict';

    // 监听来自扩展的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'EXTRACT_CONTENT') {
            const content = extractPageContent();
            sendResponse({ success: true, data: content });
        }
        return true;
    });

    // 提取页面内容
    function extractPageContent() {
        const title = document.title;
        const url = window.location.href;
        const selectedText = window.getSelection().toString();

        // 尝试找到主要内容区域
        const mainContent = findMainContent();

        return {
            title,
            url,
            content: mainContent,
            selectedText,
            timestamp: Date.now()
        };
    }

    // 查找页面主要内容
    function findMainContent() {
        // 优先级：article > main > 自定义选择器 > body
        const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            '#content'
        ];

        let contentElement = null;

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim().length > 100) {
                contentElement = element;
                break;
            }
        }

        if (!contentElement) {
            contentElement = document.body;
        }

        // 克隆元素并清理
        const clone = contentElement.cloneNode(true);

        // 移除不需要的元素
        const removeSelectors = [
            'script',
            'style',
            'nav',
            'header',
            'footer',
            'aside',
            'iframe',
            '.advertisement',
            '.ads',
            '.ad-container',
            '.social-share',
            '.comments',
            '#comments',
            '.sidebar',
            '.navigation'
        ];

        removeSelectors.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });

        // 获取纯文本并清理
        let text = clone.innerText;

        // 压缩多余空白
        text = text
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();

        // 限制长度（约50000字符，避免超出API限制）
        if (text.length > 50000) {
            text = text.slice(0, 50000) + '\n\n[内容已截断...]';
        }

        return text;
    }

    // 向后台发送页面信息（用于标签页切换时）
    function notifyPageLoad() {
        chrome.runtime.sendMessage({
            type: 'PAGE_LOADED',
            data: {
                title: document.title,
                url: window.location.href
            }
        }).catch(() => {
            // 忽略错误（扩展可能未运行）
        });
    }

    // 页面加载完成后通知
    if (document.readyState === 'complete') {
        notifyPageLoad();
    } else {
        window.addEventListener('load', notifyPageLoad);
    }
})();
