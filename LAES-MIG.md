# Hammerhajer · Det blå dyb

Åbn **index.html** i Chrome eller Edge. Der kræves hverken installation, internet eller server. Behold filerne `index.html`, `ocean.css`, `ocean.js` og `three.min.js` i samme mappe.

1. **Fuldskærm:** Klik på Fuldskærm, tryk F, eller dobbeltklik i havet. Esc forlader fuldskærm.
2. **Pause:** Tryk på mellemrum eller klik på Pause. Samme handling starter animationen igen.
3. **Hastighed:** Brug skyderen mellem knapperne.
4. **Antal hammerhajer:** Skyderen "Hajer" vælger mellem 0 og 40. Tallet er antallet i hele havet; nogle kan svømme uden for synsfeltet. Siden starter med 21.
5. **Skjul betjening:** Lad musen være stille i 5 sekunder. Bevæg den, eller rør skærmen, for at vise knapperne igen.
6. **Skub, træk og drej en haj:** Hold venstre museknap nede på hajen for at skubbe den længere ind i vandet, eller højre for at trække den mod dig. Bevæg samtidig musen for at styre til siderne. Nær kropsmidten flytter kraften primært hajen; ved hoved, hale eller finner drejer den også kroppen. Hajen følger elastisk efter og beholder lidt bevægelse og rotation efter slip, før vandmodstanden bremser den. En finger trækker i skærmens plan og kan også dreje hajen. Det virker under pause, mens resten af havet forbliver på pause.

Scenen har hammerhajer på sammenhængende svømmebaner, små fisk, svævende partikler og solstråler fra en bølgende overflade over kameraet. Hajerne har modellerede øjne, næsebor, mund, gæller og buede finner, en lys bug samt fin hudtekstur. Lysets mønstre bevæger sig over ryggen. Den er lydløs og har ingen tidsbegrænsning.

Lyset følger computerens lokale klokkeslæt. Solen står lavt til venstre om morgenen, højt midt på dagen og lavt til højre om aftenen. Ved lave vinkler bliver lyset rødorange; om natten er havet dæmpet blåt. Den visuelle døgnkurve bruger solopgang kl. 06, højeste solhøjde 65 grader kl. 12 og solnedgang kl. 18. Den afhænger ikke af geografisk placering eller årstid. Svømmehastigheden påvirker ikke uret. Pause fryser også lyset; når animationen fortsættes, følger lyset igen det aktuelle klokkeslæt.

Overfladen består af ti bølgekomponenter med forskellige retninger, bølgelængder, faser og hastigheder samt en langsomt varierende amplitude. Strålernes akser deler ét forsvindingspunkt, der følger solens retning efter brydning ind i vandet. Det samme lys styrer hajernes belysning og lysets mønstre på huden.

Refleksionen bruger de upolariserede Fresnel-ligninger for vand (brydningsindeks 1,333) og luft (1,00029), beregnet ud fra kameraets retning og bølgens lokale normal. Snells lov bestemmer brydningen og overgangen til totalrefleksion. Refleksion viser det blå vandmiljø; gennemlyste områder viser himlen. Der er ingen fast sølvfarve på bølgerne. Fagligt grundlag: [Physically Based Rendering, afsnit 9.3](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission). Linket er kontrolleret fra den lokale pc den 2026-09-06.

Himlen, det reflekterede havmiljø og lysstrålerne er forenklede visuelle modeller. Overfladen sporer ikke refleksioner af de enkelte hajer, og scenen foretager ikke en fuld fysisk beregning af lysets spredning i vandet.

Siden er en pauseskærm i browseren. Den installerer sig ikke som Windows-pauseskærm eller skrivebordsbaggrund. En skjult browserfane holder pause med at tegne og fortsætter automatisk, når den bliver synlig igen. I fuldskærm forsøger siden at holde skærmen tændt, hvis browseren tillader det. Ved indstillingen reduceret bevægelse starter scenen på pause; klik Fortsæt for at starte den.

Modeller, lys og bevægelse er lavet til denne scene. 3D-motoren er Three.js r160 (MIT-licens, se THREE-LICENSE).
