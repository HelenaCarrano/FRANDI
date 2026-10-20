import { content } from '../content';
import type { GameState } from '../core/gameState';
import type { UI } from './ui';

/**
 * Pergunta de múltipla escolha para os guardiões (Torre, Castelo). Nunca trava o progresso: errar mostra
 * a dica e pergunta de novo. Com o Biscoito da sorte na mochila aparece uma opção extra que o gasta
 * para eliminar uma resposta errada (sempre sobra ao menos uma errada, então o jogador ainda escolhe).
 */

export interface QuizQuestion {
  question: string;
  options: readonly string[];
  /** Índice da resposta certa em `options`. */
  answer: number;
  /** Fala ao errar. */
  hint: readonly string[];
  /** Fala ao acertar. */
  right: readonly string[];
}

export async function askQuiz(ui: UI, game: GameState, q: QuizQuestion, speaker?: string): Promise<void> {
  let options = q.options.map((label, i) => ({ label, right: i === q.answer }));
  for (;;) {
    const labels = options.map((o) => o.label);
    const canCookie = game.has('biscoito') && options.filter((o) => !o.right).length > 1;
    if (canCookie) labels.push(content.ui.cookieOption);

    const pick = await ui.ask(q.question, labels, speaker);
    if (canCookie && pick === labels.length - 1) {
      game.removeItem('biscoito');
      ui.toast(content.ui.cookieUsed);
      const wrong = options.filter((o) => !o.right);
      const out = wrong[Math.floor(Math.random() * wrong.length)];
      options = options.filter((o) => o !== out);
      continue;
    }
    if (options[pick]?.right) break;
    await ui.tell(q.hint, speaker);
  }
  await ui.tell(q.right, speaker);
}
