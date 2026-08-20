const DBD = {
  email: "contato@davibelodesign.com",
  whatsapp: "", // só dígitos, ex: 5511999999999
};

function header(page) {
  const item = (href, label, id) =>
    `<a href="${href}" ${page === id ? 'aria-current="page"' : ""}>${label}</a>`;
  return `
    <div class="header-inner">
      <a class="brand" href="index.html">davi belo <em>design</em></a>
      <button class="nav-toggle" type="button" aria-label="Abrir menu"><span></span></button>
      <nav class="nav">
        ${item("index.html", "Home", "home")}
        ${item("projetos.html", "Projetos", "projetos")}
        ${item("contato.html", "Contato", "contato")}
      </nav>
    </div>`;
}

function footer() {
  return `
    <div class="wrap site-footer">
      <span>© ${new Date().getFullYear()} Davi Belo Design</span>
      <span>Sites e páginas — do rascunho ao ar</span>
    </div>`;
}

document.querySelector("[data-header]").innerHTML = header(document.body.dataset.page);
document.querySelector("[data-footer]").innerHTML = footer();

document.querySelector(".nav-toggle")?.addEventListener("click", () => {
  document.body.classList.toggle("nav-open");
});

document.querySelectorAll("[data-email]").forEach((el) => {
  el.textContent = DBD.email;
  if (el.tagName === "A") el.href = `mailto:${DBD.email}`;
});

const wa = document.querySelector("[data-whatsapp]");
if (wa) {
  if (DBD.whatsapp) {
    wa.hidden = false;
    wa.href = `https://wa.me/${DBD.whatsapp}?text=${encodeURIComponent("Olá, quero um site com a Davi Belo Design.")}`;
  } else {
    wa.hidden = true;
  }
}

document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    const f = btn.dataset.filter;
    document.querySelectorAll("[data-cat]").forEach((card) => {
      card.style.display = f === "todos" || card.dataset.cat === f ? "" : "none";
    });
  });
});

const form = document.querySelector("#contato-form");
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const body = `Nome: ${data.nome}%0AEmail: ${data.email}%0AWhatsApp: ${data.fone}%0ATipo: ${data.tipo}%0A%0A${data.mensagem}`;
  window.location.href = `mailto:${DBD.email}?subject=${encodeURIComponent("Novo projeto — " + data.nome)}&body=${body}`;
  document.querySelector(".toast")?.classList.add("show");
});
