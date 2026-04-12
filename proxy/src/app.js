import http from 'node:http';
import { randomUUID } from 'node:crypto';

import { renderDebugPage } from './debug-page.js';

function toLowerCaseHeaders(headers) {
  const output = {};
  for (const [key, value] of Object.entries(headers)) {
    output[key.toLowerCase()] = value;
  }
  return output;
}

function readJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function blockText(block) {
  if (typeof block === 'string') {
    return block;
  }
  if (!block || typeof block !== 'object') {
    return '';
  }
  if (block.type === 'text') {
    return block.text ?? '';
  }
  if (block.type === 'tool_result') {
    return contentToText(block.content);
  }
  return JSON.stringify(block);
}

function contentToText(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content.map(blockText).filter(Boolean).join('\n');
}

function anthropicToOpenAi(body) {
  const messages = [];
  const systemText = contentToText(body.system);
  if (systemText) {
    messages.push({
      role: 'system',
      content: systemText,
    });
  }

  for (const message of body.messages ?? []) {
    const role = message.role;
    const content = message.content;

    if (role === 'assistant') {
      const blocks = Array.isArray(content) ? content : [{ type: 'text', text: contentToText(content) }];
      const textParts = [];
      const toolCalls = [];

      for (const block of blocks) {
        if (block?.type === 'text') {
          textParts.push(block.text ?? '');
          continue;
        }
        if (block?.type === 'tool_use') {
          toolCalls.push({
            id: block.id ?? randomUUID(),
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }

      messages.push({
        role: 'assistant',
        content: textParts.join('\n'),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    if (role === 'user' && Array.isArray(content)) {
      const textParts = [];

      for (const block of content) {
        if (block?.type === 'tool_result') {
          if (textParts.length) {
            messages.push({
              role: 'user',
              content: textParts.join('\n'),
            });
            textParts.length = 0;
          }
          messages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: contentToText(block.content),
          });
          continue;
        }

        textParts.push(blockText(block));
      }

      if (textParts.length) {
        messages.push({
          role: 'user',
          content: textParts.join('\n'),
        });
      }
      continue;
    }

    messages.push({
      role,
      content: contentToText(content),
    });
  }

  const tools = (body.tools ?? []).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.input_schema ?? { type: 'object', properties: {} },
    },
  }));

  return {
    model: body.model,
    messages,
    ...(tools.length ? { tools } : {}),
    ...(body.max_tokens != null ? { max_tokens: body.max_tokens } : {}),
    ...(body.temperature != null ? { temperature: body.temperature } : {}),
    ...(body.top_p != null ? { top_p: body.top_p } : {}),
    ...(body.stop_sequences?.length ? { stop: body.stop_sequences } : {}),
    ...(body.stream ? { stream: true } : {}),
  };
}

function parseToolInput(argumentsText) {
  if (!argumentsText) {
    return {};
  }

  try {
    return JSON.parse(argumentsText);
  } catch {
    return { _raw: argumentsText };
  }
}

function mapStopReason(choice) {
  if (choice?.finish_reason === 'tool_calls') {
    return 'tool_use';
  }
  if (choice?.finish_reason === 'length') {
    return 'max_tokens';
  }
  return 'end_turn';
}

