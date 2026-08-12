import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, query, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const aprovadosCollection = collection(db, "tasks_aprovados");

const kanbanBody = document.getElementById('kanban-body');
const addRowButton = document.getElementById('add-row-button');

// Renderização da tabela
const renderTasks = (tasks) => {
    kanbanBody.innerHTML = '';
    tasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'kanban-row';
        row.id = task.id;

        row.innerHTML = `
            <div class="cell cell-drag-handle" style="cursor:grab; color:#ccc;">⠿</div>
            
            <div class="cell cell-client">
                <input type="text" class="os-number-input" value="${task.osNumber || ''}" style="font-weight:bold;">
                <input type="text" class="client-name-input" value="${task.clientName || ''}" style="color:#666;">
            </div>

            <div class="cell" style="text-align: center;">
                <input type="text" class="status-date-input delivery-date-field" 
                       style="width: 85px; text-align: center;" 
                       value="${task.deliveryDisplay || ''}">
            </div>

            <div class="cell">
                <input type="text" class="obs-input" value="${task.obs || ''}"> 
            </div>

            <div class="cell cell-actions" style="justify-content: center;">
                <button class="action-button delete-button" 
                        style="color:#dc3545; font-size: 24px; background:none; border:none; cursor:pointer;">&times;</button>
            </div>
        `;
        kanbanBody.appendChild(row);
    });
};

// --- LÓGICA DE ESCUTA E ORDENAÇÃO ---
onSnapshot(aprovadosCollection, (snapshot) => {
    let tasksData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ordenação: 1º Alfabética (Cliente), 2º Numérica (OS)
    tasksData.sort((a, b) => {
        const clienteA = (a.clientName || "").toUpperCase();
        const clienteB = (b.clientName || "").toUpperCase();

        if (clienteA < clienteB) return -1;
        if (clienteA > clienteB) return 1;

        // Se o cliente for o mesmo, ordena pela OS
        const osA = (a.osNumber || "");
        const osB = (b.osNumber || "");
        return osA.localeCompare(osB, undefined, { numeric: true });
    });

    renderTasks(tasksData);
});

// Adicionar nova linha manual
addRowButton.addEventListener('click', () => {
    addDoc(aprovadosCollection, { 
        clientName: "Novo Cliente", 
        osNumber: "00000", 
        deliveryDate: "9999-12-31", 
        deliveryDisplay: "",
        obs: "" 
    });
});

// Eventos de Exclusão e Alteração
kanbanBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-button')) {
        if(confirm("Excluir esta tarefa?")) deleteDoc(doc(db, "tasks_aprovados", e.target.closest('.kanban-row').id));
    }
});

kanbanBody.addEventListener('change', async (e) => {
    const row = e.target.closest('.kanban-row');
    if (!row) return;
    const docRef = doc(db, "tasks_aprovados", row.id);
    const val = e.target.value;

    if (e.target.classList.contains('obs-input')) await updateDoc(docRef, { obs: val });
    if (e.target.classList.contains('os-number-input')) await updateDoc(docRef, { osNumber: val });
    if (e.target.classList.contains('client-name-input')) await updateDoc(docRef, { clientName: val });
    if (e.target.classList.contains('delivery-date-field')) {
        await updateDoc(docRef, { 
            deliveryDisplay: val,
            deliveryDate: val.split('/').reverse().join('-') 
        });
    }
});