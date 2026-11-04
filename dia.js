import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALCIfOdzUrbzs8_ceXXYFwsCeT161OFPw",
  authDomain: "kanban-board-92ce7.firebaseapp.com",
  projectId: "kanban-board-92ce7",
  storageBucket: "kanban-board-92ce7.appspot.com",
  messagingSenderId: "494809291125",
  appId: "1:494809291125:web:17f9eefa4287d39174db3c"
};
const db = getFirestore(initializeApp(firebaseConfig));

const COLORS = {
  arte: "#1E88E5", impressao: "#FB8C00", acabamento: "#FFD54F",
  corte: "#9CCC65", serralheria: "#A1887F", instalacao: "#F4511E"
};
const DIAS = { segunda: "Segunda", terca: "Terça", quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado" };

const dayId = new URLSearchParams(location.search).get("dia") || "";
const nomeDia = DIAS[dayId.split("-").pop()];
const lista = document.getElementById("dia-lista");
const titulo = document.getElementById("dia-titulo");
const contador = document.getElementById("dia-contador");

if (!/^w1-/.test(dayId) || !nomeDia) {
  titulo.textContent = "Dia não encontrado";
  lista.innerHTML = '<div class="dia-vazio">Abra esta tela clicando no nome do dia no painel semanal.</div>';
} else {
  titulo.textContent = nomeDia;
  document.title = `Programação — ${nomeDia}`;
  iniciar();
}

function iniciar() {
  const ref = doc(db, "schedule", dayId);
  let tarefas = [];
  let pendente = false; // snapshot recebido enquanto o usuário digitava

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
    pendente = false;
    lista.innerHTML = "";
    contador.textContent = tarefas.length ? `${tarefas.length} tarefa${tarefas.length > 1 ? "s" : ""}` : "";
    if (!tarefas.length) {
      lista.innerHTML = '<div class="dia-vazio">Nenhuma tarefa programada para este dia.</div>';
      return;
    }
    ordenadas().forEach(({ t, idx }) => {
      const card = document.createElement("div");
      card.className = "dia-item";
      card.style.borderLeftColor = t.color || COLORS[t.colorId] || "#ccc";

      const info = document.createElement("div");
      info.className = "dia-info";
      const cli = document.createElement("div");
      cli.className = "dia-cliente";
      cli.textContent = t.clientName || "";
      const os = document.createElement("div");
      os.className = "dia-os";
      os.textContent = t.osNumber || "";
      info.append(cli, os);

      const hora = document.createElement("input");
      hora.type = "time";
      hora.value = t.time || "";
      hora.addEventListener("change", () => salvar(idx, t, { time: hora.value }));

      const equipe = document.createElement("input");
      equipe.type = "text";
      equipe.placeholder = "Nomes dos funcionários";
      equipe.value = t.team || "";
      equipe.addEventListener("change", () => salvar(idx, t, { team: equipe.value.trim() }));

      card.append(info, campo("Hora", hora), campo("Equipe", equipe));
      lista.appendChild(card);
    });
  }

  // Relê o documento antes de gravar, para não sobrescrever mudanças feitas no painel principal
  async function salvar(idx, tarefaOriginal, campos) {
    try {
      const snap = await getDoc(ref);
      const arr = snap.exists() ? (snap.data().tasks || []) : [];
      const confere = x => x && x.osNumber === tarefaOriginal.osNumber && x.clientName === tarefaOriginal.clientName;
      let i = confere(arr[idx]) ? idx : arr.findIndex(confere);
      if (i < 0) return;
      arr[i] = { ...arr[i], ...campos };
      await updateDoc(ref, { tasks: arr });
    } catch (e) {
      console.error("Erro ao salvar equipe/hora:", e);
      alert("Não foi possível salvar. Verifique a conexão.");
    }
  }

  onSnapshot(ref, snap => {
    tarefas = snap.exists() ? (snap.data().tasks || []) : [];
    if (digitando()) { pendente = true; return; }
    render();
  }, err => {
    console.error(err);
    lista.innerHTML = '<div class="dia-vazio" style="color:red">Erro ao carregar.</div>';
  });

  // Reordena/atualiza quando o usuário sai do campo
  lista.addEventListener("focusout", () => {
    setTimeout(() => { if (pendente && !digitando()) render(); else if (!digitando()) render(); }, 0);
  });
}
