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
        this.modelIndicator = document.getElementById('current-model');
        this.modelDot = document.querySelector('.model-dot');
        this.pageTitle = document.getElementById('page-title');
        this.pageUrl = document.getElementById('page-url');

        // 绑定事件
        this.bindEvents();

        // 加载当前提供商
        await this.loadProvider();

        // 加载页面信息
        await this.loadPageInfo();

        // 加载聊天历史
        await this.loadHistory();
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
    },

    // 加载提供商配置
    async loadProvider() {
        this.currentProvider = await Storage.getActiveProvider();
        this.updateModelIndicator();
    },

    // 更新模型指示器
    updateModelIndicator() {
        if (this.currentProvider) {
            this.modelIndicator.textContent = `${this.currentProvider.name} · ${this.currentProvider.model}`;
            this.modelDot.classList.remove('error', 'warning');
        } else {
            this.modelIndicator.textContent = '未配置模型';
            this.modelDot.classList.add('warning');
        }
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
                            <div class="welcome-icon">🦋</div>
                            <h2>欢迎使用 WebFly</h2>
                            <p>我可以帮你处理当前网页的内容，比如总结、翻译、解释等。</p>
                            <p class="hint">选择下方的快捷操作，或直接输入你的问题。</p>
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
        const message = {
            id: Date.now(),
            role,
            content,
            timestamp: Date.now()
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
            if (role === 'user' && isCollapsed && content.length > 200) {
                // 用户长消息折叠显示
                const preview = content.slice(0, 100) + '...';
                contentEl.innerHTML = `
                    <div class="collapsed-message">
                        <div class="message-preview">${this.escapeHtml(preview)}</div>
                        <button class="expand-btn" onclick="this.parentElement.classList.toggle('expanded')">
                            <span class="expand-text">展开</span>
                            <span class="collapse-text">收起</span>
                        </button>
                        <div class="message-full">${this.escapeHtml(content)}</div>
                    </div>
                `;
            } else {
                contentEl.innerHTML = role === 'assistant' ? Markdown.renderMessage(content) : this.escapeHtml(content);
            }
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
        if (this.messages.length === 0) return;

        // 移除欢迎消息
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // 渲染历史消息
        this.messages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.role}`;
            messageEl.id = `msg-${msg.id}`;

            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.innerHTML = msg.role === 'assistant'
                ? Markdown.renderMessage(msg.content)
                : this.escapeHtml(msg.content);

            messageEl.appendChild(contentEl);
            this.messagesContainer.appendChild(messageEl);
        });

        this.scrollToBottom();
    },

    // 清空对话
    async clearChat() {
        this.messages = [];
        this.messagesContainer.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">🦋</div>
        <h2>欢迎使用 WebFly</h2>
        <p>我可以帮你处理当前网页的内容，比如总结、翻译、解释等。</p>
        <p class="hint">选择下方的快捷操作，或直接输入你的问题。</p>
      </div>
    `;

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            await Storage.clearChatHistory(tabs[0].id);
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
    }
};

// 导出
window.Chat = Chat;
