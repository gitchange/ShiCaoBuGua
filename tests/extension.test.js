import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const workerCode = readFileSync(new URL('../chrome-extension/background.js', import.meta.url), 'utf8');
const source = { url: 'http://127.0.0.1:5173/', frameId: 0, tab: { id: 3, windowId: 1 } };
const target = (id, url = 'https://chatgpt.com/') => ({ url, frameId: 0, tab: { id } });

function startWorker() {
  const data = {};
  let receive, close;
  let nextId = 10;
  const tabs = {
    create: vi.fn(async () => ({ id: nextId++ })),
    update: vi.fn(),
    remove: vi.fn(async () => {}),
    onRemoved: { addListener: fn => { close = fn; } },
  };
  const chrome = {
    runtime: { onMessage: { addListener: fn => { receive = fn; } } }, tabs,
    storage: { session: {
      set: async values => Object.assign(data, values),
      get: async key => ({ [key]: data[key] }),
      remove: async key => { delete data[key]; },
    } },
  };
  runInNewContext(workerCode, { chrome, URL, Date });
  const send = (message, sender) => new Promise(resolve => receive(message, sender, resolve));
  const open = (prompt, provider = 'ChatGPT', sender = source) => send({ type: 'open', provider, prompt }, sender);
  return { send, open, tabs, data, close };
}

describe('Chrome 解卦草稿', () => {
  it('每個目的分頁只能領取自己的草稿一次', async () => {
    const { open, send, tabs } = startWorker();
    await Promise.all([open('甲'), open('乙', 'Gemini')]);
    expect(tabs.update).toHaveBeenCalledWith(10, { url: 'https://chatgpt.com/', active: true });
    expect(tabs.update).toHaveBeenCalledWith(11, { url: 'https://gemini.google.com/app', active: true });
    expect(await send({ type: 'take' }, target(11))).toBeNull();
    expect(await send({ type: 'take' }, target(11, 'https://gemini.google.com/app'))).toEqual({ prompt: '乙' });
    expect(await send({ type: 'ready' }, target(10))).toHaveProperty('expires');
    const replies = await Promise.all([send({ type: 'take' }, target(10)), send({ type: 'take' }, target(10))]);
    expect(replies.filter(Boolean)).toEqual([{ prompt: '甲' }]);
    expect(await send({ type: 'take' }, target(10))).toBeNull();
  });

  it('只接受本機頂層網頁和已知服務', async () => {
    const { open, tabs } = startWorker();
    expect(await open('甲', 'ChatGPT', { ...source, url: 'https://example.com/' })).toBeNull();
    expect(await open('甲', 'Gemini', { ...source, frameId: 1 })).toBeNull();
    expect(await open('甲', 'https://example.com/')).toBeNull();
    expect(tabs.create).not.toHaveBeenCalled();
  });

  it('關閉、逾時或導頁失敗都會清理草稿', async () => {
    const { open, send, tabs, data, close } = startWorker();
    await open('甲');
    close(10);
    expect(await send({ type: 'ready' }, target(10))).toBeNull();
    await open('乙');
    data['draft:11'].expires = Date.now() - 1;
    expect(await send({ type: 'take' }, target(11))).toBeNull();
    tabs.update.mockRejectedValueOnce(new Error('tab closed'));
    expect(await open('丙')).toBeNull();
    expect(tabs.remove).toHaveBeenCalledWith(12);
    expect(data).toEqual({});
  });
});
