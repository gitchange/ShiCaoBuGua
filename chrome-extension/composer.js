// 僅處理從卜卦按鈕建立的分頁。一般 AI 對話會在第一次查詢後直接結束。
(async () => {
  const chatGPT = location.origin === 'https://chatgpt.com';
  const isNewChat = () => chatGPT ? location.pathname === '/' : /^\/(?:u\/\d+\/)?app\/?$/.test(location.pathname);
  if (!isNewChat()) return;
  const pending = await chrome.runtime.sendMessage({ type: 'ready' });
  if (!pending) return;

  const selector = chatGPT
    // 首頁的 pending-home-input 會在載入後被取代。只在正式編輯器出現後領取草稿。
    ? [
      '.ProseMirror[contenteditable="true"][role="textbox"]',
      'textarea#mobile-composer-prompt',
      '#prompt-textarea[contenteditable="true"]',
      'textarea#prompt-textarea',
    ].join(', ')
    : 'rich-textarea [contenteditable="true"], .ql-editor[contenteditable="true"][role="textbox"], textarea[aria-label="Enter a prompt here"]';
  const findEditor = () => [...document.querySelectorAll(selector)].find(el =>
    el.getClientRects().length && !el.matches(':disabled, [readonly], [aria-disabled="true"]')
  );
  const readText = el => el instanceof HTMLTextAreaElement ? el.value : el.innerText;
  const normalized = text => text.replace(/[\s\u200B]+/gu, ' ').trim();

  function notify(text) {
    const note = document.createElement('aside');
    note.setAttribute('role', 'status');
    note.textContent = text;
    Object.assign(note.style, {
      position: 'fixed', bottom: '1rem', right: '1rem', zIndex: '2147483647',
      maxWidth: '24rem', padding: '0.75rem 1rem', borderRadius: '0.5rem',
      color: 'white', background: '#292524', font: '14px/1.5 system-ui',
    });
    document.body.append(note);
    setTimeout(() => note.remove(), 10000);
  }

  async function fillWhenReady() {
    if (!isNewChat() || !findEditor()) return;
    // 在非同步操作前停止監聽，後續框架重繪不會觸發第二次填寫。
    observer.disconnect();
    clearTimeout(timeout);
    const draft = await chrome.runtime.sendMessage({ type: 'take' });
    if (!draft) return;
    const editor = findEditor();
    if (!isNewChat() || !editor || normalized(readText(editor))) {
      notify('已保留目前的輸入內容。可回卜卦分頁，從「手動複製提示詞」取用這一卦。');
      return;
    }
    editor.focus();
    // Chromium 的文字編輯操作會通知 ProseMirror／Quill，並保留復原能力。
    // 整段以純文字插入，換行也是草稿內容。
    document.execCommand('insertText', false, draft.prompt);
    if (normalized(readText(editor)) === normalized(draft.prompt)) {
      notify('已填入解卦草稿，請確認後自行送出。');
    } else {
      notify('未能完整填入。請回卜卦分頁選「手動複製提示詞」。');
    }
  }

  const observer = new MutationObserver(() => { void fillWhenReady(); });
  const timeout = setTimeout(() => {
    observer.disconnect();
    if (isNewChat()) notify('尚未找到輸入框。可回卜卦分頁重新開啟或手動複製提示詞。');
  }, Math.max(0, pending.expires - Date.now()));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'role', 'contenteditable', 'class', 'disabled', 'readonly', 'aria-disabled', 'hidden', 'style'] });
  await fillWhenReady();
})().catch(() => { /* 擴充功能可能已被停用，原卜卦分頁仍可手動複製。 */ });
