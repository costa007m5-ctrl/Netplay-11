export const translateToPortuguese = async (text: string): Promise<string> => {
  if (!text) return text;
  
  try {
    const response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return text;
    const data = await response.json();
    return data.translated || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
};
