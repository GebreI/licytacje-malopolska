# Projekt: Licytacje komornicze mieszkań – Małopolska

Statyczna strona (GitHub Pages) dla początkującego inwestora, który chce kupować mieszkania z licytacji komorniczych,
remontować i sprzedawać. Wszystko po polsku, każde pojęcie ma wyjaśnienie po najechaniu (słownik w `slownik.js`).
Właściciel: Gabriel (GitHub: GebreI). Gdy coś jest niejasne – najpierw zapytaj, nie zgaduj.

## Kryteria ofert
Tylko mieszkania, licytacje komornicze, województwo małopolskie, cena wywołania do 200 000 zł, tylko aktywne.

## Struktura
- `index.html` – układ i style (5 zakładek: Start, Oferty, Na tle rynku, Kalkulator zysku, Poradnik). Tokeny kolorów jasny/ciemny na górze.
- `app.js` – cała logika: obliczenia (`dash.calc`), ocena ofert, karta oferty, wykresy d3, kalkulator kupna/remontu/sprzedaży, maksymalna cena.
- `slownik.js` – słownik pojęć (`window.LK_SLOWNIK`), używany przez podpowiedzi `data-t="klucz"`.
- `dash-shim.js` – mały zamiennik API `dash` (ładuje `data/*.json`, liczy `dash.calc`, wywołuje `dash.onData`). Dzięki niemu strona działa bez Claude.
- `data/` – dane (JSON, tablice obiektów). Zmieniaj TYLKO dane przy codziennej aktualizacji.
- d3 v7 z cdnjs.

## Dane i schematy
- `data/licytacje.json` – oferty: id ("lp-<nr listaprzetargow>" lub "ad-<nr adradar>"), miejscowosc, lokalizacja, cena, m2, cena_m2, pokoje, typ ("Całe mieszkanie"/"Udział"), udzial ("1/2"|null), licytacja ("pierwsza"/"druga"/""), tryb ("e-licytacja"/"stacjonarna"/""), termin (data licytacji RRRR-MM-DD|null), termin_wadium (termin rękojmi|null), rabat_pct, uwagi, dodano, sprawdzono, url, url2.
  - Ryzyka rozpoznawane po słowach w `uwagi`: "służebność", "brak prawnie zabezpieczonego dojazdu", "piec węglowy do wymiany"/"do wymiany".
- `data/ceny_rynkowe.json` – na miejscowość: gmina, powiat, ofertowa_m2 (RealAdvisor, gmina, miesięcznie), ofertowa_zakres, ofertowa_data, ofertowa_url, transakcyjna_m2 (GUS BDL, powiat, rynek wtórny), transakcyjna_zakres, transakcyjna_rok, transakcyjna_url.
- `data/historia_cen.json` – 10 lat GUS: {powiat, obszar, rok, mediana_m2, transakcje}; województwo jako powiat "małopolskie".
- `data/ogloszenia.json` – aktualne ogłoszenia sprzedaży (rynek wtórny) do porównań: {id, obszar (miejscowość OFERTY), miejscowosc (gdzie jest ogłoszenie), lokalizacja, cena, m2, cena_m2, pokoje, rynek, zrodlo, url, pobrano}.
- `data/koszty_stawki.json` – stałe opłaty (PCC 2%, wpis KW 200 zł, opróżnienie lokalu 1500 zł, PIT 19%, VAT 23%, świadectwo 700 zł). Nie zmieniaj bez potrzeby.

## Codzienna aktualizacja danych (krok po kroku)
Źródła ofert (oficjalny licytacje.komornik.pl / elicytacje.komornik.pl blokują automatyczny odczyt – NIE obchodź tego):
1. https://listaprzetargow.pl/oferty/licytacje-komornicze/mieszkania/malopolskie/cena-do-200 – oferty przed sekcją "Zakończone". Data na karcie = termin wpłaty rękojmi (termin_wadium).
2. https://przetargi.adradar.pl/p/mieszkania/27529/ma%C5%82opolskie/licytacje_komornicze (+ ?page=2 …) – nie-ARCHIWALNE, cena ≤ 200 000 zł. "Termin" = data licytacji. "pierwsza"/"druga"; "w trybie elektronicznym" → e-licytacja.
Połącz duplikaty (miejscowość + cena ±1 zł + podobny metraż). Zachowuj stare id i `dodano`; `sprawdzono` = dziś. Usuń zakończone.

Ceny rynkowe dla nowych miejscowości:
- Ofertowa: https://realadvisor.pl/pl/ceny-mieszkan/powiat-<slug> – wartość "mieszkanie" dla gminy (raz w miesiącu odśwież wszystkie).
- Transakcyjna: GUS BDL, zmienna 633687 (mediana zł/m², rynek wtórny, ogółem), powiaty: https://bdl.stat.gov.pl/api/v1/data/by-variable/633687?unit-level=5&unit-parent-id=011200000000&year=<rok>&format=json
- Historia: https://bdl.stat.gov.pl/api/v1/data/by-unit/<id-powiatu>?var-id=633687&format=json oraz var-id=633627 (liczba transakcji). 10 ostatnich lat; nowy rok GUS → dopisz, najstarszy usuń.

Ogłoszenia (pełne odświeżenie w poniedziałki, w inne dni tylko nowe miejscowości):
- https://<miejscowosc>.nieruchomosci-online.pl/mieszkania/ oraz https://www.domiporta.pl/mieszkanie/sprzedam/malopolskie/<miejscowosc>
- Tylko sprzedaż z tej miejscowości, bez archiwalnych i sekcji "w promieniu X km". Pomijaj rynek pierwotny ("nowe-mieszkanie", "/nowe/", "deweloperski", serie inwestycji o równych cenach za m²). Usuń duplikaty między serwisami.
- Gdy w miejscowości brak ogłoszeń, weź najbliższe miasto z gminy/powiatu (Osieczany → Myślenice, Tymbark → Limanowa).

Po aktualizacji: sprawdź, że JSON jest poprawny, commit "Aktualizacja danych RRRR-MM-DD" i push na `main` (GitHub Pages odświeży się sam).

## Zasady
- Nie publikuj nic, co podszywa się pod portal komorników; linkuj do źródeł.
- Liczby na stronie tylko z `data/` – nic nie wpisuj na sztywno w HTML.
- Strona to narzędzie do wstępnej selekcji, nie porada prawna/podatkowa – zostaw stopkę z zastrzeżeniem.
