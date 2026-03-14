// WebFly Markdown Module
// Markdown 渲染封装 + Mermaid 支持

const Markdown = {
    mermaidInitialized: false,
    mermaidIdCounter: 0,
    allowedTags: new Set([
        'p', 'br', 'strong', 'b', 'em', 'i', 'u',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'del', 'sup', 'sub'
    ]),
    unwrapTags: new Set(['div', 'span']),
    dropTags: new Set([
        'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
        'textarea', 'select', 'option', 'link', 'meta', 'base'
    ]),
    allowedAttributes: {
        a: new Set(['href', 'title', 'target', 'rel']),
        code: new Set(['class']),
        td: new Set(['colspan', 'rowspan']),
        th: new Set(['colspan', 'rowspan'])
    },

    // 初始化 marked 和 mermaid 配置
    init() {
        // 初始化 marked
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
        }

        // 初始化 mermaid
        this.initMermaid();
    },

    // 初始化 Mermaid
    initMermaid() {
        if (typeof mermaid !== 'undefined' && !this.mermaidInitialized) {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: {
                    htmlLabels: true
                },
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            });
            this.mermaidInitialized = true;
        }
    },

    // 渲染 Markdown 为 HTML
    render(text) {
        if (!text) return '';

        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(text);
            } catch (e) {
                console.error('Markdown 渲染错误:', e);
                return this.escapeHtml(text);
            }
        }

        // 如果 marked 不可用，使用简单的转换
        return this.simpleRender(text);
    },

    // 简单的 Markdown 渲染（后备方案）
    simpleRender(text) {
        let html = this.escapeHtml(text);

        // 代码块
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

        // 行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 粗体
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 斜体
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 链接
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // 换行
        html = html.replace(/\n/g, '<br>');

        return html;
    },

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 渲染消息内容（带安全处理和 Mermaid 渲染）
    renderMessage(text) {
        let html = this.render(text);
        html = this.sanitizeHtml(html);
        return html;
    },

    // 渲染 Mermaid 图表（在 DOM 插入后调用）
    async renderMermaidInElement(container) {
        if (typeof mermaid === 'undefined') return;

        this.initMermaid();

        // 只查找明确标记为 mermaid 的代码块
        const codeBlocks = container.querySelectorAll('pre code.language-mermaid');

        for (const codeBlock of codeBlocks) {
            const pre = codeBlock.parentElement;
            const code = codeBlock.textContent.trim();

            if (!code) continue;

            // 已经渲染过的跳过
            if (pre.classList.contains('mermaid-rendered')) continue;

            try {
                // 生成唯一 ID
                const id = `mermaid-${Date.now()}-${this.mermaidIdCounter++}`;

                // 渲染 Mermaid
                const { svg } = await mermaid.render(id, code);

                // 创建容器替换 pre
                const mermaidContainer = document.createElement('div');
                mermaidContainer.className = 'mermaid-container';
                const safeSvg = this.sanitizeSvg(svg);
                if (!safeSvg) {
                    throw new Error('生成的 Mermaid SVG 不安全');
                }
                mermaidContainer.appendChild(safeSvg);

                pre.replaceWith(mermaidContainer);
            } catch (e) {
                console.error('Mermaid 渲染错误:', e);
                pre.classList.add('mermaid-rendered', 'mermaid-error');
            }
        }
    },

    // 白名单 HTML 清理
    sanitizeHtml(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        this.sanitizeNodeTree(template.content);

        return template.innerHTML;
    },

    sanitizeNodeTree(root) {
        const children = Array.from(root.childNodes);
        for (const child of children) {
            if (child.nodeType === Node.TEXT_NODE) {
                continue;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) {
                child.remove();
                continue;
            }

            const tagName = child.tagName.toLowerCase();

            if (this.dropTags.has(tagName)) {
                child.remove();
                continue;
            }

            if (this.unwrapTags.has(tagName)) {
                this.sanitizeNodeTree(child);
                this.unwrapElement(child);
                continue;
            }

            if (!this.allowedTags.has(tagName)) {
                const textNode = document.createTextNode(child.textContent || '');
                child.replaceWith(textNode);
                continue;
            }

            this.sanitizeElement(child, tagName);
            this.sanitizeNodeTree(child);
        }
    },

    sanitizeElement(element, tagName) {
        const allowedAttributes = this.allowedAttributes[tagName] || new Set();

        for (const attr of Array.from(element.attributes)) {
            const attrName = attr.name.toLowerCase();
            const attrValue = attr.value;

            if (attrName.startsWith('on') || attrName === 'style') {
                element.removeAttribute(attr.name);
                continue;
            }

            if (!allowedAttributes.has(attrName)) {
                element.removeAttribute(attr.name);
                continue;
            }

            if (tagName === 'a' && attrName === 'href') {
                const safeUrl = this.sanitizeUrl(attrValue, false);
                if (safeUrl) {
                    element.setAttribute('href', safeUrl);
                } else {
                    element.removeAttribute('href');
                }
            }

            if (tagName === 'code' && attrName === 'class') {
                const safeClass = attrValue
                    .split(/\s+/)
                    .find(className => /^language-[a-z0-9_-]+$/i.test(className));

                if (safeClass) {
                    element.setAttribute('class', safeClass);
                } else {
                    element.removeAttribute('class');
                }
            }
        }

        if (tagName === 'a') {
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noopener noreferrer');
        }
    },

    sanitizeUrl(url, allowDataImage = false) {
        if (!url) {
            return '';
        }

        const trimmedUrl = url.trim();
        if (trimmedUrl.startsWith('#')) {
            return trimmedUrl;
        }

        try {
            const parsedUrl = new URL(trimmedUrl, window.location.href);
            const protocol = parsedUrl.protocol.toLowerCase();
            const isSafeProtocol = protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';

            if (isSafeProtocol) {
                return parsedUrl.toString();
            }
        } catch (error) {
            if (allowDataImage && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(trimmedUrl)) {
                return trimmedUrl;
            }
        }

        return '';
    },

    unwrapElement(element) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
            fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
    },

    sanitizeSvg(svg) {
        const parser = new DOMParser();
        const svgDocument = parser.parseFromString(svg, 'image/svg+xml');
        const parseError = svgDocument.querySelector('parsererror');
        const svgElement = svgDocument.documentElement;

        if (parseError || !svgElement || svgElement.tagName.toLowerCase() !== 'svg') {
            return null;
        }

        this.sanitizeSvgNode(svgElement);
        return document.importNode(svgElement, true);
    },

    sanitizeSvgNode(node) {
        for (const attribute of Array.from(node.attributes || [])) {
            const attributeName = attribute.name.toLowerCase();
            const attributeValue = attribute.value.trim();

            if (attributeName.startsWith('on')) {
                node.removeAttribute(attribute.name);
                continue;
            }

            if (attributeName === 'style') {
                const safeStyle = this.sanitizeStyleValue(attributeValue);
                if (safeStyle) {
                    node.setAttribute(attribute.name, safeStyle);
                } else {
                    node.removeAttribute(attribute.name);
                }
                continue;
            }

            if ((attributeName === 'href' || attributeName === 'xlink:href')
                && /^javascript:/i.test(attributeValue)) {
                node.removeAttribute(attribute.name);
            }
        }

        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childTagName = child.tagName.toLowerCase();
                if (childTagName === 'script' || childTagName === 'iframe'
                    || childTagName === 'object' || childTagName === 'embed') {
                    child.remove();
                    continue;
                }

                this.sanitizeSvgNode(child);
            }
        }
    },

    sanitizeStyleValue(styleValue) {
        if (!styleValue) {
            return '';
        }

        const normalizedStyle = styleValue.replace(/\s+/g, ' ').trim();
        const hasUnsafeContent = /expression\s*\(|javascript:|@import|behavior\s*:|url\s*\(\s*['"]?\s*javascript:/i.test(normalizedStyle);

        return hasUnsafeContent ? '' : normalizedStyle;
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    Markdown.init();
});

// 导出
window.Markdown = Markdown;

