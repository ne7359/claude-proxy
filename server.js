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

// 创建Express应用用于UI和管理API
const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// .env 文件路径配置 - 统一保存到proxy/.env供代理使用
const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(process.cwd(), 'proxy', '.env');
const CONFIG_STORAGE_DIR = process.env.CONFIG_STORAGE_DIR || path.join(process.cwd(), '.env', 'config-storage');

// 确保配置存储目录存在
if (!fs.existsSync(CONFIG_STORAGE_DIR)) {
    fs.mkdirSync(CONFIG_STORAGE_DIR, { recursive: true });
}

// 配置文件路径
const CONFIG_JSON_PATH = path.join(CONFIG_STORAGE_DIR, 'configs.json');

/**
 * 解析 .env 文件内容
 */
function parseEnvFileContent(content) {
    const parsed = {};
    const lines = content.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const separator = line.indexOf('=');
        if (separator === -1) continue;

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        parsed[key] = value;
    }

    const config = {
        upstreamUrl: parsed.UPSTREAM_BASE_URL || '',
        apiKey: parsed.UPSTREAM_API_KEY || '',
        port: parseInt(parsed.PORT) || 8788,
        maxSessions: parseInt(parsed.MAX_SESSIONS) || 200
    };

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
// 代理应用实例
let proxyAppInstance = null;
let proxyServer = null;

/**
 * 启动/重启代理服务（作为子应用）
 */
function startProxyServer() {
    try {
        // 读取当前配置
        const config = readConfig();

        if (!config.upstreamUrl || !config.apiKey) {
            console.log('⚠️  配置不完整，跳过代理启动');
            return { success: false, message: '配置不完整，请先设置UPSTREAM_BASE_URL和UPSTREAM_API_KEY' };
        }

        console.log('🚀 创建Claude代理服务...');
        console.log('  上游地址:', config.upstreamUrl);
        console.log('  最大会话数:', config.maxSessions);

        // 创建代理应用
        proxyAppInstance = createProxyApp({
            upstreamBaseUrl: config.upstreamUrl,
            upstreamApiKey: config.apiKey,
            maxSessions: config.maxSessions,
        });

        proxyServer = proxyAppInstance.server;

        console.log(`✅ Claude代理服务已创建`);
        console.log(`   API端点: http://localhost:8788/v1/messages`);
        console.log(`   调试页面: http://localhost:8788/debug`);

        return { success: true };
    } catch (error) {
        console.error('❌ 创建代理服务失败:', error);
        return { success: false, message: error.message };
    }
}

function saveConfig(config) {
    try {
        const content = generateEnvFileContent(config);
        fs.writeFileSync(ENV_FILE_PATH, content, 'utf-8');

        // 保存后尝试启动代理服务
        console.log('⚡ 配置已保存，尝试启动/重启代理服务...');
        const proxyResult = startProxyServer();

        return {
            success: true,
            proxyStarted: proxyResult.success,
            proxyMessage: proxyResult.message
        };
    } catch (error) {
        console.error('保存 .env 文件失败:', error);
        return { success: false, message: error.message };
    }
}

// UI静态文件（从.env/vue-ui/public复制）
const UI_PUBLIC_DIR = path.join(process.cwd(), '.env', 'vue-ui', 'public');

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
    console.log(`  保存到: ${ENV_FILE_PATH}`);

    res.json({
        success: true,
        message: '配置已保存',
        proxyStarted: saveResult.proxyStarted,
        proxyMessage: saveResult.proxyMessage
    });
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

// 代理重启API
app.post('/api/proxy/restart', (req, res) => {
    console.log('🔄 收到手动重启代理服务请求');
    const result = startProxyServer();
    res.json(result);
});

app.get('/api/proxy/status', (req, res) => {
    res.json({
        running: proxyServer !== null,
        config: readConfig()
    });
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
    // 指定正确的.env文件路径
    runtimeConfig = loadRuntimeConfig({
        envPath: path.join(process.cwd(), 'proxy', '.env')
    });
} catch (error) {
    console.error('加载运行时配置失败:', error);
    runtimeConfig = {
        upstreamBaseUrl: 'https://your-upstream.example.com',
        upstreamApiKey: 'your-upstream-api-key',
        port: 8788,
        maxSessions: 200
    };
}

// 创建一个统一的HTTP服务器
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // 路由分发
    if (url.pathname.startsWith('/api/config') ||
        url.pathname.startsWith('/api/proxy') ||
        url.pathname.startsWith('/ui') ||
        url.pathname === '/' ||
        url.pathname === '/health') {
        // 配置管理和UI请求
        return app(req, res);
    } else if (proxyServer) {
        // Claude代理请求 - 转发到代理服务器
        return proxyServer.emit('request', req, res);
    } else {
        // 代理服务未启动
        if (req.method === 'POST' && url.pathname === '/v1/messages') {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Claude代理服务未启动',
                message: '请先通过配置界面设置API密钥并保存配置'
            }));
            return;
        }
        if (req.method === 'GET' && url.pathname === '/debug') {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Claude代理服务未启动',
                message: '请先启动代理服务'
            }));
            return;
        }

        // 默认404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// 启动主服务器（Web配置界面和API）
const PORT = 8788;
server.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        配置管理服务已启动                                        ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  配置管理界面: http://localhost:${PORT}/ui                                      ║`);
    console.log(`║  配置API: http://localhost:${PORT}/api/config                                   ║`);
    console.log('║                                                                                 ║');
    console.log('║  API端点:                                                                       ║');
    console.log(`║    • GET  /api/config      - 获取当前配置                                        ║`);
    console.log(`║    • POST /api/config      - 保存并激活配置                                      ║`);
    console.log(`║    • GET  /api/configs     - 获取所有配置列表                                    ║`);
    console.log(`║    • POST /api/configs/:id/activate - 激活特定配置                               ║`);
    console.log(`║    • POST /api/proxy/restart - 手动重启Claude代理                                ║`);
    console.log('║                                                                                 ║');
    console.log('║  当前配置（从proxy/.env读取）:                                                   ║');
    console.log(`║    • UPSTREAM_BASE_URL: ${runtimeConfig.upstreamBaseUrl}                       ║`);
    console.log(`║    • PORT: ${runtimeConfig.port}                                                ║`);
    console.log(`║    • MAX_SESSIONS: ${runtimeConfig.maxSessions}                                 ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('⚠️  重要说明：');
    console.log('   1. 配置管理服务已启动');
    console.log('   2. Claude代理服务尚未启动');
    console.log('   3. 请先通过Web界面配置正确的API密钥');
    console.log('   4. 然后通过以下方式启动Claude代理：');
    console.log('      - 方式1: 在Web界面保存配置后自动启动');
    console.log('      - 方式2: 调用API: POST /api/proxy/restart');
    console.log('      - 方式3: 手动重启整个服务');
    console.log('');
});