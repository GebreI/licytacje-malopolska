# Projekt: Mieszkania do 200 tys. zł – Małopolska (licytacje i inne okazje)

Statyczna strona (GitHub Pages) dla początkującego inwestora, który chce kupować mieszkania z licytacji komorniczych,
remontować i sprzedawać. Wszystko po polsku, każde pojęcie ma wyjaśnienie po najechaniu (słownik w `slownik.js`).
Właściciel: Gabriel (GitHub: GebreI). Gdy coś jest niejasne – najpierw zapytaj, nie zgaduj.

## Jak działa projekt (ważne – przeczytaj najpierw)
- To repozytorium jest JEDYNYM źródłem kodu i danych. Strona: https://gebrei.github.io/licytacje-malopolska/ (GitHub Pages, gałąź main).
- Dane w `data/` aktualizuje automatycznie zaplanowane zadanie w chmurze Claude („Mieszkania do 200 tys. Małopolska – aktualizacja danych w repo”), codziennie ok. 6:52. Robi commit „Aktualizacja danych RRRR-MM-DD” i push na main. Działa bez włączonego komputera.
- Ty (Claude Code) rozwijasz wygląd i funkcje strony: `index.html`, `app.js`, `slownik.js`.
- ZAWSZE zacznij od `git pull` (automat codziennie dopisuje commity), a po zmianach: commit i `git push`.
- Po każdej zmianie `app.js` lub `slownik.js` podbij wersję w `index.html` (`<script src="app.js?v=RRRR-MM-DD">`, to samo dla `slownik.js`) na dzisiejszą datę; przy kolejnej zmianie tego samego dnia dopisz `-2`, `-3`… Bez tego przeglądarki przez ok. 10 minut trzymają starą kopię pliku i strona może się nie wczytać. Zmiany samych danych w `data/` tego nie wymagają.
- Nie edytuj ręcznie `data/*.json`, chyba że Gabriel o to poprosi – nadpisze je poranny automat. Jeśli zmieniasz schemat danych, opisz to w tym pliku i powiedz Gabrielowi, że trzeba też zaktualizować prompt zaplanowanego zadania.
- Dawny dashboard w aplikacji Claude to archiwum – nie jest już aktualizowany.
- Podgląd lokalny: `python3 -m http.server 8000` w folderze repo i otwórz http://localhost:8000 (fetch plików JSON nie działa przy otwieraniu index.html bezpośrednio z dysku).

## Kryteria ofert
Tylko mieszkania (nie lokale użytkowe, nie domy), województwo małopolskie, cena do 200 000 zł, tylko aktywne.
TYLKO CAŁE MIESZKANIA (100% własności) – NIE pobieraj udziałów (np. „udział 1/2”, „1/8 części”, „udział we współwłasności”, mikrolokale sprzedawane jako udział). Gdy nie wiadomo, czy to całość, otwórz ofertę i sprawdź; w razie wątpliwości pomiń. `app.js` i tak odrzuca oferty z `typ` = "Udział" lub niepustym `udzial`.
Rodzaje sprzedaży (pole `rodzaj` w data/licytacje.json): "komornicza", "syndyk" (syndyk/likwidator),
"przetarg" (gminy, miasta, spółdzielnie, spółki Skarbu Państwa, KOWR, instytucje), "bank" (banki, windykacja),
"ogłoszenie" (zwykłe ogłoszenia sprzedaży, rynek wtórny).

## Struktura
- `index.html` – układ i style (5 zakładek: Start, Oferty, Na tle rynku, Kalkulator zysku, Poradnik). Tokeny kolorów jasny/ciemny na górze.
- `app.js` – cała logika: wczytanie `data/*.json` (`wczytajDane`, wyniki w obiekcie `DATA`), obliczenia (`calcPorownanie`, `calcPodsumowanie`, `calcTrendCen`, `calcPodobne`), ocena ofert, karta oferty, wykresy d3, kalkulator kupna/remontu/sprzedaży, maksymalna cena.
- `slownik.js` – słownik pojęć (`window.LK_SLOWNIK`), używany przez podpowiedzi `data-t="klucz"`.
- `data/` – dane (JSON, tablice obiektów). Zmieniaj TYLKO dane przy codziennej aktualizacji.
- d3 v7 z cdnjs.

## Dane i schematy
- `data/licytacje.json` – oferty WSZYSTKICH rodzajów (mimo nazwy): id ("lp-<nr listaprzetargow>", "ad-<nr adradar>" lub "do-<nr domiporta>"), rodzaj, miejscowosc, lokalizacja, cena, m2, cena_m2, pokoje, typ ("Całe mieszkanie"/"Udział"), udzial ("1/2"|null), licytacja ("pierwsza"/"druga"/""), tryb ("e-licytacja"/"stacjonarna"/""), termin (data licytacji RRRR-MM-DD|null), termin_wadium (termin rękojmi|null), rabat_pct, uwagi, dodano, sprawdzono, url, url2.
  - Ryzyka rozpoznawane po słowach w `uwagi`: "służebność", "brak prawnie zabezpieczonego dojazdu", "piec węglowy do wymiany"/"do wymiany".
