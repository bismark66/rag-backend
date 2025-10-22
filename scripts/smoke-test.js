const axios = require('axios');

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  try {
    console.log('Running smoke tests against', base);

    // 1. Health (if exists)
    try {
      const health = await axios.get(`${base}/health`);
      console.log('Health:', health.status);
    } catch (e) {
      console.warn('Health endpoint not available or failed');
    }

    // 2. Create conversation
    const createRes = await axios.post(`${base}/chat/conversations`, {});
    console.log(
      'Create conversation status:',
      createRes.status,
      createRes.data,
    );
    const conversationId = createRes.data.conversationId;

    // 3. Ask a question
    const askRes = await axios.post(`${base}/chat/ask`, {
      question: 'Will it rain in Kumasi today?',
      userId: 'smoke-test',
    });
    console.log('Ask status:', askRes.status);
    console.log(
      'Ask response sample:',
      askRes.data.answer ? askRes.data.answer.substring(0, 200) : askRes.data,
    );

    // 4. Get history
    const hist = await axios.get(`${base}/chat/history/${conversationId}`);
    console.log(
      'History status:',
      hist.status,
      'messages:',
      hist.data.messages.length,
    );

    console.log('Smoke test completed successfully');
  } catch (err) {
    console.error('Smoke test failed:', err.message);
    process.exit(1);
  }
}

run();
