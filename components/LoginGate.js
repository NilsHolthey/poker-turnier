import styles from "./LoginGate.module.css";

// Eigene Anmelde-Startseite vor dem Auth0-Redirect (Chat-Wunsch: "style the
// login") - die eigentliche Login-Maske ist Auth0-gehostet und wird separat
// über das Universal-Login-Branding im Auth0-Dashboard angepasst.
export default function LoginGate({ title = "Poker-Turnier", subtitle = "Tisch-Management" }) {
  return (
    <main className={styles.page}>
      <div className={`${styles.card} glassChrome`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src="/images/poker-chips.png" alt="" width="132" height="132" />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <a className={styles.button} href="/auth/login">
          Anmelden
        </a>
        <p className={styles.hint}>Mit deinem Tisch-Account (tisch1 – tisch8)</p>
      </div>
    </main>
  );
}
