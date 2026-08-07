/** Masque au moins 3/4 de la partie locale d'un email: ...29@gmail.com */
export function maskEmail(email?: string | null) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const keep = Math.max(1, Math.min(2, Math.floor(local.length / 4)));
  return `...${local.slice(-keep)}@${domain}`;
}
