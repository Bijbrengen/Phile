# Phile

`Phile` is in de eerste plaats een fysieke leerbox: een spelbord met neuronen,
synapsstukken en filosoofkaarten. Deze repository bevat de volledig zelfstandige,
frameworkloze statische digital twin. Zij heeft geen filesystem-, submodule- of
deploymentkoppeling met andere Leerpret-repository's.

De scheiding is bewust hard:

- Phile bezit HTML, CSS en de spelmechaniek;
- LeerpretEngine bezit filosoofkaartdata, runtime-instellingen, thematokens,
  objectrollen en -relaties, de LeerpretSDK, eventopslag en verwerking;
- de enige koppeling is HTTPS via de publieke Engine-API;
- valt de Engine weg, dan start het spel niet met een afwijkende lokale dataset.

## Zelfstandig draaien

```powershell
Copy-Item .env.example .env
python scripts\generate_runtime_config.py
python -m http.server 47115
```

Open daarna `http://127.0.0.1:47115/`. De Engine moet de exacte Phile-origin in
`LEERPRET_CORS_ORIGINS` en onder SDK-client `phile` toestaan. Productie kan alle
bestanden rechtstreeks op een statische host zoals GitHub Pages plaatsen; er is
geen buildstap en geen Node-runtime nodig.

## Leerbox- en eventmodel

Bij het starten haalt `bootstrap.js` eerst het SDK-manifest bij LeerpretEngine op.
Dezelfde bootstrap mount zo nodig de Google-login uit `auth-client` rechtstreeks
in Phile. Hiervoor hoeft LeerpretDashboard niet te draaien.
Daarna laadt het de API-client en de `leerobject`-component rechtstreeks vanaf
die server. De runtimeconfiguratie komt uit `GET /api/leerbox-runtime/phile`.

De SDK levert de overervingsstructuur:

