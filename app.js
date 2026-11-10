const filtro = document.querySelector("#mes");
const status = document.querySelector("#status");
const extrato = document.querySelector("#extrato");
const tabela = document.querySelector("#movimentacoes");
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nomeMes = new Intl.DateTimeFormat("pt-BR", {
  month: "long", year: "numeric", timeZone: "UTC",
});
const periodosParciais = { "2026-11": "até 09/11" };

function pagantes(lancamentos) {
  return new Set(lancamentos
    .filter(({ categoria, valor_centavos, pagador }) =>
      categoria === "Mensalidade do grupo" && valor_centavos > 0 && pagador)
    .map(({ pagador }) => pagador));
}

function exibir(lancamentos) {
  let entradas = 0;
  let saidas = 0;
  const totaisPorCategoria = new Map();
  const linhas = document.createDocumentFragment();

  for (const { data, valor_centavos: valor, categoria, pagador } of lancamentos) {
    entradas += Math.max(0, valor);
    saidas += Math.max(0, -valor);

    const resumo = totaisPorCategoria.get(categoria) ?? { valor: 0, quantidade: 0 };
    resumo.valor += valor;
    resumo.quantidade += 1;
    totaisPorCategoria.set(categoria, resumo);

    const linha = document.createElement("tr");
    const dataLocal = data.split("-").reverse().join("/");
    const tipo = valor < 0 ? "Saída" : "Entrada";
    const descricao = valor > 0 && pagador ? [categoria ?? tipo, pagador].join(" · ") : categoria ?? tipo;
    for (const texto of [dataLocal, descricao, moeda.format(valor / 100)]) {
      const celula = document.createElement("td");
      celula.textContent = texto;
      linha.append(celula);
    }
    linhas.append(linha);
  }

  tabela.replaceChildren(linhas);
  document.querySelector("#entradas").textContent = moeda.format(entradas / 100);
  document.querySelector("#saidas").textContent = moeda.format(saidas / 100);
  document.querySelector("#resultado").textContent = moeda.format((entradas - saidas) / 100);
  for (const [id, categoria] of [
    ["#mensalidades", "Mensalidade do grupo"],
    ["#quadra", "Mensalidade da quadra"],
    ["#goleiros", "Goleiros"],
  ]) {
    const valor = totaisPorCategoria.get(categoria)?.valor ?? 0;
    document.querySelector(id).textContent = moeda.format(Math.abs(valor) / 100);
  }
  const recebimentos = totaisPorCategoria.get("Mensalidade do grupo")?.quantidade ?? 0;
  document.querySelector("#contagem-mensalidades").textContent =
    recebimentos === 1 ? "1 recebimento identificado" : `${recebimentos} recebimentos identificados`;
  status.textContent = lancamentos.length === 1
    ? "1 movimentação"
    : `${lancamentos.length} movimentações`;
}

async function carregar() {
  try {
    const resposta = await fetch("./data.json");
    if (!resposta.ok) throw new Error("Falha ao carregar o histórico");
    const lancamentos = await resposta.json();
    const porMes = new Map();
    for (const lancamento of lancamentos) {
      const mes = lancamento.data.slice(0, 7);
      if (!porMes.has(mes)) porMes.set(mes, []);
      porMes.get(mes).push(lancamento);
    }

    if (!porMes.size) {
      filtro.replaceChildren(new Option("Sem meses disponíveis"));
      status.textContent = "Nenhuma movimentação no histórico.";
      return;
    }

    const meses = [...porMes.keys()].sort().reverse();
    filtro.replaceChildren(...meses.map((mes) => {
      const data = new Date(`${mes}-01T00:00:00Z`);
      const parcial = periodosParciais[mes];
      const rotulo = nomeMes.format(data);
      return new Option(parcial ? `${rotulo} (parcial ${parcial})` : rotulo, mes);
    }));
    const baseOutubro = pagantes(porMes.get("2026-10") ?? []);
    const pendencias = document.querySelector("#pendencias");
    const listaPendencias = document.querySelector("#lista-pendencias");
    const resumoPendencias = document.querySelector("#resumo-pendencias");
    function atualizarMes() {
      const mes = filtro.value;
      const lancamentosDoMes = porMes.get(mes);
      exibir(lancamentosDoMes);
      pendencias.hidden = mes !== "2026-11" || baseOutubro.size === 0;
      if (pendencias.hidden) return;

      const pagos = pagantes(lancamentosDoMes);
      const faltantes = [...baseOutubro]
        .filter((nome) => !pagos.has(nome))
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      resumoPendencias.textContent =
        `${baseOutubro.size - faltantes.length} de ${baseOutubro.size} pagantes de outubro identificados em novembro.`;
      listaPendencias.replaceChildren(...faltantes.map((nome) => {
        const item = document.createElement("li");
        item.textContent = nome;
        return item;
      }));
    }
    filtro.addEventListener("change", atualizarMes);
    atualizarMes();
    filtro.disabled = false;
    extrato.hidden = false;
  } catch {
    filtro.replaceChildren(new Option("Indisponível"));
    status.textContent = "Não foi possível carregar o histórico.";
  }
}

carregar();
