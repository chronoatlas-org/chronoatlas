# Crosswalk suggestions: -25, 34, 45, 72 (west, south, east, north), 1900–1950

OpenHistoricalMap's polities, linked to CShapes's units.

Run on 2026-09-29 on the data of the Europe re-import
([pull request 48](https://github.com/chronoatlas-org/chronoatlas/pull/48), OpenHistoricalMap as of
2026-09-29 05:42 UTC), with
`npm run suggest-crosswalk -- --region=-25,34,45,72 --years=1900,1950 --map=openhistoricalmap --with=cshapes --trial`.
Until these links are reviewed, Europe 1900–1950 reads "Not yet checked against legal borders
here" (the Europe scope reviewed on 2026-09-29 was for Cliopatria's polities).

## Notes from a first read (for the review)

**Suggestions that would hide an occupation or a rival state.** The tool suggests a link wherever
a polity held most of a unit, and these did, but a link says "the same state", which would hide
what contested areas exist to show:

- Military Administration in Belgium and Northern France → Belgium (1940–1944): a German
  occupation administration.
- German occupation of Albania → Albania (1944), and Italian protectorate of Albania → Albania
  (1939–1943).
- Italian Social Republic → Italy (1944), a German-backed state in the north.
- Republic of the Rif → a dependency of Spain (1922–1925): a republic at war with Spain.
- West Germany and the American occupation zone: CShapes codes the German Federal Republic as held
  by the United States in 1949 (`cshapes-2`); check what that should mean here.

**Links that need dates** (`from`/`until` on the match), because the polity outlived the status:

- Syrian Republic → a dependency of France is suggested for 1930–1945; CShapes has Syria as its own
  unit from 1946, and the trial shows "Syrian Republic / Syria" for 1946–1950.
- Lebanon, similarly, from 1945; Kingdom of Iceland and Denmark, where CShapes codes Iceland as
  held by the United States in 1942–1944.

**Polities not suggested** (see below): the occupation zones, the Independent State of Croatia,
the Slovak State, Ukraine and the Transcaucasian states of 1917–1922, and the small states
(Andorra, Monaco, San Marino, Liechtenstein, Vatican City, Danzig, Fiume, Trieste). The small ones
are under 10,000 km², so they can't show as contested anyway.

**Gaps in OpenHistoricalMap's Europe data** (measured on 1 July of each year: land inside
25°W–45°E, 34–72°N not covered by any imported border). Where there's a gap, the map shows
"no data" in place of Cliopatria's borders, which show there today:

| Years | Land covered | Missing (Cliopatria's polities there) | Why |
|---|---|---|---|
| 1900–1908 | 93.0% | Austria-Hungary (about 620,000 km²) | its start date `[1908-10-04..1908-10-06]` ("one of these days") is skipped: our date reader doesn't take EDTF sets |
| every year | 99.6% at most | the Netherlands (about 34,000 km²) | its dates carry a time of day (`1949-04-23T06:00:00+01:00`), which our date reader doesn't take |
| 1913 | 98.3% | parts of Greece, Serbia, Bulgaria | no boundary in OpenHistoricalMap for part of the year |
| 1918–1921 | 89.9–95.8% | Poland, Yugoslavia, Hungary, Austria | four Polish boundaries skipped (their lines don't join into closed rings), and others missing |
| 1940–1941 | 98.7–99.3% | parts of the Baltic states and Germany | missing for part of the year |
| 1944–1949 | 93.2–98.2% | Germany in 1945, parts of the Soviet Union and France | missing for part of the year |
| 1950 | 99.8% | a corner of Denmark | |

Most years in between are 99.6% covered, the remainder being the Netherlands.

Written by `npm run suggest-crosswalk`. **Suggestions only:** each link needs a maintainer's review
before it goes into `data/imports/cshapes-2-0/polity-crosswalk.yaml` (Phase 5 decision 6). The share is
on 1 July of each year sampled, inside the region: "Held" is how much of the CShapes unit(s) the OpenHistoricalMap
polity held, and "Share" how much of the polity lay inside them.

## Suggested links (92)

| CShapes holder | OpenHistoricalMap polity | Kind | Units | Held | Share | Years |
|---|---|---|---|---|---|---|
| United States of America (`cshapes-2`) | West Germany (`west-germany`) | dependency | German Federal Republic | 97% | 47% | 1949–1949 |
| United Kingdom (`cshapes-200`) | Crown Colony of Malta (`crown-colony-of-malta`) | dependency | Malta | 100% | 31% | 1900–1950 |
| United Kingdom (`cshapes-200`) | قبرص البريطانية (`cyprus-protectorate`) | dependency | Cyprus | 100% | 51% | 1915–1950 |
| United Kingdom (`cshapes-200`) | Mandatory Iraq (`mandatory-iraq`) | dependency | Iraq | 100% | 99% | 1921–1932 |
| United Kingdom (`cshapes-200`) | United Kingdom (`united-kingdom`) | same-state | United Kingdom | 100% | 82% | 1923–1950 |
| United Kingdom (`cshapes-200`) | United Kingdom of Great Britain and Ireland (`united-kingdom-of-great-britain-and-ireland`) | same-state | United Kingdom | 100% | 81% | 1900–1922 |
| Ireland (`cshapes-205`) | Ireland (`ireland`) | same-state | Ireland | 100% | 82% | 1938–1950 |
| Ireland (`cshapes-205`) | Irish Free State (`irish-free-state`) | same-state | Ireland | 100% | 82% | 1923–1937 |
| Netherlands (`cshapes-210`) | Kingdom of the Netherlands (`kingdom-of-the-netherlands`) | same-state | Netherlands | 100% | 81% | 1950–1950 |
| Belgium (`cshapes-211`) | Belgium (`belgium`) | same-state | Belgium | 97% | 98% | 1900–1950 |
| Belgium (`cshapes-211`) | Military Administration in Belgium and Northern France (`military-administration-in-belgium-and-northern-france`) | same-state | Belgium | 95% | 68% | 1940–1944 |
| Luxembourg (`cshapes-212`) | Luxembourg (`luxembourg`) | same-state | Luxembourg | 97% | 97% | 1900–1950 |
| France (`cshapes-220`) | France (`france`) | same-state | France | 100% | 66% | 1945–1946 |
| France (`cshapes-220`) | France (`france`) | dependency | Algeria | 100% | 31% | 1945–1946 |
| France (`cshapes-220`) | France (`france-2692931`) | same-state | France | 100% | 66% | 1947–1950 |
| France (`cshapes-220`) | France (`france-2692931`) | dependency | Algeria | 100% | 31% | 1947–1950 |
| France (`cshapes-220`) | French protectorate in Morocco (`french-protectorate-in-morocco`) | dependency | Morocco | 91% | 83% | 1913–1950 |
| France (`cshapes-220`) | French protectorate of Tunisia (`french-protectorate-of-tunisia`) | dependency | Tunisia | 100% | 92% | 1900–1950 |
| France (`cshapes-220`) | French Republic (`french-republic`) | same-state | France | 100% | 65% | 1900–1939 |
| France (`cshapes-220`) | French Republic (`french-republic`) | dependency | Algeria | 100% | 31% | 1900–1939 |
| France (`cshapes-220`) | French State (`french-state`) | same-state | France | 94% | 65% | 1940–1944 |
| France (`cshapes-220`) | French State (`french-state`) | dependency | Algeria | 100% | 32% | 1940–1944 |
| France (`cshapes-220`) | State of Aleppo (`state-of-aleppo`) | dependency | Syria | 66% | 85% | 1921–1921 |
| France (`cshapes-220`) | State of Greater Lebanon (`state-of-greater-lebanon`) | dependency | Lebanon | 99% | 88% | 1921–1943 |
| France (`cshapes-220`) | State of Syria (`state-of-syria`) | dependency | Syria | 95% | 96% | 1925–1929 |
| France (`cshapes-220`) | Syrian Federation (`syrian-federation`) | dependency | Syria | 99% | 89% | 1922–1924 |
| France (`cshapes-220`) | Syrian Republic (`syrian-republic`) | dependency | Syria | 97% | 74% | 1930–1945 |
| Switzerland (`cshapes-225`) | Switzerland (`switzerland`) | same-state | Switzerland | 98% | 99% | 1900–1950 |
| Spain (`cshapes-230`) | Republic of the Rif (`republic-of-the-rif`) | dependency | cshapes-602 | 61% | 68% | 1922–1925 |
| Spain (`cshapes-230`) | Spain (`spain`) | same-state | Spain | 100% | 94% | 1900–1950 |
| Spain (`cshapes-230`) | Spain (`spain`) | dependency | cshapes-602 | 77% | 3% | 1913–1950 |
| Spain (`cshapes-230`) | Spanish protectorate in Morocco (`spanish-protectorate-in-morocco`) | dependency | cshapes-602 | 76% | 85% | 1913–1950 |
| Portugal (`cshapes-235`) | Kingdom of Portugal (`kingdom-of-portugal`) | same-state | Portugal | 100% | 95% | 1900–1910 |
| Portugal (`cshapes-235`) | Portugal (`portugal`) | same-state | Portugal | 100% | 95% | 1910–1950 |
| Germany (Prussia) (`cshapes-255`) | German Reich (`german-reich`) | same-state | Germany (Prussia) | 99% | 95% | 1900–1918 |
| Germany (Prussia) (`cshapes-255`) | German Reich (`german-reich-2696519`) | same-state | Germany (Prussia) | 99% | 81% | 1919–1944 |
| German Democratic Republic (`cshapes-265`) | East Germany (`east-germany`) | same-state | German Democratic Republic | 95% | 92% | 1950–1950 |
| Poland (`cshapes-290`) | Poland (`poland`) | same-state | Poland | 99% | 99% | 1922–1939 |
| Poland (`cshapes-290`) | Poland (`poland-2692206`) | same-state | Poland | 100% | 98% | 1946–1950 |
| Austria-Hungary (`cshapes-300`) | Austria-Hungary (`austria-hungary`) | same-state | Austria-Hungary | 99% | 97% | 1909–1918 |
| Austria (`cshapes-305`) | Austria (`austria`) | same-state | Austria | 99% | 99% | 1921–1950 |
| Hungary (`cshapes-310`) | Hungarian People's Republic (`hungarian-people-s-republic`) | same-state | Hungary | 99% | 99% | 1950–1950 |
| Hungary (`cshapes-310`) | Hungarian Republic (`hungarian-republic`) | same-state | Hungary | 93% | 99% | 1945–1949 |
| Hungary (`cshapes-310`) | Kingdom of Hungary (`kingdom-of-hungary`) | same-state | Hungary | 98% | 88% | 1922–1944 |
| Czechoslovakia (`cshapes-315`) | Czechoslovak Republic (`czechoslovak-republic`) | same-state | Czechoslovakia | 99% | 91% | 1945–1947 |
| Czechoslovakia (`cshapes-315`) | Czechoslovakia (`czechoslovakia`) | same-state | Czechoslovakia | 99% | 99% | 1919–1938 |
| Czechoslovakia (`cshapes-315`) | Czechoslovakia (`czechoslovakia-2692234`) | same-state | Czechoslovakia | 99% | 99% | 1948–1950 |
| Italy/Sardinia (`cshapes-325`) | Italian Social Republic (`italian-social-republic`) | same-state | Italy/Sardinia | 53% | 94% | 1944–1944 |
| Italy/Sardinia (`cshapes-325`) | Italy (`italy`) | same-state | Italy/Sardinia | 100% | 90% | 1900–1945 |
| Italy/Sardinia (`cshapes-325`) | Italy (`italy-2692916`) | same-state | Italy/Sardinia | 100% | 91% | 1946–1950 |
| Italy/Sardinia (`cshapes-325`) | Italy (`italy-2747870`) | same-state | Italy/Sardinia | 100% | 87% | 1924–1943 |
| Albania (`cshapes-339`) | Albania (`albania`) | same-state | Albania | 98% | 91% | 1913–1913 |
| Albania (`cshapes-339`) | Albanian Kingdom (`albanian-kingdom`) | same-state | Albania | 99% | 93% | 1929–1938 |
| Albania (`cshapes-339`) | Albanian Republic (`albanian-republic`) | same-state | Albania | 99% | 92% | 1925–1928 |
| Albania (`cshapes-339`) | Democratic Government of Albania (`democratic-government-of-albania`) | same-state | Albania | 99% | 93% | 1945–1945 |
| Albania (`cshapes-339`) | German occupation of Albania (`german-occupation-of-albania`) | same-state | Albania | 100% | 63% | 1944–1944 |
| Albania (`cshapes-339`) | Italian protectorate of Albania (`italian-protectorate-of-albania`) | same-state | Albania | 100% | 72% | 1939–1943 |
| Albania (`cshapes-339`) | People's Republic of Albania (`people-s-republic-of-albania`) | same-state | Albania | 99% | 93% | 1946–1950 |
| Albania (`cshapes-339`) | Principality of Albania (`principality-of-albania`) | same-state | Albania | 99% | 92% | 1914–1924 |
| Serbia (`cshapes-340`) | Kingdom of Serbia (`kingdom-of-serbia`) | same-state | Serbia | 91% | 75% | 1900–1915 |
| Montenegro (`cshapes-341`) | Kingdom of Montenegro (`kingdom-of-montenegro`) | same-state | Montenegro | 91% | 50% | 1911–1915 |
| Montenegro (`cshapes-341`) | Principality of Montenegro (`principality-of-montenegro`) | same-state | Montenegro | 87% | 96% | 1900–1910 |
| Yugoslavia (`cshapes-345`) | Democratic Federal Yugoslavia (`democratic-federal-yugoslavia`) | same-state | Yugoslavia | 100% | 94% | 1944–1945 |
| Yugoslavia (`cshapes-345`) | FPR of Yugoslavia (`fpr-of-yugoslavia`) | same-state | Yugoslavia | 100% | 94% | 1946–1950 |
| Yugoslavia (`cshapes-345`) | Kingdom of Serbs, Croats and Slovenes (`kingdom-of-serbs-croats-and-slovenes`) | same-state | Yugoslavia | 96% | 96% | 1921–1929 |
| Yugoslavia (`cshapes-345`) | Kingdom of Yugoslavia (`kingdom-of-yugoslavia`) | same-state | Yugoslavia | 96% | 96% | 1930–1940 |
| Greece (`cshapes-350`) | Greece (`greece`) | same-state | Greece | 100% | 53% | 1947–1950 |
| Greece (`cshapes-350`) | Kingdom of Greece (`kingdom-of-greece`) | same-state | Greece | 96% | 64% | 1900–1947 |
| Bulgaria (`cshapes-355`) | People's Republic of Bulgaria (`people-s-republic-of-bulgaria`) | same-state | Bulgaria | 99% | 98% | 1947–1950 |
| Bulgaria (`cshapes-355`) | Tsardom of Bulgaria (`tsardom-of-bulgaria`) | same-state | Bulgaria | 99% | 92% | 1909–1946 |
| Rumania (`cshapes-360`) | Kingdom of Romania (`kingdom-of-romania`) | same-state | Rumania | 99% | 96% | 1900–1918 |
| Rumania (`cshapes-360`) | Kingdom of Romania (`kingdom-of-romania-2693464`) | same-state | Rumania | 98% | 93% | 1919–1947 |
| Rumania (`cshapes-360`) | Romanian People's Republic (`romanian-people-s-republic`) | same-state | Rumania | 100% | 99% | 1948–1950 |
| Estonia (`cshapes-366`) | Estonia (`estonia`) | same-state | Estonia | 96% | 76% | 1919–1939 |
| Latvia (`cshapes-367`) | Latvia (`latvia`) | same-state | Latvia | 98% | 95% | 1920–1939 |
| Lithuania (`cshapes-368`) | Lithuania (`lithuania`) | same-state | Lithuania | 95% | 93% | 1920–1939 |
| Finland (`cshapes-375`) | Finland (`finland`) | same-state | Finland | 99% | 89% | 1918–1950 |
| Sweden (`cshapes-380`) | Sweden (`sweden`) | same-state | Sweden | 98% | 91% | 1905–1950 |
| Sweden (`cshapes-380`) | Sweden–Norway (`sweden-norway`) | same-state | Sweden | 100% | 85% | 1900–1905 |
| Norway (`cshapes-385`) | Norway (`norway`) | same-state | Norway | 100% | 78% | 1906–1950 |
| Denmark (`cshapes-390`) | Denmark (`denmark`) | same-state | Denmark | 100% | 21% | 1900–1950 |
| Denmark (`cshapes-390`) | Denmark (`denmark`) | dependency | Iceland | 100% | 44% | 1900–1941 |
| Denmark (`cshapes-390`) | Kingdom of Iceland (`kingdom-of-iceland`) | dependency | Iceland | 100% | 76% | 1918–1941 |
| Iceland (`cshapes-395`) | Iceland (`iceland`) | same-state | Iceland | 100% | 82% | 1944–1950 |
| Morocco (`cshapes-600`) | Alawi Sultanate (`alawi-sultanate`) | same-state | Morocco | 100% | 47% | 1900–1903 |
| Iran (Persia) (`cshapes-630`) | Iran (`iran`) | same-state | Iran (Persia) | 98% | 98% | 1935–1950 |
| Iran (Persia) (`cshapes-630`) | Persia (`persia`) | same-state | Iran (Persia) | 98% | 98% | 1900–1935 |
| Turkey (Ottoman Empire) (`cshapes-640`) | Ottoman Empire (`ottoman-empire`) | same-state | Turkey (Ottoman Empire) | 98% | 90% | 1900–1922 |
| Turkey (Ottoman Empire) (`cshapes-640`) | State of Turkey (`state-of-turkey`) | same-state | Turkey (Ottoman Empire) | 93% | 97% | 1923–1924 |
| Turkey (Ottoman Empire) (`cshapes-640`) | Turkey (`turkey`) | same-state | Turkey (Ottoman Empire) | 100% | 96% | 1925–1950 |
| Iraq (`cshapes-645`) | Hashemite Kingdom of Iraq (`hashemite-kingdom-of-iraq`) | same-state | Iraq | 100% | 99% | 1933–1950 |
| Lebanon (`cshapes-660`) | Lebanon (`lebanon`) | same-state | Lebanon | 99% | 76% | 1945–1950 |

## Look closer (38)

Never suggested, because a link would hide what "contested" exists to show. Link one only if the
review finds it really was the same state (or its dependency).

**Inside a unit without holding most of it:** possibly a breakaway state, a rival government, or an
occupation zone.

- Alawite State (`alawite-state`): 86% inside Syria (`cshapes-652`, held by `cshapes-220`), holding 4% of it
- American occupation zone in Germany (`american-occupation-zone-in-germany`): 100% inside German Federal Republic (`cshapes-260`, held by `cshapes-2`), holding 43% of it
- Armenia (`armenia`): 51% inside Turkey (Ottoman Empire) (`cshapes-640`, held by `cshapes-640`), holding 2% of it
- Armenia (`armenia-2863796`): 87% inside Turkey (Ottoman Empire) (`cshapes-640`, held by `cshapes-640`), holding 15% of it
- Belarusian People's Republic (`belarusian-people-s-republic`): 100% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 4% of it
- British occupation zone in Germany (`british-occupation-zone-in-germany`): 87% inside German Federal Republic (`cshapes-260`, held by `cshapes-2`), holding 37% of it
- دولة كريت (`cretan-state`): 59% inside Turkey (Ottoman Empire) (`cshapes-640`, held by `cshapes-640`), holding 1% of it
- FUSSR of Transcaucasia (`fussr-of-transcaucasia`): 98% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 3% of it
- General Government of Warsaw (`general-government-of-warsaw`): 99% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 2% of it
- Georgia (`georgia`): 86% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 2% of it
- German occupation of Italy (`german-occupation-of-italy`): 61% inside Italy/Sardinia (`cshapes-325`, held by `cshapes-325`), holding 8% of it
- Germany-Luxembourg condominium (`germany-luxembourg-condominium`): 56% inside German Federal Republic (`cshapes-260`, held by `cshapes-2`), holding 0% of it
- Government of South Russia (`government-of-south-russia`): 82% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 2% of it
- Governorate of Montenegro (`governorate-of-montenegro`): 99% inside Yugoslavia (`cshapes-345`, held by `cshapes-345`), holding 6% of it
- Independent State of Croatia (`independent-state-of-croatia`): 95% inside Yugoslavia (`cshapes-345`, held by `cshapes-345`), holding 40% of it
- Italy (`italy-2794960`): 85% inside Italy/Sardinia (`cshapes-325`, held by `cshapes-325`), holding 38% of it
- Klaipėda Region (`klaipeda-region`): 75% inside Lithuania (`cshapes-368`, held by `cshapes-368`), holding 4% of it
- Mountainous Republic of the Northern Caucasus (`mountainous-republic-of-the-northern-caucasus`): 100% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 1% of it
- Saar Protectorate (`saar-protectorate`): 74% inside German Federal Republic (`cshapes-260`, held by `cshapes-2`), holding 1% of it
- Slovak State (`slovak-state`): 84% inside Czechoslovakia (`cshapes-315`, held by `cshapes-315`), holding 32% of it
- State of Damascus (`state-of-damascus`): 100% inside Syria (`cshapes-652`, held by `cshapes-220`), holding 29% of it
- منطقة طنجة الدولية (`tangier-international-zone`): 64% inside cshapes-602 (`cshapes-602`, held by `cshapes-230`), holding 0% of it
- Territory of the Military Commander in Serbia (`territory-of-the-military-commander-in-serbia`): 100% inside Yugoslavia (`cshapes-345`, held by `cshapes-345`), holding 22% of it
- Ukraine (`ukraine`): 99% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 19% of it
- Ukrainian SSR (`ukrainian-ssr`): 98% inside Russia (Soviet Union) (`cshapes-365`, held by `cshapes-365`), holding 17% of it
- Vatican City (`vatican-city`): 100% inside Italy/Sardinia (`cshapes-325`, held by `cshapes-325`), holding 0% of it

**Holding most of another state's unit:** possibly an occupation or annexation, or a year of transition
(Cliopatria's rows are yearly).


- Denmark (`denmark`): held 100% of Iceland (`cshapes-395`, held by `cshapes-2`), 2% of its own territory
- Kingdom of Iceland (`kingdom-of-iceland`): held 100% of Iceland (`cshapes-395`, held by `cshapes-2`), 6% of its own territory
- Kingdom of Montenegro (`kingdom-of-montenegro`): held 93% of Montenegro (`cshapes-341`, held by `cshapes-300`), 40% of its own territory
- Kingdom of Serbia (`kingdom-of-serbia`): held 94% of Serbia (`cshapes-340`, held by `cshapes-300`), 23% of its own territory
- Lebanon (`lebanon`): held 99% of Lebanon (`cshapes-660`, held by `cshapes-220`), 13% of its own territory
- Ottoman Empire (`ottoman-empire`): held 99% of cshapes-3461 (`cshapes-3461`, held by `cshapes-300`), 1% of its own territory
- Ottoman Empire (`ottoman-empire`): held 98% of cshapes-3462 (`cshapes-3462`, held by `cshapes-300`), 0% of its own territory
- Ottoman Empire (`ottoman-empire`): held 100% of Cyprus (`cshapes-352`, held by `cshapes-200`), 0% of its own territory
- Ottoman Empire (`ottoman-empire`): held 100% of Lebanon (`cshapes-660`, held by `cshapes-220`), 0% of its own territory
- Syrian Republic (`syrian-republic`): held 99% of Syria (`cshapes-652`, held by `cshapes-652`), 24% of its own territory
- United Kingdom of Great Britain and Ireland (`united-kingdom-of-great-britain-and-ireland`): held 100% of Ireland (`cshapes-205`, held by `cshapes-205`), 1% of its own territory
- West Germany (`west-germany`): held 97% of German Federal Republic (`cshapes-260`, held by `cshapes-260`), 47% of its own territory

## No unit held mostly (39)

These would show as contested wherever they overlap a CShapes unit, once the region is reviewed.

- Alawi Sultanate (`alawi-sultanate-2866014`): held at most 0% of any unit
- Alawite State (`alawite-state`): held at most 4% of any unit
- American occupation zone in Germany (`american-occupation-zone-in-germany`): held at most 43% of any unit
- Andorra (`andorra`): held at most 0% of any unit
- Armenia (`armenia`): held at most 2% of any unit
- Armenia (`armenia-2863796`): held at most 15% of any unit
- Belarusian People's Republic (`belarusian-people-s-republic`): held at most 4% of any unit
- British occupation zone in Germany (`british-occupation-zone-in-germany`): held at most 37% of any unit
- دولة كريت (`cretan-state`): held at most 1% of any unit
- Free City of Danzig (`free-city-of-danzig`): held at most 0% of any unit
- Free State of Fiume (`free-state-of-fiume`): held at most 0% of any unit
- Free Territory of Trieste (`free-territory-of-trieste`): held at most 0% of any unit
- FUSSR of Transcaucasia (`fussr-of-transcaucasia`): held at most 3% of any unit
- General Government of Warsaw (`general-government-of-warsaw`): held at most 2% of any unit
- Georgia (`georgia`): held at most 2% of any unit
- German occupation of Italy (`german-occupation-of-italy`): held at most 8% of any unit
- Germany-Luxembourg condominium (`germany-luxembourg-condominium`): held at most 0% of any unit
- Gibraltar (`gibraltar`): held at most 0% of any unit
- Government of South Russia (`government-of-south-russia`): held at most 2% of any unit
- Governorate of Montenegro (`governorate-of-montenegro`): held at most 6% of any unit
- Guernsey (`guernsey`): held at most 0% of any unit
- Independent State of Croatia (`independent-state-of-croatia`): held at most 40% of any unit
- Isle of Man (`isle-of-man`): held at most 0% of any unit
- Italian Islands of the Aegean (`italian-islands-of-the-aegean`): held at most 2% of any unit
- Italy (`italy-2794960`): held at most 38% of any unit
- Jersey (`jersey`): held at most 0% of any unit
- Klaipėda Region (`klaipeda-region`): held at most 4% of any unit
- Лихтенштеин (`liechtenstein`): held at most 0% of any unit
- Monaco (`monaco`): held at most 0% of any unit
- Mountainous Republic of the Northern Caucasus (`mountainous-republic-of-the-northern-caucasus`): held at most 1% of any unit
- Saar Protectorate (`saar-protectorate`): held at most 1% of any unit
- San Marino (`san-marino`): held at most 0% of any unit
- Slovak State (`slovak-state`): held at most 32% of any unit
- State of Damascus (`state-of-damascus`): held at most 29% of any unit
- منطقة طنجة الدولية (`tangier-international-zone`): held at most 0% of any unit
- Territory of the Military Commander in Serbia (`territory-of-the-military-commander-in-serbia`): held at most 22% of any unit
- Ukraine (`ukraine`): held at most 19% of any unit
- Ukrainian SSR (`ukrainian-ssr`): held at most 17% of any unit
- Vatican City (`vatican-city`): held at most 0% of any unit

## YAML, after review

```yaml
- unit: cshapes-2
  matches:
    - polity: west-germany
      kind: dependency
      why: "OpenHistoricalMap's \"West Germany\" held 97% of CShapes's \"German Federal Republic\" (a dependency of \"United States of America\"), and 47% of it lay there (1 July, 1949–1949). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-200
  matches:
    - polity: crown-colony-of-malta
      kind: dependency
      why: "OpenHistoricalMap's \"Crown Colony of Malta\" held 100% of CShapes's \"Malta\" (a dependency of \"United Kingdom\"), and 31% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: cyprus-protectorate
      kind: dependency
      why: "OpenHistoricalMap's \"قبرص البريطانية\" held 100% of CShapes's \"Cyprus\" (a dependency of \"United Kingdom\"), and 51% of it lay there (1 July, 1915–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: mandatory-iraq
      kind: dependency
      why: "OpenHistoricalMap's \"Mandatory Iraq\" held 100% of CShapes's \"Iraq\" (a dependency of \"United Kingdom\"), and 99% of it lay there (1 July, 1921–1932). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: united-kingdom
      kind: same-state
      why: "OpenHistoricalMap's \"United Kingdom\" held 100% of CShapes's \"United Kingdom\" (its own unit), and 82% of it lay there (1 July, 1923–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: united-kingdom-of-great-britain-and-ireland
      kind: same-state
      why: "OpenHistoricalMap's \"United Kingdom of Great Britain and Ireland\" held 100% of CShapes's \"United Kingdom\" (its own unit), and 81% of it lay there (1 July, 1900–1922). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-205
  matches:
    - polity: ireland
      kind: same-state
      why: "OpenHistoricalMap's \"Ireland\" held 100% of CShapes's \"Ireland\" (its own unit), and 82% of it lay there (1 July, 1938–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: irish-free-state
      kind: same-state
      why: "OpenHistoricalMap's \"Irish Free State\" held 100% of CShapes's \"Ireland\" (its own unit), and 82% of it lay there (1 July, 1923–1937). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-210
  matches:
    - polity: kingdom-of-the-netherlands
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of the Netherlands\" held 100% of CShapes's \"Netherlands\" (its own unit), and 81% of it lay there (1 July, 1950–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-211
  matches:
    - polity: belgium
      kind: same-state
      why: "OpenHistoricalMap's \"Belgium\" held 97% of CShapes's \"Belgium\" (its own unit), and 98% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: military-administration-in-belgium-and-northern-france
      kind: same-state
      why: "OpenHistoricalMap's \"Military Administration in Belgium and Northern France\" held 95% of CShapes's \"Belgium\" (its own unit), and 68% of it lay there (1 July, 1940–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-212
  matches:
    - polity: luxembourg
      kind: same-state
      why: "OpenHistoricalMap's \"Luxembourg\" held 97% of CShapes's \"Luxembourg\" (its own unit), and 97% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-220
  matches:
    - polity: france
      kind: same-state
      why: "OpenHistoricalMap's \"France\" held 100% of CShapes's \"France\" (its own unit), and 66% of it lay there (1 July, 1945–1946). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: france
      kind: dependency
      why: "OpenHistoricalMap's \"France\" held 100% of CShapes's \"Algeria\" (a dependency of \"France\"), and 31% of it lay there (1 July, 1945–1946). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: france-2692931
      kind: same-state
      why: "OpenHistoricalMap's \"France\" held 100% of CShapes's \"France\" (its own unit), and 66% of it lay there (1 July, 1947–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: france-2692931
      kind: dependency
      why: "OpenHistoricalMap's \"France\" held 100% of CShapes's \"Algeria\" (a dependency of \"France\"), and 31% of it lay there (1 July, 1947–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: french-protectorate-in-morocco
      kind: dependency
      why: "OpenHistoricalMap's \"French protectorate in Morocco\" held 91% of CShapes's \"Morocco\" (a dependency of \"France\"), and 83% of it lay there (1 July, 1913–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: french-protectorate-of-tunisia
      kind: dependency
      why: "OpenHistoricalMap's \"French protectorate of Tunisia\" held 100% of CShapes's \"Tunisia\" (a dependency of \"France\"), and 92% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: french-republic
      kind: same-state
      why: "OpenHistoricalMap's \"French Republic\" held 100% of CShapes's \"France\" (its own unit), and 65% of it lay there (1 July, 1900–1939). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: french-republic
      kind: dependency
      why: "OpenHistoricalMap's \"French Republic\" held 100% of CShapes's \"Algeria\" (a dependency of \"France\"), and 31% of it lay there (1 July, 1900–1939). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: french-state
      kind: same-state
      why: "OpenHistoricalMap's \"French State\" held 94% of CShapes's \"France\" (its own unit), and 65% of it lay there (1 July, 1940–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: french-state
      kind: dependency
      why: "OpenHistoricalMap's \"French State\" held 100% of CShapes's \"Algeria\" (a dependency of \"France\"), and 32% of it lay there (1 July, 1940–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: state-of-aleppo
      kind: dependency
      why: "OpenHistoricalMap's \"State of Aleppo\" held 66% of CShapes's \"Syria\" (a dependency of \"France\"), and 85% of it lay there (1 July, 1921–1921). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: state-of-greater-lebanon
      kind: dependency
      why: "OpenHistoricalMap's \"State of Greater Lebanon\" held 99% of CShapes's \"Lebanon\" (a dependency of \"France\"), and 88% of it lay there (1 July, 1921–1943). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: state-of-syria
      kind: dependency
      why: "OpenHistoricalMap's \"State of Syria\" held 95% of CShapes's \"Syria\" (a dependency of \"France\"), and 96% of it lay there (1 July, 1925–1929). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: syrian-federation
      kind: dependency
      why: "OpenHistoricalMap's \"Syrian Federation\" held 99% of CShapes's \"Syria\" (a dependency of \"France\"), and 89% of it lay there (1 July, 1922–1924). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: syrian-republic
      kind: dependency
      why: "OpenHistoricalMap's \"Syrian Republic\" held 97% of CShapes's \"Syria\" (a dependency of \"France\"), and 74% of it lay there (1 July, 1930–1945). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-225
  matches:
    - polity: switzerland
      kind: same-state
      why: "OpenHistoricalMap's \"Switzerland\" held 98% of CShapes's \"Switzerland\" (its own unit), and 99% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-230
  matches:
    - polity: republic-of-the-rif
      kind: dependency
      why: "OpenHistoricalMap's \"Republic of the Rif\" held 61% of CShapes's \"cshapes-602\" (a dependency of \"Spain\"), and 68% of it lay there (1 July, 1922–1925). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: spain
      kind: same-state
      why: "OpenHistoricalMap's \"Spain\" held 100% of CShapes's \"Spain\" (its own unit), and 94% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: spain
      kind: dependency
      why: "OpenHistoricalMap's \"Spain\" held 77% of CShapes's \"cshapes-602\" (a dependency of \"Spain\"), and 3% of it lay there (1 July, 1913–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: spanish-protectorate-in-morocco
      kind: dependency
      why: "OpenHistoricalMap's \"Spanish protectorate in Morocco\" held 76% of CShapes's \"cshapes-602\" (a dependency of \"Spain\"), and 85% of it lay there (1 July, 1913–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-235
  matches:
    - polity: kingdom-of-portugal
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Portugal\" held 100% of CShapes's \"Portugal\" (its own unit), and 95% of it lay there (1 July, 1900–1910). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: portugal
      kind: same-state
      why: "OpenHistoricalMap's \"Portugal\" held 100% of CShapes's \"Portugal\" (its own unit), and 95% of it lay there (1 July, 1910–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-255
  matches:
    - polity: german-reich
      kind: same-state
      why: "OpenHistoricalMap's \"German Reich\" held 99% of CShapes's \"Germany (Prussia)\" (its own unit), and 95% of it lay there (1 July, 1900–1918). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: german-reich-2696519
      kind: same-state
      why: "OpenHistoricalMap's \"German Reich\" held 99% of CShapes's \"Germany (Prussia)\" (its own unit), and 81% of it lay there (1 July, 1919–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-265
  matches:
    - polity: east-germany
      kind: same-state
      why: "OpenHistoricalMap's \"East Germany\" held 95% of CShapes's \"German Democratic Republic\" (its own unit), and 92% of it lay there (1 July, 1950–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-290
  matches:
    - polity: poland
      kind: same-state
      why: "OpenHistoricalMap's \"Poland\" held 99% of CShapes's \"Poland\" (its own unit), and 99% of it lay there (1 July, 1922–1939). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: poland-2692206
      kind: same-state
      why: "OpenHistoricalMap's \"Poland\" held 100% of CShapes's \"Poland\" (its own unit), and 98% of it lay there (1 July, 1946–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-300
  matches:
    - polity: austria-hungary
      kind: same-state
      why: "OpenHistoricalMap's \"Austria-Hungary\" held 99% of CShapes's \"Austria-Hungary\" (its own unit), and 97% of it lay there (1 July, 1909–1918). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-305
  matches:
    - polity: austria
      kind: same-state
      why: "OpenHistoricalMap's \"Austria\" held 99% of CShapes's \"Austria\" (its own unit), and 99% of it lay there (1 July, 1921–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-310
  matches:
    - polity: hungarian-people-s-republic
      kind: same-state
      why: "OpenHistoricalMap's \"Hungarian People's Republic\" held 99% of CShapes's \"Hungary\" (its own unit), and 99% of it lay there (1 July, 1950–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: hungarian-republic
      kind: same-state
      why: "OpenHistoricalMap's \"Hungarian Republic\" held 93% of CShapes's \"Hungary\" (its own unit), and 99% of it lay there (1 July, 1945–1949). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: kingdom-of-hungary
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Hungary\" held 98% of CShapes's \"Hungary\" (its own unit), and 88% of it lay there (1 July, 1922–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-315
  matches:
    - polity: czechoslovak-republic
      kind: same-state
      why: "OpenHistoricalMap's \"Czechoslovak Republic\" held 99% of CShapes's \"Czechoslovakia\" (its own unit), and 91% of it lay there (1 July, 1945–1947). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: czechoslovakia
      kind: same-state
      why: "OpenHistoricalMap's \"Czechoslovakia\" held 99% of CShapes's \"Czechoslovakia\" (its own unit), and 99% of it lay there (1 July, 1919–1938). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: czechoslovakia-2692234
      kind: same-state
      why: "OpenHistoricalMap's \"Czechoslovakia\" held 99% of CShapes's \"Czechoslovakia\" (its own unit), and 99% of it lay there (1 July, 1948–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-325
  matches:
    - polity: italian-social-republic
      kind: same-state
      why: "OpenHistoricalMap's \"Italian Social Republic\" held 53% of CShapes's \"Italy/Sardinia\" (its own unit), and 94% of it lay there (1 July, 1944–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: italy
      kind: same-state
      why: "OpenHistoricalMap's \"Italy\" held 100% of CShapes's \"Italy/Sardinia\" (its own unit), and 90% of it lay there (1 July, 1900–1945). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: italy-2692916
      kind: same-state
      why: "OpenHistoricalMap's \"Italy\" held 100% of CShapes's \"Italy/Sardinia\" (its own unit), and 91% of it lay there (1 July, 1946–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: italy-2747870
      kind: same-state
      why: "OpenHistoricalMap's \"Italy\" held 100% of CShapes's \"Italy/Sardinia\" (its own unit), and 87% of it lay there (1 July, 1924–1943). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-339
  matches:
    - polity: albania
      kind: same-state
      why: "OpenHistoricalMap's \"Albania\" held 98% of CShapes's \"Albania\" (its own unit), and 91% of it lay there (1 July, 1913–1913). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: albanian-kingdom
      kind: same-state
      why: "OpenHistoricalMap's \"Albanian Kingdom\" held 99% of CShapes's \"Albania\" (its own unit), and 93% of it lay there (1 July, 1929–1938). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: albanian-republic
      kind: same-state
      why: "OpenHistoricalMap's \"Albanian Republic\" held 99% of CShapes's \"Albania\" (its own unit), and 92% of it lay there (1 July, 1925–1928). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: democratic-government-of-albania
      kind: same-state
      why: "OpenHistoricalMap's \"Democratic Government of Albania\" held 99% of CShapes's \"Albania\" (its own unit), and 93% of it lay there (1 July, 1945–1945). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: german-occupation-of-albania
      kind: same-state
      why: "OpenHistoricalMap's \"German occupation of Albania\" held 100% of CShapes's \"Albania\" (its own unit), and 63% of it lay there (1 July, 1944–1944). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: italian-protectorate-of-albania
      kind: same-state
      why: "OpenHistoricalMap's \"Italian protectorate of Albania\" held 100% of CShapes's \"Albania\" (its own unit), and 72% of it lay there (1 July, 1939–1943). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: people-s-republic-of-albania
      kind: same-state
      why: "OpenHistoricalMap's \"People's Republic of Albania\" held 99% of CShapes's \"Albania\" (its own unit), and 93% of it lay there (1 July, 1946–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: principality-of-albania
      kind: same-state
      why: "OpenHistoricalMap's \"Principality of Albania\" held 99% of CShapes's \"Albania\" (its own unit), and 92% of it lay there (1 July, 1914–1924). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-340
  matches:
    - polity: kingdom-of-serbia
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Serbia\" held 91% of CShapes's \"Serbia\" (its own unit), and 75% of it lay there (1 July, 1900–1915). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-341
  matches:
    - polity: kingdom-of-montenegro
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Montenegro\" held 91% of CShapes's \"Montenegro\" (its own unit), and 50% of it lay there (1 July, 1911–1915). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: principality-of-montenegro
      kind: same-state
      why: "OpenHistoricalMap's \"Principality of Montenegro\" held 87% of CShapes's \"Montenegro\" (its own unit), and 96% of it lay there (1 July, 1900–1910). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-345
  matches:
    - polity: democratic-federal-yugoslavia
      kind: same-state
      why: "OpenHistoricalMap's \"Democratic Federal Yugoslavia\" held 100% of CShapes's \"Yugoslavia\" (its own unit), and 94% of it lay there (1 July, 1944–1945). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: fpr-of-yugoslavia
      kind: same-state
      why: "OpenHistoricalMap's \"FPR of Yugoslavia\" held 100% of CShapes's \"Yugoslavia\" (its own unit), and 94% of it lay there (1 July, 1946–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: kingdom-of-serbs-croats-and-slovenes
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Serbs, Croats and Slovenes\" held 96% of CShapes's \"Yugoslavia\" (its own unit), and 96% of it lay there (1 July, 1921–1929). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: kingdom-of-yugoslavia
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Yugoslavia\" held 96% of CShapes's \"Yugoslavia\" (its own unit), and 96% of it lay there (1 July, 1930–1940). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-350
  matches:
    - polity: greece
      kind: same-state
      why: "OpenHistoricalMap's \"Greece\" held 100% of CShapes's \"Greece\" (its own unit), and 53% of it lay there (1 July, 1947–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: kingdom-of-greece
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Greece\" held 96% of CShapes's \"Greece\" (its own unit), and 64% of it lay there (1 July, 1900–1947). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-355
  matches:
    - polity: people-s-republic-of-bulgaria
      kind: same-state
      why: "OpenHistoricalMap's \"People's Republic of Bulgaria\" held 99% of CShapes's \"Bulgaria\" (its own unit), and 98% of it lay there (1 July, 1947–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: tsardom-of-bulgaria
      kind: same-state
      why: "OpenHistoricalMap's \"Tsardom of Bulgaria\" held 99% of CShapes's \"Bulgaria\" (its own unit), and 92% of it lay there (1 July, 1909–1946). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-360
  matches:
    - polity: kingdom-of-romania
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Romania\" held 99% of CShapes's \"Rumania\" (its own unit), and 96% of it lay there (1 July, 1900–1918). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: kingdom-of-romania-2693464
      kind: same-state
      why: "OpenHistoricalMap's \"Kingdom of Romania\" held 98% of CShapes's \"Rumania\" (its own unit), and 93% of it lay there (1 July, 1919–1947). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: romanian-people-s-republic
      kind: same-state
      why: "OpenHistoricalMap's \"Romanian People's Republic\" held 100% of CShapes's \"Rumania\" (its own unit), and 99% of it lay there (1 July, 1948–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-366
  matches:
    - polity: estonia
      kind: same-state
      why: "OpenHistoricalMap's \"Estonia\" held 96% of CShapes's \"Estonia\" (its own unit), and 76% of it lay there (1 July, 1919–1939). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-367
  matches:
    - polity: latvia
      kind: same-state
      why: "OpenHistoricalMap's \"Latvia\" held 98% of CShapes's \"Latvia\" (its own unit), and 95% of it lay there (1 July, 1920–1939). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-368
  matches:
    - polity: lithuania
      kind: same-state
      why: "OpenHistoricalMap's \"Lithuania\" held 95% of CShapes's \"Lithuania\" (its own unit), and 93% of it lay there (1 July, 1920–1939). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-375
  matches:
    - polity: finland
      kind: same-state
      why: "OpenHistoricalMap's \"Finland\" held 99% of CShapes's \"Finland\" (its own unit), and 89% of it lay there (1 July, 1918–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-380
  matches:
    - polity: sweden
      kind: same-state
      why: "OpenHistoricalMap's \"Sweden\" held 98% of CShapes's \"Sweden\" (its own unit), and 91% of it lay there (1 July, 1905–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: sweden-norway
      kind: same-state
      why: "OpenHistoricalMap's \"Sweden–Norway\" held 100% of CShapes's \"Sweden\" (its own unit), and 85% of it lay there (1 July, 1900–1905). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-385
  matches:
    - polity: norway
      kind: same-state
      why: "OpenHistoricalMap's \"Norway\" held 100% of CShapes's \"Norway\" (its own unit), and 78% of it lay there (1 July, 1906–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-390
  matches:
    - polity: denmark
      kind: same-state
      why: "OpenHistoricalMap's \"Denmark\" held 100% of CShapes's \"Denmark\" (its own unit), and 21% of it lay there (1 July, 1900–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: denmark
      kind: dependency
      why: "OpenHistoricalMap's \"Denmark\" held 100% of CShapes's \"Iceland\" (a dependency of \"Denmark\"), and 44% of it lay there (1 July, 1900–1941). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: kingdom-of-iceland
      kind: dependency
      why: "OpenHistoricalMap's \"Kingdom of Iceland\" held 100% of CShapes's \"Iceland\" (a dependency of \"Denmark\"), and 76% of it lay there (1 July, 1918–1941). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-395
  matches:
    - polity: iceland
      kind: same-state
      why: "OpenHistoricalMap's \"Iceland\" held 100% of CShapes's \"Iceland\" (its own unit), and 82% of it lay there (1 July, 1944–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-600
  matches:
    - polity: alawi-sultanate
      kind: same-state
      why: "OpenHistoricalMap's \"Alawi Sultanate\" held 100% of CShapes's \"Morocco\" (its own unit), and 47% of it lay there (1 July, 1900–1903). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-630
  matches:
    - polity: iran
      kind: same-state
      why: "OpenHistoricalMap's \"Iran\" held 98% of CShapes's \"Iran (Persia)\" (its own unit), and 98% of it lay there (1 July, 1935–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: persia
      kind: same-state
      why: "OpenHistoricalMap's \"Persia\" held 98% of CShapes's \"Iran (Persia)\" (its own unit), and 98% of it lay there (1 July, 1900–1935). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-640
  matches:
    - polity: ottoman-empire
      kind: same-state
      why: "OpenHistoricalMap's \"Ottoman Empire\" held 98% of CShapes's \"Turkey (Ottoman Empire)\" (its own unit), and 90% of it lay there (1 July, 1900–1922). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: state-of-turkey
      kind: same-state
      why: "OpenHistoricalMap's \"State of Turkey\" held 93% of CShapes's \"Turkey (Ottoman Empire)\" (its own unit), and 97% of it lay there (1 July, 1923–1924). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
    - polity: turkey
      kind: same-state
      why: "OpenHistoricalMap's \"Turkey\" held 100% of CShapes's \"Turkey (Ottoman Empire)\" (its own unit), and 96% of it lay there (1 July, 1925–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-645
  matches:
    - polity: hashemite-kingdom-of-iraq
      kind: same-state
      why: "OpenHistoricalMap's \"Hashemite Kingdom of Iraq\" held 100% of CShapes's \"Iraq\" (its own unit), and 99% of it lay there (1 July, 1933–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
- unit: cshapes-660
  matches:
    - polity: lebanon
      kind: same-state
      why: "OpenHistoricalMap's \"Lebanon\" held 99% of CShapes's \"Lebanon\" (its own unit), and 76% of it lay there (1 July, 1945–1950). Suggested by npm run suggest-crosswalk; reviewed by the maintainers on <date>."
```

## Trial: contested areas if every suggestion were accepted (87 pairs)

Administered per OpenHistoricalMap, legally recognized as another state's per CShapes, at least 10,000 km².
The largest area of each pair; "possibly" where only uncertain (month- or year-only) dates make it so.

| Administered by (OpenHistoricalMap) | Legally (CShapes) | Largest area | Years |
|---|---|---|---|
| Ukraine | Russia (Soviet Union) | 570,405 km² | 1918–1919 |
| Ukrainian SSR | Russia (Soviet Union) | 450,479 km² | 1919–1922 |
| Sweden–Norway | Norway | 300,483 km² | 1905–1905 |
| German Reich | Poland | 265,964 km² | 1919–1945 |
| West Germany | German Federal Republic | 239,067 km² | 1949–1950 |
| Soviet Union | Poland | 199,039 km² | 1939–1945 |
| Italy | Italy/Sardinia | 176,683 km² | 1943–1945 |
| South Russian Government | Russia (Soviet Union) | 151,883 km² (possibly) | 1920–1920 |
| Ottoman Empire | France | 144,942 km² | 1920–1920 |
| Levant States | France | 144,346 km² | 1920–1920 |
| Syrian Republic | Syria | 144,125 km² | 1946–1950 |
| Belarusian People's Republic | Russia (Soviet Union) | 126,429 km² | 1918–1919 |
| State of Slovenes, Croats and Serbs | Austria-Hungary | 119,622 km² | 1918–1918 |
| Armenia | Turkey (Ottoman Empire) | 118,521 km² | 1920–1921 |
| Ottoman Empire | United Kingdom | 118,002 km² | 1920–1920 |
| Kingdom of Romania | Hungary | 114,068 km² | 1919–1920 |
| Czechoslovakia | Czechoslovakia | 108,154 km² | 1938–1939 |
| American occupation zone in Germany | United States of America | 106,248 km² | 1945–1949 |
| Independent State of Croatia | Yugoslavia | 103,294 km² | 1941–1945 |
| Denmark | United States of America | 102,196 km² | 1942–1944 |
| Kingdom of Iceland | United States of America | 102,196 km² | 1942–1944 |
| Transcaucasian Commissariat | Russia (Soviet Union) | 98,307 km² | 1917–1918 |
| Kingdom of Romania | Russia (Soviet Union) | 95,091 km² | 1919–1944 |
| State of Slovenes, Croats and Serbs | Hungary | 93,765 km² | 1918–1918 |
| Ottoman Empire | Bulgaria | 92,673 km² | 1900–1908 |
| British occupation zone in Germany | United States of America | 92,421 km² | 1945–1949 |
| British occupation zone in Germany | German Federal Republic | 92,401 km² | 1949–1949 |
| Kingdom of Serbia | Austria-Hungary | 85,010 km² | 1915–1918 |
| German Reich | Austria | 83,530 km² | 1938–1945 |
| Transcaucasian DFR | Russia (Soviet Union) | 72,532 km² | 1918–1918 |
| FUSSR of Transcaucasia | Russia (Soviet Union) | 72,390 km² | 1922–1922 |
| United Kingdom of Great Britain and Ireland | Ireland | 69,105 km² | 1921–1922 |
| Latvian Soviet Socialist Republic | Russia (Soviet Union) | 65,854 km² | 1940–1940 |
| Latvia | Russia (Soviet Union) | 65,139 km² | 1940–1940 |
| Crimean People's Republic | Russia (Soviet Union) | 62,871 km² | 1917–1918 |
| General Government of Warsaw | Russia (Soviet Union) | 61,687 km² | 1915–1916 |
| Territory of the Military Commander in Serbia | Yugoslavia | 57,015 km² | 1941–1944 |
| Georgia | Russia (Soviet Union) | 56,037 km² | 1918–1922 |
| SSR of Georgia | Russia (Soviet Union) | 56,029 km² | 1921–1922 |
| German Reich | Czechoslovakia | 54,736 km² | 1939–1945 |
| Lithuania | Russia (Soviet Union) | 52,991 km² | 1940–1940 |
| Lithuanian SSR | Russia (Soviet Union) | 52,991 km² | 1940–1940 |
| Soviet Union | Rumania | 50,775 km² | 1940–1940 |
| Government of South Russia | Russia (Soviet Union) | 45,645 km² | 1920–1920 |
| Estonia | Russia (Soviet Union) | 43,292 km² | 1918–1940 |
| Estonia SSR | Russia (Soviet Union) | 43,292 km² | 1940–1940 |
| State of Damascus | France | 42,316 km² | 1920–1922 |
| Kingdom of Hungary | Rumania | 42,152 km² | 1940–1944 |
| Ottoman Empire | Austria-Hungary | 40,792 km² | 1900–1908 |
| Kingdom of Greece | Turkey (Ottoman Empire) | 39,247 km² | 1920–1924 |
| Mountainous Republic of the Northern Caucasus | Russia (Soviet Union) | 36,638 km² | 1918–1919 |
| Slovak State | Czechoslovakia | 32,779 km² | 1939–1945 |
| Revolutionary Catalonia | Spain | 31,956 km² | 1936–1937 |
| Reichskommissariat Belgien-Nordfrankreich | Belgium | 29,079 km² | 1944–1944 |
| Albania | Turkey (Ottoman Empire) | 28,914 km² | 1912–1912 |
| Ottoman Empire | Albania | 28,586 km² | 1913–1913 |
| Tsardom of Bulgaria | Yugoslavia | 27,594 km² | 1941–1944 |
| Russian Soviet Federative Socialist Republic | Turkey (Ottoman Empire) | 26,019 km² | 1918–1918 |
| Transcaucasian Commissariat | Turkey (Ottoman Empire) | 26,019 km² | 1918–1918 |
| Transcaucasian DFR | Turkey (Ottoman Empire) | 26,019 km² | 1918–1918 |
| 점령지 연합군 정부 | Italy/Sardinia | 25,438 km² | 1943–1944 |
| German occupation of Italy | Italy/Sardinia | 24,772 km² | 1943–1945 |
| Tsardom of Bulgaria | Greece | 21,241 km² | 1941–1944 |
| Armenia | Turkey (Ottoman Empire) | 16,710 km² | 1918–1920 |
| Armenia | Russia (Soviet Union) | 16,078 km² | 1918–1920 |
| Armenia | Russia (Soviet Union) | 16,078 km² | 1920–1921 |
| State of Slovenes, Croats and Serbs | Austria | 16,011 km² | 1918–1918 |
| SSR of Armenia | Russia (Soviet Union) | 16,005 km² | 1921–1922 |
| Czechoslovak Republic | Hungary | 15,771 km² | 1945–1947 |
| French Republic | Germany (Prussia) | 15,649 km² | 1918–1919 |
| Levant States | Turkey (Ottoman Empire) | 15,555 km² | 1920–1920 |
| Syrian Federation | Turkey (Ottoman Empire) | 15,555 km² | 1922–1924 |
| State of Aleppo | Turkey (Ottoman Empire) | 15,537 km² | 1920–1922 |
| Kingdom of Montenegro | Austria-Hungary | 14,848 km² | 1915–1918 |
| Finland | Russia (Soviet Union) | 14,589 km² | 1918–1944 |
| German Reich | France | 14,499 km² | 1940–1945 |
| Governorate of Montenegro | Yugoslavia | 14,195 km² | 1941–1943 |
| German occupation of Albania | Yugoslavia | 13,990 km² | 1943–1944 |
| Italian protectorate of Albania | Yugoslavia | 13,990 km² | 1941–1943 |
| Ukraine | Poland | 13,666 km² | 1918–1919 |
| Kingdom of Hungary | Czechoslovakia | 13,466 km² | 1939–1944 |
| Italy | Yugoslavia | 12,910 km² | 1941–1943 |
| Military Administration in Belgium and Northern France | France | 12,500 km² | 1940–1944 |
| Reichskommissariat Belgien-Nordfrankreich | France | 12,500 km² | 1944–1944 |
| German occupation of Italy | Yugoslavia | 12,210 km² | 1943–1945 |
| Russian Soviet Federative Socialist Republic | Finland | 10,945 km² | 1917–1920 |
| German Reich | Yugoslavia | 10,394 km² | 1941–1945 |
