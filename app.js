// ===== Obliczenia z danych =====
// Porównanie z rynkiem: cena wywołania za m² (udział przeliczony na całe mieszkanie)
// wobec ceny ofertowej w gminie i transakcyjnej w powiecie.
const calcPorownanie = (licytacje, ceny_rynkowe) => licytacje.map((r) => {
  const rynek = ceny_rynkowe.find((c) => c.miejscowosc === r.miejscowosc) || {};
  const [a, b] = String(r.udzial || '1/1').split('/').map(Number);
  const czesc = a && b ? a / b : 1;
  const m2calosc = Number(r.cena) / czesc / Number(r.m2);
  const of = rynek.ofertowa_m2 == null ? null : Number(rynek.ofertowa_m2);
  const tr = rynek.transakcyjna_m2 == null || Number(rynek.transakcyjna_m2) === 0 ? null : Number(rynek.transakcyjna_m2);
  return {
    id: r.id,
    cena_m2_calosc: Math.round(m2calosc),
    rynek_ofertowa_m2: of,
    rynek_transakcyjna_m2: tr,
    vs_ofertowa_pct: of ? Math.round((m2calosc / of - 1) * 100) : null,
    vs_transakcyjna_pct: tr ? Math.round((m2calosc / tr - 1) * 100) : null,
    wartosc_rynkowa_ofertowa: of ? Math.round(of * Number(r.m2) * czesc) : null,
  };
});

// Podsumowanie ofert: liczba ofert, najtańsze całe mieszkanie, najniższa cena za m²,
// najbliższa licytacja i mediana różnicy do cen ofertowych.
const calcPodsumowanie = (licytacje, porownanie) => {
  const cale = licytacje.filter((r) => r.typ === 'Całe mieszkanie');
  const daty = licytacje.map((r) => r.termin).filter(Boolean).sort();
  const roznice = porownanie.filter((p) => p.vs_ofertowa_pct != null && cale.some((r) => r.id === p.id)).map((p) => p.vs_ofertowa_pct).sort((x, y) => x - y);
  const mid = Math.floor(roznice.length / 2);
  return [
    { metryka: 'liczba', wartosc: licytacje.length },
    { metryka: 'min_cena_cale', wartosc: cale.length ? Math.min(...cale.map((r) => Number(r.cena))) : null },
    { metryka: 'min_m2_cale', wartosc: cale.length ? Math.min(...cale.map((r) => Number(r.cena_m2))) : null },
    { metryka: 'najblizszy', wartosc: daty.length ? daty[0] : null },
    { metryka: 'mediana_vs_ofertowa', wartosc: roznice.length ? (roznice.length % 2 ? roznice[mid] : Math.round((roznice[mid - 1] + roznice[mid]) / 2)) : null },
  ];
};

// Trend cen – 10 lat: dla każdego powiatu mediana ceny za m² w pierwszym i ostatnim roku, wzrost łączny,
// średni roczny, zmiana w ostatnim roku i wiarygodność wg liczby transakcji.
const calcTrendCen = (historia_cen) => [...new Set(historia_cen.map((r) => r.powiat))].map((powiat) => {
  const h = historia_cen.filter((r) => r.powiat === powiat).sort((a, b) => a.rok - b.rok);
  const first = h[0], last = h[h.length - 1], prev = h[h.length - 2];
  const lat = last.rok - first.rok;
  const n = h.map((r) => r.transakcje).filter((x) => x != null);
  const minN = n.length ? Math.min(...n) : null;
  return {
    powiat, obszar: last.obszar, rok_od: first.rok, rok_do: last.rok,
    cena_2015: Number(first.mediana_m2), cena_2024: Number(last.mediana_m2),
    wzrost_10l_pct: Math.round((last.mediana_m2 / first.mediana_m2 - 1) * 100),
    srednio_rocznie_pct: Math.round((Math.pow(last.mediana_m2 / first.mediana_m2, 1 / lat) - 1) * 1000) / 10,
    zmiana_rr_pct: prev ? Math.round((last.mediana_m2 / prev.mediana_m2 - 1) * 100) : null,
    transakcje_2024: last.transakcje == null ? null : Number(last.transakcje),
    wiarygodnosc: minN == null || minN < 30 || last.transakcje == null ? 'niska' : minN < 100 ? 'średnia' : 'wysoka',
  };
});

// Podobne ogłoszenia sprzedaży: dla każdej oferty ogłoszenia z rynku wtórnego z tej samej miejscowości
// o metrażu ±30% (gdy jest ich mniej niż 3 – wszystkie z miejscowości), ich mediana ceny za m²
// i różnica do ceny wywołania za m² za całość.
const calcPodobne = (licytacje, ogloszenia) => licytacje.map((r) => {
  const [a, b] = String(r.udzial || '1/1').split('/').map(Number);
  const czesc = a && b ? a / b : 1;
  const m2calosc = Number(r.cena) / czesc / Number(r.m2);
  const pula = ogloszenia.filter((o) => o.obszar === r.miejscowosc && o.rynek !== 'pierwotny' && o.id !== r.id && o.url !== r.url && o.url !== r.url2);
  let podobne = pula.filter((o) => Math.abs(Number(o.m2) / Number(r.m2) - 1) <= 0.3);
  let dopasowanie = 'metraż ±30%';
  if (podobne.length < 3) { podobne = pula; dopasowanie = pula.length ? 'cała miejscowość' : 'brak ogłoszeń'; }
  const ceny = podobne.map((o) => Number(o.cena_m2)).sort((x, y) => x - y);
  const s = Math.floor(ceny.length / 2);
  const mediana = ceny.length ? (ceny.length % 2 ? ceny[s] : Math.round((ceny[s - 1] + ceny[s]) / 2)) : null;
  const najblizsze = podobne.slice().sort((x, y) => Math.abs(x.m2 - r.m2) - Math.abs(y.m2 - r.m2)).slice(0, 5).map((o) => o.id);
  return {
    id: r.id,
    og_liczba: podobne.length,
    og_dopasowanie: dopasowanie,
    og_skad: [...new Set(podobne.map((o) => o.miejscowosc))].join(', '),
    og_mediana_m2: mediana,
    og_min_m2: ceny.length ? ceny[0] : null,
    og_max_m2: ceny.length ? ceny[ceny.length - 1] : null,
    vs_ogloszenia_pct: mediana ? Math.round((m2calosc / mediana - 1) * 100) : null,
    og_wartosc: mediana ? Math.round(mediana * Number(r.m2) * czesc) : null,
    og_najblizsze: najblizsze.join(','),
  };
});

// ===== Pomocnicze =====
const q = (s, el = document) => el.querySelector(s);
const qa = (s, el = document) => [...el.querySelectorAll(s)];
const S = window.LK_SLOWNIK || {};
const zl = (v) => v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('pl-PL') + ' zł';
const zlk = (v) => (v < 0 ? '−' : '') + (Math.abs(v) >= 10000 ? Math.round(Math.abs(v) / 1000).toLocaleString('pl-PL') + ' tys. zł' : Math.round(Math.abs(v)).toLocaleString('pl-PL') + ' zł');
const num = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pl-PL', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (v) => v == null || isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) + '%';
const dataPL = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const dataKr = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—';
const dzis = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const dni = (s) => s ? Math.round((new Date(s + 'T00:00:00') - dzis()) / 86400000) : null;
const RODZ = { komornicza: 'Licytacja komornicza', syndyk: 'Od syndyka', przetarg: 'Przetarg (gmina, spółdzielnia, instytucja)', bank: 'Bank / windykacja', 'ogłoszenie': 'Zwykłe ogłoszenie' };
const RODZ_K = { komornicza: 'komornik', syndyk: 'syndyk', przetarg: 'przetarg', bank: 'bank', 'ogłoszenie': 'ogłoszenie' };
const rodz = (r) => r.rodzaj || 'komornicza';
const isKom = (r) => rodz(r) === 'komornicza';
const isOgl = (r) => rodz(r) === 'ogłoszenie';
const nazwaTerminu = (r) => isKom(r) ? 'Licytacja' : rodz(r) === 'syndyk' ? 'Termin ofert / przetargu' : 'Przetarg';
const nazwaWadium = (r) => isKom(r) ? 'Termin wpłaty rękojmi' : 'Termin wpłaty wadium';
const nazwaCeny = (r) => isKom(r) ? 'Cena wywołania' : isOgl(r) ? 'Cena ofertowa' : 'Cena wywoławcza';
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const term = (key, txt) => { const s = el('span', 't', txt || (S[key] ? S[key][0] : key)); s.dataset.t = key; s.tabIndex = 0; return s; };
const KOLORY = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];
const segColor = (i) => KOLORY[i % KOLORY.length];
const label2 = (r) => r.miejscowosc + (r.lokalizacja ? ', ' + r.lokalizacja.replace(/\s*\(.*\)/, '') : '') + (r.udzial ? ' (udział ' + r.udzial + ')' : '');

// ===== Podpowiedzi (hover / dotknięcie) =====
const tipEl = q('.lk-tipg');
const root = q('#dashboard');
let tipFor = null;
function showTip(target) {
  const key = target.dataset.t;
  const raw = target.dataset.tip;
  const entry = key ? S[key] : null;
  if (!entry && !raw) return;
  tipEl.replaceChildren();
  if (entry) { tipEl.append(el('b', null, entry[0]), document.createTextNode(entry[1])); }
  else { if (target.dataset.tipTitle) tipEl.appendChild(el('b', null, target.dataset.tipTitle)); tipEl.appendChild(document.createTextNode(raw)); }
  tipEl.hidden = false;
  const rr = root.getBoundingClientRect(), tr = target.getBoundingClientRect();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let left = tr.left - rr.left + tr.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, rr.width - w - 8));
  let top = tr.bottom - rr.top + 8;
  if (tr.bottom + h + 16 > window.innerHeight && tr.top - h - 8 > 0) top = tr.top - rr.top - h - 8;
  tipEl.style.left = left + 'px';
  tipEl.style.top = top + 'px';
  tipFor = target;
}
function hideTip() { tipEl.hidden = true; tipFor = null; }
root.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-t],[data-tip]'); if (t && t !== tipFor) showTip(t); });
root.addEventListener('mouseout', (e) => { const t = e.target.closest('[data-t],[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
root.addEventListener('focusin', (e) => { const t = e.target.closest('[data-t],[data-tip]'); if (t) showTip(t); });
root.addEventListener('focusout', () => hideTip());
root.addEventListener('click', (e) => {
  const t = e.target.closest('.t[data-t],[data-tip]');
  if (t && !e.target.closest('button,select,input,a')) { if (tipFor === t) hideTip(); else showTip(t); e.stopPropagation(); }
  else if (!t) hideTip();
});
qa('.t[data-t]').forEach((s) => { s.tabIndex = 0; });

// ===== Zakładki =====
const TABS = ['start', 'oferty', 'rynek', 'kalkulator', 'poradnik'];
window.lkTab = window.lkTab || 'start';
function goTab(id, scroll) {
  if (!TABS.includes(id)) return;
  window.lkTab = id;
  qa('.lk-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  TABS.forEach((t) => { q('#' + t).hidden = t !== id; });
  try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
  hideTip();
  window.lkDraw && window.lkDraw();
  if (scroll) q('.lk-tabs').scrollIntoView({ block: 'start' });
}
qa('.lk-tabs button').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
root.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.sel) window.lkSel = g.dataset.sel; goTab(g.dataset.go, true); } });

