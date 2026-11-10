// Servidor de Ollama
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
//Modelo de IA
const MODEL = process.env.EMBED_MODEL ?? "qwen3-embedding:0.6b";

export async function embed(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!response.ok) throw new Error(`Ollama embeddings falló (${response.status}). Verifica que está corriendo tu servidor de Ollama y que tienes instalado el modelo ${MODEL}. Revisa el archivo README.md`);
  return (await response.json()).embeddings;
}

export const toVector = (v: number[]) => `[${v.join(",")}]`;