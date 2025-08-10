
/* Express server for Render with rate limiting, profanity filter, and quiz parsing */
const express = require('express');
const path = require('path');
const fetch = global.fetch || require('node-fetch');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama3-8b-8192';

/* Simple profanity list (add more as needed) */
const PROFANITY = ['badword1','badword2','damn','hell','shit','fuck']; // example; extend as needed

function containsProfanity(text){
  if(!text) return false;
  const t = text.toLowerCase();
  return PROFANITY.some(w => t.includes(w));
}
function censor(text){
  if(!text) return text;
  let out = text;
  PROFANITY.forEach(w => {
    const re = new RegExp(w, 'gi');
    out = out.replace(re, '***');
  });
  return out;
}

/* Simple in-memory rate limiter (per IP) */
const RATE_LIMIT_WINDOW_MS = 60*1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window
const ipMap = new Map(); // ip -> [timestamps]

function checkRateLimit(ip){
  const now = Date.now();
  const arr = ipMap.get(ip) || [];
  // keep only within window
  const filtered = arr.filter(ts => ts > now - RATE_LIMIT_WINDOW_MS);
  filtered.push(now);
  ipMap.set(ip, filtered);
  return filtered.length <= RATE_LIMIT_MAX;
}

/* Quiz parsing: try to extract Q and options from AI text */
function parseQuiz(text){
  if(!text) return [];
  // split into blocks by double newline or numbered list
  const blocks = text.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
  const questions = [];
  const optRegex = /^(?:A\.|A\)|\(A\)|A:|a\.|a\)|\(a\)|\s*A\s*-|\s*1\)|[A]\s+)/;
  // attempt to detect Q and options
  for(const b of blocks){
    // try numbered question like "1. Question...\nA. ...\nB. ..."
    const lines = b.split(/\n/).map(l=>l.trim()).filter(Boolean);
    if(lines.length === 0) continue;
    // if first line looks like question and following lines options
    if(lines.length > 1 && lines.slice(1).some(l=>/^\s*[A-D][\).:-]/i.test(l))){
      const qline = lines[0].replace(/^[0-9]+[).\s]*/, '').trim();
      const opts = lines.slice(1).map(l=> l.replace(/^[A-D][\).:-\s]*/i,'').trim());
      questions.push({ q: qline, options: opts });
      continue;
    }
    // fallback: if block contains lines with "Q:" and "A:" patterns
    const qMatch = b.match(/^(?:Q:|Question\s*[0-9]*[:\s-]*)?(.+?)(?:\n|$)/i);
    if(qMatch && /A[:.\)]/i.test(b)){
      const qtext = qMatch[1].trim();
      const opts = Array.from(b.matchAll(/(?:A[:.\)]|A\.|A\))\s*([^\n]+)/ig)).map(m=>m[1].trim());
      if(opts.length) { questions.push({ q: qtext, options: opts }); continue; }
    }
    // last resort: if block looks like "Question? - option1; option2; option3"
    const parts = b.split(/[:;-]{2,}| - |;\s*/);
    if(parts.length >= 2){
      const qtext = parts[0].trim();
      const opts = parts.slice(1).map(p=>p.trim()).filter(Boolean);
      if(opts.length) { questions.push({ q: qtext, options: opts }); continue; }
    }
    // otherwise treat whole block as a question without options
    questions.push({ q: b, options: [] });
  }
  return questions;
}

app.post('/api/groq', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    if(!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });

    const { action, payload } = req.body || {};
    // basic profanity check
    const incomingText = (payload && (payload.text || payload.topic)) || '';
    if(containsProfanity(incomingText)) return res.status(400).json({ error: 'Request contains prohibited language.' });

    if(!GROQ_API_KEY) return res.status(500).json({ error: 'Missing GROQ_API_KEY' });

    let messages = [];
    if(action === 'summarize'){
      const length = payload.length || 'medium';
      messages = [
        { role: 'system', content: 'You are a helpful assistant that writes concise summaries.' },
        { role: 'user', content: `Summarize the following text (${length}):\n\n${censor(payload.text)}` }
      ];
    } else if(action === 'quiz'){
      messages = [
        { role: 'system', content: 'You are a helpful assistant that creates multiple-choice quizzes with 4 options each and clearly labels them A,B,C,D.' },
        { role: 'user', content: `Create ${payload.count||5} multiple-choice questions with 4 options each based on the following text or topic:\n\n${censor(payload.text)}` }
      ];
    } else if(action === 'chat'){
      messages = [
        { role: 'system', content: 'You are a helpful conversational assistant.' },
        { role: 'user', content: censor(payload.text) }
      ];
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const body = { model: MODEL, messages, max_tokens: 800 };

    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify(body)
    });

    if(!groqRes.ok){
      const txt = await groqRes.text();
      return res.status(groqRes.status).send(txt);
    }
    const data = await groqRes.json();
    let replyText = '';
    if(Array.isArray(data.choices) && data.choices[0] && data.choices[0].message){
      replyText = data.choices[0].message.content || '';
    } else if(data.output_text){
      replyText = data.output_text;
    } else {
      replyText = JSON.stringify(data);
    }

    if(action === 'quiz'){
      const questions = parseQuiz(replyText);
      return res.json({ questions });
    }
    if(action === 'summarize'){
      return res.json({ result: replyText });
    }
    if(action === 'chat'){
      return res.json({ reply: replyText });
    }
    return res.json({ data });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, ()=> console.log('Server running on port', PORT));
