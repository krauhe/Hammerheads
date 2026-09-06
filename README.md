# Hammerhajer · Det blå dyb

En interaktiv 3D-pauseskærm med hammerhajer i et dybblåt hav. Bølger, lysstråler, svømning og modeller tegnes direkte i browseren med Three.js. Alle nødvendige filer ligger i projektet, så scenen også virker uden internet.

## Start

1. Download projektet som ZIP, eller klon repositoryet.
2. Pak alle filerne ud i samme mappe.
3. Åbn `index.html` i Chrome eller Edge med grafikacceleration slået til.

Der kræves ingen installation, server eller build-trin. Det er en pauseskærm i browseren; den installerer sig ikke som Windows-pauseskærm eller skrivebordsbaggrund.

## Betjening

1. **Fuldskærm:** Klik på knappen, tryk F eller dobbeltklik på det tomme hav. Esc forlader fuldskærm.
2. **Pause:** Klik på Pause eller tryk mellemrum.
3. **Svømmehastighed:** Justér skyderen med hastighedsikonet.
4. **Antal hajer:** Vælg 0–40 med skyderen Hajer. Nogle svømmer uden for synsfeltet.
5. **Skub:** Hold venstre museknap nede på en haj for at skubbe den længere ind i vandet.
6. **Træk:** Hold højre museknap nede på en haj for at trække den nærmere. Bevæg samtidig musen for at styre til siderne.
7. **Drej:** Tag fat ved hoved, hale eller finner. Kraft nær kropsmidten flytter primært hajen; kraft længere fra midten drejer også kroppen.
8. **Touch:** En finger flytter hajen i skærmens plan og kan også dreje den.

Hajerne giver elastisk efter og beholder lidt fart og rotation efter slip. De kan også flyttes under pause. Betjeningen skjules efter inaktivitet og vises igen ved mus, berøring eller tastatur.

## Hav og lys

Lyset følger computerens lokale ur og bliver rødorange ved lave solvinkler. Den visuelle døgnrytme bruger solopgang kl. 06, højeste sol kl. 12 og solnedgang kl. 18. Den beregner ikke solens position ud fra geografisk placering eller årstid.

Overfladens refleksion og brydning afhænger af synsvinklen, bølgens hældning og vandets brydningsindeks. Modellerne af himmel, vandmiljø og lysstråler er visuelle forenklinger. Se [den udførlige beskrivelse](LAES-MIG.md).

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Siden og betjeningen |
| `ocean.css` | Layout og udseende |
| `ocean.js` | Hajmodeller, animation, fysik, lys og interaktion |
| `three.min.js` | Lokal Three.js r160 |
| `THREE-LICENSE` | MIT-licensen for Three.js |
| `LAES-MIG.md` | Brugervejledning og tekniske afgrænsninger |

Scenen er lydløs og foretager ingen netkald. En skjult fane holder pause med at tegne. Hvis systemet er indstillet til reduceret bevægelse, starter scenen på pause.
