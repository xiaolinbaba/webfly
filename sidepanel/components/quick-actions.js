// WebFly Quick Actions Component
// 快捷操作按钮组件

const QuickActions = {
    container: null,
    prompts: [],

    // 初始化
    async init() {
        this.container = document.getElementById('quick-actions');
        await this.loadPrompts();
        this.render();
    },

    // 加载 Prompts
    async loadPrompts() {
        this.prompts = await Storage.getPrompts();
    },

    // 渲染快捷操作按钮
    render() {
        this.container.innerHTML = '';

        // 渲染每个 Prompt 按钮
        this.prompts.forEach(prompt => {
            const btn = document.createElement('button');
            btn.className = 'quick-action-btn';
            btn.title = prompt.name;
            btn.innerHTML = `
        <span class="icon">${prompt.icon || '📝'}</span>
        <span class="text">${prompt.name}</span>
      `;

            btn.addEventListener('click', () => this.executePrompt(prompt));

            this.container.appendChild(btn);
        });

        // 添加新建按钮
        const addBtn = document.createElement('button');
        addBtn.className = 'add-action-btn';
        addBtn.title = '创建快捷操作';
        addBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;

        addBtn.addEventListener('click', () => {
            // 打开设置面板的快捷操作标签
            document.getElementById('settings-panel').classList.remove('hidden');
            document.querySelector('[data-tab="prompts"]').click();
        });

        this.container.appendChild(addBtn);
    },

    // 执行 Prompt
    async executePrompt(prompt) {
        if (window.Chat) {
            await Chat.sendWithPrompt(prompt);
        }
    },

    // 刷新
    async refresh() {
        await this.loadPrompts();
        this.render();
    }
};

// 导出
window.QuickActions = QuickActions;