- `data/ceny_rynkowe.json` – na miejscowość: gmina, powiat, ofertowa_m2 (RealAdvisor, gmina, miesięcznie), ofertowa_zakres, ofertowa_data, ofertowa_url, transakcyjna_m2 (GUS BDL, powiat, rynek wtórny), transakcyjna_zakres, transakcyjna_rok, transakcyjna_url.
- `data/historia_cen.json` – 10 lat GUS: {powiat, obszar, rok, mediana_m2, transakcje}; województwo jako powiat "małopolskie".
- `data/ogloszenia.json` – aktualne ogłoszenia sprzedaży (rynek wtórny) do porównań: {id, obszar (miejscowość OFERTY), miejscowosc (gdzie jest ogłoszenie), lokalizacja, cena, m2, cena_m2, pokoje, rynek, zrodlo, url, pobrano}.
- `data/koszty_stawki.json` – stałe opłaty (PCC 2%, wpis KW 200 zł, opróżnienie lokalu 1500 zł, PIT 19%, VAT 23%, świadectwo 700 zł). Nie zmieniaj bez potrzeby.

## Aktualizacja danych (robi to automat; ręcznie tylko na prośbę Gabriela)
Źródła ofert (oficjalny licytacje.komornik.pl / elicytacje.komornik.pl blokują automatyczny odczyt – NIE obchodź tego; tak samo blokad otodom/olx/banków – pomiń):
1. https://listaprzetargow.pl/oferty/mieszkania/malopolskie/cena-do-200 – wszystkie oferty przed sekcją "Zakończone". Rodzaj z URL oferty ("licytacja-komornicza"/"syndyk"/"przetarg"). Data na karcie = termin wadium/rękojmi (termin_wadium). Dla nowych ofert niekomorniczych sprawdź na stronie oferty, czy to na pewno Małopolska.
2. Adradar, nie-ARCHIWALNE, cena ≤ 200 000 zł: https://przetargi.adradar.pl/p/mieszkania/27529/ma%C5%82opolskie/ + licytacje_komornicze | zakup_od_syndyka | miasto | spoldzielnia_mieszkaniowa | spolka_skarbu_panstwa. "Termin" = data licytacji/przetargu. Dla komorniczych: "pierwsza"/"druga"; "w trybie elektronicznym" → e-licytacja.
3. Ogłoszenia i banki: https://www.domiporta.pl/mieszkanie/sprzedam/malopolskie?Price.To=200000 (wszystkie strony); otwórz nowe ogłoszenia (forma własności, rynek, czy sprzedaje syndyk/komornik/bank). Pomijaj rynek pierwotny, lokale użytkowe, ogłoszenia bez ceny. Mikrolokale jako „udział we współwłasności” to udziały – pomijaj. Banki: https://www.pekao.com.pl/nieruchomosci/lista-nieruchomosci/oferta.html
Połącz duplikaty (miejscowość + cena ±1 zł + podobny metraż). Zachowuj stare id i `dodano`; `sprawdzono` = dziś. Usuń zakończone i wszystkie udziały.

Ceny rynkowe dla nowych miejscowości:
- Ofertowa: https://realadvisor.pl/pl/ceny-mieszkan/powiat-<slug> – wartość "mieszkanie" dla gminy (raz w miesiącu odśwież wszystkie).
- Transakcyjna: GUS BDL, zmienna 633687 (mediana zł/m², rynek wtórny, ogółem), powiaty: https://bdl.stat.gov.pl/api/v1/data/by-variable/633687?unit-level=5&unit-parent-id=011200000000&year=<rok>&format=json
- Historia: https://bdl.stat.gov.pl/api/v1/data/by-unit/<id-powiatu>?var-id=633687&format=json oraz var-id=633627 (liczba transakcji). 10 ostatnich lat; nowy rok GUS → dopisz, najstarszy usuń.

Ogłoszenia (pełne odświeżenie w poniedziałki, w inne dni tylko nowe miejscowości):
- https://<miejscowosc>.nieruchomosci-online.pl/mieszkania/ oraz https://www.domiporta.pl/mieszkanie/sprzedam/malopolskie/<miejscowosc>
- Tylko sprzedaż z tej miejscowości, bez archiwalnych i sekcji "w promieniu X km". Pomijaj rynek pierwotny ("nowe-mieszkanie", "/nowe/", "deweloperski", serie inwestycji o równych cenach za m²). Usuń duplikaty między serwisami.
- Gdy w miejscowości brak ogłoszeń, weź najbliższe miasto z gminy/powiatu (Osieczany → Myślenice, Tymbark → Limanowa).

Po ręcznej aktualizacji: sprawdź, że JSON jest poprawny, commit "Aktualizacja danych RRRR-MM-DD" i push na `main` (GitHub Pages odświeży się sam).

## Zasady
- Nie publikuj nic, co podszywa się pod portal komorników; linkuj do źródeł.
- Liczby na stronie tylko z `data/` – nic nie wpisuj na sztywno w HTML.
- Strona to narzędzie do wstępnej selekcji, nie porada prawna/podatkowa – zostaw stopkę z zastrzeżeniem.