// ===== Filtry ofert =====
const F = { ocena: q('.f-ocena'), moje: q('.f-moje'), rodzaj: q('.f-rodzaj'), cena: q('.f-cena'), m2min: q('.f-m2min'), m2max: q('.f-m2max'), zlm2: q('.f-zlm2'), od: q('.f-od'), do: q('.f-do') };
F.cena.value = 200000;
Object.values(F).forEach((x) => { x.addEventListener('input', () => window.lkDraw()); x.addEventListener('change', () => window.lkDraw()); });
q('.f-reset').addEventListener('click', () => { Object.values(F).forEach((x) => { x.value = ''; }); F.cena.value = 200000; window.lkDraw(); });

// ===== Założenia kalkulatora =====
const A = {
  przeb: q('.a-przeb'), pcc: q('.a-pcc'), eksm: q('.a-eksm'), rmode: q('.a-rmode'), remont: q('.a-remont'), rkwota: q('.a-rkwota'),
  mies: q('.a-mies'), utrz: q('.a-utrz'), cena: q('.a-cena'), rabat: q('.a-rabat'), prow: q('.a-prow'), pit: q('.a-pit'), cel: q('.a-cel'),
};
const A_DEF = { przeb: 0, pcc: true, eksm: false, rmode: 'm2', remont: 1500, rkwota: 40000, mies: 6, utrz: 10, cena: 'ofertowa', rabat: 5, prow: 2.5, pit: '1', cel: 15 };
window.lkRF = window.lkRF || {};
Object.values(A).forEach((x) => { x.addEventListener('input', () => window.lkDraw()); x.addEventListener('change', () => window.lkDraw()); });
q('.a-reset').addEventListener('click', () => {
  Object.entries(A_DEF).forEach(([k, v]) => { if (typeof v === 'boolean') A[k].checked = v; else A[k].value = v; });
  Object.keys(window.lkRF).forEach((k) => delete window.lkRF[k]);
  window.lkDraw();
});
const av = (x) => Math.max(0, Number(x.value) || 0);

const SEG = [
  { key: 'zakup', name: 'Zakup', t: 'cena_wywolania' },
  { key: 'oplaty', name: 'PCC i opłaty', t: 'pcc' },
  { key: 'remont', name: 'Remont', t: 'remont' },
  { key: 'utrzymanie', name: 'Utrzymanie', t: 'utrzymanie' },
  { key: 'sprzedaz_koszty', name: 'Koszty sprzedaży', t: 'prowizja' },
  { key: 'pit', name: 'PIT', t: 'pit' },
];

function czescOf(r) { const [a, b] = String(r.udzial || '1/1').split('/').map(Number); return a && b ? a / b : 1; }

// Pełne rozliczenie kupna i odsprzedaży. zakupOverride – do szukania maksymalnej ceny.
function flip(r, st, zakupOverride) {
  const czesc = czescOf(r);
  const zakup = zakupOverride != null ? zakupOverride : Number(r.cena) * (1 + av(A.przeb) / 100);
  const pcc = A.pcc.checked ? zakup * (st.pcc ?? 2) / 100 : 0;
  const wpis = r.udzial ? Math.max(st.wpis_kw_min_udzial ?? 100, (st.wpis_kw ?? 200) * czesc) : (st.wpis_kw ?? 200);
  const eksm = A.eksm.checked ? (st.oproznienie ?? 1500) : 0;
  const wlasny = window.lkRF[r.id];
  const remontCaly = wlasny != null ? wlasny : A.rmode.value === 'kwota' ? av(A.rkwota) : av(A.remont) * Number(r.m2);
  const remont = remontCaly * czesc;
  const utrzymanie = av(A.utrz) * Number(r.m2) * av(A.mies) * czesc;
  const rynekM2 = A.cena.value === 'transakcyjna' ? r.rynek_transakcyjna_m2 : A.cena.value === 'ogloszenia' ? r.og_mediana_m2 : r.rynek_ofertowa_m2;
  if (rynekM2 == null) return null;
  const sprzedaz = rynekM2 * Number(r.m2) * czesc * (1 - av(A.rabat) / 100);
  const prowizja = sprzedaz * av(A.prow) / 100 * (1 + (st.vat_prowizja ?? 23) / 100);
  const swiad = st.swiadectwo ?? 700;
  const sprzedaz_koszty = prowizja + swiad;
  const dochod = sprzedaz - sprzedaz_koszty - (zakup + pcc + wpis) - remont;
  const pit = A.pit.value === '1' ? Math.max(0, dochod) * (st.pit ?? 19) / 100 : 0;
  const oplaty = pcc + wpis + eksm;
  const zysk = sprzedaz - zakup - oplaty - remont - utrzymanie - sprzedaz_koszty - pit;
  const wklad = zakup + oplaty + remont + utrzymanie;
  return { r, wlasny: wlasny != null, remontCaly, czesc, zakup, pcc, wpis, eksm, oplaty, remont, utrzymanie, sprzedaz, prowizja, swiad, sprzedaz_koszty, pit, zysk, wklad, roi: wklad ? zysk / wklad : null, rynekM2 };
}

// Najwyższa cena zakupu, przy której zwrot >= cel.
function maksCena(r, st) {
  const cel = av(A.cel) / 100;
  const ok = (z) => { const f = flip(r, st, z); return f && f.roi >= cel; };
  if (!ok(1)) return null;
  let lo = 1, hi = Number(r.cena) * 6;
  if (ok(hi)) return hi;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
  return Math.floor(lo / 100) * 100;
}

function oszacowanie(r) {
  if (r.licytacja === 'pierwsza') return Number(r.cena) / 0.75;
  if (r.licytacja === 'druga') return Number(r.cena) / (2 / 3);
  return null;
}

