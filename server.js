import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// 导入proxy应用
import { createApp as createProxyApp } from './proxy/src/app.js';
import { loadRuntimeConfig } from './proxy/src/env.js';
import { renderDebugPage } from './proxy/src/debug-page.js';

// 导入.env管理功能
import { parseEnvFile, generateEnvContent } from './proxy/src/env.js';

// 创建Express应用用于UI和管理API
const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// .env 文件路径配置
const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '.env', '.env');
const CONFIG_STORAGE_DIR = process.env.CONFIG_STORAGE_DIR || path.join(__dirname, '.env', 'config-storage');

// 确保配置存储目录存在
if (!fs.existsSync(CONFIG_STORAGE_DIR)) {
    fs.mkdirSync(CONFIG_STORAGE_DIR, { recursive: true });
}

// 配置文件路径
const CONFIG_JSON_PATH = path.join(CONFIG_STORAGE_DIR, 'configs.json');

/**
 * 解析 .env 文件内容（增强版）
 */
function parseEnvFileContent(content) {
    const config = {
        upstreamUrl: '',
        apiKey: '',
        port: 8788,
        maxSessions: 200
    };

    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();

            switch (key) {
                case 'UPSTREAM_BASE_URL':
                    config.upstreamUrl = value;
                    break;
                case 'UPSTREAM_API_KEY':
                    config.apiKey = value;
                    break;
                case 'PORT':
                    config.port = parseInt(value) || 8788;
                    break;
                case 'MAX_SESSIONS':
                    config.maxSessions = parseInt(value) || 200;
                    break;
            }
        }
    }

    return config;
}

/**
 * 生成 .env 文件内容
 */
function generateEnvFileContent(config) {
    return `UPSTREAM_BASE_URL=${config.upstreamUrl}
UPSTREAM_API_KEY=${config.apiKey}
PORT=${config.port}
MAX_SESSIONS=${config.maxSessions}
`;
}

/**
 * 读取所有配置
 */
