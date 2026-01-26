// WebFly Storage Module
// Chrome Storage API 封装

const Storage = {
    // 默认配置
    defaults: {
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
    },

    // 获取所有设置
    async getAll() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(this.defaults, (result) => {
                resolve(result);
            });
        });
    },

    // 获取单个设置
    async get(key) {
        const all = await this.getAll();
        return all[key];
    },

    // 设置单个值
    async set(key, value) {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ [key]: value }, () => {
                resolve();
            });
        });
    },

    // 设置多个值
    async setMultiple(data) {
        return new Promise((resolve) => {
            chrome.storage.sync.set(data, () => {
                resolve();
            });
        });
    },

    // ===== 提供商管理 =====

    // 获取所有提供商
    async getProviders() {
        return await this.get('providers') || [];
    },

    // 获取活跃提供商
    async getActiveProvider() {
        const providers = await this.getProviders();
        const activeId = await this.get('activeProviderId');
        return providers.find(p => p.id === activeId) || providers[0] || null;
    },

    // 添加提供商
    async addProvider(provider) {
        const providers = await this.getProviders();
        const newProvider = {
            id: this.generateId(),
            ...provider,
            createdAt: Date.now()
        };
        providers.push(newProvider);
        await this.set('providers', providers);

        // 如果是第一个提供商，设为活跃
        if (providers.length === 1) {
            await this.set('activeProviderId', newProvider.id);
        }

        return newProvider;
    },

    // 更新提供商
    async updateProvider(id, updates) {
        const providers = await this.getProviders();
        const index = providers.findIndex(p => p.id === id);
        if (index !== -1) {
            providers[index] = { ...providers[index], ...updates };
            await this.set('providers', providers);
            return providers[index];
        }
        return null;
    },

    // 删除提供商
    async deleteProvider(id) {
        let providers = await this.getProviders();
        providers = providers.filter(p => p.id !== id);
        await this.set('providers', providers);

        // 如果删除的是活跃提供商，切换到第一个
        const activeId = await this.get('activeProviderId');
        if (activeId === id && providers.length > 0) {
            await this.set('activeProviderId', providers[0].id);
        }
    },

    // 设置活跃提供商
    async setActiveProvider(id) {
        await this.set('activeProviderId', id);
    },

    // ===== Prompt 管理 =====

    // 获取所有 Prompt
    async getPrompts() {
        return await this.get('prompts') || [];
    },

    // 添加 Prompt
    async addPrompt(prompt) {
        const prompts = await this.getPrompts();
        const newPrompt = {
            id: this.generateId(),
            ...prompt,
            createdAt: Date.now()
        };
        prompts.push(newPrompt);
        await this.set('prompts', prompts);
        return newPrompt;
    },

    // 更新 Prompt
    async updatePrompt(id, updates) {
        const prompts = await this.getPrompts();
        const index = prompts.findIndex(p => p.id === id);
        if (index !== -1) {
            prompts[index] = { ...prompts[index], ...updates };
            await this.set('prompts', prompts);
            return prompts[index];
        }
        return null;
    },

    // 删除 Prompt
    async deletePrompt(id) {
        let prompts = await this.getPrompts();
        prompts = prompts.filter(p => p.id !== id);
        await this.set('prompts', prompts);
    },

    // ===== 聊天历史（使用本地存储）=====

    // 获取聊天历史
    async getChatHistory(tabId) {
        return new Promise((resolve) => {
            chrome.storage.local.get({ chats: {} }, (result) => {
                resolve(result.chats[tabId] || []);
            });
        });
    },

    // 保存聊天历史
    async saveChatHistory(tabId, messages) {
        return new Promise((resolve) => {
            chrome.storage.local.get({ chats: {} }, (result) => {
                result.chats[tabId] = messages;
                chrome.storage.local.set({ chats: result.chats }, () => {
                    resolve();
                });
            });
        });
    },

    // 清除聊天历史
    async clearChatHistory(tabId) {
        return new Promise((resolve) => {
            chrome.storage.local.get({ chats: {} }, (result) => {
                delete result.chats[tabId];
                chrome.storage.local.set({ chats: result.chats }, () => {
                    resolve();
                });
            });
        });
    },

    // 清除所有聊天历史
    async clearAllChatHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ chats: {} }, () => {
                resolve();
            });
        });
    },

    // ===== 按 URL 存储聊天历史 =====

    // 获取聊天历史（按URL）
    async getChatHistoryByUrl(url) {
        return new Promise((resolve) => {
            chrome.storage.local.get({ chatsByUrl: {} }, (result) => {
                resolve(result.chatsByUrl[url] || []);
            });
        });
    },

    // 保存聊天历史（按URL）
    async saveChatHistoryByUrl(url, messages) {
        return new Promise((resolve) => {
            chrome.storage.local.get({ chatsByUrl: {} }, (result) => {
                result.chatsByUrl[url] = messages;
                chrome.storage.local.set({ chatsByUrl: result.chatsByUrl }, () => {
                    resolve();
                });
            });
        });
    },

    // 清除聊天历史（按URL）
    async clearChatHistoryByUrl(url) {
        return new Promise((resolve) => {
            chrome.storage.local.get({ chatsByUrl: {} }, (result) => {
                delete result.chatsByUrl[url];
                chrome.storage.local.set({ chatsByUrl: result.chatsByUrl }, () => {
                    resolve();
                });
            });
        });
    },


    // ===== 工具函数 =====

    // 生成唯一 ID
    generateId() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
};

// 导出
window.Storage = Storage;