// Ryzyka i plusy oferty.
function flagi(r, f) {
  const out = [];
  const u = (r.uwagi || '').toLowerCase();
  if (r.typ === 'Udział') out.push(r.udzial ? { lvl: 'red', t: 'udzial', txt: 'Kupujesz tylko udział ' + r.udzial + ' w mieszkaniu', s: 'Nie zamieszkasz ani nie sprzedasz go swobodnie bez zgody współwłaściciela.' } : { lvl: 'red', t: 'udzial', txt: 'Udział we współwłasności zamiast odrębnego lokalu', s: 'Bez osobnej księgi wieczystej – trudniej o kredyt dla kupca i o odsprzedaż.' });
  if (u.includes('służebno')) out.push({ lvl: 'red', t: 'sluzebnosc', txt: 'Lokal obciążony służebnością mieszkania', s: 'Ktoś może mieć prawo mieszkać tu dożywotnio – wartość dla kupującego mocno spada.' });
  if (u.includes('dojazd') || u.includes('dostęp')) out.push({ lvl: 'red', t: 'dojazd', txt: 'Brak prawnie zapewnionego dojazdu', s: 'Utrudnia kredyt Twojemu przyszłemu kupcowi i obniża cenę sprzedaży.' });
  if (u.includes('węgl') || u.includes('do wymiany')) out.push({ lvl: 'yellow', t: 'remont', txt: 'Instalacje do wymiany (np. piec węglowy)', s: 'Doliczyć wyższy koszt remontu.' });
  if (f && f.zysk < 0) out.push({ lvl: 'red', t: 'zysk', txt: 'Przy obecnych założeniach strata ' + zl(Math.abs(f.zysk)), s: 'Zmień założenia w kalkulatorze albo odpuść ofertę.' });
  else if (f && f.roi < 0.1) out.push({ lvl: 'yellow', t: 'roi', txt: 'Niski zwrot: ' + pct(f.roi * 100), s: 'Mało miejsca na niespodzianki – droższy remont lub dłuższa sprzedaż zjedzą zysk.' });
  if (!f) out.push({ lvl: 'yellow', t: 'cena_ofertowa', txt: 'Brak wybranej ceny rynkowej dla tej miejscowości', s: 'Nie da się policzyć zysku – zmień „Cenę sprzedaży” w kalkulatorze.' });
  if (r.og_liczba != null && r.og_liczba < 3) out.push({ lvl: 'yellow', t: 'podobne', txt: r.og_liczba ? 'Tylko ' + r.og_liczba + ' ogłosz. sprzedaży w okolicy' : 'Brak aktualnych ogłoszeń sprzedaży w tej miejscowości', s: 'Rynek jest mały – sprzedaż może potrwać dłużej, a cena jest trudna do oszacowania.' });
  if (r.og_skad && r.og_skad !== r.miejscowosc) out.push({ lvl: 'info', t: 'podobne', txt: 'Porównanie z ogłoszeniami z: ' + r.og_skad, s: 'W ' + r.miejscowosc + ' nie ma ogłoszeń – to inny, zwykle droższy rynek niż wieś.' });
  const dl = dni(r.termin);
  if (!isKom(r)) {
    const dw2 = dni(r.termin_wadium);
    if (!isOgl(r) && !r.termin && !r.termin_wadium) out.push({ lvl: 'yellow', t: 'termin', txt: 'Nie znamy terminu przetargu', s: 'Sprawdź go w ogłoszeniu organizatora.' });
    if (dw2 != null && dw2 >= 0 && dw2 <= 7) out.push({ lvl: 'yellow', t: 'termin_rekojmi', txt: dw2 === 0 ? 'Wadium trzeba wpłacić dziś' : 'Wadium za ' + dw2 + ' dni – mało czasu', s: 'Wadium musi wpłynąć przed terminem, a trzeba jeszcze sprawdzić KW i lokal.' });
    if (dw2 != null && dw2 < 0) out.push({ lvl: 'yellow', t: 'termin_rekojmi', txt: 'Termin wpłaty wadium według źródła już minął', s: 'Sprawdź u organizatora, czy oferta jest jeszcze aktualna.' });
    if (rodz(r) === 'syndyk') out.push({ lvl: 'info', t: 'termin', txt: 'Sprzedaż przez syndyka', s: 'Hipoteki wygasają jak przy licytacji, ale cena bywa netto (+VAT) – przeczytaj regulamin przetargu.' });
    if (rodz(r) === 'przetarg') out.push({ lvl: 'info', t: 'termin', txt: 'Przetarg publiczny', s: 'Zasady, wadium i termin są w ogłoszeniu organizatora (gmina, spółdzielnia, instytucja).' });
    if (rodz(r) === 'bank') out.push({ lvl: 'info', t: 'termin', txt: 'Sprzedaż przez bank / firmę windykacyjną', s: 'Zwykle umowa u notariusza; sprawdź, czy lokal jest wolny od lokatorów.' });
    if (isOgl(r)) out.push({ lvl: 'info', t: 'termin', txt: 'Zwykłe ogłoszenie sprzedaży', s: 'Cenę można negocjować; kupujesz u notariusza, bez licytacji i rękojmi.' });
  }
  else if (!r.termin) out.push({ lvl: 'yellow', t: 'termin', txt: 'Nie znamy daty licytacji', s: 'Sprawdź ją w obwieszczeniu komornika.' });
  else if (dl != null && dl <= 7) out.push({ lvl: 'yellow', t: 'termin_rekojmi', txt: dl < 0 ? 'Licytacja już się odbyła lub trwa' : dl === 0 ? 'Licytacja dziś' : dl === 1 ? 'Licytacja jutro – mało czasu' : 'Licytacja za ' + dl + ' dni – mało czasu', s: 'Rękojmia musi wpłynąć wcześniej, a trzeba jeszcze sprawdzić KW i lokal.' });
  const dw = dni(r.termin_wadium);
  if (isKom(r) && dw != null && dw < 0) out.push({ lvl: 'yellow', t: 'termin_rekojmi', txt: 'Termin wpłaty rękojmi według źródła już minął', s: 'Sprawdź w obwieszczeniu, czy jeszcze można przystąpić.' });
  if (r.trend && r.trend.wiarygodnosc === 'niska') out.push({ lvl: 'yellow', t: 'wiarygodnosc', txt: 'Mało transakcji w tym powiecie', s: 'Cena transakcyjna z GUS jest tu mało pewna – oprzyj się na cenie ofertowej i sprawdź ogłoszenia z okolicy.' });
  if (r.trend && r.trend.srednio_rocznie_pct != null) out.push({ lvl: 'info', t: 'trend', txt: 'Ceny w powiecie ' + r.trend.rok_od + '–' + r.trend.rok_do + ': ' + pct(r.trend.wzrost_10l_pct), s: 'Średnio ' + num(r.trend.srednio_rocznie_pct, 1) + '% rocznie, w ostatnim roku ' + pct(r.trend.zmiana_rr_pct) + ' (GUS ' + r.trend.rok_od + '–' + r.trend.rok_do + ').' });
  if (r.licytacja === 'druga') out.push({ lvl: 'info', t: 'druga', txt: 'Druga licytacja – niższa cena wywołania', s: 'Na pierwszej nie było chętnych. Sprawdź dlaczego.' });
  if (r.tryb === 'stacjonarna') out.push({ lvl: 'info', t: 'stacjonarna', txt: 'Licytacja stacjonarna w sądzie', s: 'Trzeba być osobiście lub wysłać pełnomocnika.' });
  if (r.tryb === 'e-licytacja') out.push({ lvl: 'info', t: 'elicytacja', txt: 'E-licytacja przez internet', s: 'Konto na elicytacje.komornik.pl załóż z wyprzedzeniem.' });
  if (f && f.roi >= 0.1 && r.typ !== 'Udział') out.push({ lvl: 'green', t: 'roi', txt: 'Szacowany zwrot ' + pct(f.roi * 100), s: 'Przy obecnych założeniach z kalkulatora.' });
  return out;
}
function ocena(fl) {
  if (fl.some((x) => x.lvl === 'red')) return { k: 'red', txt: 'Wysokie ryzyko' };
  if (fl.some((x) => x.lvl === 'yellow')) return { k: 'yellow', txt: 'Ostrożnie' };
  return { k: 'green', txt: 'Warta sprawdzenia' };
}
const badge = (o) => { const b = el('span', 'lk-badge ' + o.k, o.txt); b.dataset.t = 'ocena'; b.tabIndex = 0; return b; };
const isNew = (r) => { const d = dni(r.dodano); return d != null && d >= -3; };

// ===== Dane =====
// Pliki z data/ wczytywane przy starcie; po wczytaniu w DATA są też wyniki obliczeń (porownanie, podsumowanie, trend_cen, podobne).
const PLIKI = ['licytacje', 'ceny_rynkowe', 'koszty_stawki', 'historia_cen', 'ogloszenia'];
const DATA = { status: 'loading' };
function wczytajDane() {
  return Promise.all(PLIKI.map((id) => fetch('data/' + id + '.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('data/' + id + '.json: ' + r.status); return r.json(); })
    .then((j) => { DATA[id] = Array.isArray(j) ? j : (j.rows || j.data || j); })))
    .then(() => {
      // Tylko całe mieszkania (100%) – udziałów nie pokazujemy, nawet jeśli trafią do danych.
      DATA.licytacje = DATA.licytacje.filter((r) => r.typ !== 'Udział' && !r.udzial);
      DATA.porownanie = calcPorownanie(DATA.licytacje, DATA.ceny_rynkowe);
      DATA.podsumowanie = calcPodsumowanie(DATA.licytacje, DATA.porownanie);
      DATA.trend_cen = calcTrendCen(DATA.historia_cen);
      DATA.podobne = calcPodobne(DATA.licytacje, DATA.ogloszenia);
      DATA.status = 'ok';
    })
    .catch((e) => { DATA.status = 'error'; console.error(e); });
}
function dataset() {
  const status = DATA.status;
  if (status !== 'ok') return { status };
  const por = new Map(DATA.porownanie.map((x) => [x.id, x]));
  const pod = new Map(DATA.podobne.map((x) => [x.id, x]));
  const st = Object.fromEntries(DATA.koszty_stawki.map((x) => [x.klucz, Number(x.wartosc)]));
  const rows = DATA.licytacje.map((r) => ({ ...r, cena: Number(r.cena), m2: Number(r.m2), cena_m2: Number(r.cena_m2), pokoje: r.pokoje == null ? null : Number(r.pokoje), ...(por.get(r.id) || {}), ...(pod.get(r.id) || {}) }));
  const trend = DATA.trend_cen;
  rows.forEach((r) => {
    const cr = DATA.ceny_rynkowe.find((x) => x.miejscowosc === r.miejscowosc);
    r.powiat = cr ? cr.powiat : null;
    r.trend = r.powiat ? trend.find((t) => t.powiat === r.powiat) || null : null;
    r.f = flip(r, st); r.fl = flagi(r, r.f); r.oc = ocena(r.fl);
  });
  return { status, rows, st, ceny: DATA.ceny_rynkowe, hist: DATA.historia_cen, trend, ogl: DATA.ogloszenia };
}
function filtered(rows) {
  const v = (x) => x.value === '' ? null : Number(x.value);
  const cena = v(F.cena), m2min = v(F.m2min), m2max = v(F.m2max), zlm2 = v(F.zlm2);
  return rows.filter((r) => {
    if (F.ocena.value === 'green' && r.oc.k !== 'green') return false;
    if (F.ocena.value === 'greenyellow' && r.oc.k === 'red') return false;
    if (F.rodzaj && F.rodzaj.value && rodz(r) !== F.rodzaj.value) return false;
    const mj = moje(r.id);
    if (F.moje.value === 'gw' && !mj.gw) return false;
    if (F.moje.value === 'bez_odrz' && mj.odrz) return false;
    if (F.moje.value === 'odrz' && !mj.odrz) return false;
    if (cena != null && r.cena > cena) return false;
    if (m2min != null && r.m2 < m2min) return false;
    if (m2max != null && r.m2 > m2max) return false;
    if (zlm2 != null && r.cena_m2 > zlm2) return false;
    if (F.od.value && (!r.termin || r.termin < F.od.value)) return false;
    if (F.do.value && (!r.termin || r.termin > F.do.value)) return false;
    return true;
  });
}
const ORDER = { green: 0, yellow: 1, red: 2 };
const best = (a, b) => (ORDER[a.oc.k] - ORDER[b.oc.k]) || ((b.f ? b.f.zysk : -1e12) - (a.f ? a.f.zysk : -1e12));
const fail = (box) => { box.replaceChildren(el('div', 'lk-fail', 'Failed to load')); };

// ===== START =====
function drawStart(D) {
  const tops = q('.lk-tops');
  tops.replaceChildren();
  const list = D.rows.slice().sort(best).slice(0, 3);
  list.forEach((r) => {
    const c = el('div', 'lk-top');
    const h = el('div', 'row'); h.append(badge(r.oc), el('span', null, (isKom(r) ? '' : RODZ_K[rodz(r)] + ' · ') + (r.termin ? nazwaTerminu(r).toLowerCase() + ' ' + dataKr(r.termin) : '')));
    c.append(h, el('div', 'ttl', label2(r)));
    c.appendChild(el('div', 'big', zl(r.cena)));
    const row = (k, v, t) => { const x = el('div', 'row'); const a = el('span'); a.appendChild(term(t, k)); x.append(a, el('b', null, v)); c.appendChild(x); };
    row('Powierzchnia', num(r.m2, 2) + ' m²', 'zl_m2');
    row('vs rynek', pct(r.vs_ofertowa_pct), 'vs_ofertowe');
    if (r.f) { row('Szac. zysk', zlk(r.f.zysk), 'zysk'); row('Zwrot', pct(r.f.roi * 100), 'roi'); }
    const go = el('button', 'lk-link', 'Zobacz kartę oferty →'); go.dataset.go = 'oferty'; go.dataset.sel = r.id;
    c.appendChild(go);
    tops.appendChild(c);
  });
  if (!list.length) tops.appendChild(el('div', 'lk-empty', 'Brak aktywnych ofert.'));

  const box = q('.lk-dates');
  box.replaceChildren();
  const ev = [];
  D.rows.forEach((r) => {
    if (r.termin_wadium) ev.push({ d: r.termin_wadium, txt: nazwaWadium(r), t: 'termin_rekojmi', r });
    if (r.termin) ev.push({ d: r.termin, txt: nazwaTerminu(r), t: 'termin', r });
  });
  ev.filter((e) => { const x = dni(e.d); return x != null && x >= 0 && x <= 60; }).sort((a, b) => a.d.localeCompare(b.d)).forEach((e) => {
    const row = el('div', 'lk-date');
    row.appendChild(el('span', 'd', dataKr(e.d)));
    const mid = el('span'); mid.appendChild(term(e.t, e.txt)); mid.appendChild(el('span', 's', label2(e.r) + ' · ' + zl(e.r.cena)));
    row.appendChild(mid);
    const x = dni(e.d);
    row.appendChild(el('span', 'w' + (x <= 7 ? ' soon' : ''), x === 0 ? 'dziś' : x === 1 ? 'jutro' : 'za ' + x + ' dni'));
    box.appendChild(row);
  });
  if (!box.childNodes.length) box.appendChild(el('div', 'lk-empty', 'Brak terminów w najbliższych 60 dniach.'));
}

// ===== Moje oznaczenia: obserwowane, odrzucone, komentarz (zapis tylko w tej przeglądarce) =====
const MOJE_KEY = 'lk-moje-v1';
const MOJE = (() => { try { return JSON.parse(localStorage.getItem(MOJE_KEY)) || {}; } catch (e) { return {}; } })();
const moje = (id) => MOJE[id] || {};
function zapiszMoje(id, zmiany) {
  const m = { ...moje(id), ...zmiany };
  if (!m.gw && !m.odrz && !(m.kom || '').trim()) delete MOJE[id]; else MOJE[id] = m;
  try { localStorage.setItem(MOJE_KEY, JSON.stringify(MOJE)); } catch (e) { /* np. tryb prywatny – zostaje do zamknięcia karty */ }
}
const MARK = {
  gw: { on: '★', off: '☆', tOn: 'Obserwujesz – kliknij, żeby przestać', tOff: 'Obserwuj' },
  odrz: { on: '✕', off: '✕', tOn: 'Odrzucona – kliknij, żeby cofnąć', tOff: 'Oznacz jako odrzuconą' },
};
const markBtn = (r, k) => {
  const on = !!moje(r.id)[k], m = MARK[k];
  const b = el('button', 'lk-mark ' + k + (on ? ' on' : ''), on ? m.on : m.off);
  b.type = 'button'; b.dataset.mark = k; b.dataset.id = r.id; b.title = on ? m.tOn : m.tOff;
  b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', String(on));
  return b;
};
root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mark]');
  if (!b) return;
  zapiszMoje(b.dataset.id, { [b.dataset.mark]: !moje(b.dataset.id)[b.dataset.mark] });
  window.lkDraw();
});

