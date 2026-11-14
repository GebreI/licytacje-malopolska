# Kalkulator inwestycji w mieszkanie

Moduł liczy każdą ofertę na stronie `licytacje-malopolska`. Liczy flipa (kup, wyremontuj, sprzedaj), najem i wzrost wartości mieszkania w czasie. Pokazuje trzy warianty (pesymistyczny, bazowy, optymistyczny) i edytowalny „Twój wariant”.

Formuły pochodzą 1:1 z arkusza „Kalkulator inwestycji – Oświęcim, Nojego 10/45”, który został przygotowany w Claude.

## Pliki

| Plik | Co robi |
|---|---|
| `kalkulator.js` | Logika i okno kalkulatora. Bez zależności, wystawia `window.KalkulatorMieszkania` |
| `kalkulator.css` | Style okna (prefiks `.kalk`), jasny i ciemny motyw |
| `KALKULATOR.md` | Ta instrukcja |

## Jak jest podłączony do strony

- To jedyny kalkulator na stronie. `app.js` (`flip`, `maksCena`) liczy ocenę, szacowany zysk, maksymalną cenę i wykresy zakładki „Kalkulator” wzorem `KalkulatorMieszkania.compute(KalkulatorMieszkania.preset(wariant, oferta))`.
- W zakładce „Kalkulator” wybiera się wariant (pesymistyczny/bazowy/optymistyczny), źródło ceny rynkowej i docelowy zwrot.
- Okno otwiera przycisk „Kalkulator tego mieszkania” w karcie oferty i „Zmień założenia tego mieszkania” w zakładce. Gdy dla mieszkania zapisano „Twój wariant”, cała strona liczy je tym wariantem (✎).
- Bez ceny lub metrażu oferty kalkulatora nie pokazujemy (`open()` bez ceny rzuca błąd).
- Nie zmieniaj formuł w `compute()`. Założenia (stawki remontu za m², mnożniki cen, prowizje) zmienia się w obiekcie `CONFIG` na początku `kalkulator.js`. Po zmianie podbij `?v=` w `index.html`.

### Cena rynkowa za m²

Strona podaje cenę rynkową z danych (domyślnie mediana podobnych ogłoszeń, a gdy brak – cena ofertowa w gminie). Oferta bez żadnej ceny rynkowej nie dostaje szacunku zysku; samo okno przyjmuje wtedy 6 500 zł/m² (Oświęcim) i trzeba wpisać własną cenę. Wariant pesymistyczny liczy sprzedaż po 80% tej ceny, bazowy po 88%, optymistyczny po 95%. To dyskonto za stan i niepewność.

## Co zapamiętuje

Zmiany w „Twoim wariancie” zapisują się w `localStorage` przeglądarki pod kluczem `kalkulator-mieszkania:{id}`. Są widoczne tylko w tej przeglądarce. Przycisk „Wyczyść zapisane” przywraca wariant bazowy. Klucz to `id` oferty z `data/licytacje.json`, więc musi być stałe.

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
