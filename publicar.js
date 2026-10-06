#!/usr/bin/env node
/*
  publicar.js — publicação automática do NerdZone

  O que faz, para cada arquivo .txt da pasta "rascunhos":
    1. cria a página do artigo (mesmo visual do site) em artigos/<categoria>/
    2. coloca o card do artigo na lista da categoria
    3. atualiza o busca-index.js (busca do site)
    4. atualiza o sitemap.xml
    5. move o rascunho para rascunhos/publicados/

  Como usar (na pasta raiz do site, onde está o index.html):
      node publicar.js            publica tudo que está em rascunhos/
      node publicar.js --teste    só mostra o que faria, sem mexer em nada
      node publicar.js --forcar   publica mesmo com [colchetes] sem preencher
      node publicar.js --remover nome-do-artigo
                                  tira um artigo do site, da lista, da busca e do sitemap

  Não precisa instalar nada além do Node.js.
*/
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const SITE = 'https://tonnysousa.github.io/NerdZone';const DIR_RASCUNHOS = path.join(RAIZ, 'rascunhos');
const DIR_PUBLICADOS = path.join(DIR_RASCUNHOS, 'publicados');
const DIR_ARTIGOS = path.join(RAIZ, 'artigos');
const ARQ_BUSCA = path.join(RAIZ, 'busca-index.js');
const ARQ_SITEMAP = path.join(RAIZ, 'sitemap.xml');
const MARCA = '<!-- gerado por publicar.js -->';

const args = process.argv.slice(2);
const TESTE = args.includes('--teste');
const FORCAR = args.includes('--forcar');

const CATEGORIAS = {
  jogos: { nome: 'Jogos', pasta: 'jogos', emoji: '🎮', lista: 'jogos/index.html' },
  animes: { nome: 'Animes', pasta: 'animes', emoji: '🍥', lista: 'animes/index.html' },
  filmes: { nome: 'Filmes & Séries', pasta: 'filmes', emoji: '🎬', lista: 'filmes/index.html' },
  curiosidades: { nome: 'Curiosidades', pasta: 'curiosidades', emoji: '🤓', lista: 'curiosidades/index.html' },
  noticias: { nome: 'Notícias', pasta: 'noticias', emoji: '📰', lista: 'noticias.html' }
};