// ===== OFERTY =====
window.lkSort = window.lkSort || { k: 'ocena', dir: 1 };
qa('.lk-offers th button[data-sort]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.sort;
  if (window.lkSort.k === k) window.lkSort.dir *= -1; else window.lkSort = { k, dir: 1 };
  window.lkDraw();
}));
q('.lk-offers tbody').addEventListener('click', (e) => {
  if (e.target.closest('a,.t,.lk-badge,[data-mark]')) return;
  const tr = e.target.closest('tr[data-key]');
  if (tr) { window.lkSel = tr.dataset.key; window.lkDraw(); q('#karta-oferty').scrollIntoView({ block: 'nearest' }); }
});

function drawOferty(D, rows) {
  q('.lk-count').textContent = `Pokazano ${rows.length} z ${D.rows.length}. Sortuj, klikając nagłówek. Domyślnie najlepsze na górze.`;
  const { k, dir } = window.lkSort;
  const sorted = rows.slice().sort((a, b) => {
    if (k === 'ocena') return best(a, b) * dir;
    let x = a[k], y = b[k];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    if (typeof x === 'number' || typeof y === 'number') return (Number(x) - Number(y)) * dir;
    return String(x).localeCompare(String(y), 'pl') * dir;
  });
  if (!window.lkSel || !D.rows.some((r) => r.id === window.lkSel)) window.lkSel = sorted[0] ? sorted[0].id : null;
  const tb = q('.lk-offers tbody');
  tb.replaceChildren(...sorted.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r.id;
    const mj = moje(r.id);
    tr.className = [r.id === window.lkSel ? 'sel' : '', mj.odrz ? 'odrz' : ''].filter(Boolean).join(' ');
    const td = (cls) => { const c = el('td', cls); tr.appendChild(c); return c; };
    const a = td();
    const nm = el('div', 'lk-name');
    nm.append(markBtn(r, 'gw'), markBtn(r, 'odrz'), el('span', null, r.miejscowosc));
    a.appendChild(nm);
    if (r.lokalizacja) a.appendChild(el('span', 'small', r.lokalizacja));
    const tags = el('span', 'small');
    tags.appendChild(badge(r.oc));
    if (isNew(r)) { const t = el('span', 'lk-tag new', 'nowa'); tags.appendChild(t); }
    if (!isKom(r)) tags.appendChild(el('span', 'lk-tag', RODZ_K[rodz(r)]));
    if (r.typ === 'Udział') { const t = el('span', 'lk-tag bad', r.udzial ? 'udział ' + r.udzial : 'udział'); t.dataset.t = 'udzial'; tags.appendChild(t); }
    if (mj.odrz) tags.appendChild(el('span', 'lk-tag bad', 'odrzucona'));
    a.appendChild(tags);
    if ((mj.kom || '').trim()) { const k = mj.kom.trim(); a.appendChild(el('span', 'small lk-kom', '✎ ' + (k.length > 70 ? k.slice(0, 70) + '…' : k))); }
    td('num').textContent = zl(r.cena);
    td('num').textContent = num(r.m2, 2);
    td('num lk-hide-narrow').textContent = num(r.cena_m2);
    const pc = (v) => { const c = td('num'); c.appendChild(el('span', 'lk-pct ' + (v == null ? '' : v <= -15 ? 'good' : v >= 0 ? 'bad' : ''), pct(v))); return c; };
    pc(r.vs_ofertowa_pct);
    const co = pc(r.vs_ogloszenia_pct); if (r.og_liczba != null) co.appendChild(el('span', 'small', r.og_liczba + ' ogł.'));
    const t = td();
    t.textContent = r.termin ? dataPL(r.termin) : isKom(r) ? 'brak daty' : r.termin_wadium ? 'wadium ' + dataKr(r.termin_wadium) : '—';
    if (r.tryb) t.appendChild(el('span', 'small', r.tryb));
    td('lk-hide-narrow').textContent = r.typ;
    return tr;
  }));
  qa('.lk-offers th').forEach((th) => { const b = th.querySelector('button'); th.setAttribute('aria-sort', b && b.dataset.sort === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'); });
  drawDetail(D, D.rows.find((r) => r.id === window.lkSel));
}

function drawDetail(D, r) {
  const box = q('.lk-detail');
  box.replaceChildren();
  if (!r) { box.appendChild(el('div', 'lk-empty', 'Wybierz ofertę z tabeli.')); return; }
  const head = el('div', 'lk-detail-head');
  const h = el('div'); h.appendChild(el('h2', null, label2(r)));
  h.appendChild(el('p', 'note', RODZ[rodz(r)] + ' · ' + (r.uwagi || '') + (r.sprawdzono ? ' · sprawdzono ' + dataKr(r.sprawdzono) : '')));
  head.append(h, badge(r.oc));
  box.appendChild(head);

  const mj = moje(r.id);
  const sec = el('div', 'lk-moje');
  const btns = el('div', 'lk-moje-btns');
  const tb = (k, txtOn, txtOff) => { const on = !!mj[k]; const b = el('button', 'lk-btn ' + k + (on ? ' on' : ''), on ? txtOn : txtOff); b.type = 'button'; b.dataset.mark = k; b.dataset.id = r.id; b.setAttribute('aria-pressed', String(on)); return b; };
  btns.append(tb('gw', '★ Obserwujesz', '☆ Obserwuj'), tb('odrz', '✕ Odrzucona', '✕ Odrzuć'));
  const lab = el('label', 'lk-moje-kom');
  const ta = document.createElement('textarea');
  ta.className = 'lk-in'; ta.rows = 3; ta.value = mj.kom || ''; ta.placeholder = 'Np. dzwoniłem do komornika, lokal zamieszkany, obejrzeć w sobotę…';
  ta.addEventListener('input', () => zapiszMoje(r.id, { kom: ta.value }));
  lab.append(el('span', null, 'Twój komentarz'), ta);
  sec.append(btns, lab, el('p', 'note', 'Oznaczenia i komentarze zapisują się tylko w tej przeglądarce, na tym urządzeniu.'));
  box.appendChild(sec);

  const facts = el('div', 'lk-facts');
  const fact = (t, k, v, s) => { const f = el('div', 'lk-fact'); const kk = el('div', 'k'); kk.appendChild(term(t, k)); f.append(kk, el('div', 'v', v)); if (s) f.appendChild(el('div', 's', s)); facts.appendChild(f); };
  const osz = oszacowanie(r);
  fact('cena_wywolania', nazwaCeny(r), zl(r.cena), isKom(r) && r.licytacja ? (r.licytacja === 'pierwsza' ? '3/4 sumy oszacowania' : '2/3 sumy oszacowania') : isKom(r) ? null : RODZ[rodz(r)]);
  if (isKom(r)) {
    fact('suma_oszacowania', 'Suma oszacowania', osz ? '~' + zl(osz) : '—', osz ? 'szacunek z ceny wywołania' : 'sprawdź w obwieszczeniu');
    fact('rekojmia', 'Rękojmia do wpłaty', osz ? '~' + zl(osz / 10) : '—', osz ? '1/10 sumy oszacowania' : 'sprawdź w obwieszczeniu');
    fact('termin', 'Licytacja', r.termin ? dataPL(r.termin) : 'brak daty', [r.licytacja ? r.licytacja + ' licytacja' : '', r.tryb].filter(Boolean).join(' · ') || null);
    fact('termin_rekojmi', 'Termin rękojmi', r.termin_wadium ? dataPL(r.termin_wadium) : '—', r.termin_wadium ? (dni(r.termin_wadium) >= 0 ? 'za ' + dni(r.termin_wadium) + ' dni' : 'minął') : 'brak w źródle');
  } else if (!isOgl(r)) {
    fact('termin', nazwaTerminu(r), r.termin ? dataPL(r.termin) : 'brak daty', r.termin ? null : 'sprawdź w ogłoszeniu');
    fact('termin_rekojmi', 'Termin wadium', r.termin_wadium ? dataPL(r.termin_wadium) : '—', r.termin_wadium ? (dni(r.termin_wadium) >= 0 ? 'za ' + dni(r.termin_wadium) + ' dni' : 'minął') : 'brak w źródle');
  }
  fact('zl_m2', 'Powierzchnia', num(r.m2, 2) + ' m²', (r.pokoje ? r.pokoje + ' pok. · ' : '') + num(r.cena_m2) + ' zł/m²');
  fact('vs_ofertowe', 'Taniej niż w ogłoszeniach', pct(r.vs_ofertowa_pct), r.rynek_ofertowa_m2 ? 'rynek: ' + num(r.rynek_ofertowa_m2) + ' zł/m²' : null);
  fact('vs_ogloszenia', 'Vs podobne ogłoszenia', pct(r.vs_ogloszenia_pct), r.og_mediana_m2 ? 'mediana ' + num(r.og_mediana_m2) + ' zł/m² · ' + r.og_liczba + ' ogł. (' + r.og_dopasowanie + ')' : 'brak ogłoszeń w okolicy');
  if (r.og_wartosc) fact('podobne', 'Wartość wg ogłoszeń', '~' + zl(r.og_wartosc), r.udzial ? 'za udział ' + r.udzial : 'gdyby kosztowało jak podobne');
  fact('vs_transakcyjne', 'Taniej niż w transakcjach', pct(r.vs_transakcyjna_pct), r.rynek_transakcyjna_m2 ? 'GUS: ' + num(r.rynek_transakcyjna_m2) + ' zł/m²' : null);
  if (r.trend) fact('trend', 'Ceny w powiecie ' + r.trend.rok_od + '–' + r.trend.rok_do, pct(r.trend.wzrost_10l_pct), 'śr. ' + num(r.trend.srednio_rocznie_pct, 1) + '% rocznie · ' + (r.trend.transakcje_2024 == null ? 'brak danych o transakcjach' : num(r.trend.transakcje_2024) + ' transakcji w 2024'));
  if (r.f) {
    fact('zysk', 'Szacowany zysk', zlk(r.f.zysk), 'zwrot ' + pct(r.f.roi * 100) + ' · wkład ' + zlk(r.f.wklad));
    const mx = maksCena(r, D.st);
    fact('maks_cena', isOgl(r) ? 'Maks. cena do zapłaty' : isKom(r) ? 'Maks. cena do licytowania' : 'Maks. cena w ofercie', mx ? zl(mx) : 'nie opłaca się', mx ? (mx >= r.cena ? pct((mx / r.cena - 1) * 100) + ' ponad wywołanie' : 'poniżej ceny wywołania!') : 'przy celu ' + av(A.cel) + '% zwrotu');
  }
  box.appendChild(facts);

  const g = el('div', 'lk-grid'); g.style.marginTop = 'var(--cds-gap-lg)';
  const c1 = el('div'); c1.appendChild(el('h3', null, 'Ryzyka i plusy'));
  const ul = el('ul', 'lk-flags');
  r.fl.forEach((x) => { const li = el('li', x.lvl); li.appendChild(el('span', 'i')); const sp = el('span'); sp.appendChild(term(x.t, x.txt)); sp.appendChild(el('span', 's', x.s)); li.appendChild(sp); ul.appendChild(li); });
  c1.appendChild(ul);
  const c2 = el('div'); c2.appendChild(el('h3', null, 'Co zrobić teraz'));
  const ol = el('ol', 'lk-todo');
  const todo = [];
  if (isKom(r)) {
    todo.push('Otwórz ogłoszenie i znajdź pełne obwieszczenie komornika (numer KW, sygnatura, dokładna rękojmia).');
    todo.push('Sprawdź księgę wieczystą na ekw.ms.gov.pl – dział III i IV.');
    todo.push('Umów się na oględziny i przeczytaj operat w kancelarii komornika.');
    todo.push('Ustaw w kalkulatorze realny remont dla tego mieszkania i sprawdź maksymalną cenę.');
    if (r.tryb === 'e-licytacja') todo.push('Załóż konto na elicytacje.komornik.pl i potwierdź tożsamość z wyprzedzeniem.');
    if (r.termin_wadium && dni(r.termin_wadium) >= 0) todo.push('Wpłać rękojmię najpóźniej ' + dataPL(r.termin_wadium) + ' – i miej gotówkę na resztę ceny.');
    else todo.push('Wpłać rękojmię w terminie z obwieszczenia – i miej gotówkę na resztę ceny.');
  } else if (isOgl(r)) {
    todo.push('Zadzwoń do sprzedającego: forma własności (odrębna KW czy udział), kto jest zameldowany, czynsz i fundusz remontowy.');
    todo.push('Sprawdź księgę wieczystą na ekw.ms.gov.pl – dział III i IV.');
    todo.push('Obejrzyj lokal i budynek; zapytaj spółdzielnię/wspólnotę o planowane remonty.');
    todo.push('Ustaw w kalkulatorze realny remont i negocjuj cenę poniżej wyliczonej maksymalnej.');
  } else {
    todo.push('Otwórz ogłoszenie i pobierz regulamin przetargu (cena netto/brutto, VAT, wadium, sposób składania ofert).');
    todo.push('Sprawdź księgę wieczystą na ekw.ms.gov.pl – dział III i IV.');
    todo.push('Umów oględziny u organizatora (syndyka, gminy, spółdzielni) i zapytaj o operat szacunkowy.');
    todo.push('Ustaw w kalkulatorze realny remont dla tego mieszkania i sprawdź maksymalną cenę.');
    if (r.termin_wadium && dni(r.termin_wadium) >= 0) todo.push('Wpłać wadium najpóźniej ' + dataPL(r.termin_wadium) + ' i złóż ofertę w terminie.');
    else todo.push('Wpłać wadium i złóż ofertę w terminie z ogłoszenia.');
  }
  todo.forEach((t) => ol.appendChild(el('li', null, t)));
  c2.appendChild(ol);
  g.append(c1, c2);
  box.appendChild(g);

  const naj = (r.og_najblizsze || '').split(',').filter(Boolean).map((id) => D.ogl.find((o) => o.id === id)).filter(Boolean);
  if (naj.length) {
    const sec = el('div'); sec.style.marginTop = 'var(--cds-gap-lg)';
    const h3 = el('h3'); h3.appendChild(term('podobne', 'Najbardziej podobne ogłoszenia sprzedaży')); sec.appendChild(h3);
    sec.appendChild(el('p', 'note', 'Aktualne ogłoszenia z rynku wtórnego' + (r.og_skad ? ' (' + r.og_skad + ')' : '') + ', najbliższe metrażem. Pobrane ' + dataKr(naj[0].pobrano) + '. To ceny, jakich chcą sprzedający – transakcje zwykle zamykają się trochę niżej.'));
    const w = el('div', 'lk-tablewrap'); const t = el('table', 'lk-table plain'); const hd = el('thead'); const hr = el('tr');
    [['Mieszkanie'], ['Cena', 'num'], ['m²', 'num'], ['zł/m²', 'num'], ['vs ta oferta', 'num'], ['']].forEach(([n, c]) => hr.appendChild(el('th', c || null, n)));
    hd.appendChild(hr); t.appendChild(hd);
    const tb = el('tbody');
    naj.forEach((o) => {
      const tr = el('tr');
      const a = el('td'); a.appendChild(el('div', null, o.miejscowosc + (o.lokalizacja ? ', ' + o.lokalizacja : ''))); a.appendChild(el('span', 'small', (o.pokoje ? o.pokoje + ' pok. · ' : '') + o.zrodlo)); tr.appendChild(a);
      tr.appendChild(el('td', 'num', zl(o.cena)));
      tr.appendChild(el('td', 'num', num(o.m2, 2)));
      tr.appendChild(el('td', 'num', num(o.cena_m2)));
      const dd = r.cena_m2_calosc ? Math.round((r.cena_m2_calosc / o.cena_m2 - 1) * 100) : null;
      const x = el('td', 'num'); x.appendChild(el('span', 'lk-pct ' + (dd == null ? '' : dd <= -15 ? 'good' : dd >= 0 ? 'bad' : ''), pct(dd))); tr.appendChild(x);
      const l = el('td'); const an = el('a', null, 'Zobacz ↗'); an.href = o.url; an.target = '_blank'; an.rel = 'noopener'; l.appendChild(an); tr.appendChild(l);
      tb.appendChild(tr);
    });
    t.appendChild(tb); w.appendChild(t); sec.appendChild(w); box.appendChild(sec);
  }

  const links = el('div', 'lk-links');
  const link = (href, txt) => { const a = el('a', null, txt); a.href = href; a.target = '_blank'; a.rel = 'noopener'; links.appendChild(a); };
  if (r.url) link(r.url, 'Ogłoszenie ↗');
  if (r.url2) link(r.url2, 'Drugie źródło ↗');
  link('https://ekw.ms.gov.pl/', 'Księgi wieczyste ↗');
  if (isKom(r)) link(r.tryb === 'e-licytacja' ? 'https://elicytacje.komornik.pl/' : 'https://licytacje.komornik.pl/', 'Portal komorników ↗');
  const calc = el('button', 'lk-link', 'Policz w kalkulatorze →'); calc.dataset.go = 'kalkulator'; calc.addEventListener('click', () => { window.lkWf = r.id; });
  links.appendChild(calc);
  box.appendChild(links);
}

// ===== RYNEK =====
function drawLegend(box, items) {
  if (box.childNodes.length) return;
  items.forEach(([n, c, line]) => { const it = el('span', 'lk-leg'); const sw = el('i', line ? 'line' : null); sw.style.background = c; it.append(sw, document.createTextNode(n)); box.appendChild(it); });
}
function drawRynek(D, rows) {
  drawLegend(q('.lk-mkt-legend'), [['Oferta (za całość)', KOLORY[0]], ['Udział (przeliczony)', 'var(--cds-chart-muted)'], ['Cena ofertowa', 'var(--cds-chart-reference)', 1], ['Cena transakcyjna', 'var(--color-warn)', 1], ['Podobne ogłoszenia', 'var(--color-ok)', 1]]);
  const box = q('.lk-chart');
  box.replaceChildren();
  const data = rows.filter((r) => r.cena_m2_calosc != null).sort((a, b) => (a.vs_ofertowa_pct ?? 999) - (b.vs_ofertowa_pct ?? 999));
  if (!data.length) { box.appendChild(el('div', 'lk-empty', 'Brak ofert dla wybranych filtrów.')); }
  else {
    const W = box.clientWidth || 600, rowH = 34;
    const label = (r) => r.miejscowosc + (r.udzial ? ' (udz. ' + r.udzial + ')' : '');
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const meas = svg.append('g'); let lw = 0;
    data.forEach((r) => { lw = Math.max(lw, meas.append('text').attr('font-size', 12).text(label(r)).node().getComputedTextLength()); });
    meas.remove();
    const m = { l: Math.min(lw + 10, W * 0.4), r: 52, t: 4, b: 22 };
    const H = m.t + m.b + data.length * rowH;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H); box.style.minHeight = H + 'px';
    const maxV = d3.max(data, (d) => Math.max(d.cena_m2_calosc, d.rynek_ofertowa_m2 || 0, d.rynek_transakcyjna_m2 || 0, d.og_mediana_m2 || 0)) || 1;
    const x = d3.scaleLinear([0, maxV], [m.l, W - m.r]).nice();
    const y = d3.scaleBand(data.map((d) => d.id), [m.t, H - m.b]).padding(0.35);
    const ticks = x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 90)));
    svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (t) => x(t)).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((t) => num(t));
    const tip = el('div', 'lk-tip'); tip.hidden = true; box.appendChild(tip);
    const g = svg.append('g').selectAll('g').data(data).join('g');
    g.append('text').attr('x', m.l - 8).attr('y', (d) => y(d.id) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('fill', 'var(--color-fg-muted)').text(label);
    g.append('rect').attr('x', m.l).attr('y', (d) => y(d.id)).attr('height', y.bandwidth()).attr('rx', 4).attr('width', (d) => Math.max(2, x(d.cena_m2_calosc) - m.l)).attr('fill', (d) => d.typ === 'Udział' ? 'var(--cds-chart-muted)' : KOLORY[0]);
    const tick = (key, color) => g.filter((d) => d[key] != null).append('line').attr('x1', (d) => x(d[key])).attr('x2', (d) => x(d[key])).attr('y1', (d) => y(d.id) - 4).attr('y2', (d) => y(d.id) + y.bandwidth() + 4).attr('stroke', color).attr('stroke-width', 3).attr('stroke-linecap', 'round');
    tick('rynek_ofertowa_m2', 'var(--cds-chart-reference)');
    tick('rynek_transakcyjna_m2', 'var(--color-warn)');
    tick('og_mediana_m2', 'var(--color-ok)');
    g.append('text').attr('x', (d) => Math.max(x(d.cena_m2_calosc), x(d.rynek_ofertowa_m2 || 0), x(d.rynek_transakcyjna_m2 || 0), x(d.og_mediana_m2 || 0)) + 8).attr('y', (d) => y(d.id) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 12)
      .attr('fill', (d) => d.vs_ofertowa_pct == null ? 'var(--color-fg-muted)' : d.vs_ofertowa_pct <= -15 ? 'var(--color-ok)' : d.vs_ofertowa_pct >= 0 ? 'var(--color-bad)' : 'var(--color-fg)').style('font-variant-numeric', 'tabular-nums').text((d) => pct(d.vs_ofertowa_pct));
    g.append('rect').attr('x', 0).attr('width', W).attr('y', (d) => y(d.id) - y.step() * y.paddingInner() / 2).attr('height', y.step()).attr('fill', 'transparent')
      .on('mousemove', (e, d) => {
        tip.replaceChildren(el('div', 'd', label2(d)), el('div', null, 'Oferta: ' + num(d.cena_m2_calosc) + ' zł/m²' + (d.udzial ? ' (przeliczone z udziału)' : '')), el('div', null, 'Ofertowa (gmina): ' + (d.rynek_ofertowa_m2 == null ? '—' : num(d.rynek_ofertowa_m2) + ' zł/m², ' + pct(d.vs_ofertowa_pct))), el('div', null, 'Transakcyjna (powiat, GUS 2024): ' + (d.rynek_transakcyjna_m2 == null ? '—' : num(d.rynek_transakcyjna_m2) + ' zł/m², ' + pct(d.vs_transakcyjna_pct))), el('div', null, 'Podobne ogłoszenia: ' + (d.og_mediana_m2 == null ? 'brak' : num(d.og_mediana_m2) + ' zł/m², ' + pct(d.vs_ogloszenia_pct) + ' (' + d.og_liczba + ' ogł.)')));
        tip.hidden = false; const [px, py] = d3.pointer(e, box);
        tip.style.left = Math.max(4, Math.min(px + 12, box.clientWidth - tip.offsetWidth - 4)) + 'px'; tip.style.top = (py + 12) + 'px';
      }).on('mouseleave', () => { tip.hidden = true; });
  }
  const tbo = q('.lk-ogl tbody');
  tbo.replaceChildren(...rows.slice().sort((a, b) => (a.vs_ogloszenia_pct ?? 999) - (b.vs_ogloszenia_pct ?? 999)).map((r) => {
    const tr = el('tr'); tr.dataset.key = r.id;
    const a = el('td'); a.appendChild(el('div', null, label2(r))); tr.appendChild(a);
    tr.appendChild(el('td', 'num', num(r.cena_m2_calosc)));
    const m = el('td', 'num', r.og_mediana_m2 ? num(r.og_mediana_m2) : '—'); if (r.og_min_m2) m.appendChild(el('span', 'small', num(r.og_min_m2) + '–' + num(r.og_max_m2))); tr.appendChild(m);
    const v = el('td', 'num'); v.appendChild(el('span', 'lk-pct ' + (r.vs_ogloszenia_pct == null ? '' : r.vs_ogloszenia_pct <= -15 ? 'good' : r.vs_ogloszenia_pct >= 0 ? 'bad' : ''), pct(r.vs_ogloszenia_pct))); tr.appendChild(v);
    tr.appendChild(el('td', 'num', r.og_liczba == null ? '—' : String(r.og_liczba)));
    const dp = el('td', 'lk-hide-narrow', r.og_dopasowanie || '—'); if (r.og_skad && r.og_skad !== r.miejscowosc) dp.appendChild(el('span', 'small', 'z: ' + r.og_skad)); tr.appendChild(dp);
    return tr;
  }));
  const tb = q('.lk-mkt tbody');
  tb.replaceChildren(...D.ceny.slice().sort((a, b) => a.miejscowosc.localeCompare(b.miejscowosc, 'pl')).map((c) => {
    const tr = document.createElement('tr'); tr.dataset.key = c.miejscowosc;
    const td = (cls, txt) => { const x = el('td', cls, txt); tr.appendChild(x); return x; };
    td(null, c.miejscowosc);
    const o = td('num', num(c.ofertowa_m2)); o.appendChild(el('span', 'small', c.ofertowa_data || ''));
    td('lk-hide-narrow', c.ofertowa_zakres || '');
    td('num', c.transakcyjna_m2 ? num(c.transakcyjna_m2) : '—');
    td('lk-hide-narrow', c.transakcyjna_zakres || '');
    td('num lk-hide-narrow', c.transakcyjna_rok || '');
    const l = td();
    const mk = (h, t) => { if (!h) return; const a = el('a', null, t); a.href = h; a.target = '_blank'; a.rel = 'noopener'; l.appendChild(a); l.appendChild(document.createTextNode(' ')); };
    mk(c.ofertowa_url, 'RealAdvisor ↗'); mk(c.transakcyjna_url, 'GUS ↗');
    return tr;
  }));
}


