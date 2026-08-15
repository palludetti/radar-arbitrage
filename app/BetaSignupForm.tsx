"use client";

import { FormEvent, useState } from "react";
import styles from "./BetaSignupForm.module.css";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export default function BetaSignupForm() {
  const [state, setState] = useState<SubmissionState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          plan: formData.get("plan"),
          company: formData.get("company"),
        }),
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message || "Não foi possível enviar agora.");
      }

      form.reset();
      setState("success");
      setMessage("Cadastro recebido! Vamos entrar em contato por e-mail.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar agora.");
    }
  }

  return (
    <form className={styles.form} id="beta-cadastro" onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Seu nome</span>
        <input name="name" type="text" autoComplete="name" minLength={2} maxLength={80} required />
      </label>
      <label className={styles.field}>
        <span>Seu melhor e-mail</span>
        <input name="email" type="email" autoComplete="email" maxLength={160} required />
      </label>
      <label className={styles.field}>
        <span>Quero começar pelo</span>
        <select name="plan" defaultValue="teste">
          <option value="teste">Teste — 3 análises por R$ 29</option>
          <option value="founding">Pacote Founding — 15 análises por R$ 79</option>
        </select>
      </label>
      <label className={styles.honeypot} aria-hidden="true">
        Empresa
        <input name="company" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <button className="public-cta primary" type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Enviando..." : "Quero entrar no Founding Beta"}
      </button>
      {message && (
        <p className={`${styles.message} ${state === "error" ? styles.error : ""}`} role="status" aria-live="polite">
          {message}
        </p>
      )}
      <small>Ao enviar, você autoriza nosso contato por e-mail sobre o Founding Beta.</small>
    </form>
  );
}
