// ========================================
// NERDZONE - SCRIPT PRINCIPAL
// Compartilhado por todas as páginas:
// cada recurso só roda se os elementos existirem.
// ========================================


// ========================================
// BOTÃO EXPLORAR
// ========================================

const explorarBtn = document.getElementById("explorarBtn");

if (explorarBtn) {

    explorarBtn.addEventListener("click", function () {

        const content = document.querySelector(".content");

        if (content) {

            content.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }

    });

}


// ========================================
// PESQUISA DO NERDZONE
// ========================================

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchMessage = document.getElementById("searchMessage");

const cards = document.querySelectorAll(".card");


// Ignora maiúsculas e acentos (ex.: "animacao" encontra "animação")

function normalizar(texto) {

    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

}


function pesquisar() {

    if (!searchInput) {
        return;
    }

    const termoOriginal = searchInput.value.trim();
    const termo = normalizar(termoOriginal);

    let encontrados = 0;


    cards.forEach(function (card) {

        const texto = normalizar(card.textContent);

        if (termo === "" || texto.includes(termo)) {

            card.style.display = "";

            encontrados++;

        } else {

            card.style.display = "none";

        }

    });


    if (!searchMessage) {
        return;
    }


    if (termo === "") {

        searchMessage.textContent = "";

    } else if (encontrados === 0) {

        searchMessage.textContent =
            "😕 Nenhum conteúdo encontrado para: " + termoOriginal;

    } else {

        searchMessage.textContent =
            "🔎 Encontramos " +
            encontrados +
            " conteúdo(s) para: " +
            termoOriginal;

    }

}


// Botão de pesquisa

if (searchBtn) {

    searchBtn.addEventListener("click", pesquisar);

}


if (searchInput) {

    // Tecla Enter

    searchInput.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {

            pesquisar();

        }

    });

    // Ao apagar tudo, os cards voltam a aparecer

    searchInput.addEventListener("input", function () {

        if (searchInput.value.trim() === "") {

            pesquisar();

        }

    });

}


// ========================================
// MODO CLARO / ESCURO
// ========================================

const themeToggle = document.getElementById("themeToggle");


function lerTema() {

    try {
        return localStorage.getItem("theme");
    } catch (erro) {
        return null;
    }

}


function salvarTema(tema) {

    try {
        localStorage.setItem("theme", tema);
    } catch (erro) {
        // Armazenamento indisponível: o tema vale só nesta página
    }

}


function aplicarTema(claro) {

    document.body.classList.toggle("light-mode", claro);

    if (themeToggle) {

        themeToggle.textContent = claro ? "🌞" : "🌙";

        themeToggle.setAttribute(
            "aria-label",
            claro ? "Ativar modo escuro" : "Ativar modo claro"
        );

    }

}


// Aplica o tema salvo (padrão: escuro)

aplicarTema(lerTema() === "light");


if (themeToggle) {

    themeToggle.addEventListener("click", function () {

        const claro = !document.body.classList.contains("light-mode");

        aplicarTema(claro);

        salvarTema(claro ? "light" : "dark");

    });

}


// ========================================
// BOTÃO VOLTAR AO TOPO
// ========================================

const topBtn = document.getElementById("topBtn");


if (topBtn) {

    function atualizarBotaoTopo() {

        topBtn.style.display = window.scrollY > 300 ? "flex" : "none";

    }


    // Verifica a posição ao carregar e durante a rolagem

    atualizarBotaoTopo();

    window.addEventListener("scroll", atualizarBotaoTopo, { passive: true });


    // Voltar ao topo

    topBtn.addEventListener("click", function () {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

}
