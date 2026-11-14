# Kalkulator inwestycji w mieszkanie: instrukcja wdrożenia

Ten moduł dodaje do dashboardu `licytacje-malopolska` kalkulator dla każdej oferty. Liczy flipa (kup, wyremontuj, sprzedaj), najem i wzrost wartości mieszkania w czasie. Pokazuje trzy warianty (pesymistyczny, bazowy, optymistyczny) i edytowalny „Twój wariant”.

Formuły pochodzą 1:1 z arkusza „Kalkulator inwestycji – Oświęcim, Nojego 10/45”, który został przygotowany w Claude.

## Pliki

| Plik | Co robi |
|---|---|
| `kalkulator.js` | Logika i okno kalkulatora. Bez zależności, wystawia `window.KalkulatorMieszkania` |
| `kalkulator.css` | Style okna (prefiks `.kalk`), jasny i ciemny motyw |
| `demo.html` | Strona testowa z dwiema przykładowymi ofertami. Otwórz lokalnie w przeglądarce |
| `KALKULATOR.md` | Ta instrukcja |

## Zadanie dla Claude Code

1. Skopiuj `kalkulator.js` i `kalkulator.css` do repo, np. do `assets/kalkulator/` albo tam, gdzie leżą inne skrypty strony.
2. Dołącz oba pliki na stronie dashboardu:
   ```html
   <link rel="stylesheet" href="assets/kalkulator/kalkulator.css">
   <script src="assets/kalkulator/kalkulator.js"></script>
   ```
3. Przy każdej ofercie (wierszu tabeli albo karcie) dodaj przycisk „Kalkulator”. Wartości weź z danych oferty, z pliku JSON/CSV, który generuje codzienne zadanie:
   ```html
   <button class="kalk-przycisk"
     data-kalk-id="{unikalne id oferty}"
     data-kalk-tytul="{miasto, ulica – metraż}"
     data-kalk-link="{link do ogłoszenia}"
     data-kalk-cena="{cena wywoławcza w zł, liczba}"
     data-kalk-metraz="{powierzchnia w m², liczba z kropką}"
     data-kalk-cena-rynkowa-m2="{opcjonalnie: cena rynkowa/m² po remoncie}"
     data-kalk-czynsz-najmu-m2="{opcjonalnie: czynsz najmu zł/m²}">Kalkulator</button>
   ```
   Jeśli tabela jest renderowana w JS, zamiast atrybutów możesz wywołać bezpośrednio:
   ```js
   KalkulatorMieszkania.open({ id, tytul, link, cena, metraz, cenaRynkowaM2, czynszNajmuM2 });
   ```
4. Raz po załadowaniu strony wywołaj `KalkulatorMieszkania.attachButtons();`. Kliknięcia są delegowane, więc działa to też dla wierszy dodanych później.
5. Opcjonalnie dodaj sortowalną kolumnę „Zysk (bazowy)” liczoną bez otwierania okna:
   ```js
   const p = KalkulatorMieszkania.preset('bazowy', { cena, metraz, cenaRynkowaM2 });
   const r = KalkulatorMieszkania.compute(p);
   r.zyskNetto;        // zysk na czysto z flipa
   r.rentownoscNajmu;  // rentowność najmu netto / rok
   ```
6. Nie zmieniaj formuł w `compute()`. Założenia (stawki remontu za m², mnożniki cen, prowizje) zmienia się w obiekcie `CONFIG` na początku `kalkulator.js`.
7. Jeśli oferta nie ma ceny albo metrażu, nie pokazuj przycisku (`open()` bez ceny rzuca błąd).

### Cena rynkowa za m²

Bez `cenaRynkowaM2` kalkulator przyjmuje 6 500 zł/m² (Oświęcim). Dla innych miast wynik będzie wtedy zły. Najlepiej, żeby codzienne zadanie zapisywało przy ofercie średnią cenę ofertową za m² z danego miasta albo dzielnicy. Wariant pesymistyczny liczy sprzedaż po 80% tej ceny, bazowy po 88%, optymistyczny po 95%. To dyskonto za stan i niepewność.

## Co zapamiętuje

Zmiany w „Twoim wariancie” zapisują się w `localStorage` przeglądarki pod kluczem `kalkulator-mieszkania:{id}`. Są widoczne tylko w tej przeglądarce. Przycisk „Wyczyść zapisane” przywraca wariant bazowy. Dlatego `data-kalk-id` musi być stałe dla oferty, np. numer z serwisu.

## Formuły

- **Taksa notarialna:** stawka maksymalna według progów z rozporządzenia (60 tys.–1 mln zł: 1 010 zł + 0,4% nadwyżki ponad 60 tys.) + 23% VAT. Pole „Taksa” można nadpisać.
- **Zakup** = cena + taksa + wypisy + opłaty sądowe (KW 100 zł + wpis 200 zł) + PCC.
- **Remont** = robocizna + materiały + rezerwa %.
- **Utrzymanie** = miesiące × (czynsz administracyjny + media).
- **PIT 19%** = (cena sprzedaży − koszty sprzedaży − zakup − remont) × 19%. Bieżące opłaty się nie odliczają. Remont odlicza się tylko na podstawie faktur.
- **Zysk na czysto** = cena sprzedaży − wszystkie koszty − PIT.
- **Najem:** dochód = czynsz × (12 − puste miesiące) − ryczałt 8,5% − ubezpieczenie − naprawy − czynsz administracyjny w pustych miesiącach. Inwestycja = zakup + remont + 3 miesiące opłat + umeblowanie.
- **Wzrost wartości:** wartość = cena sprzedaży × (1 + wzrost)^lata. PIT liczony tylko, gdy lata < 5. Do wyniku doliczany jest najem za te lata.

## Na co uważać przy licytacjach

- **Licytacja komornicza:** od nabycia nie płaci się PCC, więc w Twoim wariancie ustaw PCC na 0%. Zamiast aktu notarialnego jest postanowienie sądu o przysądzeniu własności. Taksę i wypisy też ustaw na 0, a wpis do KW zostaw.
- **Sprzedaż przez syndyka, gminę lub spółdzielnię:** zwykle akt notarialny i PCC 2%, chyba że sprzedaż jest z VAT.
- Wszystkie kwoty to szacunki z listopada 2026, nie porada finansowa.

## Źródła założeń

- Koszty remontu 2026: kb.pl, totalmoney.pl, cenauslug.pl
- Koszty notarialne i opłaty sądowe 2026: money.pl, rynekpierwotny.pl, pewnylokal.pl
- Ceny mieszkań i najmu w Oświęcimiu: otodom.pl, tabelaofert.pl, finwire.pl
