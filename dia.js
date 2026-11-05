import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot, getDoc, getDocs, updateDoc, setDoc, arrayUnion, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALCIfOdzUrbzs8_ceXXYFwsCeT161OFPw",
  authDomain: "kanban-board-92ce7.firebaseapp.com",
  projectId: "kanban-board-92ce7",
  storageBucket: "kanban-board-92ce7.appspot.com",
  messagingSenderId: "494809291125",
  appId: "1:494809291125:web:17f9eefa4287d39174db3c"
};
const db = getFirestore(initializeApp(firebaseConfig));

// Mesma legenda/ciclo de cores do painel principal
const COLOR_CYCLE = [
  { id: "", label: "Nenhuma", color: "" },
  { id: "arte", label: "Arte Final", color: "#1E88E5" },
  { id: "impressao", label: "Impressão", color: "#FB8C00" },
  { id: "acabamento", label: "Acabamento", color: "#FFD54F" },
  { id: "corte", label: "Corte", color: "#9CCC65" },
  { id: "serralheria", label: "Serralheria", color: "#A1887F" },
  { id: "instalacao", label: "Instalação", color: "#F4511E" }
];
const DIAS = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado" };
const ORDEM_DIAS = Object.keys(DIAS);
const MAX_SEMANAS = 2;                       // semana 1 = w1-*, semana 2 = w2-* (mesmo padrão do painel principal)
const pad = n => String(n).padStart(2, "0");

// Segunda-feira da semana corrente (domingo mostra a semana seguinte, como o painel do principal)
function segundaBase() {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate() + (h.getDay() === 0 ? 1 : 1 - h.getDay()));
}
const dataDe = (semana, idx) => { const b = segundaBase(); return new Date(b.getFullYear(), b.getMonth(), b.getDate() + semana * 7 + idx); };
const fmt = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
const idDoDia = (semana, key) => `w${semana + 1}-${key}`;
const diaCorrenteId = () => { const g = new Date().getDay(); return idDoDia(0, g === 0 ? "segunda" : ORDEM_DIAS[g - 1]); };
const idValido = id => /^w[1-2]-(segunda|terca|quarta|quinta|sexta|sabado)$/.test(id || "");

// ---------- estado ----------
const grade = document.getElementById("dia-grade");
const titulo = document.getElementById("dia-titulo");
const contador = document.getElementById("dia-contador");
const gaveta = document.getElementById("gaveta-os");
const aba = document.getElementById("gaveta-aba");
const btnFechar = document.getElementById("gaveta-fechar");
const buscaOs = document.getElementById("busca-os");
const listaOs = document.getElementById("lista-os");
const tituloGaveta = document.getElementById("gaveta-titulo");

const params = new URLSearchParams(location.search);
let selecionado = idValido(params.get("dia")) ? params.get("dia") : diaCorrenteId();
let modo = "dia";                            // "dia" | "1" | "2" — sempre abre em 1 dia (não é guardado)
const TODOS_IDS = [...Array(MAX_SEMANAS).keys()].flatMap(s => ORDEM_DIAS.map(k => idDoDia(s, k)));
const semanasVisiveis = () => modo === "2" ? 2 : 1;
const idsVisiveis = () => modo === "dia" ? [selecionado] : TODOS_IDS.slice(0, semanasVisiveis() * 6);
const tarefasPorDia = {};                    // dayId -> tarefas[]
const unsubs = {};                           // dayId -> cancelar listener
let todasOs = [];
const comConfere = (os, cli) => x => x && x.osNumber === os && x.clientName === cli;

const digitando = () => grade.contains(document.activeElement) && document.activeElement.tagName === "INPUT";

// Ordena por hora (HH:MM); sem hora vai para o fim; empate mantém a ordem original
function ordenadas(tarefas) {
  return tarefas.map((t, idx) => ({ t, idx })).sort((a, b) => {
    const ha = a.t.time || "", hb = b.t.time || "";
    if (ha && hb) return ha.localeCompare(hb) || a.idx - b.idx;
    if (ha) return -1;
    if (hb) return 1;
    return a.idx - b.idx;
  });
}

