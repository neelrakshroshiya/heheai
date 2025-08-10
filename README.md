
Groq Fullstack Enhanced (Render + Netlify ready)
===============================================

This project includes:
- public/ (frontend) - minimal responsive UI with Summarize, Quiz, Chat tabs
- server.js - Express backend for Render with rate limiting, profanity filter, quiz parsing
- netlify/functions/groq.js - Netlify serverless function with same behavior
- netlify.toml - redirects /api/groq to function on Netlify
- package.json

Deployment:
1) Push repo to GitHub.
2) For Render: create a Web Service -> Start Command: npm start -> Add env var GROQ_API_KEY.
3) For Netlify: create a site from Git -> Ensure functions are recognized -> Add env var GROQ_API_KEY.
4) Place ad code inside AD SLOT divs in public/index.html

Notes:
- Rate limiting in server.js uses in-memory storage and works on a single instance. For robust limits across instances use Redis or a hosted rate-limit service.
- Netlify Functions are stateless; implemented simple checks in the function but for production use external rate-limit storage.
- Update the PROFANITY array in server.js/netlify function to include words you want blocked.
- The Groq request uses model llama3-8b-8192 and endpoint https://api.groq.com/openai/v1/chat/completions.
