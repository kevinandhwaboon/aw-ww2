# Topic Doc 15: Eastern Front Scenarios

**Status:** three Eastern Front maps built (v0): Kursk (§1), the first theater map after Normandy and the first with the Soviet Union; Stalingrad (§2), the first city fight and the first Soviet boat; and Sevastopol (§3), the first railway and the Railway Gun. Balance untested.
**Last updated:** 2026-11-19
**Depends on:** 00-master-design.md §8 and §9, 01-units.md (availability rule; §2b Railway Gun), 02-terrain.md §4 (bunkers and obstacles) and §4c (Railway), 04-economy-production.md §8 (victory conditions), 08-art-pipeline.md §12 (Soviet art and insignia).

---

## 1. Kursk (`kursk`)

![Overview](maps/kursk.png)

Army green properties are Soviet, red German. The inner mark shows the kind: yellow factory, white airfield, black HQ. Dark squares are starting units; grey squares are bunkers and black squares anti-tank obstacles.

### The history it follows

After Stalingrad, the front had a bulge around the city of Kursk, about 200 km wide, pushing west into German lines. In July 1943 Germany launched Operation Citadel: two pincers, Model's 9th Army from Orel in the north and Hoth's 4th Panzer Army with Army Detachment Kempf from Belgorod in the south, were to meet at Kursk and cut off everything inside. Germany had waited months for its new Panther and Tiger tanks and Ferdinand tank destroyers. That gave the Soviets time: they knew the plan and dug in deeper than anywhere else in the war, with belt after belt of strongpoints, anti-tank ditches and minefields, and a reserve army (the Steppe Front) waiting behind.

In the north, Model got about 12 km in and stalled at Ponyri station and the Olkhovatka heights. In the south, the SS Panzer Corps got furthest and met the Soviet 5th Guards Tank Army at **Prokhorovka** on 12 July, the famous tank battle. Hitler called the offensive off the next day; the Allies had just landed in Sicily. It was Germany's last great offensive in the east.

### Area and scale

- **68 × 80 squares**, a theater map like Normandy (10-scenarios-normandy): the whole salient, from Orel and Karachev in the north to Belgorod and Sumy in the south, and from Sevsk and Lebedin in the west to the Oskol river in the east.
- Generated from real longitude and latitude, with near-even scale: each square is about 3.5 km across and 3.9 km tall. Kharkov, the southern pincer's real base, is just off the south edge.
- The north German line is about 16 squares south of Orel; Kursk is about 19 squares behind the north front and 25 behind the south front, so a tank (6 moves) needs a few days of fighting through the belts to reach it.

### The front, 4 July 1943

The front line is traced as a polygon of real points in `tools/maps/kursk.mjs`. Germany holds one piece of ground wrapped round the salient: the Orel bulge in the north, a thin strip along the west face, and the Belgorod–Sumy line in the south. Every town is placed on its own side of that line.

### Places

| | Soviet Union | Germany |
|---|---|---|
| HQ | Kursk | Orel |
| Factories | Shchigry, Livny, Stary Oskol | Kromy, Karachev, Belgorod, Sumy |
| Airfields | Kursk East, Novy Oskol | Orel West, Mikoyanovka |
| Cities | North face: Ponyri, Olkhovatka, Maloarkhangelsk, Fatezh, Zolotukhino, Novosil, Dmitriev. West face: Lgov, Rylsk, Sudzha. South face: Medvenka, **Oboyan**, **Prokhorovka**, Ivnya, Yakovlevo, Korocha, Shebekino, Solntsevo, Tim | Zmiyovka, Naryshkino, Dmitrovsk, Komarichi, Lokot, Sevsk, Tomarovka, Borisovka, Grayvoron, Krasnopolye, Lebedin |

- **Income:** the Soviet Union owns 25 properties, Germany 18. There are no neutral towns: the front ran through open country with no gap between the lines.
- Orel is the German HQ because it was the hub of the northern salient, well behind the front; Belgorod sat right on the line. Mikoyanovka was the airfield the Luftwaffe's VIII Air Corps flew from over the south face. Factories and HQs are our choice, not history.

### Terrain