// ===== HISTORIA CEN (10 lat) =====
function drawHist(D) {
  const box = q('.lk-hist');
  box.replaceChildren();
  const rows = D.hist;
  const keys = [...new Set(rows.map((r) => r.powiat))];
  const woj = 'małopolskie';
  const pk = keys.filter((k) => k !== woj);
  const color = (k) => k === woj ? 'var(--cds-chart-muted)' : segColor(pk.indexOf(k));
  const name = (k) => k === woj ? 'województwo' : k;
  const lg = q('.lk-hist-legend');
  lg.replaceChildren();
  keys.forEach((k) => { const it = el('span', 'lk-leg'); const sw = el('i', 'line'); sw.style.background = color(k); sw.style.width = '12px'; sw.style.height = '3px'; it.append(sw, document.createTextNode(name(k))); lg.appendChild(it); });

  const years = [...new Set(rows.map((r) => r.rok))].sort();
  const series = keys.map((k) => ({ k, pts: years.map((y) => { const r = rows.find((x) => x.powiat === k && x.rok === y); return { y, v: r ? Number(r.mediana_m2) : null, n: r ? r.transakcje : null }; }).filter((p) => p.v != null) }));
  const W = box.clientWidth || 600;
  const H = Math.max(280, Math.min(380, W * 0.55));
  const svg = d3.select(box).append('svg').attr('width', '100%');
  const meas = svg.append('g'); let lw = 0;
  series.forEach((s) => { const last = s.pts[s.pts.length - 1]; lw = Math.max(lw, meas.append('text').attr('font-size', 11).text(name(s.k) + ' ' + num(last.v)).node().getComputedTextLength()); });
  meas.remove();
  const m = { l: 48, r: Math.min(lw + 14, W * 0.38), t: 12, b: 26 };
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  box.style.minHeight = H + 'px';
  const x = d3.scaleLinear([years[0], years[years.length - 1]], [m.l, W - m.r]);
  const maxV = d3.max(rows, (r) => Number(r.mediana_m2));
  const y = d3.scaleLinear([0, maxV], [H - m.b, m.t]).nice();
  const yt = y.ticks(5);
  svg.append('g').selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => y(t)).attr('y2', (t) => y(t)).attr('stroke', (t) => t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)');
  svg.append('g').selectAll('text').data(yt).join('text').attr('x', m.l - 6).attr('y', (t) => y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((t) => t === 0 ? '0' : num(t));
  const step = W < 480 ? 3 : 1;
  svg.append('g').selectAll('text').data(years.filter((yy, i) => i % step === 0 || i === years.length - 1)).join('text').attr('x', (t) => x(t)).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((t) => t);
  const line = d3.line().x((p) => x(p.y)).y((p) => y(p.v));
  svg.append('g').selectAll('path').data(series).join('path').attr('d', (s) => line(s.pts)).attr('fill', 'none')
    .attr('stroke', (s) => color(s.k)).attr('stroke-width', (s) => s.k === woj ? 2 : 2).attr('stroke-dasharray', (s) => s.k === woj ? '5 4' : null)
    .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  // etykiety na końcu linii, rozsunięte
  const ends = series.map((s) => { const p = s.pts[s.pts.length - 1]; return { k: s.k, v: p.v, yy: y(p.v) }; }).sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 13) ends[i].yy = ends[i - 1].yy + 13;
  const over = ends.length ? ends[ends.length - 1].yy - (H - m.b) : 0;
  if (over > 0) ends.forEach((e) => { e.yy -= over; });
  svg.append('g').selectAll('text').data(ends).join('text').attr('x', W - m.r + 6).attr('y', (e) => e.yy).attr('dy', '0.35em').attr('font-size', 11)
    .attr('fill', (e) => e.k === woj ? 'var(--color-fg-muted)' : 'var(--color-fg)').style('font-variant-numeric', 'tabular-nums').text((e) => name(e.k) + ' ' + num(e.v));
  // podpowiedź z linią pionową
  const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 1).style('display', 'none');
  const dots = svg.append('g').selectAll('circle').data(series).join('circle').attr('r', 4).attr('fill', (s) => color(s.k)).style('display', 'none');
  const tip = el('div', 'lk-tip'); tip.hidden = true; box.appendChild(tip);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('mousemove', (e) => {
      const [px, py] = d3.pointer(e, box);
      const yr = Math.round(x.invert(d3.pointer(e)[0]));
      const yy = Math.max(years[0], Math.min(years[years.length - 1], yr));
      rule.style('display', null).attr('x1', x(yy)).attr('x2', x(yy));
      dots.style('display', (s) => s.pts.some((p) => p.y === yy) ? null : 'none').attr('cx', x(yy)).attr('cy', (s) => { const p = s.pts.find((q2) => q2.y === yy); return p ? y(p.v) : 0; });
      tip.replaceChildren(el('div', 'd', String(yy)));
      series.map((s) => ({ s, p: s.pts.find((q2) => q2.y === yy) })).filter((o) => o.p).sort((a, b) => b.p.v - a.p.v).forEach(({ s, p }) => {
        const ln = el('div'); const sw = el('i', 'sw'); sw.style.background = color(s.k);
        ln.append(sw, document.createTextNode(name(s.k) + ': ' + num(p.v) + ' zł/m²' + (p.n ? ' (' + num(p.n) + ' transakcji)' : ' (brak danych o liczbie)')));
        tip.appendChild(ln);
      });
      tip.hidden = false;
      const left = px + 14 + tip.offsetWidth > box.clientWidth ? px - tip.offsetWidth - 14 : px + 14;
      tip.style.left = Math.max(4, left) + 'px'; tip.style.top = Math.max(4, py - 20) + 'px';
    })
    .on('mouseleave', () => { tip.hidden = true; rule.style('display', 'none'); dots.style('display', 'none'); });

  // tabela trendu
  const tb = q('.lk-trend tbody');
  const pctCell = (v, good) => { const td = el('td', 'num'); td.appendChild(el('span', 'lk-pct ' + (v == null ? '' : good(v) ? 'good' : v < 0 ? 'bad' : ''), v == null ? '—' : pct(v))); return td; };
  tb.replaceChildren(...D.trend.slice().sort((a, b) => (a.powiat === woj) - (b.powiat === woj) || b.wzrost_10l_pct - a.wzrost_10l_pct).map((t) => {
    const tr = el('tr'); tr.dataset.key = t.powiat;
    tr.appendChild(el('td', null, t.obszar));
    tr.appendChild(el('td', 'num lk-hide-narrow', num(t.cena_2015)));
    tr.appendChild(el('td', 'num', num(t.cena_2024)));
    tr.appendChild(pctCell(t.wzrost_10l_pct, (v) => v >= 80));
    tr.appendChild(pctCell(t.srednio_rocznie_pct, (v) => v >= 6));
    tr.appendChild(pctCell(t.zmiana_rr_pct, (v) => v >= 5));
    tr.appendChild(el('td', 'num lk-hide-narrow', t.transakcje_2024 == null ? 'brak danych' : num(t.transakcje_2024)));
    const w = el('td'); const b = el('span', 'lk-rel ' + (t.wiarygodnosc === 'wysoka' ? 'hi' : t.wiarygodnosc === 'średnia' ? 'mid' : 'lo'), t.wiarygodnosc); b.dataset.t = 'wiarygodnosc'; w.appendChild(b); tr.appendChild(w);
    return tr;
  }));
}

