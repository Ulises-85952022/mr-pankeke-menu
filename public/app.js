// Mejoras opcionales: el menú completo se ve igual sin JavaScript.
(function () {
  "use strict";

  // Día de hoy en Tepatitlán, sin importar la zona horaria del visitante.
  function todayInTepa() {
    var wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", weekday: "short" }).format(new Date());
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
  }

  function markToday() {
    var li = document.querySelector('#hours li[data-day="' + todayInTepa() + '"]');
    if (li) li.classList.add("is-today");
  }

  // Quita acentos para que "cafe" encuentre "Café".
  function norm(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function setupSearch() {
    var box = document.getElementById("search");
    var input = document.getElementById("q");
    var empty = document.getElementById("search-empty");
    var menu = document.getElementById("menu");
    if (!box || !input) return;
    box.hidden = false;

    var rows = Array.prototype.slice.call(document.querySelectorAll("#menu .row"));
    rows.forEach(function (r) { r._q = norm(r.getAttribute("data-search") || ""); });
    var cats = document.querySelectorAll("#menu .cat");
    var groups = document.querySelectorAll("#menu .group");

    input.addEventListener("input", function () {
      var q = norm(input.value.trim());
      var any = false;
      rows.forEach(function (r) {
        var hit = !q || r._q.indexOf(q) !== -1;
        r.hidden = !hit;
        if (hit) any = true;
      });
      cats.forEach(function (c) { c.hidden = !!q && !c.querySelector(".row:not([hidden])"); });
      groups.forEach(function (g) { g.hidden = !!q && !g.querySelector(".cat:not([hidden])"); });
      menu.classList.toggle("is-searching", !!q);
      empty.hidden = any;
    });
  }

  function setupCatnav() {
    var nav = document.getElementById("catnav");
    if (!nav || !("IntersectionObserver" in window)) return;
    var links = {};
    nav.querySelectorAll("a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var a = links[e.target.id];
        if (!a || a === current) return;
        if (current) current.classList.remove("is-active");
        a.classList.add("is-active");
        current = a;
        nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth" });
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  function setupShare() {
    var btn = document.getElementById("share");
    if (!btn || !navigator.share) return;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      navigator.share({
        title: "Menú · Mr. Pankeke",
        text: "Mira el menú de Mr. Pankeke en Tepatitlán",
        url: location.origin + "/"
      }).catch(function () { /* el usuario canceló */ });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    markToday();
    setupSearch();
    setupCatnav();
    setupShare();
  });
})();
