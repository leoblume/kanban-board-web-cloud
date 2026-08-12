import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALCIfOdzUrbzs8_ceXXYFwsCeT161OFPw",
  authDomain: "kanban-board-92ce7.firebaseapp.com",
  projectId: "kanban-board-92ce7",
  storageBucket: "kanban-board-92ce7.appspot.com",
  messagingSenderId: "494809291125",
  appId: "1:494809291125:web:17f9eefa4287d39174db3c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tasksCollection = collection(db, "tasks");

const urlParams = new URLSearchParams(window.location.search);
const setorId = urlParams.get("setor");
const setorNome = urlParams.get("nome");

document.getElementById("setor-title").textContent = `Tarefas do Setor: ${setorNome}`;
const container = document.getElementById("tarefas-do-setor");

function hojeFormatado() {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

function healStatuses(statuses = []) {
  const ids = ["compras", "arte", "impressao", "acabamento", "corte", "faturamento", "instalacao", "entrega"];
  return ids.map(id => {
    const existing = statuses.find(s => s.id === id);
    return {
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      state: existing?.state || "state-pending",
      date: existing?.date || ""
    };
  });
}

// --- FUNÇÃO MODIFICADA PARA CRIAR UMA LINHA DA LISTA ---
function createTarefaCard(task, status) {
  const item = document.createElement("div");
  item.className = "sector-task-item"; // Nova classe para o item da lista

  // Usa a data do status, se não houver, usa a data de hoje para exibição.
  const dataExec = status.date || hojeFormatado();

  item.innerHTML = `
    <div class="sector-task-os">${task.osNumber || "OS?"}</div>
    <div class="sector-task-client">${task.clientName || "Cliente?"}</div>
    <div class="sector-task-execution-date">${dataExec}</div>
    <div class="sector-task-action">
      <button class="status-button ${status.state}" title="Alterar Status" data-id="${task.id}" data-status="${status.id}"></button>
    </div>
  `;

  return item;
}


function parseDate(dateString) {
  if (!dateString) {
    return new Date('9999-12-31');
  }
  const [day, month] = dateString.split('/').map(Number);
  return new Date(new Date().getFullYear(), month - 1, day);
}

onSnapshot(tasksCollection, (snapshot) => {
  // Limpa apenas as tarefas, mantendo o cabeçalho intacto
  const items = container.querySelectorAll('.sector-task-item');
  items.forEach(item => item.remove());
  
  const tarefasParaExibir = [];

  snapshot.docs.forEach(docSnap => {
    const task = { id: docSnap.id, ...docSnap.data() };
    const statuses = healStatuses(task.statuses);
    const currentStatus = statuses.find(s => s.id === setorId);

    if (!currentStatus) return;

    // A lógica de visualização permanece a mesma
    const isAguardando = currentStatus.state === "state-in-progress";
    const isSemStatus = currentStatus.state === "state-pending";

    if (isAguardando || isSemStatus) {
      tarefasParaExibir.push({ task, status: currentStatus });
    }
  });

  // A lógica de ordenação permanece a mesma
  tarefasParaExibir.sort((a, b) => {
    const dateA = parseDate(a.status.date);
    const dateB = parseDate(b.status.date);
    return dateA - dateB; 
  });

  // Renderiza as linhas da lista já ordenadas
  tarefasParaExibir.forEach(item => {
    const card = createTarefaCard(item.task, item.status);
    container.appendChild(card);
  });
});

container.addEventListener("click", async (event) => {
  const button = event.target.closest(".status-button");
  if (!button) return;

  const docId = button.dataset.id;
  const statusId = button.dataset.status;
  const taskRef = doc(db, "tasks", docId);
  const snap = await getDoc(taskRef);

  if (!snap.exists()) return;

  const data = snap.data();
  const statuses = healStatuses(data.statuses);
  
  // --- LÓGICA DE ALTERAÇÃO DE STATUS ---
  // A ação agora é marcar como "feito" (state-done)
  const updatedStatuses = statuses.map(s => {
    if (s.id === statusId) {
      // Se já estiver "em andamento" ou "pendente", marca como "feito"
      return {
        ...s,
        state: "state-done",
        date: s.date || hojeFormatado() // Garante que a data seja preenchida ao concluir
      };
    }
    return s;
  });

  await updateDoc(taskRef, { statuses: updatedStatuses });
});