// ===== KALKULATOR =====
function drawFlip(D, rows) {
  drawLegend(q('.lk-flip-legend'), SEG.map((s, i) => [s.name, segColor(i)]).concat([['Zysk', 'var(--color-ok)'], ['Kwota ze sprzedaży', 'var(--color-fg)', 1]]));
  q('.a-cel-txt').textContent = av(A.cel) + '%';
  const box = q('.lk-flip');
  box.replaceChildren();
  const data = rows.map((r) => r.f).filter(Boolean).sort((a, b) => b.zysk - a.zysk);
  window.lkFlipData = data;
  const short = (r) => r.miejscowosc + (r.udzial ? ' (udz. ' + r.udzial + ')' : '') + (window.lkRF[r.id] != null ? ' ✎' : '');
  if (!data.length) { box.appendChild(el('div', 'lk-empty', 'Brak ofert z ceną rynkową dla wybranych filtrów.')); }
  else {
    const W = box.clientWidth || 600, rowH = 36;
    const svg = d3.select(box).append('svg').attr('width', '100%');
    const meas = svg.append('g'); let lw = 0, rw = 0;
    data.forEach((d) => {
      lw = Math.max(lw, meas.append('text').attr('font-size', 12).text(short(d.r)).node().getComputedTextLength());
      rw = Math.max(rw, meas.append('text').attr('font-size', 12).text(zlk(d.zysk) + ' · ' + pct(d.roi * 100)).node().getComputedTextLength());
    });
    meas.remove();
    const m = { l: Math.min(lw + 10, W * 0.32), r: Math.min(rw + 12, W * 0.3), t: 4, b: 22 };
    const H = m.t + m.b + data.length * rowH;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H); box.style.minHeight = H + 'px';
    const maxV = d3.max(data, (d) => Math.max(d.sprzedaz, d.sprzedaz - d.zysk)) || 1;
    const x = d3.scaleLinear([0, maxV], [m.l, W - m.r]).nice();
    const y = d3.scaleBand(data.map((d) => d.r.id), [m.t, H - m.b]).padding(0.32);
    const ticks = x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 80)));
    svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (t) => x(t)).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((t) => t === 0 ? '0' : Math.round(t / 1000) + ' tys.');
    const tip = el('div', 'lk-tip'); tip.hidden = true; box.appendChild(tip);
    const g = svg.append('g').selectAll('g').data(data).join('g').style('cursor', 'pointer').on('click', (e, d) => { window.lkWf = d.r.id; drawWaterfall(D); q('#rozliczenie').scrollIntoView({ block: 'nearest' }); });
    g.append('text').attr('x', m.l - 8).attr('y', (d) => y(d.r.id) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).attr('fill', 'var(--color-fg-muted)').text((d) => short(d.r));
    g.each(function (d) {
      let acc = 0; const gg = d3.select(this);
      SEG.map((s, i) => ({ i, v: d[s.key] })).concat(d.zysk > 0 ? [{ i: -1, v: d.zysk }] : []).forEach((p) => {
        if (p.v <= 0) return;
        gg.append('rect').attr('x', x(acc)).attr('y', y(d.r.id)).attr('height', y.bandwidth()).attr('width', Math.max(0.5, x(acc + p.v) - x(acc))).attr('fill', p.i < 0 ? 'var(--color-ok)' : segColor(p.i)).attr('opacity', p.i < 0 ? 0.55 : 1);
        acc += p.v;
      });
      gg.append('line').attr('x1', x(d.sprzedaz)).attr('x2', x(d.sprzedaz)).attr('y1', y(d.r.id) - 4).attr('y2', y(d.r.id) + y.bandwidth() + 4).attr('stroke', 'var(--color-fg)').attr('stroke-width', 2).attr('stroke-linecap', 'round');
      gg.append('text').attr('x', W - m.r + 8).attr('y', y(d.r.id) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 12).style('font-variant-numeric', 'tabular-nums').attr('fill', d.zysk >= 0 ? 'var(--color-ok)' : 'var(--color-bad)').text(zlk(d.zysk) + ' · ' + pct(d.roi * 100));
    });
    g.append('rect').attr('x', 0).attr('width', W).attr('y', (d) => y(d.r.id) - y.step() * y.paddingInner() / 2).attr('height', y.step()).attr('fill', 'transparent')
      .on('mousemove', (e, d) => {
        tip.replaceChildren(el('div', 'd', label2(d.r)));
        SEG.forEach((s, i) => { const ln = el('div'); const sw = el('i', 'sw'); sw.style.background = segColor(i); ln.append(sw, document.createTextNode(s.name + ': ' + zl(d[s.key]) + (s.key === 'remont' && d.wlasny ? ' (własna kwota)' : ''))); tip.appendChild(ln); });
        tip.appendChild(el('div', null, 'Ze sprzedaży: ' + zl(d.sprzedaz)));
        tip.appendChild(el('div', null, (d.zysk >= 0 ? 'Zysk: ' : 'Strata: ') + zl(Math.abs(d.zysk)) + ' (' + pct(d.roi * 100) + ' wkładu)'));
        tip.hidden = false; const [px, py] = d3.pointer(e, box);
        tip.style.left = Math.max(4, Math.min(px + 12, box.clientWidth - tip.offsetWidth - 4)) + 'px'; tip.style.top = (py + 12) + 'px';
      }).on('mouseleave', () => { tip.hidden = true; });
  }

  // tabela maksymalnych cen
  const mx = q('.lk-max');
  mx.replaceChildren();
  const tbl = el('table', 'lk-table plain');
  const thead = el('thead'); const hr = el('tr');
  [['Mieszkanie'], ['Cena wywołania', 'cena_wywolania', 'num'], ['Maks. cena', 'maks_cena', 'num'], ['Zapas', 'przebicie', 'num'], ['Zysk przy cenie wywołania', 'zysk', 'num lk-hide-narrow']].forEach(([n, t, c]) => { const th = el('th', c || null); if (t) th.appendChild(term(t, n)); else th.textContent = n; hr.appendChild(th); });
  thead.appendChild(hr); tbl.appendChild(thead);
  const tb = el('tbody');
  data.forEach((d) => {
    const m = maksCena(d.r, D.st);
    const tr = el('tr');
    const a = el('td'); a.appendChild(el('div', null, label2(d.r))); a.appendChild(el('span', 'small')).appendChild(badge(d.r.oc)); tr.appendChild(a);
    tr.appendChild(el('td', 'num', zl(d.r.cena)));
    tr.appendChild(el('td', 'num', m ? zl(m) : 'nie opłaca się'));
    const z = el('td', 'num'); const zz = el('span', 'lk-pct ' + (!m ? 'bad' : m >= d.r.cena * 1.1 ? 'good' : m < d.r.cena ? 'bad' : ''), m ? pct((m / d.r.cena - 1) * 100) : '—'); z.appendChild(zz); tr.appendChild(z);
    tr.appendChild(el('td', 'num lk-hide-narrow', zlk(d.zysk)));
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); mx.appendChild(tbl);
  mx.appendChild(el('p', 'note', '„Zapas” – o ile procent możesz przebić cenę wywołania. Ujemny zapas znaczy, że nawet cena wywołania jest za wysoka przy Twoich założeniach.'));

  const sel = q('.a-oferta');
  const prev = window.lkWf || sel.value;
  sel.replaceChildren(...data.map((d) => new Option(label2(d.r) + ' – ' + zl(d.r.cena), d.r.id)));
  if (data.length) sel.value = data.some((d) => d.r.id === prev) ? prev : data[0].r.id;
  window.lkWf = sel.value;
  drawWaterfall(D);
}