// Itens do menu, vistos de dentro de artigos/<pasta>/
const MENU = [
  ['Início', '../../index.html', null],
  ['Jogos', '../jogos/index.html', 'jogos'],
  ['Animes', '../animes/index.html', 'animes'],
  ['Filmes & Séries', '../filmes/index.html', 'filmes'],
  ['Curiosidades', '../curiosidades/index.html', 'curiosidades'],
  ['Notícias', '../noticias.html', 'noticias'],
  ['Sobre', '../sobre.html', null],
  ['Contato', '../contato.html', null]
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ---------- utilidades ---------- */

const pad = n => String(n).padStart(2, '0');
const semAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataBr = d => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const dataIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function slugify(s) {
  return semAcento(s).toLowerCase().replace(/\.(txt|md)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function achaCategoria(txt) {
  const n = semAcento(txt || '').toLowerCase();
  if (/jogo|game/.test(n)) return 'jogos';
  if (/anime/.test(n)) return 'animes';
  if (/filme|serie/.test(n)) return 'filmes';
  if (/curiosidade/.test(n)) return 'curiosidades';
  if (/noticia/.test(n)) return 'noticias';
  return null;
}

function parseData(s) {
  if (!s) return new Date();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let d;
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (!d || isNaN(d)) throw new Error('data inválida: use AAAA-MM-DD (exemplo: 2026-10-05)');
  return d;
}

function gravar(arquivo, conteudo) {
  if (TESTE) return;
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, conteudo, 'utf8');
}

/* ---------- leitura do rascunho ---------- */

function lerRascunho(arquivo) {
  const txt = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const i = txt.search(/^---\s*$/m);
  if (i < 0) throw new Error('não achei a linha com três traços (---) que separa o cabeçalho do texto');
  const cab = txt.slice(0, i);
  const corpo = txt.slice(i).replace(/^---[ \t]*\n?/, '');
  const meta = {};
  cab.split('\n').forEach(linha => {
    if (/^\s*#/.test(linha)) return;
    const m = linha.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
    if (m) meta[semAcento(m[1]).toLowerCase()] = m[2].trim();
  });
  return { meta, corpo };
}

/* ---------- texto -> HTML ---------- */

function inline(t) {
  let s = esc(t);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, texto, url) => {
    if (/^https?:\/\//i.test(url)) return `<a href="${url}" target="_blank" rel="noopener">${texto}</a>`;
    if (/^[\w./#-]+$/.test(url)) return `<a href="${url}">${texto}</a>`;
    return m;
  });
  return s;
}

function textoPuro(t) {
  return t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*+/g, '').replace(/^#{2,3}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*(-|\d+\.)\s+/gm, '').replace(/\s+/g, ' ').trim();
}

function corpoParaHtml(corpo) {
  const ident = '            ';
  const prep = corpo.replace(/^(#{2,3} .*)$/gm, '\n$1\n');
  const blocos = prep.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocos.map(b => {
    let m;
    if ((m = b.match(/^### (.+)$/))) return `${ident}<h3>${inline(m[1])}</h3>`;
    if ((m = b.match(/^## (.+)$/))) return `${ident}<h2>${inline(m[1])}</h2>`;
    const linhas = b.split('\n');
    if (linhas.every(l => /^- /.test(l))) {
      const itens = linhas.map(l => `${ident}    <li>${inline(l.replace(/^- /, ''))}</li>`).join('\n');
      return `${ident}<ul>\n${itens}\n${ident}</ul>`;
    }
    if (linhas.every(l => /^\d+\.\s/.test(l))) {
      const itens = linhas.map(l => `${ident}    <li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('\n');
      return `${ident}<ol>\n${itens}\n${ident}</ol>`;
    }
    if (/^>/.test(b)) {
      const t = linhas.map(l => l.replace(/^>\s?/, '')).join(' ').trim();
      const mm = t.match(/^([^:]{1,40}):\s*([\s\S]+)$/);
      const titulo = mm ? mm[1] : 'Dica NerdZone';
      const texto = mm ? mm[2] : t;
      return `${ident}<div class="highlight">\n${ident}    <strong>💡 ${inline(titulo)}:</strong>\n${ident}    <p>${inline(texto)}</p>\n${ident}</div>`;
    }
    return `${ident}<p>\n${ident}    ${inline(linhas.join(' '))}\n${ident}</p>`;
  }).join('\n\n');
}

/* ---------- páginas ---------- */

function menuHtml(chave) {
  return MENU.map(([nome, href, k]) => `            <a${k && k === chave ? ' class="active"' : ''} href="${href}">${esc(nome)}</a>`).join('\n');
}

function paginaArtigo(d) {
  const { chave, cat, slug, titulo, descricao, imagem, alt, tag, data, minutos, corpoHtml, relacionados } = d;
  const rotulo = `${cat.emoji} ${cat.nome.toUpperCase()}${tag ? ' • ' + tag.toUpperCase() : ''}`;
  const url = `${SITE}/artigos/${cat.pasta}/${slug}.html`;
  const voltarHref = chave === 'noticias' ? '../noticias.html' : 'index.html';
  const imgHtml = imagem ? `
        <img
            class="article-image"
            loading="lazy"
            src="${esc(imagem)}"
            alt="${esc(alt || titulo)}"
        >
` : '';
  const rel = relacionados.length ? `
            <section class="continue-reading">
                <h2>📚 Continue lendo</h2>
${relacionados.map(r => `                <a href="${r.href}">${cat.emoji} ${esc(r.t)} →</a>`).join('\n')}
            </section>` : '';

  return `<!DOCTYPE html>
${MARCA}
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${esc(descricao)}">
    <meta name="theme-color" content="#0b0a1a">
    <title>${esc(titulo)} | NerdZone</title>
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${esc(titulo)}">
    <meta property="og:description" content="${esc(descricao)}">
    <meta property="og:url" content="${url}">${imagem ? `\n    <meta property="og:image" content="${esc(imagem)}">` : ''}
    <link rel="icon" type="image/png" href="../../favicon.png">
    <link rel="stylesheet" href="../../style.css">
    <link rel="stylesheet" href="../../curiosidades.css">
</head>

<body>

    <header class="header">
        <div class="logo">
            <span>Nerd</span>Zone
        </div>

        <nav class="menu" aria-label="Menu principal">
${menuHtml(chave)}
        </nav>

        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Alternar tema">🌙</button>
    </header>

    <main class="article-page">
        <div class="article-category">${esc(rotulo)}</div>

        <h1 class="article-title">${esc(titulo)}</h1>

        <p class="article-description">
            ${esc(descricao)}
        </p>

        <p class="article-meta">
            📅 ${dataBr(data)} • ⏱️ Leitura: ${minutos} min
        </p>
${imgHtml}
        <div class="article-content">
${corpoHtml}

            <a class="back-link" href="${voltarHref}">← Voltar para ${esc(cat.nome)}</a>
${rel}
        </div>
    </main>

    <footer>
        <div class="logo">
            <span>Nerd</span>Zone
        </div>
        <p>© ${new Date().getFullYear()} NerdZone. Todos os direitos reservados.</p>
        <p>Feito para quem vive o universo geek.</p>
        <p class="footer-links"><a href="../privacidade.html">Política de Privacidade</a> • <a href="../termos.html">Termos de Uso</a></p>
    </footer>

    <button id="topBtn" class="top-btn" type="button" aria-label="Voltar ao topo">⬆</button>
    <script src="../../script.js"></script>

</body>

</html>
`;
}

function cardHtml(chave, cat, d) {
  const etiqueta = `${cat.emoji} ${(d.tag || cat.nome).toUpperCase()}`;
  if (chave === 'noticias') {
    return `            <!-- auto: ${d.slug} -->
            <article class="news-card">
                <img loading="lazy" src="${esc(d.imagem)}" alt="${esc(d.alt || d.titulo)}">
                <div class="news-card-content">
                    <span class="news-category">${esc(etiqueta)}</span>
                    <h2>${esc(d.titulo)}</h2>
                    <p>${esc(d.descricao)}</p>
                    <a href="noticias/${d.slug}.html">Ler notícia →</a>
                </div>
            </article>
`;
  }
  return `            <!-- auto: ${d.slug} -->
            <article class="article-card">
                <img loading="lazy" src="${esc(d.imagem)}" alt="${esc(d.alt || d.titulo)}">
                <div class="article-card-content">
                    <span>${esc(etiqueta)}</span>
                    <h2>${esc(d.titulo)}</h2>
                    <p>${esc(d.descricao)}</p>
                    <a href="${d.slug}.html">Ler artigo →</a>
                </div>
            </article>
`;
}

// Devolve um aviso (texto) se não conseguir; devolve null se deu certo.
function inserirCard(chave, cat, d) {
  const arq = path.join(DIR_ARTIGOS, cat.lista);
  if (!fs.existsSync(arq)) return `lista não encontrada (artigos/${cat.lista}); o card não foi criado`;
  let html = fs.readFileSync(arq, 'utf8');
  if (html.includes(`<!-- auto: ${d.slug} -->`)) return null;
  const alvo = chave === 'noticias' ? 'news-grid' : 'articles-grid';
  const re = new RegExp(`(<section class="${alvo}">[ \\t]*\\n?)`);
  if (!re.test(html)) return `não achei <section class="${alvo}"> em artigos/${cat.lista}; o card não foi criado`;
  const href = chave === 'noticias' ? `noticias/${d.slug}.html` : `${d.slug}.html`;
  if (html.includes(`href="${href}"`)) return null; // já existe um card para esta página
  html = html.replace(re, `$1${cardHtml(chave, cat, d)}\n`);
  gravar(arq, html);
  return null;
}

/* ---------- busca e sitemap ---------- */

function lerIndice() {
  const txt = fs.readFileSync(ARQ_BUSCA, 'utf8');
  const m = txt.match(/window\.NZ_INDEX\s*=\s*([\s\S]*?);?\s*$/);
  if (!m) throw new Error('busca-index.js está em um formato que eu não reconheço');
  return JSON.parse(m[1]);
}

function gravarIndice(indice) {
  gravar(ARQ_BUSCA, `window.NZ_INDEX = ${JSON.stringify(indice)};\n`);
}

function atualizarSitemap(xml, urlRel, hoje, listaRel) {
  const loc = `${SITE}/artigos/${urlRel}`;
  if (!xml.includes(`<loc>${loc}</loc>`)) {
    xml = xml.replace('</urlset>', `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${hoje}</lastmod>\n    <priority>0.6</priority>\n  </url>\n</urlset>`);
  } else {
    xml = trocaLastmod(xml, loc, hoje);
  }
  return trocaLastmod(xml, `${SITE}/artigos/${listaRel}`, hoje);
}

function trocaLastmod(xml, loc, hoje) {
  const re = new RegExp(`(<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>\\s*<lastmod>)[^<]*(</lastmod>)`);
  return re.test(xml) ? xml.replace(re, `$1${hoje}$2`) : xml;
}

/* ---------- backup ---------- */

function fazerBackup(extras = []) {
  const agora = new Date();
  const nome = `${dataIso(agora)}_${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
  const dest = path.join(RAIZ, '_backup', nome);
  const arquivos = [ARQ_BUSCA, ARQ_SITEMAP, ...Object.values(CATEGORIAS).map(c => path.join(DIR_ARTIGOS, c.lista)), ...extras];
  arquivos.forEach(a => {
    if (!fs.existsSync(a)) return;
    const alvo = path.join(dest, path.relative(RAIZ, a));
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.copyFileSync(a, alvo);
  });
  return path.relative(RAIZ, dest);
}

/* ---------- publicar um rascunho ---------- */

function publicarUm(nomeArquivo, estado) {
  const { meta, corpo } = lerRascunho(path.join(DIR_RASCUNHOS, nomeArquivo));

  const titulo = meta.titulo;
  const descricao = meta.descricao;
  if (!titulo) throw new Error('falta a linha "titulo:" no cabeçalho');
  if (!descricao) throw new Error('falta a linha "descricao:" no cabeçalho');
  const chave = achaCategoria(meta.categoria);
  if (!chave) throw new Error('categoria inválida. Use: Jogos, Animes, Filmes & Séries, Curiosidades ou Notícias');
  const cat = CATEGORIAS[chave];

  const slug = slugify(meta.slug || nomeArquivo);
  if (!slug || slug === 'index') throw new Error('nome de arquivo inválido; use um nome como melhores-jogos-pc-fraco.txt');

  if (!corpo.trim()) throw new Error('o texto do artigo está vazio');
  const pendentes = corpo.match(/\[[^\]\n]+\](?!\()/g);
  if (pendentes && !FORCAR) {
    throw new Error(`ainda há trechos entre colchetes para preencher: ${pendentes.slice(0, 3).join(' ')}${pendentes.length > 3 ? ' ...' : ''}\n      (preencha e rode de novo; se for intencional, use: node publicar.js --forcar)`);
  }

  const data = parseData(meta.data);
  const palavras = textoPuro(corpo).split(' ').filter(Boolean).length;
  const minutos = Math.max(1, Math.ceil(palavras / 200));
  const avisos = [];
  if (palavras < 600) avisos.push(`só ${palavras} palavras (para o Google e o AdSense, o ideal é 600 ou mais)`);
  if (!meta.imagem) avisos.push('sem imagem (linha "imagem:" vazia); o artigo e o card saem sem foto');
  else if (!/^https?:\/\//i.test(meta.imagem)) avisos.push('a imagem não começa com https://; confira se o endereço está certo');

  const destRel = `${cat.pasta}/${slug}.html`;
  const destAbs = path.join(DIR_ARTIGOS, destRel);
  if (fs.existsSync(destAbs) && !fs.readFileSync(destAbs, 'utf8').includes(MARCA)) {
    throw new Error(`já existe artigos/${destRel} e ele não foi criado por este script; troque o nome do rascunho para não sobrescrever`);
  }

  const relacionados = estado.indice
    .filter(e => e.c === cat.nome && e.u !== destRel)
    .slice(0, 2)
    .map(e => ({ t: e.t, href: path.posix.relative(cat.pasta, e.u) }));

  const dados = { chave, cat, slug, titulo, descricao, imagem: meta.imagem || '', alt: meta.alt, tag: meta.tag, data, minutos, corpoHtml: corpoParaHtml(corpo), relacionados };

  gravar(destAbs, paginaArtigo(dados));
  const avisoCard = inserirCard(chave, cat, dados);
  if (avisoCard) avisos.push(avisoCard);

  const rotulo = `${cat.emoji} ${cat.nome.toUpperCase()}${meta.tag ? ' • ' + meta.tag.toUpperCase() : ''}`;
  const texto = `${rotulo} ${titulo} ${descricao} 📅 ${dataBr(data)} • ⏱️ Leitura: ${minutos} min ${textoPuro(corpo)}`;
  estado.indice = estado.indice.filter(e => e.u !== destRel);
  estado.indice.unshift({ u: destRel, t: titulo, c: cat.nome, d: descricao, i: dados.imagem, x: texto.slice(0, 3000) });

  estado.sitemap = atualizarSitemap(estado.sitemap, destRel, dataIso(new Date()), cat.lista);

  if (!TESTE) {
    fs.mkdirSync(DIR_PUBLICADOS, { recursive: true });
    let destino = path.join(DIR_PUBLICADOS, nomeArquivo);
    if (fs.existsSync(destino)) destino = path.join(DIR_PUBLICADOS, `${dataIso(new Date())}-${nomeArquivo}`);
    fs.renameSync(path.join(DIR_RASCUNHOS, nomeArquivo), destino);
  }

  return { destRel, palavras, avisos };
}

/* ---------- remover um artigo ---------- */

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function removerCard(cat, u) {
  const arq = path.join(DIR_ARTIGOS, cat.lista);
  if (!fs.existsSync(arq)) return false;
  const href = cat.pasta === 'noticias' ? u : path.posix.basename(u);
  const html = fs.readFileSync(arq, 'utf8');
  let achou = false;
  const novo = html.replace(
    /(?:[ \t]*<!-- auto: [^>]*? -->\n)?[ \t]*<article class="(?:article-card|news-card)">[\s\S]*?<\/article>\n?(?:[ \t]*\n)?/g,
    m => {
      if (m.includes(`href="${href}"`)) { achou = true; return ''; }
      return m;
    }
  );
  if (achou) gravar(arq, novo);
  return achou;
}

function remover(nome) {
  if (!nome) {
    console.log('Diga o nome do artigo. Exemplo: node publicar.js --remover meu-primeiro');
    return;
  }
  const faltando = [DIR_ARTIGOS, ARQ_BUSCA, ARQ_SITEMAP].filter(p => !fs.existsSync(p));
  if (faltando.length) {
    console.error('Não achei: ' + faltando.map(p => path.relative(RAIZ, p)).join(', '));
    console.error('Coloque o publicar.js na pasta raiz do site (a mesma do index.html) e rode de lá.');
    process.exit(1);
  }

  const nomesCat = Object.values(CATEGORIAS).map(c => c.nome);
  const indice = lerIndice();
  const entrada = nome.replace(/\.html?$/i, '').replace(/\\/g, '/');
  const slug = slugify(entrada.split('/').pop());
  const pasta = entrada.includes('/') ? slugify(entrada.split('/')[0]) : null;

  const artigos = indice.filter(e => nomesCat.includes(e.c));
  const achados = artigos.filter(e => pasta ? e.u === `${pasta}/${slug}.html` : e.u.endsWith(`/${slug}.html`));

  if (!achados.length) {
    console.log(`✖ Não encontrei nenhum artigo chamado "${nome}".`);
    console.log('Artigos que existem (use o nome do arquivo, sem .html):');
    artigos.slice(0, 15).forEach(e => console.log('   ' + e.u.replace(/\.html$/, '')));
    return;
  }
  if (achados.length > 1) {
    console.log(`Há mais de um artigo com o nome "${slug}". Escolha um, escrevendo a pasta junto:`);
    achados.forEach(e => console.log('   ' + e.u.replace(/\.html$/, '')));
    return;
  }

  const alvo = achados[0];
  const cat = Object.values(CATEGORIAS).find(c => c.nome === alvo.c);
  const paginaAbs = path.join(DIR_ARTIGOS, alvo.u);

  console.log(TESTE ? '\n== MODO TESTE: nada será alterado ==\n' : '');
  console.log(`Removendo: ${alvo.t}`);

  if (!TESTE) {
    const backup = fazerBackup([paginaAbs]);
    console.log('Backup (inclui a página) em: ' + backup);
    if (fs.existsSync(paginaAbs)) fs.unlinkSync(paginaAbs);
  }
  console.log(`✔ página artigos/${alvo.u} apagada`);

  console.log(removerCard(cat, alvo.u) ? '✔ card tirado da lista' : '⚠ não achei o card na lista (talvez já tenha sido tirado)');

  gravarIndice(indice.filter(e => e.u !== alvo.u));
  console.log('✔ tirado da busca');

  const xml = fs.readFileSync(ARQ_SITEMAP, 'utf8');
  const re = new RegExp(`[ \\t]*<url>\\s*<loc>${escRe(`${SITE}/artigos/${alvo.u}`)}</loc>[\\s\\S]*?</url>\\n?`);
  gravar(ARQ_SITEMAP, xml.replace(re, ''));
  console.log('✔ tirado do sitemap');

  console.log('\nAgora suba de novo artigos/, busca-index.js e sitemap.xml e APAGUE a página antiga também na hospedagem.');
}

/* ---------- programa principal ---------- */

function main() {
  const iRem = args.indexOf('--remover');
  if (iRem >= 0) return remover(args[iRem + 1]);

  console.log(TESTE ? '\n== MODO TESTE: nada será alterado ==\n' : '');

  const faltando = [DIR_ARTIGOS, ARQ_BUSCA, ARQ_SITEMAP].filter(p => !fs.existsSync(p));
  if (faltando.length) {
    console.error('Não achei: ' + faltando.map(p => path.relative(RAIZ, p)).join(', '));
    console.error('Coloque o publicar.js na pasta raiz do site (a mesma do index.html) e rode de lá.');
    process.exit(1);
  }

  fs.mkdirSync(DIR_RASCUNHOS, { recursive: true });
  const arquivos = fs.readdirSync(DIR_RASCUNHOS)
    .filter(f => /\.(txt|md)$/i.test(f) && !f.startsWith('_') && fs.statSync(path.join(DIR_RASCUNHOS, f)).isFile())
    .sort();

  if (!arquivos.length) {
    console.log('Nenhum rascunho para publicar na pasta "rascunhos".');
    console.log('Copie o rascunhos/_modelo.txt, renomeie (ex.: meu-artigo.txt), preencha e rode de novo.');
    return;
  }

  const estado = { indice: lerIndice(), sitemap: fs.readFileSync(ARQ_SITEMAP, 'utf8') };
  const backup = TESTE ? null : fazerBackup();
  let ok = 0;
  let erros = 0;

  arquivos.forEach(arq => {
    try {
      const r = publicarUm(arq, estado);
      ok++;
      console.log(`✔ ${arq}  →  artigos/${r.destRel}  (${r.palavras} palavras)`);
      r.avisos.forEach(a => console.log(`    ⚠ ${a}`));
    } catch (e) {
      erros++;
      console.log(`✖ ${arq}\n    ${e.message}`);
    }
  });

  if (ok) {
    gravarIndice(estado.indice);
    gravar(ARQ_SITEMAP, estado.sitemap);
  }

  console.log(`\n${ok} publicado(s), ${erros} com problema.`);
  if (ok && !TESTE) {
    console.log('Backup dos arquivos alterados em: ' + backup);
    console.log('\nSuba para a hospedagem: a pasta artigos/, o busca-index.js e o sitemap.xml.');
  }
}

main();
