import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { buildReadingPrompt } from '../core/readingPrompt.js';

const providers = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
];

export function ReadingAiButtons({ record }) {
  const prompt = buildReadingPrompt(record);
  const [result, setResult] = useState(null);
  const [canPrefill, setCanPrefill] = useState(false);
  const group = useRef(null);

  useEffect(() => {
    const element = group.current;
    const check = () => setCanPrefill(!document.dispatchEvent(new Event('shicao:probe', { cancelable: true })));
    const failed = event => {
      const provider = providers.find(item => item.name === event.target.dataset.shicaoProvider);
      if (provider) setResult({ state: 'failed', provider });
    };
    check();
    window.addEventListener('focus', check);
    element.addEventListener('shicao:open-failed', failed);
    return () => {
      window.removeEventListener('focus', check);
      element.removeEventListener('shicao:open-failed', failed);
    };
  }, []);

  async function copyAndOpen(provider, event) {
    if (canPrefill && event.defaultPrevented) {
      setResult({ state: 'prefill', provider });
      return;
    }
    setResult({ state: 'copying', provider });
    let tab;
    try {
      // 在同一次點擊中開始複製並取得新分頁，剪貼簿成功後才前往 AI 網站。
      const copied = navigator.clipboard.writeText(prompt);
      tab = window.open('about:blank', '_blank');
      if (tab) tab.opener = null;
      await copied;
    } catch {
      tab?.close();
      setResult({ state: 'manual', provider });
      return;
    }

    if (!tab || tab.closed) {
      setResult({ state: 'blocked', provider });
      return;
    }
    tab.location.replace(provider.url);
    setResult({ state: 'opened', provider });
  }

  const manual = ['manual', 'failed', 'manualPrompt'].includes(result?.state);
  const blocked = result?.state === 'blocked';
  return (
    <div ref={group} data-shicao-prompt={canPrefill ? prompt : undefined} role="group" aria-label="AI 解卦" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-serif font-bold text-gold">AI 解卦</span>
        {providers.map(provider => (
          <button
            key={provider.name}
            type="button"
            disabled={!prompt || result?.state === 'copying'}
            data-shicao-provider={provider.name}
            onClick={event => copyAndOpen(provider, event)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-paper hover:border-gold hover:bg-ink-700 disabled:opacity-50 cursor-pointer"
          >
            {canPrefill ? '預填並開啟' : '複製並開啟'} {provider.name}
            <ExternalLink aria-hidden="true" className="size-3.5 text-gold" />
          </button>
        ))}
      </div>
      <p role="status" className="text-xs text-muted">
        {!prompt && '這筆紀錄缺少完整六爻，無法產生提示詞。'}
        {prompt && !result && (canPrefill ? '在新分頁預填這一卦，由你確認後送出。' : '複製這一卦的解卦提示詞，到新分頁貼上並送出。')}
        {result?.state === 'prefill' && `請在 ${result.provider.name} 的新分頁確認草稿後送出。`}
        {result?.state === 'copying' && '正在複製提示詞…'}
        {result?.state === 'opened' && `已複製，請到 ${result.provider.name} 的新分頁貼上並送出。`}
        {blocked && '提示詞已複製。請點下方連結開啟新分頁，再貼上送出。'}
        {result?.state === 'manual' && '瀏覽器未允許自動複製。請複製下方提示詞，再開啟新分頁。'}
        {result?.state === 'failed' && '擴充功能未能開啟分頁。請複製下方提示詞，再開啟新分頁。'}
        {result?.state === 'manualPrompt' && '請複製下方提示詞，到 AI 分頁貼上。'}
      </p>
      {result?.state === 'prefill' && (
        <button type="button" className="text-sm text-gold underline cursor-pointer" onClick={() => setResult({ ...result, state: 'manualPrompt' })}>
          手動複製提示詞
        </button>
      )}
      {manual && (
        <textarea
          aria-label="手動複製解卦提示詞" readOnly value={prompt} rows={5}
          onFocus={event => event.currentTarget.select()}
          className="w-full rounded border border-ink-600 bg-ink-950 p-2 text-sm text-paper"
        />
      )}
      {(manual || blocked) && (
        <a href={result.provider.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold underline">
          開啟 {result.provider.name}
        </a>
      )}
    </div>
  );
}
