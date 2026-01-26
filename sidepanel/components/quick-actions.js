// WebFly Quick Actions Component
// 快捷操作按钮组件

const QuickActions = {
    container: null,
    prompts: [],

    // 初始化
    async init() {
        this.container = document.getElementById('quick-actions-container');
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
        <span class="icon">${prompt.icon || ''}</span>
        <span class="text">${prompt.name}</span>
      `;

            btn.addEventListener('click', () => this.executePrompt(prompt));

            this.container.appendChild(btn);
        });

        // 添加新建按钮
        const addBtn = document.createElement('button');
        addBtn.className = 'quick-action-btn add-new';
        addBtn.title = '创建快捷操作';
        addBtn.innerHTML = `
      <span class="icon">+</span>
      <span class="text">New</span>
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
