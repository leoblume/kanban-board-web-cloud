import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot, getDoc, getDocs, updateDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const DIA_IDX = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 };

function dataDoDia(key) {
  const hoje = new Date();
  const ate = hoje.getDay() === 0 ? 1 : 1 - hoje.getDay();
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + ate + DIA_IDX[key]);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Dia corrente da semana (domingo mostra a segunda, como o painel semanal do principal)
const ORDEM_DIAS = Object.keys(DIAS);
const diaCorrente = () => { const g = new Date().getDay(); return g === 0 ? "segunda" : ORDEM_DIAS[g - 1]; };
const urlDoDia = key => `dia.html?dia=w1-${key}`;

// Sem ?dia= na URL (ex.: abriu/atualizou a página direto) → mostra o dia corrente
let dayId = new URLSearchParams(location.search).get("dia") || "";
if (!dayId) {
  dayId = `w1-${diaCorrente()}`;
  history.replaceState(null, "", urlDoDia(diaCorrente()));
}
const diaKey = dayId.split("-").pop();
const nomeDia = DIAS[diaKey];
const lista = document.getElementById("dia-lista");
const titulo = document.getElementById("dia-titulo");
const contador = document.getElementById("dia-contador");
const gaveta = document.getElementById("gaveta-os");
const aba = document.getElementById("gaveta-aba");
const btnFechar = document.getElementById("gaveta-fechar");
const buscaOs = document.getElementById("busca-os");
const listaOs = document.getElementById("lista-os");

if (!/^w1-/.test(dayId) || !nomeDia) {
  titulo.textContent = "Dia não encontrado";
  gaveta.hidden = true;
  document.querySelectorAll(".dia-seta").forEach(a => a.classList.add("desativada"));
  lista.innerHTML = '<div class="dia-vazio">Abra esta tela clicando no nome do dia no painel semanal.</div>';
} else {
  const data = dataDoDia(diaKey);
  titulo.innerHTML = `${nomeDia} <small>${data}</small>`;
  document.title = `Programação — ${nomeDia} ${data}`;
  const ordem = Object.keys(DIAS);
  const pos = ordem.indexOf(diaKey);
  const ligar = (el, alvo) => {
    if (alvo) el.href = urlDoDia(alvo);
    else el.classList.add("desativada");
  };
  ligar(document.getElementById("btn-anterior"), ordem[pos - 1]);
  ligar(document.getElementById("btn-proximo"), ordem[pos + 1]);
  iniciar();
}