function drawWaterfall(D) {
  const box = q('.lk-wf'), sum = q('.lk-wf-sum');
  box.replaceChildren(); sum.replaceChildren();
  const d = (window.lkFlipData || []).find((x) => x.r.id === window.lkWf);
  const rf = q('.a-rflat'), rn = q('.lk-rflat-note');
  if (!d) { rf.value = ''; rn.textContent = ''; box.appendChild(el('div', 'lk-empty', 'Brak oferty do rozliczenia.')); return; }
  q('.a-oferta').value = d.r.id;
  if (rf !== document.activeElement) rf.value = d.wlasny ? Math.round(d.remontCaly) : '';
  rf.placeholder = num(Math.round(d.remontCaly)) + ' (z ustawień)';
  q('.a-rflat-clear').hidden = !d.wlasny;
  rn.textContent = (d.wlasny ? 'Własna kwota remontu dla tego mieszkania. ' : 'Wpisz kwotę, żeby zastąpić ustawienie ogólne tylko dla tego mieszkania. ') + (d.r.udzial ? 'To udział ' + d.r.udzial + ', więc do rozliczenia wchodzi ' + zl(d.remont) + '.' : '');
  const steps = [{ name: 'Ze sprzedaży', v: d.sprzedaz, type: 'total' }].concat(SEG.map((s, i) => ({ name: s.name, v: -d[s.key], type: 'cost', i }))).concat([{ name: d.zysk >= 0 ? 'Zysk' : 'Strata', v: d.zysk, type: 'end' }]);
  let run = 0;
  steps.forEach((s) => { if (s.type === 'total') { s.y0 = 0; s.y1 = s.v; run = s.v; } else if (s.type === 'cost') { s.y0 = run; s.y1 = run + s.v; run = s.y1; } else { s.y0 = 0; s.y1 = s.v; } });
  const W = box.clientWidth || 600, H = 270, m = { l: 56, r: 8, t: 20, b: 44 };
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  box.style.minHeight = H + 'px';
  const lo = Math.min(0, d3.min(steps, (s) => Math.min(s.y0, s.y1))), hi = d3.max(steps, (s) => Math.max(s.y0, s.y1));
  const y = d3.scaleLinear([lo, hi], [H - m.b, m.t]).nice();
  const x = d3.scaleBand(steps.map((s) => s.name), [m.l, W - m.r]).padding(0.25);
  const yt = y.ticks(5);
  svg.append('g').selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => y(t)).attr('y2', (t) => y(t)).attr('stroke', (t) => t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)');
  svg.append('g').selectAll('text').data(yt).join('text').attr('x', m.l - 6).attr('y', (t) => y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((t) => t === 0 ? '0' : Math.round(t / 1000) + ' tys.');
  const bw = x.bandwidth();
  const g = svg.append('g').selectAll('g').data(steps).join('g');
  g.append('rect').attr('x', (s) => x(s.name)).attr('width', bw).attr('y', (s) => y(Math.max(s.y0, s.y1))).attr('height', (s) => Math.max(1, Math.abs(y(s.y0) - y(s.y1)))).attr('rx', 3)
    .attr('fill', (s) => s.type === 'total' ? 'var(--color-fg-muted)' : s.type === 'end' ? (s.v >= 0 ? 'var(--color-ok)' : 'var(--color-bad)') : segColor(s.i));
  g.append('text').attr('x', (s) => x(s.name) + bw / 2).attr('y', (s) => y(Math.max(s.y0, s.y1)) - 5).attr('text-anchor', 'middle').attr('font-size', 11).style('font-variant-numeric', 'tabular-nums').attr('fill', 'var(--color-fg)')
    .text((s) => Math.abs(s.v) < 1 ? '0' : (s.type === 'cost' ? '−' : '') + zlk(Math.abs(s.v)).replace(' zł', ''));
  svg.append('g').selectAll('text').data(steps).join('text').attr('y', H - m.b + 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)')
    .each(function (s) { const w = s.name.split(' '); const t = d3.select(this); (bw < 70 && w.length > 1 ? [w[0], w.slice(1).join(' ')] : [s.name]).forEach((ln, i) => t.append('tspan').attr('x', x(s.name) + bw / 2).attr('dy', i ? '1.2em' : 0).text(ln)); });
  const p = (t, k, v) => { const x = el('div'); const a = el('span', 'k'); a.appendChild(term(t, k)); x.append(a, el('span', 'v', v)); sum.appendChild(x); };
  p('wklad', 'Potrzebna gotówka', zl(d.wklad));
  p('cena_ofertowa', 'Sprzedaż po', num(Math.round(d.rynekM2 * (1 - av(A.rabat) / 100))) + ' zł/m²');
  p('pcc', 'PCC + wpis' + (d.eksm ? ' + opróżnienie' : ''), zl(d.oplaty));
  p('prowizja', 'Prowizja z VAT + świadectwo', zl(d.sprzedaz_koszty));
  p('pit', 'PIT', zl(d.pit));
  p('zysk', d.zysk >= 0 ? 'Zysk na czysto' : 'Strata', zl(Math.abs(d.zysk)) + ' (' + pct(d.roi * 100) + ')');
  const mx = maksCena(d.r, D.st);
  p('maks_cena', 'Maks. cena (cel ' + av(A.cel) + '%)', mx ? zl(mx) : 'nie opłaca się');
}
q('.a-oferta').addEventListener('change', () => { window.lkWf = q('.a-oferta').value; window.lkDraw(); });
q('.a-rflat').addEventListener('input', () => {
  const x = q('.a-rflat'), id = window.lkWf;
  if (!id) return;
  if (x.value === '' || isNaN(Number(x.value))) delete window.lkRF[id]; else window.lkRF[id] = Math.max(0, Number(x.value));
  window.lkDraw();
});
q('.a-rflat').addEventListener('blur', () => window.lkDraw());
q('.a-rflat-clear').addEventListener('click', () => { delete window.lkRF[window.lkWf]; q('.a-rflat').value = ''; window.lkDraw(); });

