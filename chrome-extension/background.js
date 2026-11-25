const targets = new Map([
  ['ChatGPT', 'https://chatgpt.com/'],
  ['Gemini', 'https://gemini.google.com/app'],
]);
const lifetime = 5 * 60 * 1000;
const keyFor = tabId => `draft:${tabId}`;
const claiming = new Set();

async function handle(message, sender) {
  if (sender.frameId !== 0 || sender.tab?.id == null || !sender.url) return;
  const url = new URL(sender.url);
  if (message.type === 'open') {
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) return;
    const destination = targets.get(message.provider);
    if (!destination || typeof message.prompt !== 'string' || !message.prompt.trim()) return;

    // 先綁定新分頁再導頁，即使兩筆卦同時開啟也不會拿到彼此的提示詞。
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false, windowId: sender.tab.windowId });
    const key = keyFor(tab.id);
    try {
      await chrome.storage.session.set({
        [key]: { origin: new URL(destination).origin, prompt: message.prompt, expires: Date.now() + lifetime },
      });
      await chrome.tabs.update(tab.id, { url: destination, active: true });
      return { ok: true };
    } catch (error) {
      await chrome.storage.session.remove(key);
      await chrome.tabs.remove(tab.id).catch(() => {});
      throw error;
    }
  }

  if (message.type !== 'ready' && message.type !== 'take') return;
  const key = keyFor(sender.tab.id);
  const draft = (await chrome.storage.session.get(key))[key];
  if (!draft || draft.origin !== url.origin) return;
  if (draft.expires <= Date.now()) {
    await chrome.storage.session.remove(key);
    return;
  }
  if (message.type === 'ready') return { expires: draft.expires };
  if (claiming.has(key)) return;
  claiming.add(key);
  try {
    // get/remove 分開執行；快速重新載入時只讓一份文件取得草稿。
    const latest = (await chrome.storage.session.get(key))[key];
    if (!latest || latest.expires <= Date.now()) return;
    await chrome.storage.session.remove(key);
    return { prompt: latest.prompt };
  } finally {
    claiming.delete(key);
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(value => respond(value ?? null), () => respond(null));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => { void chrome.storage.session.remove(keyFor(tabId)); });
