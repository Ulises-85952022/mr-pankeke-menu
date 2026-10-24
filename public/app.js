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

  // Fotos y favoritos que se publican desde el panel. Si no hay datos, se queda lo que trae el HTML.
  function fotoUrl(id, v, tam) {
    return "/fotos/" + id + "/" + v + "/" + tam + ".jpg";
  }

  function aplicarFotoPlato(id, v) {
    var row = document.querySelector('#menu .row[data-id="' + id + '"]');
    if (!row) return;
    var img = row.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.width = 96;
      img.height = 96;
      img.alt = "";
      row.insertBefore(img, row.firstChild);
      row.classList.add("has-thumb");
    }
    img.src = fotoUrl(id, v, "thumb");
    img.removeAttribute("srcset");
  }

  function crearFavorito(id) {
    var row = document.querySelector('#menu .row[data-id="' + id + '"]');
    if (!row) return null;
    var li = document.createElement("li");
    li.className = "fav";
    li.setAttribute("data-id", id);

    var img = document.createElement("img");
    img.loading = "lazy";
    var desc = row.querySelector("p");
    img.alt = desc ? desc.textContent : "";
    var thumb = row.querySelector("img");
    if (thumb) img.src = thumb.src;
    li.appendChild(img);

    var body = document.createElement("div");
    body.className = "fav-body";
    var head = document.createElement("div");
    head.className = "row-head";
    var h4 = document.createElement("h4");
    h4.textContent = row.querySelector("h4").textContent;
    var precio = document.createElement("span");
    precio.className = "price";
    precio.textContent = row.querySelector(".price").textContent;
    head.appendChild(h4);
    head.appendChild(precio);
    body.appendChild(head);
    if (desc) {
      var p = document.createElement("p");
      p.textContent = desc.textContent;
      body.appendChild(p);
    }
    li.appendChild(body);
    return li;
  }

  function aplicarFotoFavorito(li, id, v) {
    var img = li.querySelector("img");
    if (!img) return;
    img.src = fotoUrl(id, v, "600");
    img.srcset = fotoUrl(id, v, "600") + " 600w, " + fotoUrl(id, v, "1200") + " 1200w";
  }

  function aplicarFavoritos(items, fotos) {
    var primero = document.querySelector("li.fav");
    if (!primero) return;
    var cont = primero.parentNode;
    var existentes = {};
    Array.prototype.slice.call(cont.querySelectorAll("li.fav")).forEach(function (li) {
      existentes[li.getAttribute("data-id")] = li;
      li.parentNode.removeChild(li);
    });
    items.forEach(function (id) {
      var li = existentes[id] || crearFavorito(id);
      if (!li) return;
      if (fotos[id]) aplicarFotoFavorito(li, id, fotos[id]);
      cont.appendChild(li);
    });
  }

  function setupMenuDatos() {
    fetch("/datos-menu.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var fotos = d.fotos || {};
        Object.keys(fotos).forEach(function (id) { aplicarFotoPlato(id, fotos[id]); });
        if (Array.isArray(d.favoritos) && d.favoritos.length) aplicarFavoritos(d.favoritos, fotos);
      })
      .catch(function () { /* sin datos, el menú se ve igual */ });
  }

  document.addEventListener("DOMContentLoaded", function () {
    markToday();
    setupSearch();
    setupCatnav();
    setupShare();
    setupMenuDatos();
  });
})();
