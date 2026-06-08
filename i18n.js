"use strict";
/* =========================================================================
   Cozy Pond — English translation dictionary.
   Keyed by the Norwegian source string (so `T(s)` returns s unchanged in
   Norwegian and the mapped value in English). Strings with {placeholders}
   are filled in by T(s, vars). Kept in its own file so the big game file
   stays small and low-risk to edit.
   ========================================================================= */
window.EN = {
  /* ---- HUD ---- */
  "Fangst:": "Catch:",
  "Stang:": "Rod:",
  "Fiskekort:": "License:",
  "Meny": "Menu",
  "Hvordan spille": "How to play",
  "Hjelp": "Help",
  "Lyd": "Sound",
  "Volum": "Volume",
  "Fullskjerm": "Fullscreen",
  "Klikk for å kaste ut": "Click to cast",
  "Innhaling": "Reeling",
  "Linestramming": "Line tension",
  "Klikk for å fortsette": "Click to continue",

  /* ---- Main menu ---- */
  "Start spill": "Start game",
  "Fortsett": "Continue",
  "Lagringsplasser": "Save slots",
  "Toppliste": "Leaderboard",
  "Se introen igjen": "Watch the intro again",

  /* ---- Market / map ---- */
  "☰ Meny": "☰ Menu",
  "Klikk på en bod for å gå inn — eller bilen for å reise videre": "Click a stall to enter — or the truck to travel on",
  "← Tilbake": "← Back",
  "Klikk på et fiskevann — eller Markedet — for å reise dit": "Click a lake — or the Market — to travel there",
  "← Marked": "← Market",

  /* ---- Help ---- */
  "<b>Fiske:</b> Klikk i vannet (eller trykk mellomrom) for å kaste ut. Vent på napp — små rykk er bare lureri. Klikk i det duppen dras skikkelig under for å kroke fisken.":
    "<b>Fishing:</b> Click the water (or press space) to cast. Wait for a bite — small twitches are just teasing. Click the moment the bobber is pulled fully under to hook the fish.",
  "<b>Sveiv inn:</b> Hold inne for å dra fisken nærmere, men slipp når den rykker hardt — ellers ryker lina. Store og sjeldne fisk slåss hardest. Hvert vann skjuler en svær troféfisk.":
    "<b>Reeling in:</b> Hold to pull the fish closer, but let go when it yanks hard — or the line snaps. Big and rare fish fight hardest. Every lake hides one huge trophy fish.",
  "<b>Reise:</b> Kjør pickupen bak deg for å åpne kartet. På kartet ser du fiskene som svømmer i hvert vann — snok rundt og klikk deg fram. Nye vann låses opp med penger (og hvert vann krever sitt eget fiskekort).":
    "<b>Travel:</b> Drive the pickup behind you to open the map. On the map you can see the fish swimming in each lake — snoop around and click your way along. New lakes unlock with money (and each lake needs its own license).",
  "<b>Markedet:</b> Selg fangsten hos dama, kjøp stenger hos gubben, fiskekort hos fiskeoppsynet og godsaker i kiosken. Prøv lykken i kasinoet om du tør.":
    "<b>The Market:</b> Sell your catch to the lady, buy rods from the old man, licenses from the warden and goodies at the kiosk. Try your luck at the casino if you dare.",
  "<b>Fiskekort &amp; bot:</b> Fisker oppsynet deg uten gyldig kort for vannet du står i, ryker 25 % av pengene i bot. Kortene dine ser du oppe til venstre.":
    "<b>License &amp; fines:</b> If the warden catches you without a valid license for the lake you're at, you lose 25% of your money as a fine. Your licenses show up top left.",
  "<b>Godsaker:</b> Alt fra kiosken gir midlertidig fiskeflaks — du ser den som <b>FLAKS</b>-baren nede til høyre (en tidslinje som teller ned). Drikke, snus og røyk fyller også <b>RUS</b>-baren: blander du for mye, begynner du å vingle, og går baren i taket, sovner du på bredden! Sekken ved siden av deg har også stang-bytte og fangstrekorder.":
    "<b>Goodies:</b> Everything from the kiosk grants temporary fishing luck — shown as the <b>LUCK</b> bar bottom right (a timeline counting down). Drinks, snus and smokes also fill the <b>BUZZ</b> bar: mix too much and you start to wobble, and if the bar maxes out you pass out on the bank! The bag beside you also holds rod swapping and catch records.",
  "<b>Småtteri:</b> Radioen spiller country mens du fisker, og katten din kan slå følge — men trykk på den om den prøver å snike til seg den minste fisken!":
    "<b>Little things:</b> The radio plays country while you fish, and your cat may tag along — but tap it if it tries to sneak off with your smallest fish!",

  /* ---- Leaderboard ---- */
  "Poengsummen din sendes inn automatisk når du kjører videre med pickupen.": "Your score is submitted automatically when you drive on with the pickup.",
  "Søk etter navn …": "Search by name …",
  "🏆 Storfiskeren": "🏆 Master Angler",
  "Arter + troféer + ferdighet": "Species + trophies + skill",
  "🐋 Største fangst": "🐋 Biggest catch",
  "Din tyngste enkeltfisk": "Your heaviest single fish",
  "Laster …": "Loading …",
  "Ingen poeng ennå — bli den første!": "No scores yet — be the first!",
  "Ingen treff.": "No matches.",
  "Fang noen fisk først, så havner du på topplista!": "Catch some fish first to land on the leaderboard!",
  "Skriv inn et navn først.": "Enter a name first.",
  "Sjekker navnet …": "Checking the name …",
  "Navnet er allerede tatt — velg et annet.": "That name's already taken — pick another.",
  "Du må fange minst én fisk før du kan sende inn.": "You must catch at least one fish before submitting.",
  "Sender inn …": "Submitting …",
  "Poengsum sendt inn! 🎣": "Score submitted! 🎣",
  "Klarte ikke å sende inn — prøv igjen om litt.": "Couldn't submit — try again shortly.",
  "Kunne ikke laste topplista.": "Couldn't load the leaderboard.",

  /* ---- New game ---- */
  "Nytt spill": "New game",
  "Hva heter fiskeren? Navnet vises på topplista.": "What's the angler's name? It shows on the leaderboard.",
  "Skriv navnet ditt": "Enter your name",
  "Start fiskelivet": "Start fishing",
  "Avbryt": "Cancel",

  /* ---- Save slots ---- */
  "Du kan ha opptil tre spill gående samtidig. Velg en plass for å spille, eller start på nytt.": "You can have up to three games at once. Pick a slot to play, or start fresh.",

  /* ---- Fish shop ---- */
  "Hei, kjekken… har du noe fint til meg i dag?": "Hey there, handsome… got anything nice for me today?",
  "Fangsten din": "Your catch",
  "Totalt:": "Total:",
  "Selg alt": "Sell all",
  "Tom fangst? Kom tilbake når du har fanget noe, da.": "Empty-handed? Come back when you've caught something.",
  "Nydelig handel! Trykk ← Marked for å fortsette.": "Lovely deal! Press ← Market to continue.",
  "Da var sekken tom! Trykk ← Marked for å fortsette.": "Bag's empty now! Press ← Market to continue.",

  /* ---- Rod shop ---- */
  "Hmf. Skal du kjøpe noe, eller bare glo?": "Hmf. You buying something, or just gawking?",
  "Fiskeutstyr": "Fishing gear",
  "Du har ikke råd. Kom igjen når du har penger. Hmf.": "You can't afford it. Come back when you've got money. Hmf.",

  /* ---- License shop ---- */
  "God dag! Skal det være et gyldig fiskekort? Husk — fiskeoppsynet er ute og går.": "Good day! Care for a valid fishing license? Remember — the warden is out and about.",
  "Fiskekort": "Fishing license",
  "Hvert vann krever sitt eget kort. Uten gyldig kort risikerer du bot fra fiskeoppsynet.": "Each lake needs its own license. Without a valid one you risk a fine from the warden.",
  "Fiskekort koster penger, det også. Kom igjen med kontanter.": "Licenses cost money too. Come back with some cash.",
  "Da slipper du bot fra oppsynet. Trykk ← Marked for å fortsette.": "Now you'll dodge the warden's fine. Press ← Market to continue.",

  /* ---- Kiosk ---- */
  "Tjena! Trygdepatron, snus, sigarillo, blænnvin — eller snabelstoff for de tøffe? Alt for et godt fiske.": "Hey! Welfare-grade brew, snus, cigarillo, moonshine — or the hard stuff for the bold? Anything for good fishing.",
  "Kiosken": "The Kiosk",
  "Bruk varene fra sekken mens du fisker — de gir midlertidig fiskeflaks.": "Use the goodies from your bag while fishing — they grant temporary luck.",
  "Tomme lommer? Kom igjen med kontanter, kompis.": "Empty pockets? Come back with cash, buddy.",
  "Bra valg! Trykk ← Marked for å gå videre.": "Good choice! Press ← Market to move on.",

  /* ---- Casino ---- */
  "Rød": "Red",
  "Svart": "Black",
  "Grønn 0": "Green 0",
  "Hjulet har 0–36. Rød eller svart gir <b>dobbelt</b>. Den grønne <b>0</b> er en langskudd-tipp — treffer du, betaler den <b>14×</b>!":
    "The wheel has 0–36. Red or black pays <b>double</b>. The green <b>0</b> is a long-shot bet — hit it and it pays <b>14×</b>!",
  "Spinn 100 kr": "Spin 100 kr",
  "Godt spinn! Nå er du klar — kjør tilbake til vannet og fisk i vei! 🎣": "Nice spin! Now you're ready — drive back to the lake and get fishing! 🎣",

  /* ---- Rotate hint ---- */
  "Snu telefonen": "Turn your phone",
  "Cozy&nbsp;Pond fiskes best i liggende modus.<br>Vri enheten til siden for full opplevelse.":
    "Cozy&nbsp;Pond plays best in landscape.<br>Turn your device sideways for the full experience.",

  /* ---- Language select ---- */
  "Velg språk": "Choose language",
  "Norsk": "Norsk",
  "English": "English"
};
