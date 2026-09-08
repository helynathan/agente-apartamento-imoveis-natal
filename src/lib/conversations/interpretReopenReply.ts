export function interpretReopenReply(text: string): 'continuar' | 'novo_assunto' {
  const normalized = text.trim().toLowerCase();

  const newTopicKeywords = ['2', 'novo', 'outro', 'novo assunto', 'outro assunto'];
  const isNewTopic = newTopicKeywords.some(
    (keyword) => normalized === keyword || normalized.includes(keyword)
  );

  return isNewTopic ? 'novo_assunto' : 'continuar';
}