// ===== PORADNIK =====
const gl = q('.lk-gloss'), glq = q('.lk-gloss-q');
function drawGloss() {
  const f = glq.value.trim().toLowerCase();
  const seen = new Set();
  gl.replaceChildren(...Object.values(S).filter(([n, t]) => { if (seen.has(n)) return false; seen.add(n); return !f || n.toLowerCase().includes(f) || t.toLowerCase().includes(f); })
    .sort((a, b) => a[0].localeCompare(b[0], 'pl')).map(([n, t]) => { const d = el('div'); d.append(el('b', null, n), el('p', null, t)); return d; }));
  if (!gl.childNodes.length) gl.appendChild(el('div', 'lk-empty', 'Nic nie znaleziono.'));
}
glq.addEventListener('input', drawGloss);
drawGloss();
const cl = qa('.lk-checklist input');
const clp = q('.lk-progress');
cl.forEach((c) => c.addEventListener('change', () => { const n = cl.filter((x) => x.checked).length; clp.textContent = n + ' z ' + cl.length + (n === cl.length ? ' – możesz myśleć o wpłacie rękojmi.' : ''); }));

// ===== Główne rysowanie =====
window.lkDraw = () => {
  q('.a-remont-val').textContent = num(av(A.remont));
  q('.a-rm2-wrap').hidden = A.rmode.value !== 'm2';
  q('.a-rkw-wrap').hidden = A.rmode.value !== 'kwota';

  if (DATA.status === 'ok') {
    const v = Object.fromEntries(DATA.podsumowanie.map((x) => [x.metryka, x.wartosc]));
    const set = (f, t) => { const x = q(`[data-source="podsumowanie"][data-where="metryka=${f}"]`); x.classList.remove('dash-skeleton'); x.textContent = t; };
    set('liczba', num(v.liczba));
    set('min_cena_cale', zl(v.min_cena_cale));
    set('min_m2_cale', v.min_m2_cale == null ? '—' : num(v.min_m2_cale));
    set('najblizszy', dataKr(v.najblizszy));
    set('mediana_vs_ofertowa', pct(v.mediana_vs_ofertowa));
  }

  const D = dataset();
  const fr = q('.lk-fresh-txt');
  if (D.status === 'error') { fr.textContent = 'Nie udało się wczytać części danych – szczegóły w konsoli przeglądarki.'; ['.lk-tops', '.lk-dates', '.lk-detail', '.lk-chart', '.lk-flip', '.lk-max', '.lk-wf', '.lk-hist'].forEach((x) => fail(q(x))); return; }
  if (D.status !== 'ok') return;

  const spr = D.rows.map((r) => r.sprawdzono).filter(Boolean).sort().pop();
  const old = spr ? dni(spr) < -2 : true;
  fr.replaceChildren();
  const dot = el('span', 'lk-dot' + (old ? ' old' : ''));
  const a = el('span'); a.append(dot, document.createTextNode('Oferty sprawdzone: ' + (spr ? dataPL(spr) : 'nieznana data')));
  fr.appendChild(a);
  fr.appendChild(el('span', null, old ? 'Dane mogą być nieaktualne – automat nie odświeżył ich od kilku dni.' : 'Automat sprawdza nowe i zakończone licytacje codziennie ok. 6:52.'));
  const nowe = D.rows.filter(isNew).length;
  if (nowe) fr.appendChild(el('span', null, nowe + ' nowych w ostatnich dniach'));

  const rows = filtered(D.rows);
  const tab = window.lkTab;
  if (tab === 'start') drawStart(D);
  if (tab === 'oferty') drawOferty(D, rows);
  if (tab === 'rynek') { drawRynek(D, rows); drawHist(D); }
  if (tab === 'kalkulator') drawFlip(D, rows);
};

window.lkDraw();
wczytajDane().then(() => window.lkDraw());
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => window.lkDraw(), 150); });
const hash = location.hash.slice(1);
if (TABS.includes(hash)) goTab(hash);