// ---------- estrutura da grade ----------
function criarColuna(id) {
  const m = /^w(\d)-(\w+)$/.exec(id), semana = +m[1] - 1, key = m[2], i = ORDEM_DIAS.indexOf(key), d = dataDe(semana, i);
  const col = document.createElement("section");
  col.className = "dia-col";
  col.dataset.dia = id;
  if (mesmoDia(d, new Date())) col.classList.add("hoje");
  col.innerHTML = `<div class="dia-col-topo" title="Selecionar este dia (para Adicionar OS)"><span>${DIAS[key]}</span><small>${fmt(d)} · <span class="n">0</span></small></div><div class="dia-col-lista"></div>`;
  return col;
}
function montarGrade() {
  grade.innerHTML = "";
  grade.classList.toggle("modo-dia", modo === "dia");
  if (modo === "dia") {
    const pos = TODOS_IDS.indexOf(selecionado);
    const um = document.createElement("div");
    um.className = "dia-um";
    const seta = (delta, txt, rot) => { const b = document.createElement("button"); b.type = "button"; b.className = "dia-seta"; b.dataset.nav = delta; b.textContent = txt; b.title = rot + " (solte uma tarefa aqui para movê-la)"; b.setAttribute("aria-label", rot); if (!TODOS_IDS[pos + delta]) b.classList.add("desativada"); return b; };
    um.append(seta(-1, "‹", "Dia anterior"), criarColuna(selecionado), seta(1, "›", "Próximo dia"));
    grade.appendChild(um);
  } else {
    for (let s = 0; s < semanasVisiveis(); s++) {
      const rot = document.createElement("div");
      rot.className = "dia-semana-rotulo";
      rot.textContent = `Semana ${s + 1} · ${fmt(dataDe(s, 0))} a ${fmt(dataDe(s, 5))}`;
      const sem = document.createElement("div");
      sem.className = "dia-semana";
      ORDEM_DIAS.forEach(k => sem.appendChild(criarColuna(idDoDia(s, k))));
      grade.append(rot, sem);
    }
  }
  marcarSelecionado();
  ouvirDias();
}

function ouvirDias() {
  const ativos = new Set(idsVisiveis());
  Object.keys(unsubs).forEach(id => { if (!ativos.has(id)) { unsubs[id](); delete unsubs[id]; delete tarefasPorDia[id]; } });
  ativos.forEach(id => {
    if (unsubs[id]) { renderDia(id); return; }
    unsubs[id] = onSnapshot(doc(db, "schedule", id), snap => {
      tarefasPorDia[id] = snap.exists() ? (snap.data().tasks || []) : [];
      if (id === selecionado && gavetaAberta()) renderOs();
      const col = colDe(id);
      if (col && digitando() && col.contains(document.activeElement)) return;   // renderiza ao sair do campo
      renderDia(id); atualizarContador();
    }, err => { console.error(err); const c = colDe(id); if (c) c.querySelector(".dia-col-lista").innerHTML = '<div class="dia-col-vazio" style="color:red">Erro ao carregar.</div>'; });
  });
}
const colDe = id => grade.querySelector(`.dia-col[data-dia="${id}"]`);

function atualizarContador() {
  const total = idsVisiveis().reduce((n, id) => n + (tarefasPorDia[id] || []).length, 0);
  contador.textContent = total ? `${total} tarefa${total > 1 ? "s" : ""}` : "";
}

function marcarSelecionado() {
  grade.querySelectorAll(".dia-col").forEach(c => c.classList.toggle("selecionado", c.dataset.dia === selecionado));
  const m = /^w(\d)-(\w+)$/.exec(selecionado);
  if (!m) return;
  const rotulo = `${DIAS[m[2]]} ${fmt(dataDe(+m[1] - 1, ORDEM_DIAS.indexOf(m[2])))}`;
  if (tituloGaveta) tituloGaveta.textContent = `Adicionar ao dia: ${rotulo}`;
  document.title = `Programação — ${rotulo}`;
}

