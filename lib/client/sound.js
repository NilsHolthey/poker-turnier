// Chat-Wunsch: "play a sound if a player busts" - echte Audio-Datei statt
// des ursprünglichen generierten Beeps (public/sounds/bust.mp3).
//
// Browser-Autoplay-Policy: ein <audio>-Element darf erst nach IRGENDEINER
// Nutzer-Interaktion mit der Seite abspielen - auf dem Dashboard übernimmt
// das der Doppelklick für Vollbild (siehe DashboardBoard.js toggleFullscreen).
// Ohne jede Interaktion bleibt der allererste Ton stumm (play() wirft dann
// einen NotAllowedError, hier bewusst verschluckt statt den Rest der App zu
// stören).
//
// Ein Element statt bei jedem Bust ein neues Audio(...) zu erzeugen - spart
// wiederholtes Neuladen derselben Datei. currentTime = 0 vor jedem Abspielen,
// damit zwei Busts kurz hintereinander den Sound jeweils von vorne hören
// lassen statt den laufenden einfach zu ignorieren.
let bustAudio = null;

export function playBustSound() {
  if (typeof window === "undefined") return;
  if (!bustAudio) {
    bustAudio = new Audio("/sounds/bust.mp3");
  }
  bustAudio.currentTime = 0;
  bustAudio.play().catch(() => {});
}
