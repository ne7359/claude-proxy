const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// .env 文件路径（支持 Docker 环境）
const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '..', '.env');
const CONFIG_STORAGE_DIR = process.env.CONFIG_STORAGE_DIR || path.join(__dirname, '..', 'config-storage');

// 确保配置存储目录存在
if (!fs.existsSync(CONFIG_STORAGE_DIR)) {
    fs.mkdirSync(CONFIG_STORAGE_DIR, { recursive: true });
}

// 配置文件路径
const CONFIG_JSON_PATH = path.join(CONFIG_STORAGE_DIR, 'configs.json');

/**
 * 解析 .env 文件内容
 */
function parseEnvFile(content) {
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
function generateEnvContent(config) {
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
            return parseEnvFile(content);
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
        const content = generateEnvContent(config);
        fs.writeFileSync(ENV_FILE_PATH, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('保存 .env 文件失败:', error);
        return { success: false, message: error.message };
    }
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

// 启动服务器
app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         Vue 环境变量配置管理 UI 服务已启动              ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  访问地址: http://localhost:${PORT}                    ║`);
    console.log('║                                                        ║');
    console.log('║  可修改的配置项：                                       ║');
    console.log('║    • UPSTREAM_BASE_URL - 上游服务地址                   ║');
    console.log('║    • UPSTREAM_API_KEY  - API 密钥                      ║');
    console.log('║    • PORT              - 服务端口                      ║');
    console.log('║    • MAX_SESSIONS      - 最大会话数                     ║');
    console.log('╚════════════════════════════════════════════════════════╝');
});