// ---------- cartão compacto ----------
function renderDia(dayId) {
  const col = colDe(dayId);
  if (!col) return;
  const tarefas = tarefasPorDia[dayId] || [];
  col.querySelector(".n").textContent = tarefas.length;
  const lista = col.querySelector(".dia-col-lista");
  lista.innerHTML = "";
  if (!tarefas.length) { lista.innerHTML = '<div class="dia-col-vazio">Sem tarefas</div>'; return; }
  ordenadas(tarefas).forEach(({ t, idx }) => {
    const card = document.createElement("div");
    card.className = "dia-item";
    card.draggable = true;
    card.title = "Arraste para outro dia · clique para trocar o setor (cor)";
    const cor = t.color || (COLOR_CYCLE.find(c => c.id === t.colorId) || {}).color || "";
    card.style.borderLeftColor = cor || "#ccc";

    const l1 = document.createElement("div"); l1.className = "dia-l1";
    const cli = document.createElement("div"); cli.className = "dia-cliente"; cli.textContent = t.clientName || ""; cli.title = t.clientName || "";
    const excluir = document.createElement("button");
    excluir.type = "button"; excluir.className = "dia-excluir"; excluir.title = "Remover do dia"; excluir.textContent = "×";
    excluir.addEventListener("click", () => remover(dayId, idx, t));
    l1.append(cli, excluir);

    const l2 = document.createElement("div"); l2.className = "dia-l2";
    const setorInfo = COLOR_CYCLE.find(c => c.id === (t.colorId || ""));
    const setor = document.createElement("span"); setor.className = "dia-setor";
    setor.textContent = setorInfo && setorInfo.id ? setorInfo.label : "Sem setor";
    if (cor) { setor.style.background = cor; setor.style.color = "#1b1b1b"; }
    const os = document.createElement("span"); os.textContent = t.osNumber || "";
    l2.append(os, setor);

    const l3 = document.createElement("div"); l3.className = "dia-l3";
    const hora = document.createElement("input"); hora.type = "time"; hora.value = t.time || ""; hora.title = "Hora";
    hora.addEventListener("change", () => salvar(dayId, idx, t, { time: hora.value }));
    const equipe = document.createElement("input"); equipe.type = "text"; equipe.placeholder = "Equipe"; equipe.value = t.team || ""; equipe.title = "Equipe";
    equipe.addEventListener("change", () => salvar(dayId, idx, t, { team: equipe.value.trim() }));
    [hora, equipe].forEach(i => {      // permite selecionar texto/digitar sem iniciar um arrasto
      i.addEventListener("pointerdown", () => { card.draggable = false; });
      i.addEventListener("blur", () => { card.draggable = true; });
    });
    l3.append(hora, equipe);
    card.append(l1, l2, l3);

    card.addEventListener("click", e => {          // clique fora dos campos cicla o setor/cor
      if (e.target.closest(".dia-l3, .dia-excluir")) return;
      const atual = COLOR_CYCLE.findIndex(c => c.id === (t.colorId || ""));
      const prox = COLOR_CYCLE[(atual + 1) % COLOR_CYCLE.length];
      salvar(dayId, idx, t, { colorId: prox.id, color: prox.color });
    });
    card.addEventListener("dragstart", e => {
      e.dataTransfer.setData("application/json", JSON.stringify({ osNumber: t.osNumber || "", clientName: t.clientName || "", fromDay: dayId }));
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
      setTimeout(() => grade.classList.add("arrastando"), 0);   // inputs/botões não capturam o "soltar"
    });
    card.addEventListener("dragend", () => { card.classList.remove("dragging"); grade.classList.remove("arrastando"); grade.querySelectorAll(".drag-over").forEach(c => c.classList.remove("drag-over")); });
    lista.appendChild(card);
  });
}

