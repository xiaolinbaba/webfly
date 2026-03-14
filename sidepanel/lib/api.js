// WebFly API Module
// OpenAI 兼容 API 封装

const API = {
    // 提供商预设配置
    presets: {
        openai: {
            name: 'OpenAI',
            icon: '🤖',
            baseUrl: 'https://api.openai.com/v1',
            models: ['gpt-5.1-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            defaultModel: 'gpt-5.1-mini'
        },
        gemini: {
            name: 'Gemini',
            icon: '✨',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
            models: ['gemini-3-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
            defaultModel: 'gemini-3-flash'
        },
        deepseek: {
            name: 'DeepSeek',
            icon: '🔮',
            baseUrl: 'https://api.deepseek.com/v1',
            models: ['deepseek-v3.2', 'deepseek-chat', 'deepseek-reasoner'],
            defaultModel: 'deepseek-v3.2'
        },
        qwen: {
            name: '通义千问',
            icon: '🌟',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            models: ['qwen3.5-plus', 'qwen3.5-plus-2026-02-15', 'qwen-plus', 'qwen-plus-latest', 'qwen-turbo', 'qwen-max'],
            defaultModel: 'qwen3.5-plus'
        },
        openrouter: {
            name: 'OpenRouter',
            icon: '🔄',
            baseUrl: 'https://openrouter.ai/api/v1',
            models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro'],
            defaultModel: 'openai/gpt-4o-mini'
        },
        custom: {
            name: '自定义',
            icon: '⚙️',
            baseUrl: '',
            models: [],
            defaultModel: ''
        }
    },

    // 发送聊天请求（流式）
    async streamChat(provider, messages, onChunk, onComplete, onError, options = {}) {
        if (!provider) {
            onError(new Error('未配置模型提供商'));
            return;
        }

        const { baseUrl, apiKey, model } = provider;

        console.log('[WebFly] 开始API调用:', { baseUrl, model, messagesCount: messages.length });

        if (!apiKey) {
            onError(new Error('API Key 未配置'));
            return;
        }

        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        console.log('[WebFly] 请求URL:', url);

        try {
            const requestBody = this.buildChatRequestBody(provider, messages, true);

            console.log('[WebFly] 请求体:', JSON.stringify(requestBody, null, 2));

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: options.signal
            });

            console.log('[WebFly] 响应状态:', response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = `请求失败: ${response.status}`;
                try {
                    const errorText = await response.text();
                    console.error('[WebFly] 错误响应:', errorText);
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error?.message || errorData.message || errorMessage;
                } catch (e) {
                    console.error('[WebFly] 无法解析错误响应');
                }
                throw new Error(errorMessage);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            let chunkCount = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('[WebFly] 流式响应完成, 总块数:', chunkCount, '总字符:', fullContent.length);
                    onComplete(fullContent);
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // 处理可能的多行数据
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue;

                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmedLine.slice(6);
                            const data = JSON.parse(jsonStr);
                            const content = this.extractStreamText(data);
                            if (content) {
                                fullContent += content;
                                chunkCount++;
                                onChunk(content);
                            }
                        } catch (e) {
                            console.warn('[WebFly] 解析数据块失败:', trimmedLine, e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[WebFly] API调用错误:', error);
            onError(error);
        }
    },

    // 发送聊天请求（非流式）
    async chat(provider, messages) {
        if (!provider) {
            throw new Error('未配置模型提供商');
        }

        const { baseUrl, apiKey, model } = provider;

        if (!apiKey) {
            throw new Error('API Key 未配置');
        }

        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const requestBody = this.buildChatRequestBody(provider, messages, false);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        return this.extractMessageText(data);
    },

    // 获取模型列表（如果 API 支持）
    async getModels(provider) {
        if (!provider || !provider.apiKey) {
            return [];
        }

        const url = `${provider.baseUrl.replace(/\/$/, '')}/models`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${provider.apiKey}`
                }
            });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.data?.map(m => m.id) || [];
        } catch {
            return [];
        }
    },

    // 测试 API 连接
    async testConnection(provider) {
        try {
            const testMessages = [
                { role: 'user', content: 'Hi' }
            ];

            const result = await this.chat(provider, testMessages);
            return { success: true, message: '连接成功' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    buildChatRequestBody(provider, messages, stream) {
        const requestBody = {
            model: provider.model,
            messages,
            stream
        };

        // 官方文档说明 Qwen3.5 Plus/Flash 的混合推理默认开启。
        // 对当前插件的总结/翻译等场景，默认关闭思考模式可避免长时间只返回 reasoning_content
        // 导致前端看起来“无响应”或更容易超时。
        if (this.shouldDisableThinkingByDefault(provider)) {
            requestBody.enable_thinking = false;
        }

        return requestBody;
    },

    shouldDisableThinkingByDefault(provider) {
        if (provider.type !== 'qwen' || !provider.model) {
            return false;
        }

        return /^qwen3\.5-(plus|flash)(-|$)/i.test(provider.model);
    },

    extractStreamText(data) {
        const delta = data.choices?.[0]?.delta;
        if (!delta) {
            return '';
        }

        if (typeof delta.content === 'string' && delta.content) {
            return delta.content;
        }

        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            return delta.reasoning_content;
        }

        return '';
    },

    extractMessageText(data) {
        const message = data.choices?.[0]?.message;
        if (!message) {
            return '';
        }

        if (typeof message.content === 'string' && message.content) {
            return message.content;
        }

        if (typeof message.reasoning_content === 'string' && message.reasoning_content) {
            return message.reasoning_content;
        }

        return '';
    }
};

// 导出
window.API = API;
