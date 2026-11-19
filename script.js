/* Dicionario de Dados - Sistema de Gestao Operacional e Vendas (Kalunga S.A.)
   Funcoes: tema claro/escuro, menu lateral dinamico, pesquisa em tempo real,
   modal do DER com zoom e arraste, modal do DDL com copia. */
(function () {
  "use strict";

  /* ---------------- Tema claro / escuro ---------------- */
  var root = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var themeLabel = document.getElementById("themeLabel");

  function readTheme() {
    try { return localStorage.getItem("dd-theme"); } catch (e) { return null; }
  }
  function saveTheme(t) {
    try { localStorage.setItem("dd-theme", t); } catch (e) { /* armazenamento indisponivel */ }
  }
  function applyTheme(t) {
    if (t === "dark") { root.setAttribute("data-theme", "dark"); } else { root.removeAttribute("data-theme"); }
    themeLabel.textContent = t === "dark" ? "Modo claro" : "Modo escuro";
    themeBtn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
  }
  var initial = readTheme() ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initial);
  themeBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  });

  /* ---------------- Menu lateral gerado a partir das tabelas ---------------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll(".dict-table"));
  var nav = document.getElementById("tableNav");
  var links = {};
  sections.forEach(function (sec) {
    var a = document.createElement("a");
    a.href = "#" + sec.id;
    a.className = "side-link";
    a.textContent = sec.id;
    nav.appendChild(a);
    links[sec.id] = a;
  });
  document.getElementById("tableCount").textContent = "(" + sections.length + ")";

  var sidebar = document.getElementById("sidebar");
  var backdrop = document.getElementById("backdrop");
  var menuBtn = document.getElementById("menuBtn");
  function setMenu(open) {
    sidebar.classList.toggle("open", open);
    backdrop.classList.toggle("show", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuBtn.addEventListener("click", function () { setMenu(!sidebar.classList.contains("open")); });
  backdrop.addEventListener("click", function () { setMenu(false); });
  sidebar.addEventListener("click", function (ev) {
    if (ev.target.tagName === "A") { setMenu(false); }
  });

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove("active"); });
          if (links[en.target.id]) { links[en.target.id].classList.add("active"); }
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---------------- Pesquisa em tempo real ---------------- */
  var search = document.getElementById("search");
  var info = document.getElementById("searchInfo");
  var noResults = document.getElementById("noResults");

  function normalize(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  // guarda o texto original dos nomes para destacar e restaurar
  sections.forEach(function (sec) {
    sec.querySelectorAll("tbody tr").forEach(function (tr) {
      var codeEl = tr.querySelector("td:first-child code");
      tr.dataset.col = codeEl.textContent;
    });
  });

  function highlight(el, text, term) {
    if (!term) { el.textContent = text; return; }
    var i = normalize(text).indexOf(term);
    if (i < 0) { el.textContent = text; return; }
    el.textContent = "";
    el.appendChild(document.createTextNode(text.slice(0, i)));
    var m = document.createElement("mark");
    m.textContent = text.slice(i, i + term.length);
    el.appendChild(m);
    el.appendChild(document.createTextNode(text.slice(i + term.length)));
  }

  function runSearch() {
    var term = normalize(search.value.trim());
    var tablesShown = 0, rowsShown = 0;
    sections.forEach(function (sec) {
      var tableMatch = !term || normalize(sec.id).indexOf(term) >= 0;
      var visibleRows = 0;
      sec.querySelectorAll("tbody tr").forEach(function (tr) {
        var col = tr.dataset.col;
        var colMatch = term && normalize(col).indexOf(term) >= 0;
        var show = tableMatch || colMatch;
        tr.classList.toggle("is-hidden", !show);
        highlight(tr.querySelector("td:first-child code"), col, colMatch ? term : "");
        if (show) { visibleRows++; }
      });
      highlight(sec.querySelector(".dict-head h3 code"), sec.id, tableMatch && term ? term : "");
      var showSec = visibleRows > 0;
      sec.classList.toggle("is-hidden", !showSec);
      links[sec.id].classList.toggle("is-hidden", !showSec);
      if (showSec) { tablesShown++; rowsShown += visibleRows; }
    });
    noResults.hidden = tablesShown > 0;
    info.textContent = term ? tablesShown + " tabela(s), " + rowsShown + " coluna(s)" : "";
  }
  search.addEventListener("input", runSearch);
  search.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { search.value = ""; runSearch(); }
  });

  /* ---------------- Modais ---------------- */
  var lastFocus = null;
  function openModal(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    var first = modal.querySelector("button");
    if (first) { first.focus(); }
  }
  function closeModal(modal) {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocus) { lastFocus.focus(); }
  }
  document.querySelectorAll(".modal").forEach(function (modal) {
    modal.addEventListener("click", function (ev) {
      if (ev.target === modal || ev.target.hasAttribute("data-close")) { closeModal(modal); }
    });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") { return; }
    document.querySelectorAll(".modal").forEach(function (m) { if (!m.hidden) { closeModal(m); } });
  });

  /* ---------------- DER: zoom e arraste ---------------- */
  var derModal = document.getElementById("derModal");
  var stage = document.getElementById("derStage");
  var img = document.getElementById("derImg");
  var view = { scale: 1, x: 0, y: 0 };
  var MIN = 0.1, MAX = 8;

  function render() {
    img.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.scale + ")";
  }
  function fit() {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { return; }
    var sw = stage.clientWidth, sh = stage.clientHeight;
    view.scale = Math.min(sw / w, sh / h) * 0.96;
    view.x = (sw - w * view.scale) / 2;
    view.y = (sh - h * view.scale) / 2;
    render();
  }
  function zoomAt(factor, cx, cy) {
    var next = Math.min(MAX, Math.max(MIN, view.scale * factor));
    var k = next / view.scale;
    view.x = cx - (cx - view.x) * k;
    view.y = cy - (cy - view.y) * k;
    view.scale = next;
    render();
  }
  function zoomCenter(factor) { zoomAt(factor, stage.clientWidth / 2, stage.clientHeight / 2); }

  document.getElementById("openDer").addEventListener("click", function () {
    openModal(derModal);
    if (img.complete) { fit(); } else { img.addEventListener("load", fit, { once: true }); }
  });
  document.getElementById("zoomIn").addEventListener("click", function () { zoomCenter(1.25); });
  document.getElementById("zoomOut").addEventListener("click", function () { zoomCenter(0.8); });
  document.getElementById("zoomReset").addEventListener("click", fit);
  window.addEventListener("resize", function () { if (!derModal.hidden) { fit(); } });

  stage.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var r = stage.getBoundingClientRect();
    zoomAt(ev.deltaY < 0 ? 1.12 : 0.89, ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });

  var pointers = {};
  var last = null, pinchDist = 0;
  function dist() {
    var p = Object.keys(pointers).map(function (k) { return pointers[k]; });
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
  stage.addEventListener("pointerdown", function (ev) {
    stage.setPointerCapture(ev.pointerId);
    pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    last = { x: ev.clientX, y: ev.clientY };
    if (Object.keys(pointers).length === 2) { pinchDist = dist(); }
    stage.classList.add("dragging");
  });
  stage.addEventListener("pointermove", function (ev) {
    if (!pointers[ev.pointerId]) { return; }
    pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var n = Object.keys(pointers).length;
    if (n === 2) {
      var d = dist();
      var p = Object.keys(pointers).map(function (k) { return pointers[k]; });
      var r = stage.getBoundingClientRect();
      if (pinchDist) { zoomAt(d / pinchDist, (p[0].x + p[1].x) / 2 - r.left, (p[0].y + p[1].y) / 2 - r.top); }
      pinchDist = d;
    } else if (n === 1 && last) {
      view.x += ev.clientX - last.x;
      view.y += ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      render();
    }
  });
  function endPointer(ev) {
    delete pointers[ev.pointerId];
    var rest = Object.keys(pointers);
    last = rest.length === 1 ? { x: pointers[rest[0]].x, y: pointers[rest[0]].y } : null;
    pinchDist = 0;
    if (!rest.length) { stage.classList.remove("dragging"); }
  }
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  /* ---------------- DDL: modal e copia ---------------- */
  var ddlModal = document.getElementById("ddlModal");
  var ddlCode = document.getElementById("ddlCode");
  var ddlText = ddlCode.textContent;
  var copyBtn = document.getElementById("copyDdl");

  document.getElementById("openDdl").addEventListener("click", function () {
    openModal(ddlModal);
    if (window.Prism && !ddlCode.dataset.highlighted) {
      window.Prism.highlightElement(ddlCode);
      ddlCode.dataset.highlighted = "1";
    }
  });

  function copyFallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function feedback(text) {
    copyBtn.textContent = text;
    setTimeout(function () { copyBtn.textContent = "Copiar DDL"; }, 2000);
  }
  copyBtn.addEventListener("click", function () {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(ddlText).then(function () { feedback("Copiado!"); },
        function () { feedback(copyFallback(ddlText) ? "Copiado!" : "Falha ao copiar"); });
    } else {
      feedback(copyFallback(ddlText) ? "Copiado!" : "Falha ao copiar");
    }
  });
})();
