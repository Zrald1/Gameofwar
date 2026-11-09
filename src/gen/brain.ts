/**
 * The game's "AI" brain — a pluggable interface.
 *
 * `local` mode is the default: a deterministic, seeded generator that authors
 * NPC offers, dialogue and build plans entirely on-device (no key, no
 * network — the honest interpretation of "the game AI authors them").
 *
 * `llm` mode upgrades the same calls through any OpenAI-compatible
 * chat/completions endpoint. The user supplies their own endpoint + key via
 * `setLlmConfig()`; it lives in localStorage, never in source — a public
 * GitHub Pages app cannot safely ship a key.
 */

export type BrainMode = 'local' | 'llm';

export interface LlmConfig {
  endpoint: string; // e.g. https://api.openai.com/v1/chat/completions
  key: string;
  model: string;
}

const LLM_KEY = 'atlas-llm-v1';

export function getLlmConfig(): LlmConfig | null {
  try {
    const d = JSON.parse(localStorage.getItem(LLM_KEY) ?? 'null');
    return d?.endpoint && d?.key && d?.model ? d : null;
  } catch {
    return null;
  }
}

export function setLlmConfig(cfg: LlmConfig | null): void {
  try {
    if (cfg) localStorage.setItem(LLM_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(LLM_KEY);
  } catch {
    /* private mode */
  }
}

export function brainMode(): BrainMode {
  return getLlmConfig() ? 'llm' : 'local';
}

/**
 * BYOK bootstrap for a static PWA: `?llm=<endpoint>|<key>|<model>` (or the
 * separate `llm_endpoint`/`llm_key`/`llm_model` params) stores the config in
 * localStorage, then scrubs the key out of the address bar. Nothing is ever
 * written to source.
 */
export function brainBoot(): void {
  const p = new URLSearchParams(location.search);
  const one = p.get('llm');
  const key = p.get('llm_key') ?? (one ? one.split('|')[1] : null);
  const endpoint = p.get('llm_endpoint') ?? (one ? one.split('|')[0] : null);
  const model = p.get('llm_model') ?? (one ? one.split('|')[2] : null);
  let touched = false;
  if (endpoint && key && model) {
    setLlmConfig({ endpoint, key, model });
    touched = true;
  }
  if (p.has('llm') || p.has('llm_key') || touched) {
    p.delete('llm');
    p.delete('llm_key');
    p.delete('llm_endpoint');
    p.delete('llm_model');
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
  }
}

/**
 * One chat-completion round trip. Returns the assistant text, or null on any
 * failure (missing config, network, bad shape) — callers always fall back to
 * the local generator, so the game never hard-depends on the key.
 */
export async function llmChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 220,
): Promise<string | null> {
  const cfg = getLlmConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.9,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