function iniciar() {
  const ref = doc(db, "schedule", dayId);
  let tarefas = [];
  let todasOs = [];

  const digitando = () => lista.contains(document.activeElement) && document.activeElement.tagName === "INPUT";

  // Ordena por hora (HH:MM); sem hora vai para o fim; empate mantém a ordem original
  function ordenadas() {
    return tarefas
      .map((t, idx) => ({ t, idx }))
      .sort((a, b) => {
        const ha = a.t.time || "", hb = b.t.time || "";
        if (ha && hb) return ha.localeCompare(hb) || a.idx - b.idx;
        if (ha) return -1;
        if (hb) return 1;
        return a.idx - b.idx;
      });
  }

  function campo(rotulo, input) {
    const wrap = document.createElement("div");
    wrap.className = "dia-campo";
    const label = document.createElement("label");
    label.textContent = rotulo;
    wrap.append(label, input);
    return wrap;
  }

  function render() {
    lista.innerHTML = "";
    contador.textContent = tarefas.length ? `${tarefas.length} tarefa${tarefas.length > 1 ? "s" : ""}` : "";
    if (!tarefas.length) {
      lista.innerHTML = '<div class="dia-vazio">Nenhuma tarefa programada para este dia.</div>';
      return;
    }
    ordenadas().forEach(({ t, idx }) => {
      const card = document.createElement("div");
      card.className = "dia-item";
      card.title = "Clique para trocar o setor (cor)";
      const cor = t.color || (COLOR_CYCLE.find(c => c.id === t.colorId) || {}).color || "";
      card.style.borderLeftColor = cor || "#ccc";

      const info = document.createElement("div");
      info.className = "dia-info";
      const cli = document.createElement("div");
      cli.className = "dia-cliente";
      cli.textContent = t.clientName || "";
      const os = document.createElement("div");
      os.className = "dia-os";
      os.textContent = t.osNumber || "";
      const setor = document.createElement("span");
      setor.className = "dia-setor";
      const setorInfo = COLOR_CYCLE.find(c => c.id === (t.colorId || ""));
      setor.textContent = setorInfo && setorInfo.id ? setorInfo.label : "Sem setor";
      if (cor) { setor.style.background = cor; setor.style.color = "#1b1b1b"; }
      info.append(cli, os, setor);

      const hora = document.createElement("input");
      hora.type = "time";
      hora.value = t.time || "";
      hora.addEventListener("change", () => salvar(idx, t, { time: hora.value }));

      const equipe = document.createElement("input");
      equipe.type = "text";
      equipe.placeholder = "Nomes dos funcionários";
      equipe.value = t.team || "";
      equipe.addEventListener("change", () => salvar(idx, t, { team: equipe.value.trim() }));

      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "dia-excluir";
      excluir.title = "Remover do dia";
      excluir.textContent = "×";
      excluir.addEventListener("click", () => remover(idx, t));

      card.append(info, campo("Hora", hora), campo("Equipe", equipe), excluir);

      // Clique na tarefa (fora dos campos) cicla o setor/cor, igual ao painel principal
      card.addEventListener("click", e => {
        if (e.target.closest(".dia-campo, .dia-excluir")) return;
        const atual = COLOR_CYCLE.findIndex(c => c.id === (t.colorId || ""));
        const prox = COLOR_CYCLE[(atual + 1) % COLOR_CYCLE.length];
        salvar(idx, t, { colorId: prox.id, color: prox.color });
      });

      lista.appendChild(card);
    });
  }

  // Relê o documento antes de gravar, para não sobrescrever mudanças feitas no painel principal
  async function salvar(idx, tarefaOriginal, campos) {
    try {
      const snap = await getDoc(ref);
      const arr = snap.exists() ? (snap.data().tasks || []) : [];
      const confere = x => x && x.osNumber === tarefaOriginal.osNumber && x.clientName === tarefaOriginal.clientName;
      const i = confere(arr[idx]) ? idx : arr.findIndex(confere);
      if (i < 0) return;
      arr[i] = { ...arr[i], ...campos };
      await updateDoc(ref, { tasks: arr });
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Não foi possível salvar. Verifique a conexão.");
    }
  }

  // Remove só esta tarefa do dia (relê o documento antes, como em salvar)
  async function remover(idx, tarefaOriginal) {
    try {
      const snap = await getDoc(ref);
      const arr = snap.exists() ? (snap.data().tasks || []) : [];
      const confere = x => x && x.osNumber === tarefaOriginal.osNumber && x.clientName === tarefaOriginal.clientName;
      const i = confere(arr[idx]) ? idx : arr.findIndex(confere);
      if (i < 0) return;
      arr.splice(i, 1);
      await updateDoc(ref, { tasks: arr });
    } catch (e) {
      console.error("Erro ao remover:", e);
      alert("Não foi possível remover. Verifique a conexão.");
    }
  }

  // ---------- Adicionar OS a este dia ----------
  function renderOs() {
    const termo = buscaOs.value.toLowerCase().trim();
    listaOs.innerHTML = "";
    const filtradas = todasOs.filter(o =>
      !termo || (o.clientName || "").toLowerCase().includes(termo) || (o.osNumber || "").toLowerCase().includes(termo));
    if (!filtradas.length) {
      listaOs.innerHTML = '<div class="dia-vazio" style="padding:12px 0">Nenhuma OS encontrada.</div>';
      return;
    }
    filtradas.forEach(o => {
      const jaAdicionada = tarefas.some(t => t.osNumber === o.osNumber && t.clientName === o.clientName);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dia-os-opcao";
      b.disabled = jaAdicionada;
      const txt = document.createElement("span");
      txt.textContent = `${o.osNumber || ""} — ${o.clientName || ""}`;
      b.appendChild(txt);
      if (jaAdicionada) {
        const ja = document.createElement("span");
        ja.className = "ja";
        ja.textContent = "✓ neste dia";
        b.appendChild(ja);
      }
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await setDoc(ref, { tasks: arrayUnion({ osNumber: o.osNumber || "", clientName: o.clientName || "", colorId: "", color: "" }) }, { merge: true });
        } catch (e) {
          console.error("Erro ao adicionar OS:", e);
          alert("Não foi possível adicionar a OS.");
          b.disabled = false;
        }
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
    } catch (e) {
      console.error(e);
      listaOs.innerHTML = '<div class="dia-vazio" style="color:red">Erro ao carregar as OS.</div>';
    }
  }

  async function alternarGaveta(abrir) {
    gaveta.classList.toggle("aberta", abrir);
    gaveta.setAttribute("aria-hidden", String(!abrir));
    aba.setAttribute("aria-expanded", String(abrir));
    aba.textContent = abrir ? "Fechar lista" : "+ Adicionar OS";
    if (abrir) { await carregarOs(); buscaOs.focus(); }
  }
  const gavetaAberta = () => gaveta.classList.contains("aberta");
  aba.addEventListener("click", () => alternarGaveta(!gavetaAberta()));
  btnFechar.addEventListener("click", () => alternarGaveta(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && gavetaAberta()) alternarGaveta(false); });
  buscaOs.addEventListener("input", renderOs);

  // ---------- Tempo real ----------
  onSnapshot(ref, snap => {
    tarefas = snap.exists() ? (snap.data().tasks || []) : [];
    if (gavetaAberta()) renderOs();
    if (digitando()) return; // renderiza ao sair do campo
    render();
  }, err => {
    console.error(err);
    lista.innerHTML = '<div class="dia-vazio" style="color:red">Erro ao carregar.</div>';
  });

  // Reordena/atualiza quando o usuário sai do campo
  lista.addEventListener("focusout", () => {
    setTimeout(() => { if (!digitando()) render(); }, 0);
  });
}


// ---------- Volta sozinha para o dia corrente ----------
// • Depois de VOLTAR_HOJE_MS sem nenhuma interação, se estiver em outro dia, volta para o dia de hoje.
// • Quando a data muda (meia-noite), vai para o novo dia corrente.
// Não interrompe quem está digitando nem quando a gaveta "Adicionar OS" está aberta.
const VOLTAR_HOJE_MS = 25 * 1000;     // ajuste aqui (20–30 s)
let ultimaAtividade = Date.now();
let dataAoCarregar = new Date().toDateString();
["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"].forEach(ev =>
  document.addEventListener(ev, () => { ultimaAtividade = Date.now(); }, { passive: true, capture: true }));

const ocupado = () => {
  const a = document.activeElement;
  const digitando = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
  return digitando || gaveta.classList.contains("aberta");
};

function verificarDiaCorrente() {
  if (ocupado()) return;
  const hoje = diaCorrente();
  const virou = new Date().toDateString() !== dataAoCarregar;
  const emOutroDia = diaKey !== hoje;
  const ocioso = Date.now() - ultimaAtividade >= VOLTAR_HOJE_MS;
  if (virou || (emOutroDia && ocioso)) location.replace(urlDoDia(hoje));
}
setInterval(verificarDiaCorrente, 5000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarDiaCorrente(); });
