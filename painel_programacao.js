// Importar SDK do Firebase para Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Configuração Firebase (usar a mesma do seu script.js principal)
const firebaseConfig = {
  apiKey: "AIzaSyALCIfOdzUrbzs8_ceXXYFwsCeT161OFPw",
  authDomain: "kanban-board-92ce7.firebaseapp.com",
  projectId: "kanban-board-92ce7",
  storageBucket: "kanban-board-92ce7.appspot.com",
  messagingSenderId: "494809291125",
  appId: "1:494809291125:web:17f9eefa4287d39174db3c"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scheduleCollection = collection(db, "schedule"); // Coleção 'schedule'

// Cores iguais ao Kanban principal
const COLORS = {
  arte: "#1E88E5",
  impressao: "#FB8C00",
  acabamento: "#FFD54F",
  corte: "#9CCC65",
  serralheria: "#A1887F",
  instalacao: "#F4511E"
};

// Mapeamento de IDs de dias para elementos HTML
const dayElements = {
    segunda: document.getElementById('segunda')?.querySelector('.painel-lista'),
    terca: document.getElementById('terca')?.querySelector('.painel-lista'),
    quarta: document.getElementById('quarta')?.querySelector('.painel-lista'),
    quinta: document.getElementById('quinta')?.querySelector('.painel-lista'),
    sexta: document.getElementById('sexta')?.querySelector('.painel-lista'),
    sabado: document.getElementById('sabado')?.querySelector('.painel-lista'),
};

// Atualiza painel com dados do Firestore
function carregarProgramacao(snapshot) {
  // Limpa todos os painéis antes de adicionar os novos itens
  Object.values(dayElements).forEach(el => {
    if (el) el.innerHTML = "";
  });

  snapshot.forEach(docSnap => {
    const dayId = docSnap.id; // Ex: "w1-segunda", "w1-terca"
    const tasks = docSnap.data().tasks || [];

    // O painel_programacao.html usa apenas "segunda", "terca", etc.
    // Precisamos mapear "w1-segunda" para "segunda"
    const simpleDayId = dayId.split('-').pop(); 
    const targetList = dayElements[simpleDayId];

    if (targetList) {
      tasks.forEach(item => {
        const card = document.createElement("div");
        card.className = "painel-item";
        
        // Usa a cor definida no item.color ou COLORS[item.colorId]
        const itemColor = item.color || COLORS[item.colorId] || "#ccc";
        card.style.borderLeftColor = itemColor;
        card.style.backgroundColor = '#fff'; // Fundo branco para o item

        card.innerHTML = `
          <div class="painel-cliente">${item.clientName || ''}</div>
          <div class="painel-os">OS: ${item.osNumber || ''}</div>
          <div class="painel-setor">Setor: ${COLORS[item.colorId] ? item.colorId.charAt(0).toUpperCase() + item.colorId.slice(1) : 'Não Definido'}</div>
        `;
        // O painel_programacao.html não tem campo para data de entrega,
        // então removi o item.dataEntrega
        targetList.appendChild(card);
      });
    }
  });
}

// Escuta o Firestore em tempo real
onSnapshot(scheduleCollection, carregarProgramacao, (error) => {
    console.error("Erro ao carregar programação do Firestore:", error);
    // Opcional: Mostrar uma mensagem de erro no painel
    Object.values(dayElements).forEach(el => {
        if (el) el.innerHTML = `<p style="color: red; text-align: center;">Erro ao carregar.</p>`;
    });
});
// escuta para o texto de anotações no final do arquivo:
const displayNotes = document.getElementById('display-notes');
onSnapshot(doc(db, "schedule", "general-notes"), (docSnap) => {
    if (docSnap.exists() && displayNotes) {
        displayNotes.textContent = docSnap.data().text || "";
    }
});

// Atualização visual automática (opcional, pode ser removido se não for necessário)
// setInterval(() => window.location.reload(), 30000);
