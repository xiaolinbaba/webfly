// WebFly Main Application
// 主应用入口

const App = {
    // 初始化应用
    async init() {
        console.log('WebFly 初始化中...');

        // 初始化设置面板 (优先初始化)
        this.initSettings();

        try {
            // 初始化组件
            await Chat.init();
            await QuickActions.init();
        } catch (error) {
            console.error('组件初始化失败:', error);
        }

        console.log('WebFly 初始化完成');
    },

    // 初始化设置面板
    initSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const backBtn = document.getElementById('back-btn');
        const tabBtns = document.querySelectorAll('.tab-btn');

        // 打开设置
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
            this.loadSettingsData();
        });

        // 返回主界面
        backBtn.addEventListener('click', async () => {
            settingsPanel.classList.add('hidden');
            // 刷新数据
            await Chat.refreshProvider();
            await QuickActions.refresh();
        });

        // 标签切换
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                const tabId = btn.dataset.tab;
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });

        // 初始化提供商模态框
        this.initProviderModal();

        // 初始化 Prompt 模态框
        this.initPromptModal();
    },

    // 加载设置数据
    async loadSettingsData() {
        await this.renderProviders();
        await this.renderPrompts();
    },

    // ===== 提供商管理 =====

    async renderProviders() {
        const providers = await Storage.getProviders();
        const activeId = await Storage.get('activeProviderId');
        const container = document.getElementById('providers-list');

        container.innerHTML = '';

        providers.forEach(provider => {
            const item = document.createElement('div');
            item.className = `provider-item ${provider.id === activeId ? 'active' : ''}`;
            item.innerHTML = `
        <div class="provider-icon">${this.getProviderIcon(provider.type)}</div>
        <div class="provider-info">
          <div class="provider-name">${provider.name}</div>
          <div class="provider-model">${provider.model}</div>
        </div>
        <div class="provider-actions">
          <button class="icon-btn edit-provider" title="编辑">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="icon-btn delete-provider" title="删除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

            // 点击选中
            item.addEventListener('click', async (e) => {
                if (!e.target.closest('.icon-btn')) {
                    await Storage.setActiveProvider(provider.id);
                    this.renderProviders();
                }
            });

            // 编辑按钮
            item.querySelector('.edit-provider').addEventListener('click', () => {
                this.openProviderModal(provider);
            });

            // 删除按钮
            item.querySelector('.delete-provider').addEventListener('click', async () => {
                if (confirm(`确定要删除 "${provider.name}" 吗？`)) {
                    await Storage.deleteProvider(provider.id);
                    this.renderProviders();
                }
            });

            container.appendChild(item);
        });

        // 添加提供商按钮
        document.getElementById('add-provider-btn').onclick = () => {
            this.openProviderModal();
        };
    },

    getProviderIcon(type) {
        const icons = {
            openai: '🤖',
            gemini: '✨',
            deepseek: '🔮',
            qwen: '🌟',
            openrouter: '🔄',
            custom: '⚙️'
        };
        return icons[type] || '🤖';
    },

    // 提供商模态框
    initProviderModal() {
        const modal = document.getElementById('provider-modal');
        const closeBtn = document.getElementById('close-provider-modal');
        const cancelBtn = document.getElementById('cancel-provider');
        const saveBtn = document.getElementById('save-provider');
        const typeSelect = document.getElementById('provider-type');

        // 关闭模态框
        const closeModal = () => {
            modal.classList.add('hidden');
            this.editingProviderId = null;
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

        // 类型切换
        typeSelect.addEventListener('change', () => {
            const type = typeSelect.value;
            const isCustom = type === 'custom';

            document.getElementById('custom-name-group').style.display = isCustom ? 'block' : 'none';
            document.getElementById('custom-url-group').style.display = isCustom ? 'block' : 'none';

            if (!isCustom) {
                const preset = API.presets[type];
                document.getElementById('provider-model').value = preset.defaultModel || '';
            }
        });

        // 保存
        saveBtn.addEventListener('click', async () => {
            const type = typeSelect.value;
            const preset = API.presets[type];

            const provider = {
                type,
                name: type === 'custom'
                    ? document.getElementById('provider-custom-name').value
                    : preset.name,
                baseUrl: type === 'custom'
                    ? document.getElementById('provider-base-url').value
                    : preset.baseUrl,
                apiKey: document.getElementById('provider-api-key').value,
                model: document.getElementById('provider-model').value || preset.defaultModel
            };

            if (!provider.apiKey) {
                alert('请输入 API Key');
                return;
            }

            if (type === 'custom' && !provider.name) {
                alert('请输入自定义名称');
                return;
            }

            if (type === 'custom' && !provider.baseUrl) {
                alert('请输入 API Base URL');
                return;
            }

            if (this.editingProviderId) {
                await Storage.updateProvider(this.editingProviderId, provider);
            } else {
                await Storage.addProvider(provider);
            }

            closeModal();
            this.renderProviders();
        });
    },

    openProviderModal(provider = null) {
        const modal = document.getElementById('provider-modal');
        const title = document.getElementById('provider-modal-title');

        if (provider) {
            title.textContent = '编辑模型提供商';
            this.editingProviderId = provider.id;

            document.getElementById('provider-type').value = provider.type;
            document.getElementById('provider-api-key').value = provider.apiKey || '';
            document.getElementById('provider-model').value = provider.model || '';

            if (provider.type === 'custom') {
                document.getElementById('provider-custom-name').value = provider.name || '';
                document.getElementById('provider-base-url').value = provider.baseUrl || '';
                document.getElementById('custom-name-group').style.display = 'block';
                document.getElementById('custom-url-group').style.display = 'block';
            } else {
                document.getElementById('custom-name-group').style.display = 'none';
                document.getElementById('custom-url-group').style.display = 'none';
            }
        } else {
            title.textContent = '添加模型提供商';
            this.editingProviderId = null;

            document.getElementById('provider-type').value = 'openai';
            document.getElementById('provider-api-key').value = '';
            document.getElementById('provider-model').value = 'gpt-4o-mini';
            document.getElementById('custom-name-group').style.display = 'none';
            document.getElementById('custom-url-group').style.display = 'none';
        }

        modal.classList.remove('hidden');
    },

    // ===== Prompt 管理 =====

    async renderPrompts() {
        const prompts = await Storage.getPrompts();
        const container = document.getElementById('prompts-list');

        container.innerHTML = '';

        prompts.forEach(prompt => {
            const item = document.createElement('div');
            item.className = 'prompt-item';
            item.innerHTML = `
        <div class="prompt-icon">${prompt.icon || ''}</div>
        <div class="prompt-info">
          <div class="prompt-name">${prompt.name}</div>
          <div class="prompt-preview">${prompt.content.slice(0, 50)}...</div>
        </div>
      `;

            item.addEventListener('click', () => {
                this.openPromptModal(prompt);
            });

            container.appendChild(item);
        });

        // 添加 Prompt 按钮
        document.getElementById('add-prompt-btn').onclick = () => {
            this.openPromptModal();
        };
    },

    // Prompt 模态框
    initPromptModal() {
        const modal = document.getElementById('prompt-modal');
        const closeBtn = document.getElementById('close-prompt-modal');
        const cancelBtn = document.getElementById('cancel-prompt');
        const saveBtn = document.getElementById('save-prompt');
        const deleteBtn = document.getElementById('delete-prompt');

        const closeModal = () => {
            modal.classList.add('hidden');
            this.editingPromptId = null;
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

        // 保存
        saveBtn.addEventListener('click', async () => {
            const prompt = {
                name: document.getElementById('prompt-name').value,
                icon: document.getElementById('prompt-icon').value || '',
                content: document.getElementById('prompt-content').value
            };

            if (!prompt.name) {
                alert('请输入名称');
                return;
            }

            if (!prompt.content) {
                alert('请输入 Prompt 内容');
                return;
            }

            if (this.editingPromptId) {
                await Storage.updatePrompt(this.editingPromptId, prompt);
            } else {
                await Storage.addPrompt(prompt);
            }

            closeModal();
            this.renderPrompts();
        });

        // 删除
        deleteBtn.addEventListener('click', async () => {
            if (this.editingPromptId && confirm('确定要删除这个快捷操作吗？')) {
                await Storage.deletePrompt(this.editingPromptId);
                closeModal();
                this.renderPrompts();
            }
        });
    },

    openPromptModal(prompt = null) {
        const modal = document.getElementById('prompt-modal');
        const title = document.getElementById('prompt-modal-title');
        const deleteBtn = document.getElementById('delete-prompt');

        if (prompt) {
            title.textContent = '编辑快捷操作';
            this.editingPromptId = prompt.id;

            document.getElementById('prompt-name').value = prompt.name || '';
            document.getElementById('prompt-icon').value = prompt.icon || '';
            document.getElementById('prompt-content').value = prompt.content || '';

            deleteBtn.style.display = 'block';
        } else {
            title.textContent = '创建快捷操作';
            this.editingPromptId = null;

            document.getElementById('prompt-name').value = '';
            document.getElementById('prompt-icon').value = '';
            document.getElementById('prompt-content').value = '';

            deleteBtn.style.display = 'none';
        }

        modal.classList.remove('hidden');
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
