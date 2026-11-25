// 只接受使用者在本機卜卦按鈕上的實際點擊（含鍵盤啟動）。
document.addEventListener('shicao:probe', event => {
  if (chrome.runtime?.id) event.preventDefault();
});

document.addEventListener('click', event => {
  if (!event.isTrusted || !chrome.runtime?.id) return;
  const button = event.target.closest?.('button[data-shicao-provider]');
  const prompt = button?.closest('[data-shicao-prompt]')?.dataset.shicaoPrompt;
  if (!prompt || button.disabled) return;

  // React 在冒泡階段看到 defaultPrevented，便採用預填流程。
  event.preventDefault();
  const provider = button.dataset.shicaoProvider;
  chrome.runtime.sendMessage({ type: 'open', provider, prompt })
    .then(reply => {
      if (!reply?.ok) throw new Error('無法開啟草稿');
    })
    .catch(() => button.dispatchEvent(new CustomEvent('shicao:open-failed', { bubbles: true })));
}, true);
