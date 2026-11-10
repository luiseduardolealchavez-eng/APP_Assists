import Anthropic from "@anthropic-ai/sdk";
import { pool } from "@/lib/db";
import { embed, toVector } from "@/lib/embed";
import { ensureSchema } from "@/lib/schema";
import { requireUser, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

//Cliente de Claude para conectarse a los modelos de IA
const client = new Anthropic();
//Fragmentos a considerar
const TOP_K = 5;

//Definición de PROMPT
const PROMPT =
  "Eres DocsAssist. Responde SOLO con la información de los documentos proporcionados, " +
  "en el idioma de la pregunta. Si los documentos no contienen la respuesta, dilo claramente. " +
  "Sé conciso.";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  //Se valida que existan las tablas necesarias
  await ensureSchema();
  const { messages } = (await req.json()) as { messages: Msg[] };
  const last = messages?.at(-1);
  if (!last || last.role !== "user" || !last.content.trim()) {
    return Response.json({ error: "Pregunta vacía" }, { status: 400 });
  }

  //Obtenemos el API KEY desde .env
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Falta ANTHROPIC_API_KEY en .env.local. Contacta a luiseduardolealchavez@gmail.com" }, { status: 500 });
  }

  // 1) Búsqueda semántica
  const [qvec] = await embed([last.content]);
  const { rows } = await pool.query(
    `SELECT c.content, d.filename
       FROM chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.embedding IS NOT NULL AND d.user_id = $3
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [toVector(qvec), TOP_K, user.id],
  );
  if (!rows.length) {
    return Response.json({
      segments: [{ text: "No hay documentos indexados todavía. Favor de subir alguno primero.", citations: [] }],
    });
  }

  // 2) Cada fragmento va como documento con citas activadas (título = nombre del archivo)
  const docs: Anthropic.DocumentBlockParam[] = rows.map((document) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: document.content },
    title: document.filename,
    citations: { enabled: true },
  }));

  const history: Anthropic.MessageParam[] = messages
    .slice(0, -1)
    .map((message) => ({ role: message.role, content: message.content }));

  try {
    //Indico el modelo de IA, el PROMPT y el consumo de tokens
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: PROMPT,
      messages: [
        ...history,
        { role: "user", content: [...docs, { type: "text", text: last.content }] },
      ],
    });

    const segments = response.content.flatMap((content) =>
        content.type === "text"
        ? [{
            text: content.text,
            citations: (content.citations ?? []).map((cita) => ({
              document: ("document_title" in cita && cita.document_title) || "documento",
              quote: cita.cited_text,
            })),
          }]
        : [],
    );
    // Se guarda en el historial (si el registro falla aquí, no debe perderse la respuesta al usuario)
    try {
      //Valida que las tablas existan
      await ensureSchema();
      await pool.query("INSERT INTO questions (question, answer, segments, user_id) VALUES ($1,$2,$3,$4)", [
        last.content,
        segments.map((s) => s.text).join(""),
        JSON.stringify(segments),
        user.id,
      ]);
    } catch (e) {
      //Mandamos un mensaje a consola
      console.error("No se pudo guardar el historial", e);
    }
    return Response.json({ segments });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Falta ANTHROPIC_API_KEY en .env.local. Contacta a luiseduardolealchavez@gmail.com" }, { status: 500 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Límite de tasa alcanzado. Contacta a luiseduardolealchavez@gmail.com" }, { status: 429 });
    }
    const msg = e instanceof Error ? e.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}