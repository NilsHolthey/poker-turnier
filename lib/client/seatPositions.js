// Percent-based seat coordinates around the capsule, clockwise starting at the
// bottom, matching lib/core/seating.js's seatOf() index order. seatOf() only
// ever produces a 0-based index - what that index visually means is entirely
// up to this file, so changing the arrangement here never touches seat
// numbering/assignment logic.
//
// Derived from the capsule's actual geometry (TableCapsule.module.css): width/
// height scale with vw at a fixed 3:5 ratio, and border-radius: 999px clamps to
// a true stadium - semicircular caps of radius r = width/2 = 1.5 (unit system
// W=3, H=5), joined by straight sides.
//
// Each seat is pushed outward from the true boundary by the same fixed gap
// (d = 0.35 units) along that point's OUTWARD NORMAL:
//   - straight-side seats: normal is purely horizontal.
//   - cap seats (top-center/bottom-center on the 6er, Kopfende/Fußende on the
//     8er): normal is the radial direction from THAT CAP'S OWN circle center -
//     (50%, 30%) for the top cap, (50%, 70%) for the bottom cap - not the
//     capsule's overall center. Scaling from the capsule's overall center only
//     happens to be correct for the straight-side seats; for cap seats it
//     shrinks both the direction and the distance, leaving them visibly closer
//     to the table than the straight-side seats.
export const SEAT_POSITIONS = {
  // 6er: 2 Plätze pro Längsseite + je einer oben/unten mittig (statt 3 pro
  // Seite ohne Pol-Plätze) - realistischeres "Nieren"-Layout eines echten
  // Pokertisches. Index 0 (Spieler X.1, z.B. die Bank auf 1.1) ist links-unten,
  // nicht unten-mitte - das ist der eigentliche "erste Sitz" nach der
  // Uhrzeigersinn-Konvention (spec, "Start unten links").
  6: [
    { top: "70%", left: "-11.7%" }, // links-unten
    { top: "30%", left: "-11.7%" }, // links-oben
    { top: "-7%", left: "50%" }, // oben-mitte
    { top: "30%", left: "111.7%" }, // rechts-oben
    { top: "70%", left: "111.7%" }, // rechts-unten
    { top: "107%", left: "50%" }, // unten-mitte
  ],
  8: [
    { top: "89.7%", left: "-2.2%" }, // unten-links
    { top: "50%", left: "-11.7%" }, // mitte-links
    { top: "10.3%", left: "-2.2%" }, // oben-links
    { top: "-7%", left: "50%" }, // Kopfende
    { top: "10.3%", left: "102.2%" }, // oben-rechts
    { top: "50%", left: "111.7%" }, // mitte-rechts
    { top: "89.7%", left: "102.2%" }, // unten-rechts
    { top: "107%", left: "50%" }, // Fußende
  ],
  // 7er (docs/table-size-kickoff-prompt.md, §2): 3 links (inkl. Mitte-links)
  // + 2 rechts (nur die Ecken) + BEIDE Pole oben/unten - nicht "3 pro
  // Längsseite + nur 1 Pol oben" (erste Version): dabei hätte unten gar
  // keine Mittelposition existiert, wodurch Kopfende und Fußende (beide
  // eigentlich bei left:50%) nicht mehr auf derselben Vertikalen lagen,
  // sondern Kopfende allein in der Mitte oben stand, während unten nur die
  // beiden Eck-Sitze da waren (Bugreport: "top seat/player and bottom seat
  // player are no longer vertically aligned"). Mit beiden Polen bleibt die
  // Kopfende/Fußende-Achse bei left:50% erhalten wie bei 6er/8er, die
  // Asymmetrie (3 links/2 rechts) fällt dafür in der Mitte weniger auf.
  // Identische Koordinaten wie beim 8er, nur ohne mitte-rechts.
  7: [
    { top: "89.7%", left: "-2.2%" }, // unten-links
    { top: "50%", left: "-11.7%" }, // mitte-links
    { top: "10.3%", left: "-2.2%" }, // oben-links
    { top: "-7%", left: "50%" }, // Kopfende
    { top: "10.3%", left: "102.2%" }, // oben-rechts
    { top: "89.7%", left: "102.2%" }, // unten-rechts
    { top: "107%", left: "50%" }, // Fußende
  ],
};