function openAiToAnthropic(json) {
  const choice = json?.choices?.[0] ?? {};
  const message = choice.message ?? {};
  const content = [];

  if (typeof message.content === 'string' && message.content) {
    content.push({ type: 'text', text: message.content });
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === 'text' && part.text) {
        content.push({ type: 'text', text: part.text });
      }
    }
  }

  for (const toolCall of message.tool_calls ?? []) {
    content.push({
      type: 'tool_use',
      id: toolCall.id ?? randomUUID(),
      name: toolCall.function?.name ?? 'tool',
      input: parseToolInput(toolCall.function?.arguments),
    });
  }

  return {
    id: json.id ?? `msg_${randomUUID().replaceAll('-', '')}`,
    type: 'message',
    role: 'assistant',
    model: json.model,
    content,
    stop_reason: mapStopReason(choice),
    stop_sequence: null,
    usage: {
      input_tokens: json.usage?.prompt_tokens ?? 0,
      output_tokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

function jsonHeaders(headers) {
  return {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  };
}

function createSessionStore(maxSessions) {
  const sessions = [];

  return {
    list() {
      return sessions;
    },
    add(session) {
      sessions.unshift(session);
      if (sessions.length > maxSessions) {
        sessions.pop();
      }
    },
  };
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders());
  res.end(JSON.stringify(payload));
}

function sendSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function extractEventData(rawEvent) {
  const lines = rawEvent.split('\n');
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  return dataLines.join('\n');
}

function finalizeSession(session) {
  session.endedAt = new Date().toISOString();
  session.durationMs = Date.parse(session.endedAt) - Date.parse(session.startedAt);
}

async function proxyStream({ upstreamResponse, session, res, requestedModel }) {
  const decoder = new TextDecoder();
  let pending = '';
  let started = false;
  let finished = false;
  let textBlockIndex = null;
  let nextContentBlockIndex = 0;
  const openBlocks = new Set();
  const toolBlocks = new Map();

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  function startMessage(modelName) {
    if (started) {
      return;
    }
    started = true;
    sendSseEvent(res, 'message_start', {
      type: 'message_start',
      message: {
        id: `msg_${randomUUID().replaceAll('-', '')}`,
        type: 'message',
        role: 'assistant',
        model: modelName ?? requestedModel,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      },
    });
  }

  function ensureTextBlock() {
    if (textBlockIndex != null) {
      return textBlockIndex;
    }
    textBlockIndex = nextContentBlockIndex;
    nextContentBlockIndex += 1;
    sendSseEvent(res, 'content_block_start', {
      type: 'content_block_start',
      index: textBlockIndex,
      content_block: {
        type: 'text',
        text: '',
      },
    });
    openBlocks.add(textBlockIndex);
    return textBlockIndex;
  }

  function ensureToolBlock(toolCallDelta) {
    const upstreamIndex = toolCallDelta.index ?? 0;
    let block = toolBlocks.get(upstreamIndex);
    if (!block) {
      block = {
        contentIndex: nextContentBlockIndex,
        id: toolCallDelta.id ?? `toolu_${randomUUID().replaceAll('-', '')}`,
        name: toolCallDelta.function?.name ?? 'tool',
      };
      nextContentBlockIndex += 1;
      toolBlocks.set(upstreamIndex, block);
      sendSseEvent(res, 'content_block_start', {
        type: 'content_block_start',
        index: block.contentIndex,
        content_block: {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: {},
        },
      });
      openBlocks.add(block.contentIndex);
      return block;
    }

    if (toolCallDelta.id && !block.id) {
      block.id = toolCallDelta.id;
    }
    if (toolCallDelta.function?.name && block.name === 'tool') {
      block.name = toolCallDelta.function.name;
    }

    return block;
  }

  function finishMessage(stopReason) {
    if (finished) {
      return;
    }
    finished = true;
    for (const index of [...openBlocks].sort((a, b) => a - b)) {
      sendSseEvent(res, 'content_block_stop', {
        type: 'content_block_stop',
        index,
      });
      openBlocks.delete(index);
    }
    sendSseEvent(res, 'message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null,
      },
      usage: {
        output_tokens: 0,
      },
    });
    sendSseEvent(res, 'message_stop', {
      type: 'message_stop',
    });
    res.end();
  }

  for await (const chunk of upstreamResponse.body) {
    const text = decoder.decode(chunk, { stream: true });
    session.response.bodyText += text;
    pending += text;

    while (pending.includes('\n\n')) {
      const separatorIndex = pending.indexOf('\n\n');
      const rawEvent = pending.slice(0, separatorIndex);
      pending = pending.slice(separatorIndex + 2);

      if (!rawEvent.trim()) {
        continue;
      }

      session.response.chunks.push({
        receivedAt: new Date().toISOString(),
        text: `${rawEvent}\n\n`,
      });

      const dataText = extractEventData(rawEvent);
      if (!dataText) {
        continue;
      }
      if (dataText === '[DONE]') {
        finishMessage('end_turn');
        continue;
      }

      const parsed = readJsonSafely(dataText);
      if (!parsed) {
        continue;
      }

      const choice = parsed.choices?.[0] ?? {};
      startMessage(parsed.model);

      const deltaContent = choice.delta?.content;
      if (typeof deltaContent === 'string' && deltaContent.length) {
        const index = ensureTextBlock();
        sendSseEvent(res, 'content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: {
            type: 'text_delta',
            text: deltaContent,
          },
        });
      }

      for (const toolCallDelta of choice.delta?.tool_calls ?? []) {
        const block = ensureToolBlock(toolCallDelta);
        const partialJson = toolCallDelta.function?.arguments;
        if (typeof partialJson === 'string' && partialJson.length) {
          sendSseEvent(res, 'content_block_delta', {
            type: 'content_block_delta',
            index: block.contentIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: partialJson,
            },
          });
        }
      }

      if (choice.finish_reason) {
        finishMessage(mapStopReason(choice));
      }
    }
  }

  if (!finished) {
    finishMessage('end_turn');
  }
}

