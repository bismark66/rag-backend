/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// Utility functions for RAGService

export function isGreetingOrCasual(input: string): boolean {
  const greetingPatterns = [
    /^(hi|hello|hey|greetings)/i,
    /^(how are you|how's it going|what's up)/i,
    /^(good morning|good afternoon|good evening)/i,
    /^(thanks|thank you|bye|goodbye)/i,
  ];
  const trimmedInput = input.trim().toLowerCase();
  return (
    greetingPatterns.some((pattern) => pattern.test(trimmedInput)) ||
    ['hi', 'hello', 'hey', 'thanks', 'bye', 'sup'].includes(trimmedInput)
  );
}

export function extractResponseContent(response: any): string {
  if (typeof response.content === 'string') {
    return response.content;
  } else if (Array.isArray(response.content)) {
    return response.content
      .map((item: any) =>
        typeof item === 'string' ? item : item.text || JSON.stringify(item),
      )
      .join(' ');
  } else {
    return JSON.stringify(response.content);
  }
}
