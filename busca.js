(function () {
  var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var script = document.currentScript;
  var lista = document.getElementById("buscaResultados");

  /* Página inicial: leva a busca para a página de resultados */
  if (!lista) {
    var alvo = script && script.dataset.busca;
    if (!alvo) return;
    window.addEventListener("load", function () {
      var b = document.getElementById("searchBtn"), i = document.getElementById("searchInput");
      if (!b || !i) return;
      var nb = b.cloneNode(true), ni = i.cloneNode(true);
      b.replaceWith(nb); i.replaceWith(ni);
      var ir = function () { location.href = alvo + "?q=" + encodeURIComponent(ni.value.trim()); };
      nb.addEventListener("click", ir);
      ni.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); ir(); } });
    });
    return;
  }

  /* Página de busca */
  var data = window.NZ_INDEX || [];
  var input = document.getElementById("buscaInput");
  var info = document.getElementById("buscaInfo");
  var chips = document.getElementById("buscaChips");
  var cats = ["Todos"].concat(data.map(function (d) { return d.c; }).filter(function (c, i, a) { return c !== "Site" && a.indexOf(c) === i; }));
  var cat = "Todos";
  input.value = new URLSearchParams(location.search).get("q") || "";

  function marcar(raw, termos) {
    var n = norm(raw), r = [];
    termos.forEach(function (t) { var p = n.indexOf(t); while (p >= 0) { r.push([p, p + t.length]); p = n.indexOf(t, p + t.length); } });
    r.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", pos = 0;
    r.forEach(function (x) { if (x[0] < pos) return; out += esc(raw.slice(pos, x[0])) + "<mark>" + esc(raw.slice(x[0], x[1])) + "</mark>"; pos = x[1]; });
    return out + esc(raw.slice(pos));
  }
  function trecho(x, termos) {
    var n = norm(x), p = -1;
    for (var k = 0; k < termos.length && p < 0; k++) p = n.indexOf(termos[k]);
    if (p < 0) p = 0;
    var ini = Math.max(0, p - 60), fim = Math.min(x.length, ini + 170);
    return (ini > 0 ? "… " : "") + marcar(x.slice(ini, fim), termos) + (fim < x.length ? " …" : "");
  }
  function buscar(q) {
    var termos = norm(q).split(/\s+/).filter(Boolean);
    var base = data.filter(function (d) { return cat === "Todos" || d.c === cat; });
    if (!termos.length) return { termos: termos, itens: base.map(function (d) { return { d: d, s: 0 }; }) };
    var itens = base.map(function (d) {
      var t = norm(d.t), ds = norm(d.d), c = norm(d.c), x = norm(d.x), s = 0;
      for (var k = 0; k < termos.length; k++) {
        var a = t.indexOf(termos[k]) >= 0, b = ds.indexOf(termos[k]) >= 0, e = c.indexOf(termos[k]) >= 0, f = x.indexOf(termos[k]) >= 0;
        if (!(a || b || e || f)) return null;
        s += (a ? 6 : 0) + (b ? 3 : 0) + (e ? 2 : 0) + (f ? 1 : 0);
      }
      return { d: d, s: s };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; });
    return { termos: termos, itens: itens };
  }
  function desenharChips() {
    chips.innerHTML = cats.map(function (c) { return '<button type="button" class="chip' + (c === cat ? " active" : "") + '" data-c="' + esc(c) + '">' + esc(c) + "</button>"; }).join("");
  }
  function render() {
    var q = input.value.trim(), r = buscar(q);
    history.replaceState(null, "", q ? "?q=" + encodeURIComponent(q) : location.pathname);
    info.textContent = q ? r.itens.length + (r.itens.length === 1 ? " resultado" : " resultados") + ' para "' + q + '"' : "Todos os conteúdos (" + r.itens.length + ")";
    if (!r.itens.length) {
      lista.innerHTML = '<div class="busca-vazio"><p>Nada encontrado. Tente uma destas ideias:</p>' +
        ["jogos", "animes", "cinema", "streaming", "personagens", "tecnologia"].map(function (t) { return '<button type="button" class="chip" data-t="' + t + '">' + t + "</button>"; }).join("") + "</div>";
      return;
    }
    lista.innerHTML = r.itens.map(function (it) {
      var d = it.d;
      return '<a class="result-card" href="' + esc(d.u) + '">' + (d.i ? '<img loading="lazy" src="' + esc(d.i) + '" alt="">' : "") +
        '<div><span class="result-cat">' + esc(d.c) + "</span><h2>" + marcar(d.t, r.termos) + "</h2><p>" +
        (r.termos.length ? trecho(d.x, r.termos) : esc(d.d)) + "</p></div></a>";
    }).join("");
  }
  chips.addEventListener("click", function (e) { var b = e.target.closest("[data-c]"); if (!b) return; cat = b.dataset.c; desenharChips(); render(); });
  lista.addEventListener("click", function (e) { var b = e.target.closest("[data-t]"); if (!b) return; input.value = b.dataset.t; render(); });
  input.addEventListener("input", render);
  document.getElementById("buscaForm").addEventListener("submit", function (e) { e.preventDefault(); render(); });
  desenharChips(); render();
})();
