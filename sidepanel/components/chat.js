// WebFly Chat Component
// 聊天功能核心逻辑

const Chat = {
    messages: [],
    isLoading: false,
    currentProvider: null,
    pageContent: null,

    // 初始化
    async init() {
        this.messagesContainer = document.getElementById('messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearChatBtn = document.getElementById('clear-chat-btn');
        this.copyPageBtn = document.getElementById('copy-page-btn');
        this.pageTitle = document.getElementById('page-title');
        this.pageUrl = document.getElementById('page-url');

        // 绑定事件
        this.bindEvents();

        // 绑定关闭上下文卡片事件
        this.closeContextBtn = document.getElementById('close-context-btn');
        this.pageContextCard = document.getElementById('page-context-card');
        if (this.closeContextBtn) {
            this.closeContextBtn.addEventListener('click', () => {
                this.pageContextCard.classList.add('hidden');
            });
        }

        // 加载当前提供商
        await this.loadProvider();

        // 加载页面信息
        await this.loadPageInfo();

        // 加载聊天历史
        await this.loadHistory();

        // 监听标签页切换
        chrome.tabs.onActivated.addListener(() => {
            this.loadPageInfo();
        });

        // 监听标签页URL变化
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
            if (changeInfo.status === 'complete') {
                this.loadPageInfo();
            }
        });
    },

    // 绑定事件
    bindEvents() {
        // 发送消息
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // 回车发送
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 自动调整输入框高度
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 120) + 'px';
        });

        // 清空对话
        this.clearChatBtn.addEventListener('click', () => this.clearChat());

        // 复制页面内容
        if (this.copyPageBtn) {
            this.copyPageBtn.addEventListener('click', () => this.copyPageContent());
        }
    },

    // 加载提供商配置
    async loadProvider() {
        this.currentProvider = await Storage.getActiveProvider();
    },

    // 加载页面信息
    async loadPageInfo() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
            if (response && response.success) {
                const newUrl = response.data.url;

                // 检查URL是否变化
                if (this.pageContent && this.pageContent.url !== newUrl) {
                    console.log('[WebFly] URL变化，清空聊天历史');
                    this.messages = [];
                    this.messagesContainer.innerHTML = `
                        <div class="welcome-message">
                            <img class="welcome-icon" src="../icons/icon128.png" alt="WebFly" />
                            <h3>WebFly</h3>
                            <p>Ready to help</p>
                        </div>
                    `;
                }

                this.pageContent = response.data;
                this.pageTitle.textContent = response.data.title || '未知页面';
                this.pageUrl.textContent = response.data.url || '';

                // URL变化后重新加载历史
                if (newUrl) {
                    await this.loadHistory();
                }
            }
        } catch (error) {
            console.log('无法获取页面内容:', error.message);
            this.pageTitle.textContent = '无法获取页面信息';
        }
    },

    // 加载聊天历史（按URL存储）
    async loadHistory() {
        if (this.pageContent && this.pageContent.url) {
            this.messages = await Storage.getChatHistoryByUrl(this.pageContent.url);
            this.renderMessages();
        }
    },

    // 保存聊天历史
    async saveHistory() {
        if (this.pageContent && this.pageContent.url) {
            await Storage.saveChatHistoryByUrl(this.pageContent.url, this.messages);
        }
    },

    // 发送消息
    async sendMessage(content = null, isSystemGenerated = false) {
        const text = content || this.userInput.value.trim();
        if (!text || this.isLoading) return;

        // 清空输入框
        if (!content) {
            this.userInput.value = '';
            this.userInput.style.height = 'auto';
        }

        // 添加用户消息
        this.addMessage('user', text, false, isSystemGenerated);

        // 检查提供商配置
        if (!this.currentProvider) {
            this.addMessage('assistant', '⚠️ 请先在设置中配置模型提供商和 API Key。');
            return;
        }

        console.log('[WebFly] 发送消息, 字符数:', text.length);
        console.log('[WebFly] 当前提供商:', this.currentProvider);

        // 开始加载
        this.setLoading(true);

        // 创建助手消息占位
        const assistantMessage = this.addMessage('assistant', '', true);

        // 构建消息历史
        const apiMessages = this.messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));

        console.log('[WebFly] API消息数:', apiMessages.length);

        // 设置超时
        let timeoutId = null;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('请求超时（60秒），请检查网络连接或 API 配置'));
            }, 60000);
        });

        // 调用 API
        let fullResponse = '';

        const apiPromise = API.streamChat(
            this.currentProvider,
            apiMessages,
            // onChunk
            (chunk) => {
                fullResponse += chunk;
                this.updateMessage(assistantMessage, fullResponse);
            },
            // onComplete
            (content) => {
                if (timeoutId) clearTimeout(timeoutId);
                this.finalizeMessage(assistantMessage, content);
                this.setLoading(false);
                this.saveHistory();
            },
            // onError
            (error) => {
                if (timeoutId) clearTimeout(timeoutId);
                console.error('[WebFly] Chat 错误:', error);
                this.updateMessage(assistantMessage, `❌ 错误: ${error.message}`);
                this.setLoading(false);
            }
        );

        // 使用 Promise.race 处理超时
        try {
            await Promise.race([apiPromise, timeoutPromise]);
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            this.updateMessage(assistantMessage, `❌ ${error.message}`);
            this.setLoading(false);
        }
    },

    // 发送带 Prompt 的消息
    async sendWithPrompt(prompt, pageContent = null) {
        if (!pageContent) {
            pageContent = this.pageContent;
        }

        if (!pageContent) {
            await this.loadPageInfo();
            pageContent = this.pageContent;
        }

        // 不限制内容长度，完整发送
        let pageText = pageContent?.content || '(无法获取页面内容)';

        console.log('[WebFly] 页面内容长度:', pageText.length);

        // 替换变量
        let content = prompt.content
            .replace(/\{\{content\}\}/g, pageText)
            .replace(/\{\{selection\}\}/g, pageContent?.selectedText || '')
            .replace(/\{\{title\}\}/g, pageContent?.title || '')
            .replace(/\{\{url\}\}/g, pageContent?.url || '');

        console.log('[WebFly] 最终消息长度:', content.length);

        // 标记这是系统生成的长消息，需要折叠显示
        await this.sendMessage(content, true);
    },

    // 添加消息
    addMessage(role, content, isStreaming = false, isCollapsed = false) {
        // 使用时间戳 + 随机数 + 角色后缀，确保 ID 唯一
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${role}`;
        const message = {
            id: uniqueId,
            role,
            content,
            timestamp: Date.now(),
            isCollapsed: isCollapsed,
            // 保存页面信息，用于刷新后渲染卡片
            pageTitle: this.pageContent?.title || '',
            pageUrl: this.pageContent?.url || ''
        };

        // 只有完整的用户消息才加入历史
        if (role === 'user') {
            this.messages.push(message);
        }

        // 移除欢迎消息
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        messageEl.id = `msg-${message.id}`;

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';

        if (isStreaming) {
            contentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        } else {
            if (role === 'user' && isCollapsed && content.length > 100) {
                // 用户长消息显示为链接卡片样式
                const pageTitle = this.pageContent?.title || '页面内容';
                const pageUrl = this.pageContent?.url || '';
                const shortUrl = pageUrl.length > 50 ? pageUrl.slice(0, 50) + '...' : pageUrl;
                contentEl.innerHTML = `
                    <div class="message-link-card">
                        <div class="link-icon">📄</div>
                        <div class="link-info">
                            <div class="link-title">${this.escapeHtml(pageTitle)}</div>
                            <div class="link-url">${this.escapeHtml(shortUrl)}</div>
                        </div>
                    </div>
                `;
            } else {
                contentEl.innerHTML = role === 'assistant' ? Markdown.renderMessage(content) : this.escapeHtml(content);
            }
        }

        // 为assistant消息添加复制按钮
        if (role === 'assistant' && !isStreaming) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-message-btn';
            copyBtn.title = '复制内容';
            copyBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
            copyBtn.addEventListener('click', () => this.copyMessageContent(content, copyBtn));
            messageEl.appendChild(copyBtn);
        }

        messageEl.appendChild(contentEl);
        this.messagesContainer.appendChild(messageEl);

        // 滚动到底部
        this.scrollToBottom();

        return message.id;
    },

    // 更新消息内容（流式）
    updateMessage(messageId, content) {
        const messageEl = document.getElementById(`msg-${messageId}`);
        if (messageEl) {
            const contentEl = messageEl.querySelector('.message-content');
            contentEl.innerHTML = Markdown.renderMessage(content);
            // 流式输出时不渲染 Mermaid，等消息完成后再渲染
            this.scrollToBottom();
        }
    },

    // 完成消息（保存到历史）
    finalizeMessage(messageId, content) {
        // 确保移除加载指示器
        const messageEl = document.getElementById(`msg-${messageId}`);
        if (messageEl) {
            const typingIndicator = messageEl.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            // 消息完成后渲染 Mermaid 图表
            const contentEl = messageEl.querySelector('.message-content');
            if (contentEl) {
                Markdown.renderMermaidInElement(contentEl);
            }
        }

        this.messages.push({
            id: messageId,
            role: 'assistant',
            content,
            timestamp: Date.now()
        });
    },

    // 渲染所有消息
    renderMessages() {
        // 先清空容器中的所有消息（保留结构）
        this.messagesContainer.innerHTML = '';

        if (this.messages.length === 0) {
            // 如果没有消息，显示欢迎消息
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'welcome-message';
            welcomeDiv.innerHTML = `
                <img class="welcome-icon" src="../icons/icon128.png" alt="WebFly" />
                <h3>WebFly</h3>
                <p>Ready to help</p>
            `;
            this.messagesContainer.appendChild(welcomeDiv);
            return;
        }

        // 渲染历史消息
        this.messages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.role}`;
            messageEl.id = `msg-${msg.id}`;

            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';

            // 检查是否需要以卡片形式显示
            if (msg.role === 'user' && msg.isCollapsed && msg.content.length > 100) {
                const pageTitle = msg.pageTitle || '页面内容';
                const pageUrl = msg.pageUrl || '';
                const shortUrl = pageUrl.length > 50 ? pageUrl.slice(0, 50) + '...' : pageUrl;
                contentEl.innerHTML = `
                    <div class="message-link-card">
                        <div class="link-icon">📄</div>
                        <div class="link-info">
                            <div class="link-title">${this.escapeHtml(pageTitle)}</div>
                            <div class="link-url">${this.escapeHtml(shortUrl)}</div>
                        </div>
                    </div>
                `;
            } else {
                contentEl.innerHTML = msg.role === 'assistant'
                    ? Markdown.renderMessage(msg.content)
                    : this.escapeHtml(msg.content);
            }

            messageEl.appendChild(contentEl);

            // 为assistant消息添加复制按钮
            if (msg.role === 'assistant') {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-message-btn';
                copyBtn.title = '复制内容';
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
                copyBtn.addEventListener('click', () => this.copyMessageContent(msg.content, copyBtn));
                messageEl.appendChild(copyBtn);
            }

            this.messagesContainer.appendChild(messageEl);

            // 渲染 Mermaid 图表
            if (msg.role === 'assistant') {
                Markdown.renderMermaidInElement(contentEl);
            }
        });

        this.scrollToBottom();
    },

    // 清空对话
    async clearChat() {
        this.messages = [];
        this.messagesContainer.innerHTML = ''; // 清空消息

        // 可选：添加一个简单的欢迎占位
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <img class="welcome-icon" src="../icons/icon128.png" alt="WebFly" />
            <h3>WebFly</h3>
            <p>Ready to help</p>
        `;
        this.messagesContainer.appendChild(welcomeDiv);

        // 按 URL 清除聊天历史
        if (this.pageContent && this.pageContent.url) {
            await Storage.clearChatHistoryByUrl(this.pageContent.url);
        }
    },

    // 设置加载状态
    setLoading(loading) {
        this.isLoading = loading;
        this.sendBtn.disabled = loading;
        this.userInput.disabled = loading;
    },

    // 滚动到底部
    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });
    },

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 刷新提供商配置
    async refreshProvider() {
        await this.loadProvider();
    },

    // 复制页面内容
    async copyPageContent() {
        if (!this.pageContent) {
            await this.loadPageInfo();
        }

        if (!this.pageContent) {
            this.showCopyFeedback(this.copyPageBtn, false);
            return;
        }

        const content = `页面标题：${this.pageContent.title || '未知'}\n页面链接：${this.pageContent.url || '未知'}\n页面内容：${this.pageContent.content || '无内容'}`;

        try {
            await navigator.clipboard.writeText(content);
            this.showCopyFeedback(this.copyPageBtn, true);
        } catch (err) {
            console.error('复制失败:', err);
            this.showCopyFeedback(this.copyPageBtn, false);
        }
    },

    // 复制消息内容
    async copyMessageContent(content, button) {
        try {
            await navigator.clipboard.writeText(content);
            this.showCopyFeedback(button, true);
        } catch (err) {
            console.error('复制失败:', err);
            this.showCopyFeedback(button, false);
        }
    },

    // 显示复制反馈
    showCopyFeedback(button, success) {
        const originalHTML = button.innerHTML;
        const originalTitle = button.title;

        if (success) {
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            button.title = '已复制';
            button.style.color = '#10b981';
        } else {
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            button.title = '复制失败';
            button.style.color = '#ef4444';
        }

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.title = originalTitle;
            button.style.color = '';
        }, 2000);
    }
};

// 导出
window.Chat = Chat;
