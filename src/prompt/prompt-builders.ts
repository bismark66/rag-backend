export const SYSTEM_PROMPTS = {
  greeting: `You are a friendly, conversational assistant. Respond to the user in a warm, natural, and human way. If the user says thank you, respond appropriately. If the user greets you, greet them back. Keep it short and friendly.`,
  api: `You are a helpful assistant. Given the following API data and user question, generate a friendly, conversational answer for the user. Do not mention that you are using an API or that this is API data. Be concise and natural.`,
  agriculture: `You are an expert agricultural advisor. Given the user's question and the current weather data, provide a clear, actionable recommendation about whether it is wise to plant now. Do NOT just summarize the weather. Always give a recommendation about planting, based on the weather and season. If you don't have enough information, say so, but always give a recommendation. Be friendly, concise, and practical.`,
};

// eslint-disable-next-line prettier/prettier
export function buildApiPrompt({
  userQuestion,
  apiData,
  isFarmingQuery,
}: {
  userQuestion: string;
  apiData: any;
  isFarmingQuery: boolean;
}) {
  return [
    {
      role: 'system',
      content: isFarmingQuery ? SYSTEM_PROMPTS.agriculture : SYSTEM_PROMPTS.api,
    },
    {
      role: 'user',
      content: `User question: ${userQuestion}\nAPI data: ${JSON.stringify(apiData)}`,
    },
  ];
}

export function buildGreetingPrompt(userQuestion: string) {
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPTS.greeting,
    },
    {
      role: 'user',
      content: userQuestion,
    },
  ];
}
