'use client';

import { useState, useTransition } from 'react';
import { generateCopilotSuggestionAction } from '../copilotActions';

export function CopilotPanel({
  conversationId,
  onUseSuggestion,
}: {
  conversationId: string;
  onUseSuggestion: (text: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateCopilotSuggestionAction(conversationId);
      if ('error' in result) {
        setError(result.error);
        setSuggestion(null);
      } else {
        setSuggestion(result.suggestion);
      }
    });
  }

  return (
    <div className="flex w-full flex-shrink-0 flex-col justify-between rounded-2xl border border-nathai-cyan/30 bg-nathai-cyan/10 p-3 shadow-card md:aspect-[9/16] md:w-40">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-nathai-cyan/80">Copiloto IA</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {suggestion && <p className="text-sm text-nathai-ink/80">{suggestion}</p>}
        {!suggestion && !error && (
          <p className="text-xs text-nathai-ink/40">Gere uma sugestão de resposta com base na conversa.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {suggestion && (
          <button
            type="button"
            onClick={() => onUseSuggestion(suggestion)}
            className="w-full rounded-xl border border-nathai-blue py-1 text-xs font-medium text-nathai-blue transition-all duration-200 hover:-translate-y-0.5 hover:bg-nathai-blue hover:text-white hover:shadow-button"
          >
            Usar
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan py-1 font-display text-xs font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-button"
        >
          {isPending ? 'Gerando...' : suggestion ? 'Gerar outra' : 'Gerar sugestão'}
        </button>
      </div>
    </div>
  );
}
