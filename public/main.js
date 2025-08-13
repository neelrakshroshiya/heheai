(function(){
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // ------- Helpers -------
  function showLoading(on=true){
    const m = qs('#loadingModal');
    if(!m) return;
    m.style.display = on ? 'flex' : 'none';
  }
  function toast(msg){
    const c = qs('#toastContainer');
    if(!c) { alert(msg); return; }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 4000);
  }
  function appendMsg(containerSel, role, htmlOrText){
    const box = qs(containerSel);
    if(!box) return;
    const el = document.createElement('div');
    el.className = `message ${role}`;
    if(typeof htmlOrText === 'string' && /<.+>/.test(htmlOrText)){
      el.innerHTML = htmlOrText;
    } else {
      el.textContent = htmlOrText;
    }
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  // ------- Tabs -------
  const tabs = qsa('.tab-btn');
  const panels = {
    summarizer: qs('#summarizer'),
    quiz: qs('#quiz'),
    chat: qs('#chat')
  };

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(btn => btn.classList.remove('active'));
    t.classList.add('active');
    Object.values(panels).forEach(p => p && p.classList.remove('active'));
    const target = panels[t.dataset.tab];
    if(target) target.classList.add('active');
  }));

  // ------- Theme Toggle -------
  const themeBtn = qs('#themeToggle');
  const themeIcon = qs('#themeIcon');
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if(themeIcon) themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    try { localStorage.setItem('theme', theme); } catch(e){}
  }
  if(themeBtn){
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
  setTheme((()=>{ try{return localStorage.getItem('theme')||'light';}catch(e){return 'light';} })());

  // ------- Backend -------
  const API_URL = '/api/groq'; // Netlify/Render route
  async function callBackend(action, payload){
    try{
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      // try to parse JSON even on error to surface useful messages
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text || res.statusText, status: res.status }; }
      if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }catch(err){
      // Helpful hint if opened on GitHub Pages / file://
      const host = (location && location.host) || '';
      const hint = (host.includes('github.io') || location.protocol === 'file:')
        ? 'No backend found. Deploy to Netlify/Render and set GROQ_API_KEY. (See README)'
        : 'Backend not reachable.';
      return { error: `${err.message}. ${hint}` };
    }
  }

  // ------- Summarizer -------
  const summarizeBtn = qs('#summarizeBtn');
  if(summarizeBtn){
    summarizeBtn.addEventListener('click', async () => {
      const text = (qs('#summarizerInput')?.value || '').trim();
      if(!text) { toast('Please enter text to summarize.'); return; }
      showLoading(true);
      const resp = await callBackend('summarize', { text });
      showLoading(false);
      if(resp.error){ toast('Error: ' + resp.error); return; }
      appendMsg('#summarizerHistory', 'ai', resp.result || JSON.stringify(resp));
    });
  }

  // ------- Quiz -------
  const quizBtn = qs('#generateQuizBtn');
  if(quizBtn){
    quizBtn.addEventListener('click', async () => {
      const topic = (qs('#quizInput')?.value || '').trim();
      if(!topic) { toast('Please enter a topic.'); return; }
      showLoading(true);
      const resp = await callBackend('quiz', { text: topic, count: 5 });
      showLoading(false);
      if(resp.error){ toast('Error: ' + resp.error); return; }
      const qsArr = resp.questions || resp.quiz || resp.data || [];
      if(Array.isArray(qsArr) && qsArr.length){
        const html = '<ol class=\"quiz-list\">' + qsArr.map(q => {
          if(typeof q === 'string') return `<li>${q}</li>`;
          const qtxt = q.question || q.q || 'Question';
          const opts = Array.isArray(q.options||q.choices) ? '<ul>' + (q.options||q.choices).map(o=>`<li>${o}</li>`).join('') + '</ul>' : '';
          const ans = q.answer ? `<div class=\"answer\"><strong>Answer:</strong> ${q.answer}</div>` : '';
          return `<li><div class=\"q\">${qtxt}</div>${opts}${ans}</li>`;
        }).join('') + '</ol>';
        appendMsg('#quizHistory', 'ai', html);
      } else {
        appendMsg('#quizHistory', 'ai', JSON.stringify(resp));
      }
    });
  }

  // ------- Chat -------
  const sendBtn = qs('#sendChatBtn');
  if(sendBtn){
    sendBtn.addEventListener('click', async () => {
      const input = qs('#chatInput');
      const msg = (input?.value || '').trim();
      if(!msg) return;
      appendMsg('#chatHistory', 'user', msg);
      if(input) input.value = '';
      showLoading(true);
      const resp = await callBackend('chat', { text: msg });
      showLoading(false);
      appendMsg('#chatHistory', 'ai', resp.reply || resp.result || resp.message || (resp.error ? ('Error: ' + resp.error) : JSON.stringify(resp)));
    });
  }

  // ------- Clear History (used by buttons in HTML) -------
  window.clearHistory = function(tab) {
    const map = {
      summarizer: '#summarizerHistory',
      quiz: '#quizHistory',
      chat: '#chatHistory'
    };
    const container = qs(map[tab]);
    if(container) container.innerHTML = '<div class=\"empty-state\"><i class=\"fas fa-robot\"></i><p>History cleared.</p></div>';
  };
})();