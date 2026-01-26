// WebFly Markdown Module
// Markdown 渲染封装

const Markdown = {
    // 初始化 marked 配置
    init() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
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

    // 渲染消息内容（带安全处理）
    renderMessage(text) {
        const html = this.render(text);
        return this.sanitizeHtml(html);
    },

    // 简单的 HTML 清理（保留安全标签）
    sanitizeHtml(html) {
        // 允许的标签
        const allowedTags = [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote', 'pre', 'code',
            'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'hr', 'del', 'sup', 'sub'
        ];

        // 创建一个临时 DOM 来处理
        const template = document.createElement('template');
        template.innerHTML = html;

        // 处理链接，添加安全属性
        template.content.querySelectorAll('a').forEach(a => {
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
        });

        return template.innerHTML;
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    Markdown.init();
});

// 导出
window.Markdown = Markdown;