function readAllConfigs() {
    try {
        if (fs.existsSync(CONFIG_JSON_PATH)) {
            const content = fs.readFileSync(CONFIG_JSON_PATH, 'utf-8');
            const configs = JSON.parse(content);
            return configs;
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
    }
    return [];
}

/**
 * 保存所有配置
 */
function saveAllConfigs(configs) {
    try {
        const content = JSON.stringify(configs, null, 2);
        fs.writeFileSync(CONFIG_JSON_PATH, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('保存配置文件失败:', error);
        return { success: false, message: error.message };
    }
}

/**
 * 添加新配置
 */
function addConfig(newConfig) {
    const configs = readAllConfigs();

    // 生成ID和时间戳
    const id = Date.now().toString();
    const configWithMeta = {
        id: id,
        name: newConfig.name || `配置_${id.substring(10)}`,
        ...newConfig,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: false
    };

    // 限制最多保存10个配置
    if (configs.length >= 10) {
        configs.shift(); // 移除最早的配置
    }

    configs.push(configWithMeta);
    return saveAllConfigs(configs);
}

/**
 * 激活配置（将其保存到.env文件）
 */
function activateConfig(configId) {
    const configs = readAllConfigs();
    const configToActivate = configs.find(c => c.id === configId);

    if (!configToActivate) {
        return { success: false, message: '配置不存在' };
    }

    // 更新所有配置的激活状态
    configs.forEach(config => {
        config.active = config.id === configId;
    });

    // 保存更新后的配置列表
    const saveResult = saveAllConfigs(configs);
    if (!saveResult.success) {
        return saveResult;
    }

    // 将激活的配置保存到.env文件
    const envConfig = {
        upstreamUrl: configToActivate.upstreamUrl,
        apiKey: configToActivate.apiKey,
        port: configToActivate.port,
        maxSessions: configToActivate.maxSessions
    };

    return saveConfig(envConfig);
}

/**
 * 读取当前激活的配置（从.env文件）
 */
function readConfig() {
    try {
        if (fs.existsSync(ENV_FILE_PATH)) {
            const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
            return parseEnvFileContent(content);
        }
    } catch (error) {
        console.error('读取 .env 文件失败:', error);
    }
    return {
        upstreamUrl: 'https://your-upstream.example.com',
        apiKey: 'your-upstream-api-key',
        port: 8788,
        maxSessions: 200
    };
}

/**
 * 保存配置到 .env 文件
 */
function saveConfig(config) {
    try {
        const content = generateEnvFileContent(config);
        fs.writeFileSync(ENV_FILE_PATH, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('保存 .env 文件失败:', error);
        return { success: false, message: error.message };
    }
}

// UI静态文件（从.env/vue-ui/public复制）
const UI_PUBLIC_DIR = path.join(__dirname, '.env', 'vue-ui', 'public');

if (fs.existsSync(UI_PUBLIC_DIR)) {
    app.use('/ui', express.static(UI_PUBLIC_DIR));
}

// API 路由

// 获取当前激活的配置
app.get('/api/config', (req, res) => {
    const config = readConfig();
    res.json({ success: true, config });
});

// 保存并激活配置
app.post('/api/config', (req, res) => {
    const { upstreamUrl, apiKey, port, maxSessions, name } = req.body;

    // 验证输入
    if (!upstreamUrl || !upstreamUrl.trim()) {
        return res.json({ success: false, message: '上游服务地址不能为空' });
    }

    if (!apiKey || !apiKey.trim()) {
        return res.json({ success: false, message: 'API 密钥不能为空' });
    }

    if (!port || port < 1 || port > 65535) {
        return res.json({ success: false, message: '端口号无效 (1-65535)' });
    }

    if (!maxSessions || maxSessions < 1) {
        return res.json({ success: false, message: '最大会话数必须大于 0' });
    }

    const config = {
        upstreamUrl: upstreamUrl.trim(),
        apiKey: apiKey.trim(),
        port: parseInt(port),
        maxSessions: parseInt(maxSessions)
    };

    // 保存到.env文件并激活
    const saveResult = saveConfig(config);
    if (!saveResult.success) {
        return res.json(saveResult);
    }

    // 同时保存到配置列表
    const configForList = {
        ...config,
        name: name || `配置_${Date.now().toString().substring(10)}`
    };

    const addResult = addConfig(configForList);

    if (!addResult.success) {
        return res.json(addResult);
    }

    console.log(`[${new Date().toISOString()}] 配置已更新：`);
    console.log('  UPSTREAM_BASE_URL:', config.upstreamUrl);
    console.log('  PORT:', config.port);
    console.log('  MAX_SESSIONS:', config.maxSessions);

    res.json({ success: true });
});

// 获取所有配置列表
app.get('/api/configs', (req, res) => {
    const configs = readAllConfigs();
    res.json({ success: true, configs });
});

// 激活特定配置
app.post('/api/configs/:id/activate', (req, res) => {
    const configId = req.params.id;
    const result = activateConfig(configId);
    res.json(result);
});

// 删除配置
app.delete('/api/configs/:id', (req, res) => {
    const configId = req.params.id;
    const configs = readAllConfigs();
    const filteredConfigs = configs.filter(c => c.id !== configId);

    const saveResult = saveAllConfigs(filteredConfigs);
    if (saveResult.success) {
        res.json({ success: true, message: '配置已删除' });
    } else {
        res.json(saveResult);
    }
});

// UI路由
app.get('/ui', (req, res) => {
    if (fs.existsSync(path.join(UI_PUBLIC_DIR, 'index.html'))) {
        res.sendFile(path.join(UI_PUBLIC_DIR, 'index.html'));
    } else {
        res.json({ message: 'UI界面未找到，请确保.env/vue-ui/public目录存在' });
    }
});

// 加载运行时配置
let runtimeConfig;
try {
    runtimeConfig = loadRuntimeConfig();
} catch (error) {
    console.error('加载运行时配置失败:', error);
    runtimeConfig = {
        upstreamBaseUrl: 'https://your-upstream.example.com',
        upstreamApiKey: 'your-upstream-api-key',
        port: 8788,
        maxSessions: 200
    };
}

// 创建proxy应用
const proxyApp = createProxyApp({
    upstreamBaseUrl: runtimeConfig.upstreamBaseUrl,
    upstreamApiKey: runtimeConfig.upstreamApiKey,
    maxSessions: runtimeConfig.maxSessions,
});

// 代理API路由转发到proxy应用
const proxyServer = proxyApp.server;

// 创建一个统一的HTTP服务器
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // 处理UI和管理API
    if (url.pathname.startsWith('/api/config') ||
        url.pathname.startsWith('/ui') ||
        url.pathname === '/') {
        return app(req, res);
    }

    // 处理proxy调试页面
    if (req.method === 'GET' && (url.pathname === '/debug' || url.pathname === '/debug/api/sessions')) {
        return proxyServer.emit('request', req, res);
    }

    // 处理Claude API请求
    if (req.method === 'POST' && url.pathname === '/v1/messages') {
        return proxyServer.emit('request', req, res);
    }

    // 默认404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// 启动服务器
const PORT = runtimeConfig.port;
server.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         统一代理服务 + 环境变量管理器已启动                       ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  代理服务地址: http://localhost:${PORT}                                         ║`);
    console.log(`║  UI管理界面: http://localhost:${PORT}/ui                                        ║`);
    console.log(`║  调试页面: http://localhost:${PORT}/debug                                       ║`);
    console.log('║  API端点:                                                                       ║');
    console.log(`║    • /v1/messages     - Claude API代理                                          ║`);
    console.log(`║    • /api/config      - 获取当前配置                                            ║`);
    console.log(`║    • /api/configs     - 获取所有配置列表                                        ║`);
    console.log('║                                                                                 ║');
    console.log('║  当前配置:                                                                       ║');
    console.log(`║    • UPSTREAM_BASE_URL: ${runtimeConfig.upstreamBaseUrl}                       ║`);
    console.log(`║    • PORT: ${runtimeConfig.port}                                                ║`);
    console.log(`║    • MAX_SESSIONS: ${runtimeConfig.maxSessions}                                 ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
});