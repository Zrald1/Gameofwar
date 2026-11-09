export default async function run({ page }) {
  const app = page.frames().find((f) => f.url().includes('iwsdk_preview_reload')) ?? page.mainFrame();
  return await app.evaluate(async () => {
    const A = window.__atlas;
    return {
      speechRec: typeof (window.SpeechRecognition ?? window.webkitSpeechRecognition),
      tts: typeof window.speechSynthesis,
      llmCfg: !!localStorage.getItem('atlas-llm-v1'),
      systems: undefined,
    };
  });
}
