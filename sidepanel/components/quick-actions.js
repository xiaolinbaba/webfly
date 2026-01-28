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
            btn.textContent = prompt.name;

            btn.addEventListener('click', () => this.executePrompt(prompt));

            this.container.appendChild(btn);
        });
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
