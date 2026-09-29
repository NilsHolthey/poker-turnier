import BackButton from "./BackButton";
import styles from "./RulesBoard.module.css";

// In-App-Version von docs/spielregeln-app.md (Chat-Wunsch: "we should add the
// tournament spielregeln here, too") - dieselbe nicht-technische Erklärung,
// jetzt direkt im Board statt nur als Repo-Doku, für alle Rollen erreichbar
// übers Hamburger-Menü. Statischer Inhalt (kein Turnier-Bezug nötig), daher
// keine DB-Abfrage in app/regeln/page.js.
export default function RulesBoard() {
  return (
    <main className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>Spielregeln</h1>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Das Grundprinzip</h2>
        <p className={styles.text}>
          Die App würfelt automatisch aus, wer wohin umgesetzt wird - aber jeder einzelne Umsatz muss von
          einem Operator oder dem Admin bestätigt werden. Es gibt einen „Neu auslosen“-Button, falls das
          Ergebnis nicht passt. Die App setzt nie eigenmächtig jemanden um, ohne dass das am Bildschirm
          bestätigt wurde.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wann wird ein Tisch aufgelöst?</h2>
        <p className={styles.text}>
          Sobald an einem Tisch nur noch sehr wenige Spieler übrig sind (Standard: 2 oder weniger), löst die
          App diesen Tisch auf - vorausgesetzt, es gibt noch mindestens einen anderen aktiven Tisch. Die
          verbliebenen Spieler werden nacheinander an den jeweils kleinsten anderen Tisch verteilt. Dabei
          steht fest, welcher Spieler als nächstes drankommt - nur das Ziel wird ausgelost.
        </p>
        <p className={styles.text}>
          Während ein Tisch aufgelöst wird, zeigt die App ein rotes Banner „Tisch X wird aufgelöst“. Am Ende
          gibt es eine Übersicht mit allen neuen Plätzen auf einen Blick.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wann wird ausgeglichen?</h2>
        <p className={styles.text}>
          Wenn kein Tisch aufgelöst werden muss, aber die Tische deutlich unterschiedlich groß sind (Standard:
          der kleinste Tisch hat weniger als 4 Spieler UND der Unterschied zum größten Tisch beträgt
          mindestens 2), zieht die App einen zufälligen Spieler vom größten Tisch und schlägt vor, ihn an den
          kleinsten Tisch zu setzen. Auch das muss bestätigt werden.
        </p>
        <p className={styles.text}>Diese Schwellenwerte kann der Admin unter „Turnier bearbeiten“ anpassen.</p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wenn mehrere Tische gleichzeitig klein sind</h2>
        <p className={styles.text}>
          Manchmal schrumpfen mehrere Tische unabhängig voneinander auf eine kleine, aber gleich große Anzahl
          Spieler (z.B. mehrere Tische mit je 3 Spielern) - dann greift weder das automatische Auflösen noch
          der Ausgleich, weil beide auf einen Unterschied zwischen Tischen angewiesen sind. Für genau diesen
          Fall bekommt der Admin eine Push-Benachrichtigung, sobald zu viele Tische gleichzeitig klein sind.
          Ab wie vielen Tischen mit wie wenig Spielern das gemeldet wird, legt der Admin beim Anlegen oder
          Bearbeiten des Turniers fest.
        </p>
        <p className={styles.text}>
          Ein Beispiel mit den Standardwerten (klein = 3 oder weniger Spieler, Alarm ab 2 solchen Tischen):
          Tisch A, B, C und D haben jeweils genau 3 Spieler. Auflösen greift nicht (3 ist mehr als die
          Auflöse-Schwelle 2). Ausgleichen greift auch nicht (alle vier Tische sind gleich groß, es gibt
          keinen Unterschied). Ohne die Alarm-Funktion würde die App hier einfach nichts tun, obwohl vier
          3er-Tische deutlich schlechter sind als z.B. zwei volle 6er-Tische. Weil aber schon 2 kleine Tische
          für den Alarm reichen (hier sind es sogar 4), bekommt der Admin jetzt eine Push-Benachrichtigung und
          kann von Hand nachhelfen, z.B. Tisch D auflösen und auf A, B und C verteilen.
        </p>
        <p className={styles.text}>
          Der Admin kann dann manuell einen Tisch auflösen/zusammenlegen: „Verwalten“ am gewünschten Tisch
          öffnen, ganz unten „Tisch auflösen“ antippen, bestätigen. Danach läuft es wie eine automatische
          Auflösung: ein Spieler nach dem anderen wird auf die übrigen Tische verteilt, jeder Zug einzeln
          bestätigt, am Ende eine Übersicht mit allen neuen Plätzen. Das geht mit jedem Tisch, der noch
          Spieler hat, nicht nur mit tatsächlich „kleinen“ Tischen - der Admin kann so jederzeit manuell
          zusammenlegen, auch unabhängig vom Alarm.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wann startet das Halbfinale bzw. das Finale?</h2>
        <p className={styles.text}>
          Nur wenn der Admin es manuell auslöst - über den Button in der Navigationsleiste. Es gibt keinen
          automatischen Wechsel nach Zeit oder Spielerzahl.
        </p>
        <p className={styles.text}>
          Beim Klick werden alle noch aktiven Spieler komplett neu und zufällig auf die neuen Tische verteilt,
          die alten Tische werden geschlossen, und jeder Spieler bekommt einen neuen Sitzplatz - auf einen
          Schlag, kein einzelner Auslosungsschritt wie beim Auflösen/Ausgleichen. Vorher fragt die App noch
          einmal nach, weil die aktuelle Sitzordnung dabei verloren geht.
        </p>
        <p className={styles.text}>
          <strong>Noch nicht umgesetzt:</strong> ein „nur die Top X pro Halbfinale-Tisch ziehen ins Finale
          ein“-Modus, bei dem der Rest ausscheidet. Aktuell kommen beim Phasenwechsel immer alle noch aktiven
          Spieler mit ins nächste Level, komplett neu gemischt. Das könnte man später als zusätzliche
          Checkbox/Option beim Anlegen des Turniers ergänzen, falls gewünscht.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wie kommen neue Spieler dazu?</h2>
        <p className={styles.text}>
          Solange die „Rebuy-Phase“ aktiv ist, dürfen auch die Tisch-Operatoren neue Spieler an ihrem eigenen
          Tisch eintragen, nicht nur der Admin.
        </p>
        <p className={styles.text}>
          Rebuy lässt sich auf zwei Wegen beenden: manuell über den Schalter in „Turnier bearbeiten“
          (jederzeit sofort), oder automatisch über „Rebuy endet nach Level X“ beim Bearbeiten der
          Blindstruktur („Blindstruktur bearbeiten“) - sobald die Blind-Uhr dieses Level erreicht, schaltet
          Rebuy von selbst ab. Beides kann gleichzeitig gelten: der manuelle Schalter kann Rebuy auch
          vorzeitig sperren, schon bevor das eingestellte Level erreicht ist.
        </p>
        <p className={styles.text}>
          <strong>Wichtig:</strong> „Spieler hinzufügen“ ist dafür gedacht, jemanden wieder einzutragen, der
          aus Versehen entfernt wurde, oder der gerade eine Hand aussetzt (z.B. kurz nicht am Tisch) - nicht
          dafür, komplett neue Spieler ins laufende Turnier zu holen, die vorher nicht dabei waren. Die App
          unterscheidet das technisch nicht, das ist reine Turnier-Regel.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Die Blind-Uhr</h2>
        <p className={styles.text}>
          Die Blindstruktur zu speichern startet die Uhr nicht. Erst der eigene „Turnier starten“-Button
          setzt die Uhr wirklich in Gang. Danach zählt die App die Level automatisch weiter, sobald die Zeit
          eines Levels abgelaufen ist. Der Admin kann die Uhr jederzeit manuell auf ein anderes Level springen
          lassen oder komplett zurücksetzen, ohne die hinterlegte Struktur zu verlieren.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Wer darf was?</h2>
        <p className={styles.text}>
          <strong>Admin:</strong> darf an jedem Tisch Spieler hinzufügen/entfernen/umbenennen, das Turnier
          anlegen/bearbeiten/löschen, die Blind-Uhr steuern, und den Phasenwechsel auslösen.
        </p>
        <p className={styles.text}>
          <strong>Operator (Tisch-Account):</strong> darf nur am eigenen Tisch Spieler hinzufügen (falls
          Rebuy aktiv), entfernen und umbenennen. Ein Operator kann nie an einem fremden Tisch etwas
          verändern - das verhindert die App aktiv.
        </p>
        <p className={styles.text}>
          <strong>Wichtig für Halbfinale/Finale:</strong> die Tisch-Accounts (tisch1-tisch8) sind an die
          Tisch<strong>nummer</strong> gekoppelt, nicht an eine feste Person. Mit den Standardwerten gibt es
          im Halbfinale nur noch 2 Tische, im Finale nur noch 1 - dadurch können nach der Vorrunde nur noch
          tisch1 und tisch2 (Halbfinale) bzw. nur noch tisch1 (Finale) sich überhaupt noch einen Tisch
          verwalten. tisch3-tisch8 haben dann keinen Tisch mehr zugeordnet. Der Admin kann in dem Fall
          weiterhin jeden Tisch verwalten.
        </p>
      </section>
    </main>
  );
}
