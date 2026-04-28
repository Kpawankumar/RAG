import 'dotenv/config';
import { OpenRouter } from '@openrouter/sdk';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY is missing. Set it in your environment or .env (backend).');
}

const client = new OpenRouter({
  apiKey,
  httpReferer: process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:10000',
  appTitle: process.env.OPENROUTER_TITLE || 'RAG 1.0',
});

const completion = await client.chat.send({
  chatRequest: {
    model: 'openai/gpt-5.2',
    maxTokens: 512,
    messages: [
      {
        role: 'user',
        content: 'What is the meaning of life?',
      },
    ],
  },
});

console.log(completion.choices[0].message.content);

