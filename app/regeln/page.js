import { auth0 } from "@/lib/auth0";
import RulesBoard from "@/components/RulesBoard";
import LoginGate from "@/components/LoginGate";

// Eigene Seite statt Modal, wie /overview (Chat-Wunsch: "we should add the
// tournament spielregeln here, too") - für ALLE angemeldeten Rollen, kein
// Admin-Gate, kein Turnier-Bezug nötig (statischer Inhalt).
export default async function RegelnPage() {
  const session = await auth0.getSession();

  if (!session) {
    return <LoginGate subtitle="Spielregeln" />;
  }

  return <RulesBoard />;
}
