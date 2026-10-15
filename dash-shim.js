// Lekki zamiennik środowiska dashboardu Claude – pozwala uruchomić stronę samodzielnie (np. na GitHub Pages).
(function () {
  const FILES = {
    licytacje: 'data/licytacje.json',
    ceny_rynkowe: 'data/ceny_rynkowe.json',
    koszty_stawki: 'data/koszty_stawki.json',
    historia_cen: 'data/historia_cen.json',
    ogloszenia: 'data/ogloszenia.json',
  };
  const DATA = {}, CALC = {}, CACHE = {}, cbs = [];
  let status = 'loading', message = '';
  const run = () => cbs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  const dash = {
    colors: ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'],
    calc(id, o) { CALC[id] = o; },
    loader() {},
    data(id) {
      if (id in DATA) return { status: 'ok', data: DATA[id], columns: [], meta: [] };
      if (CALC[id]) {
        if (id in CACHE) return { status: 'ok', data: CACHE[id] };
        const ins = CALC[id].inputs.map((i) => dash.data(i));
        if (ins.some((x) => x.status === 'error')) return { status: 'error', data: [] };
        if (ins.some((x) => x.status !== 'ok')) return { status, data: [] };
        try { CACHE[id] = CALC[id].fn(...ins.map((x) => x.data)); return { status: 'ok', data: CACHE[id] }; }
        catch (e) { console.error(e); return { status: 'error', data: [], message: String(e) }; }
      }
      return { status: status === 'error' ? 'error' : 'loading', data: [], message };
    },
    onData(fn) { cbs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    refresh() {},
    params() { return {}; },
    setParams() { run(); },
    resetParams() { run(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } },
  };
  window.dash = dash;
  Promise.all(Object.entries(FILES).map(([id, url]) => fetch(url, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); }).then((j) => { DATA[id] = Array.isArray(j) ? j : (j.rows || j.data || j); })))
    .then(() => { status = 'ok'; run(); })
    .catch((e) => { status = 'error'; message = String(e); console.error(e); run(); });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 150); });
})();