// ---------- gravações (sempre relendo o documento antes) ----------
async function salvar(dayId, idx, original, campos) {
  try {
    const ref = doc(db, "schedule", dayId);
    const snap = await getDoc(ref);
    const arr = snap.exists() ? (snap.data().tasks || []) : [];
    const confere = comConfere(original.osNumber, original.clientName);
    const i = confere(arr[idx]) ? idx : arr.findIndex(confere);
    if (i < 0) return;
    arr[i] = { ...arr[i], ...campos };
    await updateDoc(ref, { tasks: arr });
  } catch (e) { console.error("Erro ao salvar:", e); alert("Não foi possível salvar. Verifique a conexão."); }
}
async function remover(dayId, idx, original) {
  try {
    const ref = doc(db, "schedule", dayId);
    const snap = await getDoc(ref);
    const arr = snap.exists() ? (snap.data().tasks || []) : [];
    const confere = comConfere(original.osNumber, original.clientName);
    const i = confere(arr[idx]) ? idx : arr.findIndex(confere);
    if (i < 0) return;
    arr.splice(i, 1);
    await updateDoc(ref, { tasks: arr });
  } catch (e) { console.error("Erro ao remover:", e); alert("Não foi possível remover. Verifique a conexão."); }
}
// Move a tarefa (com hora, equipe e cor) de um dia para outro, de forma atômica
async function mover(deId, paraId, os, cliente) {
  if (!deId || !paraId || deId === paraId) return;
  const origem = doc(db, "schedule", deId), destino = doc(db, "schedule", paraId);
  const confere = comConfere(os, cliente);
  try {
    await runTransaction(db, async tx => {
      const a = await tx.get(origem), b = await tx.get(destino);
      const arrA = a.exists() ? (a.data().tasks || []) : [];
      const tarefa = arrA.find(confere);
      if (!tarefa) return;
      const arrB = b.exists() ? (b.data().tasks || []) : [];
      tx.set(origem, { tasks: arrA.filter(t => !confere(t)) }, { merge: true });
      if (!arrB.some(confere)) tx.set(destino, { tasks: [...arrB, tarefa] }, { merge: true });
    });
  } catch (e) { console.error("Erro ao mover:", e); alert("Não foi possível mover a tarefa. Verifique a conexão."); }
}

// ---------- arrastar e soltar entre os dias ----------
const alvoDrop = e => e.target.closest(".dia-col, [data-nav]");
grade.addEventListener("dragover", e => { const c = alvoDrop(e); if (!c) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; c.classList.add("drag-over"); });
grade.addEventListener("dragleave", e => { const c = alvoDrop(e); if (c && !c.contains(e.relatedTarget)) c.classList.remove("drag-over"); });
grade.addEventListener("drop", async e => {
  const c = alvoDrop(e);
  if (!c) return;
  e.preventDefault();
  c.classList.remove("drag-over");
  grade.classList.remove("arrastando");
  try {
    const d = JSON.parse(e.dataTransfer.getData("application/json"));
    const destino = c.dataset.nav ? TODOS_IDS[TODOS_IDS.indexOf(selecionado) + Number(c.dataset.nav)] : c.dataset.dia;
    if (d && d.fromDay && destino) await mover(d.fromDay, destino, d.osNumber, d.clientName);
  } catch (err) { console.error(err); }
});
function navegar(delta) {
  const novo = TODOS_IDS[TODOS_IDS.indexOf(selecionado) + delta];
  if (!novo) return;
  selecionado = novo;
  montarGrade();
  if (gavetaAberta()) renderOs();
}
grade.addEventListener("click", e => {
  const nav = e.target.closest("[data-nav]");
  if (nav) { navegar(Number(nav.dataset.nav)); return; }
  const topo = e.target.closest(".dia-col-topo");              // escolhe o dia que recebe as OS da gaveta
  if (!topo || modo === "dia") return;
  selecionado = topo.parentElement.dataset.dia;
  marcarSelecionado();
  if (gavetaAberta()) renderOs();
});
document.addEventListener("keydown", e => {
  if (modo !== "dia" || digitando() || document.activeElement === buscaOs) return;
  if (e.key === "ArrowLeft") navegar(-1); else if (e.key === "ArrowRight") navegar(1);
});

