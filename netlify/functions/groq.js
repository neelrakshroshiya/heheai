
export async function handler(event, context) {
  // Netlify function version with same features
  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if(!GROQ_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Missing GROQ_API_KEY' }) };

    const { action, payload } = JSON.parse(event.body || '{}');
    const PROFANITY = ['badword1','badword2','damn','hell','shit','fuck'];

    const containsProfanity = (text) => {
      if(!text) return false;
      const t = text.toLowerCase();
      return PROFANITY.some(w => t.includes(w));
    };
    const censor = (text) => {
      if(!text) return text;
      let out = text;
      PROFANITY.forEach(w => { out = out.replace(new RegExp(w, 'gi'), '***'); });
      return out;
    };

    if(containsProfanity(payload?.text || '')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request contains prohibited language.' }) };
    }

    // Simple in-memory rate limit not reliable in serverless (stateless) but we'll implement a lightweight token check via context.clientContext
    // For serious rate limiting use an external store (Redis) or use hosting provider rate limit features.

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
      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }

    const body = { model: 'llama3-8b-8192', messages, max_tokens: 800 };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify(body)
    });

    if(!res.ok){
      const txt = await res.text();
      return { statusCode: res.status, body: txt };
    }
    const data = await res.json();
    let replyText = '';
    if(Array.isArray(data.choices) && data.choices[0] && data.choices[0].message){
      replyText = data.choices[0].message.content || '';
    } else if(data.output_text){
      replyText = data.output_text;
    } else {
      replyText = JSON.stringify(data);
    }

    // parse quiz similar to server
    const parseQuiz = (text) => {
      if(!text) return [];
      const blocks = text.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
      const questions = [];
      for(const b of blocks){
        const lines = b.split(/\n/).map(l=>l.trim()).filter(Boolean);
        if(lines.length > 1 && lines.slice(1).some(l=>/^\s*[A-D][\).:-]/i.test(l))){
          const qline = lines[0].replace(/^[0-9]+[).\s]*/, '').trim();
          const opts = lines.slice(1).map(l=> l.replace(/^[A-D][\).:-\s]*/i,'').trim());
          questions.push({ q: qline, options: opts });
          continue;
        }
        questions.push({ q: b, options: [] });
      }
      return questions;
    };

    if(action === 'quiz'){
      const questions = parseQuiz(replyText);
      return { statusCode: 200, body: JSON.stringify({ questions }) };
    }
    if(action === 'summarize'){
      return { statusCode: 200, body: JSON.stringify({ result: replyText }) };
    }
    if(action === 'chat'){
      return { statusCode: 200, body: JSON.stringify({ reply: replyText }) };
    }
    return { statusCode: 200, body: JSON.stringify({ data }) };

  } catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