export function createApp({
  upstreamBaseUrl,
  upstreamApiKey,
  maxSessions = 100,
} = {}) {
  if (!upstreamBaseUrl) {
    throw new Error('upstreamBaseUrl is required');
  }

  const store = createSessionStore(maxSessions);

  const server = http.createServer(async (req, res) => {
    let activeSession = null;

    try {
      const url = new URL(req.url, 'http://127.0.0.1');

      if (req.method === 'GET' && url.pathname === '/debug') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(renderDebugPage());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/debug/api/sessions') {
        writeJson(res, 200, store.list());
        return;
      }

      if (req.method === 'POST' && url.pathname === '/v1/messages') {
        const rawBody = await readRequestBody(req);
        const parsedBody = readJsonSafely(rawBody);

        if (!parsedBody) {
          writeJson(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        const forwardedBody = anthropicToOpenAi(parsedBody);
        const forwardedBodyText = JSON.stringify(forwardedBody);
        const upstreamUrl = new URL('/v1/chat/completions', upstreamBaseUrl).toString();
        const forwardedHeaders = toLowerCaseHeaders({
          'content-type': 'application/json',
          authorization: `Bearer ${upstreamApiKey}`,
        });

        const session = {
          id: randomUUID(),
          startedAt: new Date().toISOString(),
          endedAt: null,
          durationMs: null,
          request: {
            method: 'POST',
            url: upstreamUrl,
            headers: forwardedHeaders,
            bodyText: forwardedBodyText,
            chunks: [],
          },
          response: {
            status: null,
            headers: null,
            bodyText: '',
            chunks: [],
            error: null,
          },
        };
        activeSession = session;
        store.add(session);

        let upstreamResponse;
        try {
          upstreamResponse = await fetch(upstreamUrl, {
            method: 'POST',
            headers: forwardedHeaders,
            body: forwardedBodyText,
          });
        } catch (error) {
          session.response.status = 502;
          session.response.error = String(error);
          finalizeSession(session);
          writeJson(res, 502, { error: 'Upstream request failed', detail: String(error) });
          return;
        }

        session.response.status = upstreamResponse.status;
        session.response.headers = Object.fromEntries(upstreamResponse.headers.entries());

        if (forwardedBody.stream) {
          await proxyStream({
            upstreamResponse,
            session,
            res,
            requestedModel: parsedBody.model,
          });
          finalizeSession(session);
          return;
        }

        const upstreamBodyText = await upstreamResponse.text();
        session.response.bodyText = upstreamBodyText;
        const upstreamJson = readJsonSafely(upstreamBodyText);

        if (!upstreamResponse.ok || !upstreamJson) {
          finalizeSession(session);
          res.writeHead(upstreamResponse.status, jsonHeaders());
          res.end(upstreamBodyText);
          return;
        }

        const anthropicResponse = openAiToAnthropic(upstreamJson);
        finalizeSession(session);
        writeJson(res, upstreamResponse.status, anthropicResponse);
        return;
      }

      writeJson(res, 404, { error: 'Not found' });
    } catch (error) {
      if (activeSession) {
        activeSession.response.error = String(error);
        if (!activeSession.endedAt) {
          finalizeSession(activeSession);
        }
      }

      if (res.headersSent || res.writableEnded) {
        if (!res.destroyed && !res.writableEnded) {
          res.end();
        }
        return;
      }

      writeJson(res, 500, { error: 'Internal server error', detail: String(error) });
    }
  });

  return {
    server,
    sessions: store.list(),
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
