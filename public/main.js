
(function(){
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // Tabs
  const tabs = qsa('.tab');
  const panels = {
    summarize: qs('#summarize-panel'),
    quiz: qs('#quiz-panel'),
    chat: qs('#chat-panel')
  };
  function activateTab(name){
    tabs.forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
    Object.keys(panels).forEach(k => panels[k].classList.toggle('hidden', k!==name));
    localStorage.setItem('activeTab', name);
  }
  tabs.forEach(t => t.addEventListener('click', ()=> activateTab(t.dataset.tab)));
  const last = localStorage.getItem('activeTab') || 'summarize';
  activateTab(last);

  // Theme
  const themeBtn = qs('#theme-toggle');
  function setTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.textContent = t==='dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', t);
  }
  themeBtn.addEventListener('click', ()=> setTheme(document.documentElement.getAttribute('data-theme')==='dark' ? 'light':'dark'));
  const savedTheme = localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light');
  setTheme(savedTheme);

  // Prevent form reloads
  qsa('form').forEach(f => f.addEventListener('submit', e => e.preventDefault()));

  // Backend call (works on Render or Netlify — frontend posts to /api/groq)
  async function callBackend(action, payload){
    try{
      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      if(!res.ok){
        const txt = await res.text();
        throw new Error(txt || 'Request failed');
      }
      return await res.json();
    }catch(err){
      return { error: err.message || String(err) };
    }
  }

  // Summarize
  qs('#summarize-form').addEventListener('submit', async ()=>{
    const text = qs('#summarize-input').value.trim();
    if(!text){ qs('#summarize-output').textContent = 'Enter text to summarize.'; return; }
    qs('#summarize-output').textContent = 'Summarizing...';
    const len = qs('#summary-length').value;
    const resp = await callBackend('summarize', { text, length: len });
    if(resp.error){ qs('#summarize-output').textContent = 'Error: ' + resp.error; return; }
    qs('#summarize-output').textContent = resp.result || JSON.stringify(resp);
  });

  // Quiz
  qs('#quiz-form').addEventListener('submit', async ()=>{
    const text = qs('#quiz-input').value.trim();
    if(!text){ qs('#quiz-output').textContent = 'Enter topic or text.'; return; }
    qs('#quiz-output').textContent = 'Generating quiz...';
    const count = qs('#quiz-count').value;
    const resp = await callBackend('quiz', { text, count });
    if(resp.error){ qs('#quiz-output').textContent = 'Error: ' + resp.error; return; }
    // render parsed questions with options
    const questions = resp.questions || [];
    if(questions.length === 0) { qs('#quiz-output').textContent = 'No questions returned.'; return; }
    let html = '<ol class="quiz-list">';
    questions.forEach(q => {
      html += `<li><div class="q-text">${q.q}</div>`;
      if(q.options && q.options.length){
        html += '<ul class="q-opts">';
        q.options.forEach(opt => html += `<li>${opt}</li>`);
        html += '</ul>';
      }
      html += '</li>';
    });
    html += '</ol>';
    qs('#quiz-output').innerHTML = html;
  });

  // Chat
  const chatWindow = qs('#chat-window');
  qs('#chat-form').addEventListener('submit', async ()=>{
    const text = qs('#chat-input').value.trim();
    if(!text) return;
    const userEl = document.createElement('div'); userEl.textContent = 'You: ' + text; userEl.style.margin='8px 0'; chatWindow.appendChild(userEl);
    qs('#chat-input').value='';
    const resp = await callBackend('chat', { text });
    const botEl = document.createElement('div'); botEl.style.margin='8px 0';
    if(resp.error) botEl.textContent = 'Error: ' + resp.error;
    else botEl.textContent = 'Bot: ' + (resp.reply || JSON.stringify(resp));
    chatWindow.appendChild(botEl);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });

})();