- **Open steppe and black-earth farmland** across the salient: tank country, with scattered woods. Woods and a few steep banks follow the rivers, standing for the wooded gullies (*balkas*) that broke up the steppe.
- **The Olkhovatka heights** north of Kursk: a cluster of Hills, the ridge that stopped the northern pincer. Hills stop vehicles (02-terrain), so the roads and the gaps decide the fight there, as they did.
- **The Bryansk forests** in the north-west corner: dense forest, partisan country.
- **Rivers:** the Seym past Kursk, Lgov and Rylsk; the Psel past Prokhorovka's bend, Oboyan and Sudzha to Sumy; the Pena on the Oboyan road; the Northern Donets past Belgorod, the line Kempf crossed; the Vorskla behind the German south line; the Oka and Kroma up to Orel; the Svapa; and the Oskol behind the Steppe Front. Roads cross them on bridges.
- **Roads** are routed between towns along the cheapest path, so they keep to the open ground. The main axes are the Orel–Kromy–Fatezh–Kursk highway, the Orel–Ponyri–Kursk railway, the Belgorod–Oboyan–Kursk highway and the Belgorod–Prokhorovka railway.

### The Soviet defense belts

- **Bunkers** (strongpoints) and **obstacles** (anti-tank ditches and minefields) stand in belts behind the **north face** (Ponyri, Olkhovatka, Maloarkhangelsk) and the **south face** (from Yakovlevo back to Oboyan and Prokhorovka): one belt right at the front, a second about 5 squares back, and a third about 10 squares back. About 30 bunkers and 11 obstacles on each face.
- **None on the west face**, where no attack came, and none on a road, river or town, so every road stays open for the attacker to fight along. A test checks that every German tank can still drive to Kursk.
- Obstacles are impassable to land units until cleared (02-terrain §4), so the belts funnel tanks onto the roads, where the bunkers are.

### Starting forces

- **Soviet Union** (8,000 funds, 37 units): on each face, rifle squads dug in across the first belts (12 in bunkers in all, with PTRD anti-tank rifle teams and mortars), plus artillery, Katyushas, SU-152s and T-34s behind; a KV-1 near Medvenka; the **5th Guards Tank Army** (three T-34s, a T-70 and a halftrack) in reserve near Stary Oskol, a few days' drive from Prokhorovka; Infantry and a Flak Gun at Kursk; Infantry holding Rylsk and Sudzha on the west face; a Fighter at Kursk East and an Il-2 (Bomber) at Novy Oskol.
- **Germany** (12,000 funds, 32 units): in the north, Model's attack on the Orel–Kursk railway near Zmiyovka and Kromy (a Tiger, a Ferdinand-style Tank Destroyer, two Medium Tanks, artillery, rockets, infantry); in the south, the bigger pincer round Tomarovka, Borisovka and Belgorod (two Tigers, four Medium Tanks, a StuG, artillery, rockets, assault infantry, halftracks, a Recon and Mobile AA); thin holding forces at Sevsk and Sumy; a Fighter at Orel West and a Bomber at Mikoyanovka.
- Germany has more Heavy Tanks (3 to 1), the Soviet Union more units and more income, as at Kursk.

### Turn order

The Soviet Union moves first, so it's the army green player (08-art-pipeline §12), as the Allies are on every built-in map. It fits the history: in the night before the attack, the Soviets fired a huge artillery barrage into the German assembly areas.

### Weather

Summer, with two days of **rain** (since 2026-11-17, 12-weather §3a), for the heavy summer thunderstorms of the real battle: day 3, as the northern attack stalls in the belts, and day 8, the eve of the Prokhorovka tank battle. Clear on every other day. Rain brings fog for the day and mud off the roads, so on those days the attackers lose sight of the defenders and their armor slows. Not balance-tested yet.

### Build lists

- Both sides: every land unit, Heavy Tank included (KV-1 and Tiger), plus Fighter, Bomber and Transport Aircraft. No ships: the map has no sea. The Soviet Union has no Dive or Torpedo Bomber art in any case, as it had no carriers (08-art-pipeline §12).

### Victory

- **Capture the enemy HQ** only: Kursk for Germany, Orel for the Soviet Union. Rout is off, as on the Normandy theater map, because on a map this size a side that loses every unit can still rebuild from its factories. Resign is always available.

### How it's made

- `tools/maps/kursk.mjs` generates the scenario file from real longitude/latitude points for the front line, towns and rivers, routes roads between towns along the cheapest path, and lays out the defense belts by distance from the front. Rerun it after editing; `tools/maps/overview.mjs kursk` redraws the picture above.
- Tests (`tests/scenario.test.ts`, "Kursk") check the size and nations, who moves first, the HQs and the shape of the salient, the defense belts on the north and south faces and none on the west, the dug-in garrisons, that German tanks from both pincers can reach Kursk, the Heavy Tank count, Prokhorovka, the reserve's drive there, income and funds, the HQ-only victory and the build lists.