```text
Leerobject
|- SelfStartingLeerobject
|- SuccesLeerobject
|- WeerstandLeerobject
`- OverigLeerobject
```

Iedere betekenisvolle interactie wordt via een instantie van zo'n klasse als
Actie naar `POST /api/engine/evaluate` gestuurd. Elk event bevat in ieder geval:

```json
{
  "person_id": "phile-session-...",
  "leerobject_id": "phile.card.socrates",
  "leerbox_id": "phile",
  "timestamp": "2026-08-02T12:00:00.000Z"
}
```

`person_id` is sessiegebonden en pseudoniem. Phile berekent zelf geen markers of
leerpretscore en heeft geen duurzame lokale datastore.

## Fysieke spelbord-game

Iedere speler heeft een eigen leeg rasterbord. De grootte van dat bord hangt af van het niveau. Een brein bestaat uit neuronen als puntjes en synapsen als lijntjes. In de fysieke versie is dat een soort prikbord of speelbord met gaten. De neuronen zijn stokjes of pinnetjes met inkepingen rondom. Je verbindt neuronen door synaps-stokjes tussen die inkepingen te plaatsen.

Zo bouw je het speelbrein letterlijk op tafel. Het wordt tastbaar en visueel: spelers zien patronen ontstaan, zien waar verbindingen mogelijk zijn, en zien ook waar een brein in dezelfde route blijft hangen.

De fysieke leerbox bestaat uit:

- een rasterbord met vaste posities voor neuronen;
- losse neuronstukken;
- rechte en diagonale synapsstukken;
- filosoofkaarten met een patroon en een kracht;
- een hand van maximaal vijf kaarten per speler.

Elke actieve neuron kan met buurposities worden verbonden. In het fysieke spel voelt de speler dus letterlijk dat groei altijd lokaal moet aansluiten: een verbinding kan niet zomaar door het bord springen.

## Simpele speluitleg

Je speelt bijvoorbeeld met vier spelers.

Elke speler plaatst eerst een startneuron op zijn eigen bord. Daarna bouwt iedereen samen aan elkaars brein. Om de beurt plaats je een neuron en een verbinding. Dat doe je soms op je eigen bord en soms op het bord van een andere speler. Elke nieuwe plaatsing moet verbonden zijn aan bestaande neuronen op dat bord. Je helpt elkaar dus, maar je beinvloedt elkaar ook. Aan het einde van deze bouwfase heeft iedere speler een uniek stadbrein dat door alle spelers samen is gemaakt.

Daarna kiest het spel voor ieder bord een doelneuron. Dat is een plek die nog niet verbonden is en vaak ver weg of lastig bereikbaar ligt. Dat doel is jouw verlangen: daar moet jouw brein naartoe.

In het kaartgedeelte doe je elke beurt twee dingen:

1. Je legt verplicht een kaart op je bord, passend maar niet herhalend.
2. Daarna wissel je verplicht een kaart met een medespeler.

Goede kaarten maken nieuwe groene paden. Slechte keuzes versterken oude patronen en worden rood: file. Te vaak herhalen betekent dat je brein vastloopt en je uitvalt.

De strategie zit in de spanning tussen helpen en hinderen. Je probeert kaarten te verzamelen die jouw pad openen. Tegelijk geef je kaarten weg die voor jou slecht zijn, maar misschien juist goed zijn voor een ander. Als je een kaart aanbiedt, kan je medespeler soms de bijbehorende filosofische theorie raden voor extra diepgang. Bluffen of gokken kan ook. Andere spelers zijn tegelijk je probleem en je oplossing.

De diepere gedachte is dat jouw brein nooit alleen van jou is. Anderen hebben het grotendeels meegebouwd, alleen realiseren we ons dat meestal niet. In Phile wordt dat zichtbaar: je moet ontsnappen uit een structuur die mede door anderen is gevormd, terwijl diezelfde anderen ook nieuwe openingen kunnen aanreiken.

Je wint als je als eerste jouw doelneuron bereikt, of als alle andere spelers vastlopen in file.

Pitchzin: je bouwt samen elkaars brein, maar moet zelf als eerste ontsnappen met kaarten die jou helpen en anderen soms redden.

## Regels in gamevorm

Doel van het spel: bereik als eerste jouw doelneuron, of zorg dat alle andere spelers vastlopen in file.

Spelopzet:

- kies een niveau;
- kies een bordgrootte;
- iedere speler krijgt een eigen leeg rasterbord.

Niveaus:

- niveau 5: 5 neuronen, 12 kaarten, beginner;
- niveau 6: 6 neuronen, 35 kaarten, gevorderd;
- niveau 7: 7 neuronen, 108 kaarten, expert;
- niveau 8: 8 neuronen, 369 kaarten, kenner.

Bordgroottes:

- klein: `16 x 16`, sneller spel;
- groot: `32 x 32`, meer strategie;
- extra groot: `64 x 64`, vooral voor digitale experimenten.

Fase 1, brein bouwen:

- elke speler plaatst een startneuron op het eigen bord;
- daarna speel je om de beurt;
- per bouwbeurt plaats je een neuron plus een verbinding;
- dat mag op je eigen bord of op dat van een ander;
- elke plaatsing moet verbonden zijn aan bestaande neuronen;
- je helpt en saboteert elkaar tegelijk;
- je mag ook je eigen structuur corrigeren;
- het brein moet open blijven: geen volledig dicht blok zoals `7 x 7`;
- aantal bouwrondes = gekozen niveau.

Voorbeeld: niveau 7 geeft 7 bouwrondes. Met 4 spelers betekent dat 28 plaatsingen in de gezamenlijke bouwfase.

Doelneuron plaatsen:

- tegenstanders bepalen jouw doelneuron;
- het doel ligt zo ver mogelijk van de bestaande structuur;
- er blijft minimaal 1 leeg vak rondom het doelneuron;
- het doel is dus nog niet bereikbaar, maar komt wel voort uit jouw opgebouwde brein.

Fase 2, kaartspel:

- elke speler krijgt een hand kaarten;
- per beurt leg je verplicht 1 kaart op je bord;
- de kaart moet passen op je brein;
- exact herhalen mag niet gratis: herhaling wordt rood en kan file worden;
- daarna trek je 1 nieuwe kaart;
- daarna ruil je verplicht 1 kaart met een medespeler.

Filosofische twist bij ruilen:

- je biedt een kaart aan;
- de ontvanger probeert de filosofie of theorie op de kaart te raden;
- goed geraden: de ontvanger mag de kaart houden;
- fout geraden: de kaart gaat terug, of er geldt een afgesproken straf/alternatieve regel.

Daardoor ontstaat strategie: je kunt bewust fout antwoorden om slechte kaarten te vermijden, goed antwoorden om nieuwe kansen te krijgen, en proberen uit het gedrag van anderen af te leiden wat zij nodig hebben.

Filosofische discussie-regel:

- als een kaart wordt gelegd, mogen spelers filosofisch discussieren;
- zolang de discussie loopt, mag niemand bouwen of kaarten leggen;
- filosoferen levert dus tijd op;
- het spel vertraagt bewust, waardoor reflectie onderdeel van de strategie wordt;
- maar discussie verandert je positie op het bord niet vanzelf;
- je moet dus blijven zien wat er in je eigen brein gebeurt.

Betekenis: filosofie is geen kennis die je gebruikt om automatisch te winnen, maar aandacht die je ruimte geeft om beter te spelen. Alle spelers krijgen denktijd, maar iedereen moet tegelijk zijn eigen brein blijven volgen.

Kaartzin: wie wijsheid weet te wekken, wint tijd om te zien.

Speelse dooszin: wek je met je kaart filosofie tot leven, dan vertraag je het spel en versnel je je inzicht.

Sterke formulering: je kunt eindeloos filosoferen, maar ondertussen moet je wel blijven zien wat er in je eigen brein gebeurt, anders win je nog steeds niet.

## De Filosofische Klok

Phile gebruikt geen klassieke schaakklok. In dit spel koop je denktijd niet met seconden, maar met filosofie.

Regel: wanneer een speler met een kaart een oprechte filosofische discussie op gang brengt, wordt het spel tijdelijk gepauzeerd.

Tijdens deze pauze:

- worden geen zetten gedaan;
- ontstaat denktijd voor alle spelers;
- mag iedereen nadenken over de volgende kaart;
- mag iedereen inschatten welke ruil verstandig is;
- mag iedereen opnieuw kijken of hij in een patroon vastzit;
- mag iedereen proberen te lezen wat andere spelers willen doen.

De tijd is dus individueel waardevol, maar collectief beschikbaar. Wie filosofie wekt, vertraagt het spel en vergroot zijn inzicht.

Balansregel: een discussie telt alleen als filosofische tijd wanneer zij inhoudelijk is en door minimaal twee spelers wordt gedragen. Anders stopt de filosofische tijd direct.

Korte spelzin: in dit spel win je tijd door samen te denken.

File en verlies:

- herhaal je te vaak dezelfde structuur, dan wordt die rood;
- te veel rood betekent file;
- wie vastloopt in file ligt eruit.

Winst:

- je wint als je als eerste jouw doelneuron bereikt;
- je wint ook als alle andere spelers vastlopen.

Pitchzin: je bouwt samen elkaars brein, maar moet zelf ontsnappen, terwijl filosofie je tijd en strategie geeft.

## Doel van het spel

Phile laat ervaren dat leren niet alleen bestaat uit meer doen. Drie soorten keuzes zijn belangrijk:

- Een groeikeuze sluit aan op het bestaande brein en opent een nieuw pad.
- Een herhalingskeuze versterkt vooral wat er al ligt en kan rood worden: file.
- Een los patroon past niet bij de huidige situatie en breekt de ronde.

De speler zoekt dus niet simpelweg de mooiste filosofische uitspraak, maar de kaart die in deze concrete breinstructuur de juiste beweging opent.

## Doorbraakzone

De didactische kern lijkt op de zone van naaste ontwikkeling van Lev Vygotsky: de groeiruimte ligt net buiten wat je al kunt, maar nog wel dichtbij genoeg om te verbinden.

In Phile wordt dat spelmechaniek:

- te bekend: je herhaalt hetzelfde patroon en krijgt file;
- te vreemd: de kaart verbindt niet en je verliest grip;
- precies passend-nieuw: de kaart opent een groen pad.

Dat tussengebied heet in Phile de doorbraakzone. De oplossing ligt niet in wat je al kent, en ook niet in wat je niet begrijpt, maar precies daartussen.

## Filosoofkaarten

Elke filosoofkaart heeft een dubbele functie.

Als Breinkaart wordt de kaart als neuronpatroon gespeeld. Dan probeert de speler het getoonde patroon op het raster te leggen of te herkennen. Dit is de huidige kernlogica van Phile: neuronen plaatsen, verbindingen versterken of een misfit riskeren.

Als Actiekaart gebruikt de speler de kracht van de filosoof. De kaart verdwijnt dan uit de hand zonder dat er een neuron wordt geplaatst. Daardoor neemt de keuzevrijheid tijdelijk af, totdat de hand opnieuw wordt aangevuld.

De huidige krachten zijn:

- `swap`: wissel een handkaart voor een nieuwe kaart.
- `think_time`: neem bedenktijd of een vrije reflectiebeurt.
- `double_play`: speel deze ronde twee Breinkaarten.
- `cleanse`: reset een verhitte file-neuron.
- `draw`: trek door tot de hand weer rijker is.

De basisfilosofen, hun krachten en de niveauconfiguratie staan op de
LeerpretEngine-server. De digitale twin genereert uit die API-data de volledige
Entity Card-set voor niveau 5 t/m 8.

Voor vrije polyomino-vormen, waarbij rotatie en spiegeling niet apart worden geteld, gebruikt Phile deze niveaus:

- niveau 5: 12 unieke structuren voor de bekendste filosofen en kerntheorieen;
- niveau 6: 35 unieke structuren voor bekende overige filosofen en theorieen;
- niveau 7: 108 unieke structuren voor gangbare filosofen en stromingen;
- niveau 8: 369 unieke structuren voor kennerniveau met onbekendere filosofen en theorieen.

Samen zijn dat `12 + 35 + 108 + 369 = 524` Entity Cards. Niveau 9 heeft 1285 unieke structuren, maar Phile gaat in deze versie bewust tot en met niveau 8.

Het niveau is tegelijk het rondebudget. Een kaart of opdracht van niveau 5 heeft vijf neuronen en hoort bij vijf gerichte rondes. Niveau 6 krijgt zes rondes, niveau 7 krijgt zeven rondes en niveau 8 krijgt acht rondes. Zo heeft elke speler precies genoeg zetten om invloed uit te oefenen, zonder dat iemand het spel in een keer volledig kan dichttimmeren.

## Spelronde

Een ronde verloopt fysiek als volgt:

1. De speler heeft maximaal vijf kaarten in de hand.
2. De speler kiest een kaart.
3. De speler kiest de modus: Breinkaart of Actiekaart.
4. Bij een Breinkaart verandert het bord: groei, versterking of misfit.
5. Bij een Actiekaart verandert de speelsituatie: wisselen, opschonen, bedenktijd, extra kaart of dubbele beurt.
6. Aan het begin van een volgende ronde vult de leerbox de hand weer aan.

Daardoor ontstaat een Dungeons & Dragons-achtige laag: een filosoof is niet alleen een puzzelstuk, maar ook een bondgenoot met een strategische kracht.

## File en doorbraak

Rode file ontstaat wanneer een bestaand patroon te vaak wordt versterkt. Dat is didactisch belangrijk: een speler die steeds hetzelfde kiest, is wel actief, maar beweegt niet noodzakelijk richting leren. De filelimiet bepaalt wanneer herhaling verstarring wordt.

Een doorbraak ontstaat wanneer een kaart precies genoeg aansluit op het bestaande brein om een nieuwe groene stap te openen. De doelneuron hoort bij hetzelfde brein, maar is nog niet bereikbaar. Phile laat zo zien dat groei niet willekeurig van buiten komt, maar ook niet volledig uit herhaling van het oude patroon ontstaat.

## Eerlijkheid en dynamiek

De beginstructuur mag niet te dicht en niet te groot worden. Als het startbrein al bijna alles afsluit, raakt het spel op slot voordat de speler strategisch kan handelen. Daarom moet de leerbox grenzen stellen aan:

- de maximale dichtheid van de startstructuur;
- de maximale omvang van het startcluster;
- de afstand tussen startbrein en doelneuron;
- de hoeveelheid herhaling voordat file fataal wordt.

Ook de kaartset moet variatie afdwingen. Als alle kaarten dezelfde basisstructuur hebben, ontstaat er geen echte keuze. De digitale twin probeert daarom bij het aanvullen van de hand verschillende patroonfamilies te kiezen wanneer er genoeg alternatieven zijn.

Een speler mag ook niet in een keer een complete alles-in-een-structuur dichtleggen. De kracht van Phile zit juist in openheid tussen beurten: er moet steeds nog iets te kiezen, te riskeren of te herstellen zijn. Daarom blijven speelbare structuren begrensd in grootte en telt herhaling mee richting file.

Deze balansregels maken het spel eerlijker. Ze zorgen dat er altijd ruimte blijft voor vernieuwing: niet te makkelijk, niet op slot, en niet alleen maar herhaling.

## Digital twin

De digitale versie in deze zelfstandige repository bootst het fysieke spelbord na:

- het raster is het spelbord;
- groene cellen zijn geplaatste neuronen;
- groene lijnen zijn synapsen;
- rode warmte is filevorming;
- de linker rail is de hand met maximaal vijf kaarten;
- elke kaart heeft een Breinkaart-modus en een Actiekaart-modus;
- elke geplaatste neuron krijgt een unieke `neuron-id`.

De huidige digitale twin simuleert al het raster, de handkaarten, de krachten, de filevorming en de ruwe eventlog. De volledige fysieke multiplayer-bouwfase met vier spelers en elkaars borden is het ontwerpdoel: daar moet de digitale flow stap voor stap naartoe groeien.

De digitale versie moet niet slimmer lijken dan het fysieke spel. Zij registreert vooral wat er gebeurt, zodat de simulator later kan meten wat die ronde zegt over leerpret.

## Kale output voor LeerpretEngine

Phile stuurt ruwe interactieberichten direct via de door de Engine geleverde
Leerobject-SDK. Voor lokale diagnose blijft alleen een niet-duurzame statusbuffer
in het werkgeheugen beschikbaar via `window.PhileSimulator`.

```json
{
  "person_id": "phile-session-abc123",
  "leerobject_id": "phile.path.growth",
  "leerbox_id": "phile",
  "timestamp": "2026-04-21T09:00:00.000Z",
  "action_type": "place_neuron",
  "round": 3,
  "cardId": "socrates",
  "candidateId": "success-x1",
  "philosopher": "Socrates",
  "candidateType": "success",
  "result": "success",
  "handSize": 4
}
```

De diagnostische buffer is beschikbaar in de browser:

```js
window.PhileSimulator.getInteractionBuffer()
```

De game berekent zelf geen leerpret. Zij registreert alleen gedrag; opslag en
verwerking vinden uitsluitend op LeerpretEngine plaats.

## Converter buiten de engine

De vertaling van ruwe leerbox-events naar gedragsmarkers staat apart in:

```text
simulator/interaction_converter.py
```

Phile gebruikt daarin het profiel `phile`. De hoofdlaag is nu generiek: dezelfde converter kan later ook events uit De Drukwerkplaats, LEARNGame Operations Management of andere leerboxen verwerken.

Die converter doet de bron-specifieke interpretatie:

- duur van een ronde -> `T`;
- actiedichtheid -> `A`;
- kaart-, actie- en krachtvariatie -> `V`;
- herstel na file, reinforce of misfit -> `R`;
- succes, win en vervolgacties na succes -> `S`.

Daarna krijgt de bestaande Leerpret-engine alleen nog deze vector:

```text
(T, A, V, R, S)
```

Zo lopen de lagen niet door elkaar:

- Phile = fysieke/digitale spelregels en ruwe events.
- Interaction-converter = intelligente vertaling van bron-specifiek gedrag naar markers.
- Leerpret-engine = generieke berekening van leerpret uit markers.
- Streamlit-dashboard = zichtbaarheid, inspectie en uitleg.

## Dashboard

In `simulator/` staat de zelfstandige proefstand van de Leerpret-engine, met een menu-item `Phile` voor spelrondes uit deze leerbox.

Op die pagina kun je:

- voorbeeldrondes bekijken;
- JSON-output uit de game plakken of uploaden;
- per ronde de afgeleide markers zien;
- de door de engine berekende leerpret zien;
- de uitleg van de converter naast de engineformule inspecteren.

De dashboardpagina gebruikt voorbeelddata uit:

```text
simulator/phile_data/phile_rounds.json
```

## Belangrijk ontwerpprincipe

De fysieke leerbox blijft leidend. De digital twin mag helpen meten, herhalen en analyseren, maar moet niet de aard van het spel veranderen. Daarom blijft de spelervaring concreet: kaarten kiezen, neuronen leggen, files zien ontstaan, krachten inzetten en proberen het brein richting doorbraak te bewegen.

