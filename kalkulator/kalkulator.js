/*!
 * Kalkulator inwestycji w mieszkanie (flip / najem / wzrost wartości)
 * Moduł do dashboardu licytacje-malopolska. Bez zależności, czysty JS.
 *
 * Użycie:
 *   KalkulatorMieszkania.open({ id, tytul, link, cena, metraz, cenaRynkowaM2, czynszNajmuM2 })
 *   KalkulatorMieszkania.attachButtons()   // podpina przyciski z atrybutami data-kalk-*
 *   KalkulatorMieszkania.compute(params)   // same obliczenia, bez UI (np. do kolumny w tabeli)
 *   KalkulatorMieszkania.preset('bazowy', oferta)  // parametry wariantu dla danej oferty
 *
 * Formuły odpowiadają arkuszowi „Kalkulator inwestycji – Oświęcim, Nojego 10/45”.
 * Wszystkie kwoty to szacunki — w UI każdą da się nadpisać.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* KONFIGURACJA — domyślne założenia (zmieniaj tutaj, nie w kodzie)    */
  /* ------------------------------------------------------------------ */
  var CONFIG = {
    // Gdy oferta nie podaje rynkowej ceny za m² (po remoncie, normalny stan)
    domyslnaCenaRynkowaM2: 6500,      // Oświęcim, 2 pok. ok. 38 m²: 6 200–6 800 zł/m²
    // Gdy oferta nie podaje czynszu najmu za m²
    domyslnyCzynszNajmuM2: 44,        // ok. 1 700 zł za 38,8 m²
    pitProc: 0.19,                    // PIT od sprzedaży przed upływem 5 lat
    latBezPit: 5,
    miesiaceRemontuPrzyNajmie: 3,

    warianty: {
      pesymistyczny: {
        etykieta: 'Pesymistyczny',
        cenaZakupuMnoznik: 1.045,     // oferta vs cena wywoławcza
        wypisy: 300, oplatySadowe: 300, pccProc: 0.02,
        robociznaM2: 1289, materialyM2: 1160, rezerwaProc: 0.15,
        miesiace: 9, oplatyM2: 15.5, mediaMies: 200,
        sprzedazMnoznik: 0.80,        // cena sprzedaży/m² względem ceny rynkowej
        prowizjaProc: 0.0369, inneKosztySprzedazy: 1000,
        czynszMnoznik: 0.90, pusteMies: 2, ryczaltProc: 0.085,
        ubezpieczenieRok: 300, naprawyRok: 1500, umeblowanie: 15000,
        wzrostProc: 0.02, lata: 5
      },
      bazowy: {
        etykieta: 'Bazowy',
        cenaZakupuMnoznik: 1.01,
        wypisy: 250, oplatySadowe: 300, pccProc: 0.02,
        robociznaM2: 1031, materialyM2: 825, rezerwaProc: 0.10,
        miesiace: 6, oplatyM2: 12.9, mediaMies: 150,
        sprzedazMnoznik: 0.88,
        prowizjaProc: 0.0246, inneKosztySprzedazy: 600,
        czynszMnoznik: 1.00, pusteMies: 1, ryczaltProc: 0.085,
        ubezpieczenieRok: 300, naprawyRok: 1200, umeblowanie: 12000,
        wzrostProc: 0.05, lata: 5
      },
      optymistyczny: {
        etykieta: 'Optymistyczny',
        cenaZakupuMnoznik: 1.00,
        wypisy: 200, oplatySadowe: 300, pccProc: 0,
        robociznaM2: 773, materialyM2: 567, rezerwaProc: 0.05,
        miesiace: 4, oplatyM2: 11.6, mediaMies: 100,
        sprzedazMnoznik: 0.95,
        prowizjaProc: 0, inneKosztySprzedazy: 400,
        czynszMnoznik: 1.10, pusteMies: 0.5, ryczaltProc: 0.085,
        ubezpieczenieRok: 300, naprawyRok: 900, umeblowanie: 10000,
        wzrostProc: 0.08, lata: 5
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* OBLICZENIA                                                          */
  /* ------------------------------------------------------------------ */

  // Maksymalna taksa notarialna netto (rozporządzenie MS, § 3) + 23% VAT
  function taksaNotarialnaBrutto(wartosc) {
    var w = Math.max(0, Number(wartosc) || 0), netto;
    if (w <= 3000) netto = 100;
    else if (w <= 10000) netto = 100 + 0.03 * (w - 3000);
    else if (w <= 30000) netto = 310 + 0.02 * (w - 10000);
    else if (w <= 60000) netto = 710 + 0.01 * (w - 30000);
    else if (w <= 1000000) netto = 1010 + 0.004 * (w - 60000);
    else if (w <= 2000000) netto = 4770 + 0.002 * (w - 1000000);
    else netto = Math.min(6770 + 0.0025 * (w - 2000000), 10000);
    return Math.round(netto * 1.23);
  }

  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }

  /**
   * params: cenaZakupu, metraz, wypisy, oplatySadowe, pccProc, robocizna, materialy,
   *   rezerwaProc, miesiace, oplatyMies, mediaMies, cenaSprzedazyM2, prowizjaProc,
   *   inneKosztySprzedazy, czynsz, pusteMies, ryczaltProc, ubezpieczenieRok,
   *   naprawyRok, umeblowanie, wzrostProc, lata
   *   (opcjonalnie) taksa — własna taksa notarialna zamiast maksymalnej
   */
  function compute(p) {
    var r = {};
    var cena = n(p.cenaZakupu);
    r.taksa = (p.taksa !== undefined && p.taksa !== null && p.taksa !== '') ? n(p.taksa) : taksaNotarialnaBrutto(cena);
    r.pcc = cena * n(p.pccProc);
    r.zakup = cena + r.taksa + n(p.wypisy) + n(p.oplatySadowe) + r.pcc;

    r.rezerwa = (n(p.robocizna) + n(p.materialy)) * n(p.rezerwaProc);
    r.remont = n(p.robocizna) + n(p.materialy) + r.rezerwa;

    r.utrzymanie = n(p.miesiace) * (n(p.oplatyMies) + n(p.mediaMies));

    r.cenaSprzedazy = n(p.cenaSprzedazyM2) * n(p.metraz);
    r.prowizja = r.cenaSprzedazy * n(p.prowizjaProc);
    r.kosztySprzedazy = r.prowizja + n(p.inneKosztySprzedazy);

    r.wszystkieKoszty = r.zakup + r.remont + r.utrzymanie + r.kosztySprzedazy;
    r.zyskPrzedPodatkiem = r.cenaSprzedazy - r.wszystkieKoszty;
    // PIT: przychód − koszty zbycia − koszty nabycia − nakłady (opłaty bieżące się nie odliczają)
    r.pit = Math.round(Math.max(r.cenaSprzedazy - r.kosztySprzedazy - r.zakup - r.remont, 0) * CONFIG.pitProc);
    r.zyskNetto = r.zyskPrzedPodatkiem - r.pit;
    r.gotowka = r.zakup + r.remont + r.utrzymanie;
    r.roi = r.gotowka ? r.zyskNetto / r.gotowka : 0;
    r.roiRok = n(p.miesiace) ? r.roi * 12 / n(p.miesiace) : 0;
    r.progNaZero = (r.zakup + r.remont + r.utrzymanie + n(p.inneKosztySprzedazy)) / (1 - n(p.prowizjaProc));

    // Najem
    r.przychodNajmu = n(p.czynsz) * (12 - n(p.pusteMies));
    r.ryczalt = Math.round(r.przychodNajmu * n(p.ryczaltProc));
    r.oplatyPuste = n(p.pusteMies) * n(p.oplatyMies);
    r.dochodNajmu = r.przychodNajmu - r.ryczalt - n(p.ubezpieczenieRok) - n(p.naprawyRok) - r.oplatyPuste;
    r.inwestycjaNajem = r.zakup + r.remont + CONFIG.miesiaceRemontuPrzyNajmie * (n(p.oplatyMies) + n(p.mediaMies)) + n(p.umeblowanie);
    r.rentownoscNajmu = r.inwestycjaNajem ? r.dochodNajmu / r.inwestycjaNajem : 0;
    r.lataZwrotu = r.dochodNajmu > 0 ? r.inwestycjaNajem / r.dochodNajmu : Infinity;

    // Wzrost wartości (trzymasz i wynajmujesz)
    var lata = n(p.lata);
    r.wartoscPoLatach = r.cenaSprzedazy * Math.pow(1 + n(p.wzrostProc), lata);
    r.wzrostWartosci = r.wartoscPoLatach - r.cenaSprzedazy;
    var netSprzedaz = r.wartoscPoLatach * (1 - n(p.prowizjaProc)) - n(p.inneKosztySprzedazy);
    var pitPoLatach = lata < CONFIG.latBezPit ? Math.round(Math.max(netSprzedaz - r.zakup - r.remont, 0) * CONFIG.pitProc) : 0;
    r.zyskSprzedazPoLatach = netSprzedaz - r.zakup - r.remont - r.utrzymanie - pitPoLatach;
    r.najemPrzezLata = r.dochodNajmu * lata;
    r.razemPoLatach = r.zyskSprzedazPoLatach + r.najemPrzezLata;
    r.sredniRocznyZysk = lata ? r.razemPoLatach / lata : 0;
    return r;
  }

  function zaokr(v, krok) { return Math.round(v / krok) * krok; }

  /** Parametry wariantu dla konkretnej oferty (cena, metraż, cena rynkowa/m², czynsz/m²) */
  function preset(nazwa, oferta) {
    var w = CONFIG.warianty[nazwa];
    if (!w) throw new Error('Nieznany wariant: ' + nazwa);
    var m = n(oferta.metraz) || 40;
    var rynek = n(oferta.cenaRynkowaM2) || CONFIG.domyslnaCenaRynkowaM2;
    var czynszM2 = n(oferta.czynszNajmuM2) || CONFIG.domyslnyCzynszNajmuM2;
    var out = {
      cenaZakupu: zaokr(n(oferta.cena) * w.cenaZakupuMnoznik, 100),
      metraz: m,
      wypisy: w.wypisy, oplatySadowe: w.oplatySadowe, pccProc: w.pccProc,
      robocizna: zaokr(w.robociznaM2 * m, 500),
      materialy: zaokr(w.materialyM2 * m, 500),
      rezerwaProc: w.rezerwaProc,
      miesiace: w.miesiace,
      oplatyMies: zaokr(w.oplatyM2 * m, 10),
      mediaMies: w.mediaMies,
      cenaSprzedazyM2: zaokr(rynek * w.sprzedazMnoznik, 50),
      prowizjaProc: w.prowizjaProc,
      inneKosztySprzedazy: w.inneKosztySprzedazy,
      czynsz: zaokr(czynszM2 * m * w.czynszMnoznik, 50),
      pusteMies: w.pusteMies, ryczaltProc: w.ryczaltProc,
      ubezpieczenieRok: w.ubezpieczenieRok, naprawyRok: w.naprawyRok, umeblowanie: w.umeblowanie,
      wzrostProc: w.wzrostProc, lata: w.lata
    };
    // Licytacja komornicza: brak PCC i aktu notarialnego (jest postanowienie o przysądzeniu własności),
    // więc taksa i wypisy = 0; wpis do KW zostaje (oplatySadowe).
    if (oferta.rodzaj === 'komornicza') { out.pccProc = 0; out.taksa = 0; out.wypisy = 0; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */
  var PL = typeof Intl !== 'undefined' ? new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }) : null;
  function zl(v) {
    if (!isFinite(v)) return '—';
    return (PL ? PL.format(Math.round(v)) : String(Math.round(v))) + ' zł';
  }
  function pr(v) {
    if (!isFinite(v)) return '—';
    return (v * 100).toFixed(1).replace('.', ',') + '%';
  }
  function liczba(v, d) {
    if (!isFinite(v)) return '—';
    return v.toFixed(d || 1).replace('.', ',');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Pola formularza: [klucz, etykieta, typ ('zl' | 'proc' | 'num'), podpowiedź]
  var SEKCJE = [
    ['Zakup', [
      ['cenaZakupu', 'Cena zakupu (Twoja oferta)', 'zl', 'Cena wywoławcza lub kwota, którą chcesz zaproponować'],
      ['metraz', 'Powierzchnia (m²)', 'num', ''],
      ['taksa', 'Taksa notarialna brutto', 'zl', 'Puste = maksymalna taksa liczona automatycznie; da się negocjować'],
      ['wypisy', 'Wypisy aktu', 'zl', '6 zł + VAT za stronę'],
      ['oplatySadowe', 'Opłaty sądowe (KW)', 'zl', 'Założenie KW 100 zł + wpis własności 200 zł'],
      ['pccProc', 'PCC', 'proc', '2% na rynku wtórnym; 0% gdy sprzedaż z VAT. Licytacja komornicza: PCC nie ma']
    ]],
    ['Remont', [
      ['robocizna', 'Robocizna', 'zl', 'Jedną łączną kwotę za remont wpisz tutaj, a materiały ustaw na 0'],
      ['materialy', 'Materiały', 'zl', ''],
      ['rezerwaProc', 'Rezerwa na niespodzianki', 'proc', '10–15% przy starym budynku lub ostatnim piętrze']
    ]],
    ['Utrzymanie do sprzedaży', [
      ['miesiace', 'Miesiące od zakupu do sprzedaży', 'num', 'Remont 2–3 mies. + sprzedaż'],
      ['oplatyMies', 'Czynsz administracyjny / mies.', 'zl', 'Sprawdź u zarządcy lub w spółdzielni'],
      ['mediaMies', 'Media / mies.', 'zl', '']
    ]],
    ['Sprzedaż', [
      ['cenaSprzedazyM2', 'Cena sprzedaży za m²', 'zl', 'Po remoncie; porównaj z ofertami w okolicy'],
      ['prowizjaProc', 'Prowizja pośrednika (z VAT)', 'proc', '0% przy sprzedaży samodzielnej'],
      ['inneKosztySprzedazy', 'Inne koszty sprzedaży', 'zl', 'Świadectwo energetyczne, zaświadczenia, zdjęcia']
    ]],
    ['Najem', [
      ['czynsz', 'Czynsz najmu / mies.', 'zl', ''],
      ['pusteMies', 'Miesiące bez najemcy w roku', 'num', ''],
      ['ryczaltProc', 'Ryczałt od najmu', 'proc', '8,5% do 100 tys. zł przychodu rocznie'],
      ['ubezpieczenieRok', 'Ubezpieczenie / rok', 'zl', ''],
      ['naprawyRok', 'Naprawy i rezerwa / rok', 'zl', ''],
      ['umeblowanie', 'Umeblowanie i AGD', 'zl', '']
    ]],
    ['Wzrost wartości', [
      ['wzrostProc', 'Roczny wzrost cen', 'proc', 'Nie zakładaj, że ostatni wzrost powtórzy się co roku'],
      ['lata', 'Ile lat trzymasz mieszkanie', 'num', 'Od 5 lat (od końca roku zakupu) sprzedaż bez PIT']
    ]]
  ];

  // Wiersze tabeli wyników: [klucz wyniku, etykieta, format, wyróżnienie]
  var WYNIKI = [
    ['Flip: kup, wyremontuj, sprzedaj'],
    ['zakup', 'Razem zakup', 'zl'],
    ['remont', 'Razem remont', 'zl'],
    ['utrzymanie', 'Utrzymanie', 'zl'],
    ['cenaSprzedazy', 'Cena sprzedaży', 'zl'],
    ['kosztySprzedazy', 'Koszty sprzedaży', 'zl'],
    ['pit', 'PIT 19%', 'zl'],
    ['zyskNetto', 'Zysk na czysto', 'zl', true],
    ['gotowka', 'Zamrożona gotówka', 'zl'],
    ['roi', 'Zwrot z inwestycji', 'proc'],
    ['roiRok', 'Zwrot w skali roku', 'proc'],
    ['progNaZero', 'Próg: sprzedaż „na zero”', 'zl'],
    ['Najem'],
    ['dochodNajmu', 'Dochód netto / rok', 'zl', true],
    ['inwestycjaNajem', 'Całkowita inwestycja', 'zl'],
    ['rentownoscNajmu', 'Rentowność netto / rok', 'proc'],
    ['lataZwrotu', 'Lata zwrotu', 'lata'],
    ['Trzymasz i wynajmujesz'],
    ['wartoscPoLatach', 'Wartość po X latach', 'zl'],
    ['zyskSprzedazPoLatach', 'Zysk ze sprzedaży po X latach', 'zl'],
    ['najemPrzezLata', '+ najem przez X lat', 'zl'],
    ['razemPoLatach', 'Razem zysk', 'zl', true],
    ['sredniRocznyZysk', 'Średni roczny zysk', 'zl']
  ];

  var dialog, stan = null;

  function fmt(v, typ) {
    if (typ === 'zl') return zl(v);
    if (typ === 'proc') return pr(v);
    if (typ === 'lata') return liczba(v, 1);
    return String(v);
  }

  function klucz(id) { return 'kalkulator-mieszkania:' + (id || 'bez-id'); }
  function wczytaj(id) {
    try { var s = root.localStorage && root.localStorage.getItem(klucz(id)); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function zapisz(id, dane) {
    try { root.localStorage && root.localStorage.setItem(klucz(id), JSON.stringify(dane)); } catch (e) { /* brak storage */ }
  }
  function usun(id) {
    try { root.localStorage && root.localStorage.removeItem(klucz(id)); } catch (e) { /* brak storage */ }
  }

  function zbudujDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'kalk';
    dialog.setAttribute('aria-labelledby', 'kalk-tytul');
    dialog.innerHTML =
      '<div class="kalk__naglowek">' +
        '<div><h2 id="kalk-tytul" class="kalk__tytul"></h2><div class="kalk__podtytul"></div></div>' +
        '<button type="button" class="kalk__zamknij" aria-label="Zamknij">×</button>' +
      '</div>' +
      '<div class="kalk__presety"><span>Wczytaj do Twojego wariantu:</span>' +
        '<button type="button" data-preset="pesymistyczny">Pesymistyczny</button>' +
        '<button type="button" data-preset="bazowy">Bazowy</button>' +
        '<button type="button" data-preset="optymistyczny">Optymistyczny</button>' +
        '<button type="button" class="kalk__reset" data-reset>Wyczyść zapisane</button>' +
      '</div>' +
      '<div class="kalk__uklad">' +
        '<form class="kalk__formularz" novalidate></form>' +
        '<div class="kalk__wyniki"></div>' +
      '</div>' +
      '<p class="kalk__stopka">Szacunki, nie porada finansowa. Kwoty notarialne to stawki maksymalne; PCC, opłaty i ceny sprawdź dla konkretnej oferty.</p>';
    document.body.appendChild(dialog);

    dialog.querySelector('.kalk__zamknij').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.querySelector('.kalk__presety').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !stan) return;
      if (b.hasAttribute('data-reset')) {
        usun(stan.oferta.id);
        stan.wlasny = preset('bazowy', stan.oferta);
      } else {
        stan.wlasny = preset(b.getAttribute('data-preset'), stan.oferta);
      }
      wypelnijFormularz();
      przelicz();
    });
    dialog.querySelector('.kalk__formularz').addEventListener('input', function (e) {
      if (!stan || !e.target.name) return;
      var pole = e.target, typ = pole.getAttribute('data-typ');
      var raw = pole.value.replace(/\s/g, '').replace(',', '.');
      if (pole.name === 'taksa' && raw === '') { delete stan.wlasny.taksa; }
      else {
        var v = Number(raw);
        if (!isFinite(v)) return;
        stan.wlasny[pole.name] = typ === 'proc' ? v / 100 : v;
      }
      zapisz(stan.oferta.id, stan.wlasny);
      przelicz();
    });
    return dialog;
  }

  function wypelnijFormularz() {
    var html = '';
    SEKCJE.forEach(function (sekcja) {
      html += '<fieldset><legend>' + esc(sekcja[0]) + '</legend>';
      sekcja[1].forEach(function (pole) {
        var k = pole[0], typ = pole[2], v = stan.wlasny[k];
        var wartosc = (v === undefined || v === null) ? '' : (typ === 'proc' ? +(v * 100).toFixed(2) : v);
        var placeholder = k === 'taksa' ? 'auto: ' + zl(taksaNotarialnaBrutto(stan.wlasny.cenaZakupu)) : '';
        html += '<label class="kalk__pole"><span>' + esc(pole[1]) + (typ === 'proc' ? ' (%)' : typ === 'zl' ? ' (zł)' : '') + '</span>' +
          '<input name="' + k + '" data-typ="' + typ + '" inputmode="decimal" value="' + esc(wartosc) + '" placeholder="' + esc(placeholder) + '">' +
          (pole[3] ? '<small>' + esc(pole[3]) + '</small>' : '') + '</label>';
      });
      html += '</fieldset>';
    });
    dialog.querySelector('.kalk__formularz').innerHTML = html;
  }

  function przelicz() {
    var kolumny = [
      { nazwa: 'Pesymistyczny', p: preset('pesymistyczny', stan.oferta) },
      { nazwa: 'Bazowy', p: preset('bazowy', stan.oferta) },
      { nazwa: 'Optymistyczny', p: preset('optymistyczny', stan.oferta) },
      { nazwa: 'Twój wariant', p: stan.wlasny, twoj: true }
    ];
    kolumny.forEach(function (k) { k.r = compute(k.p); });

    var html = '<table class="kalk__tabela"><thead><tr><th scope="col">Wynik</th>';
    kolumny.forEach(function (k) { html += '<th scope="col"' + (k.twoj ? ' class="kalk__twoj"' : '') + '>' + esc(k.nazwa) + '</th>'; });
    html += '</tr></thead><tbody>';
    WYNIKI.forEach(function (w) {
      if (w.length === 1) { html += '<tr class="kalk__sekcja"><th colspan="5" scope="rowgroup">' + esc(w[0]) + '</th></tr>'; return; }
      html += '<tr' + (w[3] ? ' class="kalk__wyroznij"' : '') + '><th scope="row">' + esc(w[1]) + '</th>';
      kolumny.forEach(function (k) {
        var v = k.r[w[0]];
        var klasa = (k.twoj ? 'kalk__twoj ' : '') + (w[3] && v < 0 ? 'kalk__minus' : '');
        html += '<td class="' + klasa + '">' + fmt(v, w[2]) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    var srednia3 = (kolumny[0].r.zyskNetto + kolumny[1].r.zyskNetto + kolumny[2].r.zyskNetto) / 3;
    var srednia4 = (srednia3 * 3 + kolumny[3].r.zyskNetto) / 4;
    var sredniRok = (kolumny[0].r.roiRok + kolumny[1].r.roiRok + kolumny[2].r.roiRok) / 3;
    html += '<div class="kalk__srednie">' +
      '<div><span>Średni zysk z flipa (3 warianty)</span><strong>' + zl(srednia3) + '</strong></div>' +
      '<div><span>Średni zysk z flipa (z Twoim)</span><strong>' + zl(srednia4) + '</strong></div>' +
      '<div><span>Średni zwrot w skali roku</span><strong>' + pr(sredniRok) + '</strong></div>' +
      '</div>';
    dialog.querySelector('.kalk__wyniki').innerHTML = html;

    var taksaPole = dialog.querySelector('input[name="taksa"]');
    if (taksaPole) taksaPole.placeholder = 'auto: ' + zl(taksaNotarialnaBrutto(stan.wlasny.cenaZakupu));
  }

  /**
   * oferta: { id, tytul, link, cena, metraz, cenaRynkowaM2?, czynszNajmuM2?, opis? }
   */
  function open(oferta) {
    if (!oferta || !n(oferta.cena)) throw new Error('KalkulatorMieszkania.open: brak ceny oferty');
    zbudujDialog();
    var zapisany = wczytaj(oferta.id);
    stan = { oferta: oferta, wlasny: zapisany || preset('bazowy', oferta) };
    dialog.querySelector('.kalk__tytul').textContent = oferta.tytul || 'Kalkulator inwestycji';
    var pod = [zl(n(oferta.cena)) + ' (cena wywoławcza)', liczba(n(oferta.metraz), 1) + ' m²'];
    if (oferta.metraz) pod.push(zl(n(oferta.cena) / n(oferta.metraz)) + '/m²');
    if (oferta.opis) pod.push(oferta.opis);
    dialog.querySelector('.kalk__podtytul').innerHTML = esc(pod.join(' · ')) +
      (oferta.link ? ' · <a href="' + esc(oferta.link) + '" target="_blank" rel="noopener">ogłoszenie</a>' : '');
    wypelnijFormularz();
    przelicz();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  /** Podpina przyciski: <button data-kalk-cena="110000" data-kalk-metraz="38.8" data-kalk-id="..." ...> */
  function attachButtons(rootEl) {
    (rootEl || document).addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-kalk-cena]');
      if (!b) return;
      e.preventDefault();
      var d = b.dataset;
      open({
        id: d.kalkId, tytul: d.kalkTytul, link: d.kalkLink,
        cena: Number(d.kalkCena), metraz: Number(d.kalkMetraz),
        cenaRynkowaM2: d.kalkCenaRynkowaM2 ? Number(d.kalkCenaRynkowaM2) : undefined,
        czynszNajmuM2: d.kalkCzynszNajmuM2 ? Number(d.kalkCzynszNajmuM2) : undefined
      });
    });
  }

  var api = {
    CONFIG: CONFIG,
    compute: compute,
    preset: preset,
    taksaNotarialnaBrutto: taksaNotarialnaBrutto,
    open: open,
    attachButtons: attachButtons
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KalkulatorMieszkania = api;
})(typeof window !== 'undefined' ? window : globalThis);
