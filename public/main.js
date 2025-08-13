(function(){
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // Tab Switching
  const tabs = qsa('.tab-btn');
  const panels = {
    summarizer: qs('#summarizer'),
    quiz: qs('#quiz'),
    chat: qs('#chat')
  };

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(btn => btn.classList.remove('active'));
    t.classList.add('active');
    Object.keys(panels).forEach(k => panels[k].classList.remove('active'));
    panels[t.dataset.tab].classList.add('active');
  }));

  // Theme Toggle
  const themeBtn = qs('#themeToggle');
  const themeIcon = qs('#themeIcon');
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', theme);
  }
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
  setTheme(localStorage.getItem('theme') || 'light');

  // API call function
  async function callBackend(action, payload){
    try{
      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      if(!res.ok) throw new Error(await res.text());
      return await res.json();
    }catch(err){
      return { error: err.message };
    }
  }

  // Summarizer Button
  qs('#summarizeBtn').addEventListener('click', async () => {
    const text = qs('#summarizerInput').value.trim();
    if(!text) return alert('Please enter text to summarize.');
    const resp = await callBackend('summarize', { text });
    if(resp.error) return alert('Error: ' + resp.error);
    const history = qs('#summarizerHistory');
    const item = document.createElement('div');
    item.className = 'message ai';
    item.textContent = resp.result || JSON.stringify(resp);
    history.appendChild(item);
  });

  // Quiz Button
  qs('#generateQuizBtn').addEventListener('click', async () => {
    const topic = qs('#quizInput').value.trim();
    if(!topic) return alert('Please enter a topic.');
    const resp = await callBackend('quiz', { text: topic, count: 5 });
    if(resp.error) return alert('Error: ' + resp.error);
    const history = qs('#quizHistory');
    const item = document.createElement('div');
    item.className = 'message ai';
    item.innerHTML = JSON.stringify(resp.questions || resp);
    history.appendChild(item);
  });

  // Chat Button
  qs('#sendChatBtn').addEventListener('click', async () => {
    const msg = qs('#chatInput').value.trim();
    if(!msg) return;
    const history = qs('#chatHistory');

    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = msg;
    history.appendChild(userMsg);

    qs('#chatInput').value = '';

    const resp = await callBackend('chat', { text: msg });
    const aiMsg = document.createElement('div');
    aiMsg.className = 'message ai';
    aiMsg.textContent = resp.reply || JSON.stringify(resp);
    history.appendChild(aiMsg);

    history.scrollTop = history.scrollHeight;
  });

  // Clear History
  window.clearHistory = function(tab) {
    const map = {
      summarizer: '#summarizerHistory',
      quiz: '#quizHistory',
      chat: '#chatHistory'
    };
    const container = qs(map[tab]);
    if(container) container.innerHTML = '<div class="empty-state"><i class="fas fa-robot"></i><p>History cleared.</p></div>';
  };

})();
    