## 2. Stalingrad (`stalingrad`)

![Overview](maps/stalingrad.png)

Colors as for Kursk above; the cyan mark is a port, dark blue is water (the Volga and the Sarpa lakes), orange the two Major Bridges.

**Status:** built (v0), 2026-11-19, drafted and built the same day at the developer's request. Balance untested: funds and unit counts are first guesses.

### The history it follows

In summer 1942 Germany drove east across the Don bend to the Volga. From September the 6th Army fought its way into Stalingrad, a city strung out for about 35 km along the Volga's high west bank, block by block and factory by factory. By November it held about nine-tenths of the city. The Soviet 62nd Army clung to a few strips of riverbank, fed every night by boats crossing the Volga from the east bank under fire, with the Red Army's big guns firing across the river.

While the 6th Army was drawn into the city, its flanks along the Don to the north-west and in the lake country to the south were held by the Romanian 3rd and 4th Armies, spread thin and short of anti-tank guns. On **19 November 1942**, in fog and snow that kept the Luftwaffe on the ground, the Soviets launched **Operation Uranus**: the Southwestern and Don Fronts broke through the Romanians from the Serafimovich and Kletskaya bridgeheads, and the next day the Stalingrad Front broke through south of the city. Soviet tanks seized the Don bridge at **Kalach** intact on 22 November, and the two pincers met at **Sovetsky** on 23 November. About 300,000 Axis troops were trapped. An airlift from Pitomnik and Gumrak failed to feed them, and the pocket surrendered in early February 1943.

### Why this map

It plays like the reverse of Kursk: the Soviets attack and Germany is stuck in place, with a strong army that has its back to a river it can't cross and its supply line through a single bridge. It's also the first map where the fight inside a city matters, and the first in winter on the Eastern Front.

### Area and scale

- **70 × 68 squares**, a theater map like Kursk: from Serafimovich and Oblivskaya in the west to Leninsk east of the Volga, and from the Don bend north of Kletskaya in the north to Abganerovo and the Sarpa lakes in the south. Roughly 42.45–45.25° E and 47.95–49.70° N.
- Near-even scale, as at Kursk: each square is about **2.9 km**. That's smaller than Kursk's 3.5–3.9 km so the city fits: Stalingrad comes out about **10 squares long and 1–2 wide**, a thin strip along the river.
- Kalach is about 25 squares west of the city. The northern pincer has about 40 squares to drive to Kalach, the southern about 26 to Sovetsky. In snow, armor keeps to the roads (12-weather §3), so the pincers take most of a week to close, and Germany gets a few turns to react.

### The front, 19 November 1942

Traced as a polygon of real points in the generator, like Kursk. Germany holds one piece of ground:

- **The north-west:** the Don's south bank from the west edge past Serafimovich to Kletskaya, held by the Romanian 3rd Army. The Soviets hold the north bank and two **bridgeheads on the south bank** at Serafimovich and Kletskaya.
- **The north:** the 6th Army's "land bridge" from the Don near Vertyachy east to the Volga at Latashanka, facing the Don Front at Kotluban.
- **The city:** all of the west bank from Latashanka to Kuporosnoe, **except three Soviet strips on the riverbank** (below).
- **The south:** from Kuporosnoe on the Volga south-west past Tinguta and the Sarpa lakes, held by the German 4th Panzer Army and the Romanian 4th Army.
- Everything west of that line back to the map edge, including Kalach, the Chir valley and the railway south to Abganerovo.

The Soviets hold the Volga's whole east bank, the north (Kotluban, Ilovlya, the Don's north bank), and the south-east from Beketovka and Krasnoarmeysk down past the lakes.

### The city

At 2.9 km a square, the city is one or two columns of squares between the steppe and the Volga, from north to south:

| Squares | Held by | Notes |
|---|---|---|
| Rynok, Spartanovka | Soviet | The northern pocket (Gorokhov's group), Germans to the north and west |
| Tractor Factory | Germany | Taken in October |
| Barrikady | Germany | The gun factory; Soviets held a sliver of bank behind it, too small for a square |
| **Red October** | Soviet | The eastern half of the steel works and the bank south of it: the main Soviet foothold |
| Mamayev Kurgan | contested | A **Hills** square, height 102, overlooking everything. Not a property; starts empty |
| Central Station, Grain Elevator | Germany | The city center and the south, taken in September |
| Kuporosnoe | Germany | Where Germany reached the Volga and split the 62nd Army from the 64th |
| Beketovka | Soviet | Just south of the city, the 64th Army's stronghold, never taken |

- The few squares between the named ones are **Rubble**: wrecked blocks where tanks crawl (2 movement points for tracks) and infantry fight. Roads stop at the city's edge.
- A **bunker** stands just inland of Rynok and of Red October, for the fortified buildings and cellars the 62nd Army held.
- The two Soviet strips (Rynok–Spartanovka, and Red October) each have a **Beach square on the river**: the night landing stages, where boats unload. The Rynok–Spartanovka landing sits between the two and touches Spartanovka and Rynok's bunker.
- Gorodishche and Orlovka sit just west of the city as German towns, Gumrak and Pitomnik as German airfields.

### The Volga

- Drawn as **one column of water (Sea squares)** down the whole map, about the river's real width, splitting round Sarpinsky island south of the city (plains squares between two channels). There's **no bridge**: in 1942 there was none.
- Land units can only cross by boat. The **Soviet Landing Craft** stands for the ferries and armored river boats that carried the 62nd Army's men and shells: it loads at **Krasnaya Sloboda**, a Soviet port opposite the city, and unloads on the city beaches (05-supply-transport: a Landing Craft loads and unloads only on a beach or port).
- Germany has no port and can't build ships, so it can't cross. Its way to stop the ferries is to take the riverbank squares, or shell and bomb the beaches.
- Soviet **Artillery and Katyushas on the east bank** start at the water's edge, so they reach across the river into the city (range 2–3 and 3–5), as the massed guns of the east bank did.

### Places

| | Soviet Union | Germany |
|---|---|---|
| HQ | Beketovka | Kalach |
| Factories | Serafimovich, Kletskaya, Ilovlya, Krasnoarmeysk | Surovikino, Nizhne-Chirskaya, Abganerovo |
| Airfields | Leninsk, Kachalinskaya | Pitomnik, Gumrak, Oblivskaya |
| Port | Krasnaya Sloboda | — |
| Cities | City: Rynok, Spartanovka, Red October. North: Kotluban, Yerzovka, Sirotinskaya. East bank: Srednyaya Akhtuba. South: Svetly Yar, Raigorod, Malye Derbety | City: Tractor Factory, Barrikady, Central Station, Grain Elevator, Kuporosnoe, Gorodishche, Orlovka. Rear: Karpovka, Marinovka, Vertyachy, Golubinsky, Sovetsky, Perelazovsky, Raspopinskaya, Verkhne-Buzinovka, Manoilin, Plodovitoe, Tinguta |

- **Kalach is the German HQ** because it was the 6th Army's lifeline: its supply came over the Don bridge there, and taking it is what closed the ring. **Sovetsky**, where the pincers met, is a German town just south-east of it.
- **Beketovka is the Soviet HQ**: on the west bank, so Germany can reach it by land, and it held out all battle. Krasnaya Sloboda would have been the truer HQ (the 62nd Army's supply base), but it's across the river where Germany can never get to it.
- Germany's factories are all **outside the future pocket**, so once it's surrounded the 6th Army can't build reinforcements, only aircraft at Pitomnik and Gumrak. Factories and HQs are our choice, not history, as at Kursk.
- **Income:** 18 Soviet properties to 25 German at the start. Germany holds more ground, but much of its income sits behind the thin flanks, where the Soviets will take it.

### Terrain

- **Snowy steppe** (plains) almost everywhere: open, rolling, nearly treeless.
- **Ridges** (02-terrain §4b) along the Don's steep banks and for the deep *balkas*, the dry ravines that cut the steppe. They give cover and slow vehicles without blocking them.
- **Woods** only in the Don and Chir valleys and on the Volga's east-bank floodplain.
- **Rivers:** the **Don** (river terrain, crossable by foot units, bridged for vehicles) round its great bend; the **Chir** down the west into the Don at Nizhne-Chirskaya; the **Akhtuba**, the Volga's side channel on the east bank; the small Karpovka, Rossoshka, Kurtlak and Ilovlya.
- **Major Bridges** (02-terrain §4a, the Market Garden rule): the **Don bridge at Kalach** and the rail bridge at Rychkovsky near Nizhne-Chirskaya. German Assault Infantry can blow them; in 1942 the Kalach bridge was taken intact by a Soviet column that drove up with its headlights on and was mistaken for German. Other Don crossings (Vertyachy, Peskovatka) are ordinary bridges.
- **The Sarpa lakes** south of the city are water squares not joined to the Volga. The southern pincer attacked through the gaps between them.
- **Roads** routed between towns along the cheapest path, as at Kursk, plus the main axes: the Kalach–Stalingrad road and railway, Serafimovich–Perelazovsky–Kalach, Kletskaya–Verkhne-Buzinovka–Golubinsky, the railway south from Stalingrad through Tinguta and Abganerovo, and Surovikino–Nizhne-Chirskaya along the Chir.

### Fortifications

- **German bunkers along the land bridge**, facing Kotluban: the line the Don Front attacked again and again in September and October. About 10, in the front two rows.
- **Soviet bunkers in the city**: one behind Rynok, one behind Red October.
- **Little on the Romanian fronts**: two or three bunkers on the front line opposite each Soviet bridgehead and none behind, so once the line breaks it's open steppe to Kalach. That's the heart of the scenario.
- Never on a road, river or town.

### Starting forces

Germany's starting army stands in for the Romanians on the flanks too (see "Romania" below).

- **Soviet Union** (6,000 funds, 50 units):
  - **Northern pincer, in the Serafimovich bridgehead** south of the Don (5th Tank Army): three T-34s (Medium Tank), a KV-1 (Heavy Tank), a T-70 (Light Tank), four Infantry, two Artillery, a Katyusha.
  - **In the Kletskaya bridgehead** (21st Army): two T-34s, three Infantry, an Artillery, a Mortar Team.
  - **Don Front**, north of the land bridge: four Infantry, two Artillery, a T-34.
  - **62nd Army in the city**: an Infantry in each foothold (Rynok, Spartanovka, Red October), a Mortar Team in the bunker behind Rynok, an Assault Infantry (the storm groups) in the bunker behind Red October.
  - **East bank**: two Artillery and a Katyusha on the shore opposite the city, a Landing Craft in Krasnaya Sloboda's port and an Infantry beside it.
  - **Southern pincer**, round Krasnoarmeysk and north of the Sarpa lakes (57th and 51st Armies): three T-34s, a T-70, three Infantry, an Artillery, a Katyusha.
  - **Beketovka** (64th Army): two Infantry (one in the HQ), an Artillery.
  - A Fighter at Leninsk, an Il-2 (Bomber) at Kachalinskaya.
- **Germany** (4,000 funds, 43 units):
  - **In the city** (6th Army): three Assault Infantry, four Infantry, two Medium Tanks, a StuG (Tank Destroyer), two Artillery, two Mortar Teams, a Nebelwerfer (Rocket Artillery).
  - **The land bridge**: three Infantry in bunkers, two Medium Tanks, an Artillery.
  - **Round Gumrak and Pitomnik**: a Flak Gun.
  - **The Don front, north-west** (Romanian 3rd Army): five Infantry (one in a bunker), an Artillery, a Light Tank; behind it near Perelazovsky the reserve (48th Panzer Corps), a Medium and a Light Tank.
  - **The south** (Romanian 4th Army and 4th Panzer Army): four Infantry, an Artillery; behind them near Plodovitoe a Halftrack and a Medium Tank (29th Motorized Division).
  - **Kalach**: one Infantry guarding the bridge.
  - A Fighter at Pitomnik, Bombers at Gumrak and Oblivskaya, and a Transport Aircraft beside Oblivskaya.
- The Soviets have more tanks, more units and the first move; Germany has the better units in the city, more income at first, and its tanks are close to the city, not to the flanks.

### Romania

The flank armies were Romanian, and Romania isn't a nation in the game. **Germany fields them** (v0, chosen as the cheaper option when the map was built), with weaker forces on the flanks (more Infantry, fewer tanks, almost no anti-tank) standing in for the Romanians. The truer option, for the developer to choose, is a **Romania** nation on the Axis side, as Italy joined El Alamein: either a second Axis player sharing the side, like the UK and US at Market Garden, or Romanian units under the German player. That needs its own art (08-art-pipeline §12) or an art loan. Left for later.

### Turn order

The Soviet Union moves first, as the Allies do on every built-in map, and it fits: Uranus opened at dawn on 19 November with an 80-minute barrage. Its armies start on average further west than Germany's (the bridgeheads), so Soviet units face right and German units face left (08-art-pipeline §12).

### Weather

**Winter** season (snow on the ground, 12-weather §1). Snow on days 1–2, for the fog and snow of the opening; clear on days 3–6; snow on days 7–8; clear on days 9–11; snow from day 12, for the deep cold of December. Snow slows the attacker's tanks off the roads, which is why the road towns (Perelazovsky, Verkhne-Buzinovka, Kalach) matter.

### Build lists

- **Soviet Union:** every land unit, Heavy Tank included (KV-1); Fighter, Bomber, Transport Aircraft; **Landing Craft** (at Krasnaya Sloboda only). No other ships.
- **Germany:** every land unit **except Heavy Tank** (the first Tigers didn't reach this front until January 1943); Fighter, Bomber, Transport Aircraft. No ships. No Dive Bomber either: Germany has no Stuka art yet (08-art-pipeline §17).

### Victory

- **Soviet Union:** capture **Kalach**, the German HQ (HQ capture): closing the ring.
- **Germany:** capture **Beketovka**, the Soviet HQ, **or** take **Rynok, Spartanovka and Red October**, the last Soviet footholds in the city (`captureProperties`, 04-economy §8): finishing the job before the ring closes.
- Rout is off, as on the other theater maps. Resign is always available.

### New art

- **The Soviet Landing Craft** is a Project 1125 armored boat (*bronekater*) of the Volga Flotilla: a short river hull with a tank turret forward and an armored wheelhouse, on the map (`su-naval-32-*.png`, the only row on the Soviet naval sheet) and in battle scenes, where riflemen crouch on its open deck aft. No insignia, like every ship (08-art-pipeline §12).
- The map select features it: German artillery firing on a Soviet boat at a Volga landing.

### How it's made

As at Kursk: `tools/maps/stalingrad.mjs` generates the scenario (weather included) from real longitude/latitude points for the front line, towns, rivers, the Volga and the lakes, and lays the city out along the Volga's west bank, placing its named squares by latitude. Rerun it after editing; `tools/maps/overview.mjs stalingrad` redraws the picture above. Tests in `tests/scenario.test.ts`, "Stalingrad", check the size and nations, who moves first, the HQs, that the Volga has no land crossing, that the Soviet Landing Craft can reach each city beach from Krasnaya Sloboda, that both pincers' tanks can drive to Kalach and Sovetsky, that every German factory is outside the ring, that the land bridge is fortified and the Don front only lightly, that east-bank guns reach the city, that Germany has no Heavy Tank, the city footholds and both victory conditions, and the weather.

## 3. Sevastopol (`sevastopol`)

![Overview](maps/sevastopol.png)

Colors as for Kursk above; brown lines are the railway.

**Status:** built (v0), 2026-11-19, at the developer's request, to try the Railway Gun (01-units §2b). Balance untested: funds and unit counts are first guesses.

### The history it follows

Sevastopol, the Black Sea Fleet's base at the south-west tip of the Crimea, was the most heavily fortified port in the world in 1941. Manstein's 11th Army overran the rest of the Crimea that autumn but failed to take the city in two assaults, in November and December. In June 1942 it tried again with **Operation Störfang** ("Sturgeon Catch"): five days of bombardment from 2 June by the heaviest siege artillery Germany had, including **Schwerer Gustav**, the 80 cm railway gun, and two 60 cm Karl mortars, with the Luftwaffe's VIII Air Corps bombing round the clock. The infantry attacked on 7 June.

The Soviet Coastal Army held three belts of field works round the city, anchored on concrete forts and turreted coastal batteries the Germans named Stalin, Molotov, Lenin, Siberia, GPU, Cheka, Volga and Ural, and **Maxim Gorky I** (Coastal Battery 30), whose 305 mm turrets the Gustav and the Karl mortars pounded. The main attack (LIV Corps) came from the north, across the Belbek valley toward the forts and **Severnaya Bay**; XXX Corps attacked in the south-east toward the **Sapun Ridge**, with the Romanian Mountain Corps between them. The Gustav's 48 shells broke concrete forts and, most famously, an ammunition store dug deep under Severnaya Bay.

The north side fell by 17 June. On 29 June the Germans crossed Severnaya Bay in assault boats by night and stormed the Sapun Ridge the same day. The city fell on **4 July 1942**; the last defenders were cornered on the Khersones peninsula.

### Why this map

A siege: the attacker has the guns and the air force, the defender the forts. It's the first map with a railway, and the first with the Railway Gun: a German player who keeps it fed with shells can break a fort a turn, so the Soviet game is to hold on, hunt the gun's Halftrack, and make every fort cost Germany days.

### Area and scale

- **30 × 24 squares**, from Cape Khersones in the west to Bakhchisaray in the east, and from the Kacha in the north to Balaklava in the south. 33.36–33.92° E, 44.47–44.80° N.
- About **1.5 km a square**, smaller than any other land theater map so the forts, the bay and the ridges each get their own squares. Severnaya Bay is a single row of water about five squares long; the city is a few squares on its south shore.
- The Gustav's firing spur near Bakhchisaray is within its range (20) of the northern forts and Maxim Gorky I, but not of the city: to shell Sevastopol it has to creep down the railway line, one square a turn, as the front moves.

### The front, 7 June 1942

Traced as a polygon of real points, as at Kursk and Stalingrad. Germany holds everything east and north-east of an arc from the coast just north of the Belbek's mouth, east along the north side of the Belbek valley, south across the Mekenzie heights, down to the Chernaya valley near Chorgun, and south-west to the coast just east of Balaklava. The Soviet Union holds everything inside the arc: the north side, the city, the Sapun Ridge, Balaklava and the Khersones peninsula.

### The railway

The single line from Simferopol, laid in straight stretches so it crosses each river square-on: in along the north edge past **Bakhchisaray**, south over the Kacha, west toward the Belbek valley, south over the Belbek at **Duvankoi** and down the Mekenzie heights past **Mekenzievy Gory**, then west along the south shore of Severnaya Bay, over the Chernaya at **Inkerman**, to **Sevastopol** station beside the city. Where it crosses a river, the Railway square is the bridge.

The **Gustav's firing spur** is a two-square dead end off the line just south-west of Bakhchisaray, where the gun starts. Historically the gun stood on its own curved track near there.

From the spur the gun reaches almost every fort of the north sector (Maxim Gorky I is 19 squares away) but not the city (27). To shell the city it has to creep down the line, one square a turn, about a dozen turns to get within 20 squares. Only units block it: any unit on the track ahead stops it, and nothing else does, so it can roll on past the front if the track is clear, out in front of its escorts. The Soviet side of the line is track too, but the Soviets have no railway gun (their armored train *Zheleznyakov* isn't in the game).

### Places

| | Soviet Union | Germany |
|---|---|---|
| HQ | Sevastopol | Bakhchisaray |
| Factories | Korabelnaya (the naval dockyard), Inkerman (the cliff galleries, which held workshops and ammunition) | Duvankoi, Baydary |
| Airfields | Khersones, Kulikovo Pole | Kacha |
| Cities | Severnaya (the north side), Lyubimovka, Mekenzievy Gory, Balaklava | Mamashai, Aranchi, Kamyshly, Chorgun, Shuli |

Factories and HQs are our choice, not history, as on the other maps. **Bakhchisaray is the German HQ** because the Gustav fired from beside it and Manstein's headquarters was close by.

### Terrain

- **The Mekenzie heights**, between the Belbek and the head of Severnaya Bay: wooded hills, forest and hills squares. The ground the main attack had to cross.
- **The Sapun Ridge** east of the city: a line of Hills, the last natural wall. The **Fedyukhin heights** in front of it over the Chernaya.
- **The mountains** in the south-east, behind Balaklava and the Baydar valley: hills and forest.
- **The Khersones plateau** west of the city: open plains to the cape.
- **North of the Belbek**: orchards and open ground (plains, some forest), rising to the Kacha.
- **Rivers:** the **Kacha** and the **Belbek** across the north, the **Chernaya** from the Baydar valley north into the head of Severnaya Bay at Inkerman. Roads cross on bridges.
- **Severnaya Bay**: one row of sea from the open sea east to Inkerman, splitting the north side from the city. **No bridge**: Germany crossed it in assault boats. Here Germany can't cross it at all (no ships), so it has to go round by Inkerman, as the real attack mostly did.
- **The sea** along the west and south coasts. No ports: neither side has ships here.

### Fortifications

- **The named forts** as Bunkers in the north sector, between the Belbek and the bay: Maxim Gorky I near Lyubimovka, Stalin, Molotov, Lenin, Siberia, GPU, Cheka, Volga and Ural, placed approximately.
- **Maxim Gorky II** (Coastal Battery 35) as a Bunker near Cape Khersones.
- **Field works** in belts, as at Kursk: a few more bunkers along the Soviet side of the front. Few in the north, where the forts already make the belt; more on the Chernaya before the Sapun Ridge. Never on a road, railway, river or town.

### Starting forces

- **Soviet Union** (Coastal Army and the fleet's naval infantry): rifle units dug into the forts and field works, more Infantry, Assault Infantry and Mortar Teams behind them, Artillery for the coastal batteries (one inside Maxim Gorky I), a few T-26 light tanks, a Flak Gun in the city, a Halftrack, and a Fighter at Khersones and an Il-2 (Bomber) at Kulikovo Pole.
- **Germany** (11th Army, with the Romanian Mountain Corps fielded as German units, as at Stalingrad): **the Railway Gun on its spur with a Halftrack beside it** (the ammunition train) and a Flak Gun guarding it; in the north (LIV Corps) Infantry, pioneers (Assault Infantry), StuGs (Tank Destroyer), Artillery and Nebelwerfers; a thinner centre; XXX Corps in the south-east; and the VIII Air Corps (Bombers and Fighters) round Kacha.
- Germany has more of everything except fortifications.

### Turn order

The Soviet Union moves first, as the Allies do on every built-in map; Germany faces left (its armies start east of the Soviets).

### Weather

Summer, clear every day: June 1942 was hot and dry, and the bombing went on from dawn to dusk.

### Build lists

- **Soviet Union:** every land unit except Heavy Tank; Fighter and Bomber. No ships.
- **Germany:** every land unit except Heavy Tank; Fighter, Bomber, Transport Aircraft. No ships. The Railway Gun is never built (01-units §2b): if it's destroyed, it's gone.

### Victory

- **Germany:** capture **Sevastopol**, the Soviet HQ.
- **Soviet Union:** capture **Bakhchisaray**, the German HQ, **or survive to day 20** (`surviveDays`, 04-economy §8): the city held about four weeks after the assault began.
- Rout is off. Resign is always available.

### How it's made

`tools/maps/sevastopol.mjs` generates the scenario from real longitude/latitude points for the coast, the bay, the front, the rivers, the railway, towns and forts, as for Stalingrad. Rerun it after editing; `tools/maps/overview.mjs sevastopol` redraws the picture above. Tests in `tests/scenario.test.ts`, "Sevastopol", check the size and nations, who moves first, the HQs, that the railway runs unbroken from the north-east edge to the city, that the Gustav starts on its spur with a Halftrack beside it, that it reaches Maxim Gorky I but not the city from the start, that it can get within range of the city down the line, that the railway's river crossings are clean, that Severnaya Bay has no bridge, the forts, that no starting unit stands where it couldn't move, the weather, the build lists and both victory conditions.

## 4. Known gaps

**Kursk**

- Balance is a first guess: funds, the size of the belts and the German tank count all need playtesting.
- Minefields are obstacles: impassable until cleared, not a hidden hazard that damages whoever drives in. Hidden mines would need fog of war.
- The Ferdinand and the SU-152 are both the Tank Destroyer unit; the Panther is a Medium Tank. Stats are the same across sides (01-units §1), so the German tank edge comes from Heavy Tank numbers.
- No reinforcement schedule: the Steppe Front's reserve starts on the map instead of arriving later.

**Stalingrad**

- Balance is a first guess: funds, the size of each army and whether Germany can clear the city before the ring closes all need playtesting.

- **No supply lines**, as in the original game: being surrounded doesn't starve units, and the 6th Army keeps drawing income from the city squares it holds. The ring hurts through losing Kalach (the game), the factories outside it and the road in for reinforcements.
- **No airlift of supplies**: Transport Aircraft carry only foot units (05-supply-transport §6), so the Pitomnik airlift can bring men, not fuel and shells.
- **Fog doesn't ground aircraft**: in 1942 the opening fog kept the Luftwaffe down; here day 1 is snow, which slows tanks but lets planes fly.
- **The Volga doesn't freeze**: it froze over in mid-December, letting the Soviets walk across. Squares don't change terrain mid-game.
- **The armored boat can't fire**: it's a Landing Craft, unarmed in the rules, though the real boats shelled the city; the east-bank artillery stands in for that.
- **Coordinates are approximate**: places within a square or two of where they were; a few small towns are on the wrong bank of the Don.
- **No reinforcement schedule**, as at Kursk: Operation Winter Storm, Manstein's relief attack from Kotelnikovo in December, starts off the south edge and isn't in the scenario. A later Winter Storm map could use the same generator.

**Sevastopol**

- Balance is a first guess, and the Railway Gun is new: a Halftrack parked beside it rearms it every turn, so it can fire every turn for as long as the Halftrack lives.
- **No assault boats**: Germany can't cross Severnaya Bay, as it did on 29 June.
- **No Karl mortars**: the two 60 cm self-propelled mortars are left out; Germany's other heavy guns are Artillery and Rocket Artillery.
- **The fleet isn't there**: the Soviet supply runs by cruiser, destroyer and submarine from Novorossiysk, and the coastal batteries' fire at sea, have no part in it.
- **Fort positions are approximate**, within a square or two.

**Future scenarios**

- Prokhorovka on its own and Operation Bagration can reuse the generators' approach and the Soviet art.
