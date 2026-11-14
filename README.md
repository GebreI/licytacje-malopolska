# Mieszkania do 200 tys. zł – Małopolska

Strona z mieszkaniami do 200 000 zł w województwie małopolskim – licytacje komornicze, sprzedaż od syndyka, przetargi, oferty banków i zwykłe ogłoszenia.
Każda oferta ma ocenę, szacowany zysk z kupna, remontu i sprzedaży, maksymalną cenę do zapłaty, porównanie z rynkiem i listę kroków dla początkujących.

Strona: https://gebrei.github.io/licytacje-malopolska/

## Pliki
- `index.html` – układ strony i style (zakładki: Start, Oferty, Na tle rynku, Kalkulator, Poradnik)
- `app.js` – wczytanie danych, oceny ofert, karta oferty, wykresy
- `kalkulator/` – kalkulator inwestycji (flip, najem, wzrost wartości); jego wzorami liczone są wszystkie zyski na stronie
- `slownik.js` – wyjaśnienia podkreślonych pojęć
- `data/*.json` – dane, aktualizowane automatycznie codziennie rano (instrukcja automatu: `AUTOMAT.md`)
- `CLAUDE.md` – opis projektu i zasady dla Claude Code

Podgląd lokalny: `python3 -m http.server 8000` w folderze repo, potem http://localhost:8000.

Narzędzie do wstępnej selekcji – nie jest poradą prawną, podatkową ani inwestycyjną.
