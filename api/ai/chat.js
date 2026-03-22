import { OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL } from '../_lib/env.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
  if (!OPENROUTER_API_KEY) return sendJson(res, 503, { error: 'OPENROUTER_API_KEY is not configured' });

  try {
    const { messages = [], context } = await readJsonBody(req);
    const system = {
      role: 'system',
      content: [
        'You are Ammy, a concise AMM learning assistant.',
        context ? `Context: ${context}` : '',
      ].filter(Boolean).join('\n'),
    };

    const upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [system, ...messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      return sendJson(res, 502, { error: `OpenRouter request failed with ${upstream.status}` });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'AI chat failure' });
  }
}
