// Calcula embeddings para chunks que aún no tienen: npx tsx --env-file=.env.local scripts/backfill.ts
import { pool } from "../lib/db";
import { embed, toVector } from "../lib/embed";

async function main() {
  const { rows } = await pool.query("SELECT id, content FROM chunks WHERE embedding IS NULL");
  for (let i = 0; i < rows.length; i += 16) {
    const batch = rows.slice(i, i + 16);
    const vecs = await embed(batch.map((r) => r.content));
    for (let j = 0; j < batch.length; j++) {
      await pool.query("UPDATE chunks SET embedding = $1 WHERE id = $2", [toVector(vecs[j]), batch[j].id]);
    }
  }
  console.log(`Embeddings generados: ${rows.length}`);
  await pool.end();
  
}
main();