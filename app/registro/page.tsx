"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./registro.module.css";

type User = { nombre: string; correo: string; estatus: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
  return data.user as User;
}

export default function Registro() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reg, setReg] = useState({ nombre: "", correo: "", password: "", estatus: "ACTIVO" });
  const [log, setLog] = useState({ correo: "", password: "" });

  async function submit(e: React.FormEvent, url: string, body: unknown) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await post(url, body);
      router.replace("/");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <center><h1>Admin DocAssist</h1></center>
      <center><p>Reg&iacute;strate o inicia sesi&oacute;nn para usar el asistente.</p></center>
      {msg && <p className={msg.ok ? styles.ok : styles.err}>
        { msg.text === 'Failed to fetch' ? ( 'Revisa tu conexión a Internet o que el sitio está disponible.') : (msg.text) }
      </p>}
      <br />
      <div className={styles.columns}>
        <form className={styles.form} onSubmit={(e) => submit(e, "/api/auth/register", reg)}>
          <h2>Registro</h2>
          <br />
          <label>Nombre completo (45 max)
            <input required value={reg.nombre} onChange={(e) => setReg({ ...reg, nombre: e.target.value })} maxLength={45} />
          </label>
          <label>Correo (95 max)
            <input required type="email" value={reg.correo} onChange={(e) => setReg({ ...reg, correo: e.target.value })} maxLength={95} />
          </label>
          <label>Contrase&ntilde;a (m&iacute;n. 8 caracteres - max 10)
            <input required type="password" minLength={8} autoComplete="new-password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} maxLength={10} />
          </label>
          <br />
          <button disabled={busy}>Registrarme</button>
        </form>
        <form className={styles.form} onSubmit={(e) => submit(e, "/api/auth/login", log)}>
          <h2>Iniciar sesi&oacute;n</h2>
          <label>Correo (95 max)
            <input required type="email" value={log.correo} onChange={(e) => setLog({ ...log, correo: e.target.value })} maxLength={45} />
          </label>
          <label>Contrase&ntilde;a (m&iacute;n. 8 caracteres - max 10)
            <input required type="password" autoComplete="current-password" value={log.password} onChange={(e) => setLog({ ...log, password: e.target.value })} maxLength={10} />
          </label>
          <br />
          <button disabled={busy}>Iniciar sesi&oacute;n</button>
        </form>
      </div>
    </main>
  );
}