// ---------- Adicionar OS ao dia selecionado ----------
function renderOs() {
  const termo = buscaOs.value.toLowerCase().trim();
  const doDia = tarefasPorDia[selecionado] || [];
  listaOs.innerHTML = "";
  const filtradas = todasOs.filter(o => !termo || (o.clientName || "").toLowerCase().includes(termo) || (o.osNumber || "").toLowerCase().includes(termo));
  if (!filtradas.length) { listaOs.innerHTML = '<div class="dia-vazio" style="padding:12px 0">Nenhuma OS encontrada.</div>'; return; }
  filtradas.forEach(o => {
    const ja = doDia.some(comConfere(o.osNumber, o.clientName));
    const b = document.createElement("button");
    b.type = "button"; b.className = "dia-os-opcao"; b.disabled = ja;
    const txt = document.createElement("span");
    txt.textContent = `${o.osNumber || ""} — ${o.clientName || ""}`;
    b.appendChild(txt);
    if (ja) { const s = document.createElement("span"); s.className = "ja"; s.textContent = "✓ neste dia"; b.appendChild(s); }
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await setDoc(doc(db, "schedule", selecionado), { tasks: arrayUnion({ osNumber: o.osNumber || "", clientName: o.clientName || "", colorId: "", color: "" }) }, { merge: true });
      } catch (err) { console.error("Erro ao adicionar OS:", err); alert("Não foi possível adicionar a OS."); b.disabled = false; }
    });
    listaOs.appendChild(b);
  });
}
async function carregarOs() {
  listaOs.innerHTML = '<div class="dia-vazio" style="padding:12px 0">Carregando...</div>';
  try {
    const snap = await getDocs(collection(db, "tasks"));
    todasOs = snap.docs.map(d => d.data()).sort((a, b) =>
      (a.deliveryDate || "9999-12-31").localeCompare(b.deliveryDate || "9999-12-31") || (a.order || 0) - (b.order || 0));
    renderOs();
  } catch (e) { console.error(e); listaOs.innerHTML = '<div class="dia-vazio" style="color:red">Erro ao carregar as OS.</div>'; }
}
const gavetaAberta = () => gaveta.classList.contains("aberta");
async function alternarGaveta(abrir) {
  gaveta.classList.toggle("aberta", abrir);
  gaveta.setAttribute("aria-hidden", String(!abrir));
  aba.setAttribute("aria-expanded", String(abrir));
  aba.textContent = abrir ? "Fechar lista" : "+ Adicionar OS";
  if (abrir) { await carregarOs(); buscaOs.focus(); }
}
aba.addEventListener("click", () => alternarGaveta(!gavetaAberta()));
btnFechar.addEventListener("click", () => alternarGaveta(false));
document.addEventListener("keydown", e => { if (e.key === "Escape" && gavetaAberta()) alternarGaveta(false); });
buscaOs.addEventListener("input", renderOs);
grade.addEventListener("focusout", () => setTimeout(() => { if (!digitando()) Object.keys(tarefasPorDia).forEach(renderDia); }, 0));

// ---------- período: 1 dia (padrão) / 1 semana / 2 semanas ----------
function aplicarModo(m) {
  modo = m;
  document.querySelectorAll("[data-modo]").forEach(b => b.classList.toggle("ativo", b.dataset.modo === m));
  if (m === "1" && !/^w1-/.test(selecionado)) selecionado = diaCorrenteId();
  montarGrade();
}
document.querySelectorAll("[data-modo]").forEach(b => b.addEventListener("click", () => aplicarModo(b.dataset.modo)));
document.getElementById("btn-hoje").addEventListener("click", () => {
  selecionado = diaCorrenteId();
  if (modo === "dia") { montarGrade(); return; }
  marcarSelecionado();
  const c = colDe(selecionado); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" });
});

aplicarModo("dia");

// Quando a data muda (meia-noite), recarrega para recalcular as datas e o destaque de "hoje"
const dataAoCarregar = new Date().toDateString();
const checarVirada = () => { if (new Date().toDateString() !== dataAoCarregar && !digitando() && !gavetaAberta()) location.reload(); };
setInterval(checarVirada, 60 * 1000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checarVirada(); });
