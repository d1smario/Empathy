export type PasswordStrengthLevel = "empty" | "weak" | "medium" | "strong";

export type PasswordStrengthResult = {
  level: PasswordStrengthLevel;
  /** 0–5, somma dei criteri soddisfatti. */
  score: number;
  /** Etichetta IT pronta per la UI. */
  label: string;
};

/**
 * Stima leggera della robustezza password (nessuna dipendenza esterna).
 * Criteri: lunghezza ≥8, lunghezza ≥12, minuscole+maiuscole, cifre, simboli.
 * Mappa su 3 livelli per il semaforo (rosso/giallo/verde).
 */
export function passwordStrength(password: string): PasswordStrengthResult {
  if (!password) return { level: "empty", score: 0, label: "" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  // Password corta = sempre debole, a prescindere dagli altri criteri.
  if (password.length < 8 || score <= 2) {
    return { level: "weak", score, label: "Debole" };
  }
  if (score === 3 || score === 4) {
    return { level: "medium", score, label: "Media" };
  }
  return { level: "strong", score, label: "Sicura" };
}
