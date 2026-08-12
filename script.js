// --- Importações do Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDoc, writeBatch, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Configuração do Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyALCIfOdzUrbzs8_ceXXYFwsCeT161OFPw",
  authDomain: "kanban-board-92ce7.firebaseapp.com",
  projectId: "kanban-board-92ce7",
  storageBucket: "kanban-board-92ce7.appspot.com",
  messagingSenderId: "494809291125",
  appId: "1:494809291125:web:17f9eefa4287d39174db3c"
};

// --- Inicialização ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tasksCollection = collection(db, "tasks");
const scheduleCollection = collection(db, "schedule");

// --- Seletores de Elementos DOM ---
const kanbanBody = document.getElementById('kanban-body');
const addRowButton = document.getElementById('add-row-button');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchCounter = document.getElementById('search-counter');
const exportPdfButton = document.getElementById('export-pdf-button');
const weeklySchedulePanel = document.getElementById('weekly-schedule-panel');
const hideScheduleButton = document.getElementById('hide-schedule-button');
const showScheduleButton = document.getElementById('show-schedule-button');

// --- LÓGICA CENTRAL ROBUSTA ---
let tasks = [];
const canonicalStatuses = [ { id: 'compras', label: 'Compras' }, { id: 'arte', label: 'Arte Final' }, { id: 'impressao', label: 'Impressão' }, { id: 'acabamento', label: 'Acabamento' }, { id: 'corte', label: 'Corte' }, { id: 'faturamento', label: 'Fat.' }, { id: 'instalacao', label: 'Instalação' }, { id: 'entrega', label: 'Entrega' }];
function healStatuses(statusesArray = []) { return canonicalStatuses.map(canonical => { const existing = statusesArray.find(s => s.id === canonical.id); return { id: canonical.id, label: canonical.label, state: existing?.state || 'state-pending', date: existing?.date || '' }; }); }
function convertDateToSortable(dateStr) { if (!dateStr || !dateStr.includes('/')) return '9999-12-31'; const parts = dateStr.split('/'); if (parts.length < 2 || isNaN(parseInt(parts[0])) || isNaN(parseInt(parts[1]))) return '9999-12-31'; const day = parts[0].padStart(2, '0'); const month = parts[1].padStart(2, '0'); const year = (parts[2] && parts[2].length === 4) ? parts[2] : new Date().getFullYear(); return `${year}-${month}-${day}`; }

// --- Função de Renderização com a Correção Definitiva ---
const renderAllTasks = (tasksToRender) => {
    kanbanBody.innerHTML = '';
    tasksToRender.forEach(task => {
        const rowElement = document.createElement('div');
        rowElement.className = 'kanban-row';
        rowElement.draggable = true; 
        rowElement.id = task.id;
        rowElement.innerHTML = `
            <div class="cell cell-drag-handle">⠿</div>
            <div class="cell cell-client">
                <input type="text" class="os-number-input" placeholder="Nº OS" value="${task.osNumber || ''}">
                <input type="text" class="client-name-input" placeholder="Nome do Cliente" value="${task.clientName || ''}">
            </div>
            ${task.statuses.map(s => `
                <div class="cell">
                    <div class="status-control">
                        <button class="status-button ${s.state}" data-status-id="${s.id}"></button>
                        <input type="text" class="status-date-input" placeholder="dd/mm" value="${s.date || ''}" data-status-id="${s.id}">
                    </div>
                </div>
            `).join('')}
            <div class="cell cell-actions">
                <button class="action-button calendar-button" title="Adicionar à Agenda">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>
                </button>
                <button class="action-button delete-button" title="Excluir Linha">×</button>
            </div>
        `;
        kanbanBody.appendChild(rowElement);
    });
};


// --- LISTENERS (KANBAN) ---
const q = query(tasksCollection, orderBy("deliveryDate", "asc"), orderBy("order", "asc"));
onSnapshot(q, (snapshot) => { const batch = writeBatch(db); let updatesNeeded = 0; tasks = snapshot.docs.map(documentSnapshot => { const data = documentSnapshot.data(); let needsDBUpdate = false; const updates = {}; let correctedData = { ...data }; const healedStatuses = healStatuses(data.statuses); if (JSON.stringify(data.statuses || []) !== JSON.stringify(healedStatuses)) { updates.statuses = healedStatuses; correctedData.statuses = healedStatuses; needsDBUpdate = true; } if (correctedData.deliveryDate === undefined) { const deliveryDate = convertDateToSortable(healedStatuses.find(s => s.id === 'entrega')?.date); updates.deliveryDate = deliveryDate; correctedData.deliveryDate = deliveryDate; needsDBUpdate = true; } if (correctedData.order === undefined) { updates.order = Date.now(); correctedData.order = updates.order; needsDBUpdate = true; } if (needsDBUpdate) { const docRef = doc(db, "tasks", documentSnapshot.id); batch.update(docRef, updates); updatesNeeded++; } return { id: documentSnapshot.id, ...correctedData }; }); if (updatesNeeded > 0) { batch.commit().catch(err => console.error("Erro ao salvar auto-correção de dados:", err)); } renderAllTasks(tasks); }, (error) => { console.error("ERRO GRAVE AO CARREGAR DADOS:", error); kanbanBody.innerHTML = `<p style="text-align: center; color: red;">Erro ao carregar os dados.</p>`; });
addRowButton.addEventListener('click', async () => { try { const newOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) + 1 : Date.now(); await addDoc(tasksCollection, { clientName: "Novo Cliente", osNumber: "OS: Nova", order: newOrder, deliveryDate: '9999-12-31', statuses: healStatuses([]) }); } catch (error) { console.error("Erro ao adicionar nova tarefa:", error); } });
kanbanBody.addEventListener('click', async (event) => { const button = event.target.closest('button'); if (!button) return; const row = button.closest('.kanban-row'); if (!row) return; const docId = row.id; const docRef = doc(db, "tasks", docId); try { if (button.classList.contains('delete-button')) { await deleteDoc(docRef); } else if (button.classList.contains('status-button')) { const states = ['state-pending', 'state-in-progress', 'state-done', 'state-blocked']; const statusId = button.dataset.statusId; const docSnap = await getDoc(docRef); if (!docSnap.exists()) return; const completeStatuses = healStatuses(docSnap.data().statuses); const newStatuses = completeStatuses.map(status => (status.id === statusId) ? { ...status, state: states[(states.indexOf(status.state) + 1) % states.length] } : status); await updateDoc(docRef, { statuses: newStatuses }); } else if (button.classList.contains('calendar-button')) { const task = tasks.find(t => t.id === docId); if (task) { const eventTitle = `Entrega: ${task.clientName} (${task.osNumber})`; window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}`, '_blank'); } } } catch (error) { console.error(`Erro na ação do botão para a tarefa ${docId}:`, error); } });
kanbanBody.addEventListener('change', async (event) => { const input = event.target; const row = input.closest('.kanban-row'); if (!row || !input.matches('input[type="text"]')) return; const docId = row.id; const docRef = doc(db, "tasks", docId); try { let updateData = {}; if (input.matches('.client-name-input')) { updateData.clientName = input.value; } else if (input.matches('.os-number-input')) { updateData.osNumber = input.value; } else if (input.matches('.status-date-input')) { const statusId = input.dataset.statusId; const docSnap = await getDoc(docRef); if (!docSnap.exists()) return; const completeStatuses = healStatuses(docSnap.data().statuses); const newStatuses = completeStatuses.map(s => (s.id === statusId) ? { ...s, date: input.value } : s); updateData.statuses = newStatuses; if (statusId === 'entrega') { updateData.deliveryDate = convertDateToSortable(input.value); } } await updateDoc(docRef, updateData); } catch (error) { console.error(`Erro ao salvar alteração no campo para a tarefa ${docId}:`, error); } });

// --- DRAG-AND-DROP (KANBAN) ---
kanbanBody.addEventListener('dragstart', (e) => { 
    const row = e.target.closest('.kanban-row');
    if (row) {
        const osNumber = row.querySelector('.os-number-input').value;
        const clientName = row.querySelector('.client-name-input').value;
        e.dataTransfer.setData('application/json', JSON.stringify({ osNumber, clientName }));
        e.dataTransfer.effectAllowed = 'copyMove'; // Permitir cópia ou movimento para a agenda
    }
});

// --- LÓGICA DA PROGRAMAÇÃO SEMANAL (AJUSTADA) ---
// Palette de cores (ordem de ciclo)
const COLOR_CYCLE = [
  { id: '', label: 'Nenhuma', color: '' },
  { id: 'arte', label: 'Arte Final', color: '#1E88E5' },
  { id: 'impressao', label: 'Impressão', color: '#FB8C00' },
  { id: 'acabamento', label: 'Acabamento', color: '#FFD54F' },
  { id: 'corte', label: 'Corte', color: '#9CCC65' },
  { id: 'serralheria', label: 'Serralheria', color: '#A1887F' },
  { id: 'instalacao', label: 'Instalação', color: '#F4511E' }
];

function renderScheduleItem(task) {
    const item = document.createElement('div');
    item.className = 'schedule-item';
    item.dataset.os = task.osNumber || '';
    item.dataset.client = task.clientName || '';
    item.dataset.colorId = task.colorId || '';
    item.dataset.colorSet = task.color ? 'true' : 'false';
    const clientName = task.clientName || '';
    let firstWord = clientName.split(' ')[0] || '';
    if (firstWord.length > 8) {
        firstWord = firstWord.substring(0, 8);
    }
    const formattedText = `${task.osNumber || ''} ${firstWord}`.trim();
    item.innerHTML = `
        <span class="schedule-item-text" title="${task.osNumber || ''} ${clientName}">${formattedText}</span>
        <button class="delete-schedule-item-btn" title="Excluir">×</button>
    `;

    // Aplica cor quando existente
    if (task.color) {
      item.style.backgroundColor = task.color;
      item.style.borderLeft = `3px solid ${task.color}`;
      item.dataset.colorSet = 'true';
    } else {
      item.style.backgroundColor = '#fff';
      item.style.borderLeft = `3px solid var(--primary-color)`;
      item.dataset.colorSet = 'false';
    }

    return item;
}

onSnapshot(scheduleCollection, (snapshot) => { 
    // limpa zonas
    document.querySelectorAll('.drop-zone').forEach(zone => zone.innerHTML = '');
    snapshot.forEach(docSnap => { 
        const dayId = docSnap.id; 
        const tasks = docSnap.data().tasks || []; 
        const zone = document.getElementById(dayId); 
        if (zone) { 
            tasks.forEach(task => { 
                zone.appendChild(renderScheduleItem(task)); 
            }); 
        } 
    }); 
});

weeklySchedulePanel.addEventListener('dragover', e => { e.preventDefault(); const dropZone = e.target.closest('.drop-zone'); if (dropZone) dropZone.classList.add('drag-over'); });
weeklySchedulePanel.addEventListener('dragleave', e => { const dropZone = e.target.closest('.drop-zone'); if (dropZone) dropZone.classList.remove('drag-over'); });

weeklySchedulePanel.addEventListener('drop', async e => { 
    e.preventDefault(); 
    const dropZone = e.target.closest('.drop-zone'); 
    if (dropZone) { 
        dropZone.classList.remove('drag-over'); 
        try { 
            const taskData = JSON.parse(e.dataTransfer.getData('application/json')); 
            if (taskData && taskData.osNumber && taskData.clientName) { 
                const dayId = dropZone.id;
                const scheduleDocRef = doc(db, "schedule", dayId);
                // Adiciona cor vazia por padrão
                const newTask = { osNumber: taskData.osNumber, clientName: taskData.clientName, colorId: '', color: '' };
                await setDoc(scheduleDocRef, { tasks: arrayUnion(newTask) }, { merge: true });
            }
        } catch (error) { 
            console.error("Erro ao salvar na programação:", error); 
        } 
    } 
});

// Clique em remover e clique em item para ciclar cor
weeklySchedulePanel.addEventListener('click', async e => { 
    // exclusão (botão)
    if (e.target.classList.contains('delete-schedule-item-btn')) {
        const item = e.target.closest('.schedule-item');
        const zone = e.target.closest('.drop-zone');
        if (item && zone) {
            const os = item.dataset.os;
            const client = item.dataset.client;
            const dayId = zone.id;
            const scheduleDocRef = doc(db, "schedule", dayId);
            try {
                const snap = await getDoc(scheduleDocRef);
                const arr = snap.exists() ? (snap.data().tasks || []) : [];
                const newArr = arr.filter(t => !(t.osNumber === os && t.clientName === client));
                await updateDoc(scheduleDocRef, { tasks: newArr });
            } catch (error) {
                console.error("Erro ao excluir da programação:", error);
            }
        }
        return;
    }

    // ciclo de cores (clique no item)
    const clickedItem = e.target.closest('.schedule-item');
    if (clickedItem && !e.target.classList.contains('delete-schedule-item-btn')) {
        const os = clickedItem.dataset.os;
        const client = clickedItem.dataset.client;
        const zone = clickedItem.closest('.drop-zone');
        if (!zone) return;
        const dayId = zone.id;
        const scheduleDocRef = doc(db, "schedule", dayId);
        try {
            const snap = await getDoc(scheduleDocRef);
            const arr = snap.exists() ? (snap.data().tasks || []) : [];
            const newArr = arr.map(t => {
                if (t.osNumber === os && t.clientName === client) {
                    const currentIdx = COLOR_CYCLE.findIndex(c => c.id === (t.colorId || ''));
                    const next = COLOR_CYCLE[(currentIdx + 1) % COLOR_CYCLE.length];
                    return { ...t, colorId: next.id, color: next.color };
                }
                return t;
            });
            await updateDoc(scheduleDocRef, { tasks: newArr });
        } catch (error) {
            console.error("Erro ao atualizar cor na programação:", error);
        }
    }
});

// --- LÓGICA PARA MOSTRAR/OCULTAR PAINEL ---
const setSchedulePanelVisibility = (isHidden) => {
    document.body.classList.toggle('schedule-is-hidden', isHidden);
    localStorage.setItem('scheduleHidden', isHidden ? 'true' : 'false');
};
hideScheduleButton.addEventListener('click', () => setSchedulePanelVisibility(true));
showScheduleButton.addEventListener('click', () => setSchedulePanelVisibility(false));

// --- INICIALIZAÇÃO E EVENTOS GLOBAIS ---
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('scheduleHidden') === 'true') {
        setSchedulePanelVisibility(true);
    }
    window.addEventListener('scroll', handleStickyHeader);
    window.addEventListener('resize', handleStickyHeader);
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
    searchInput.addEventListener('input', clearSearchState);
    exportPdfButton.addEventListener('click', exportToPDF);
});
// --- PESQUISA, HEADER FIXO, PDF ---
let currentSearchTerm = ''; let currentMatchingIndices = []; let searchResultPointer = -1; const clearSearchState = () => { currentSearchTerm = ''; currentMatchingIndices = []; searchResultPointer = -1; searchCounter.textContent = ''; document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight')); }; const handleSearch = () => { const newSearchTerm = searchInput.value.toLowerCase().trim(); if (!newSearchTerm) { clearSearchState(); return; } if (newSearchTerm !== currentSearchTerm) { currentSearchTerm = newSearchTerm; currentMatchingIndices = tasks.reduce((acc, task, index) => { if ((task.clientName || '').toLowerCase().includes(currentSearchTerm) || (task.osNumber || '').toLowerCase().includes(currentSearchTerm)) { acc.push(index); } return acc; }, []); searchResultPointer = -1; } if (currentMatchingIndices.length === 0) { searchCounter.textContent = '0/0'; alert('Nenhum item encontrado.'); return; } searchResultPointer = (searchResultPointer + 1) % currentMatchingIndices.length; const taskIndexToShow = currentMatchingIndices[searchResultPointer]; const foundTask = tasks[taskIndexToShow]; const foundRow = document.getElementById(foundTask.id); if (foundRow) { document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight')); foundRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); foundRow.classList.add('highlight'); searchCounter.textContent = `${searchResultPointer + 1}/${currentMatchingIndices.length}`; } }; function handleStickyHeader() { const header = document.querySelector('.kanban-header'); const placeholder = document.querySelector('.header-placeholder'); const kanbanTable = document.querySelector('.kanban-table'); if (!header || !placeholder || !kanbanTable) return; const scrollTriggerPoint = kanbanTable.offsetTop; if (window.pageYOffset > scrollTriggerPoint) { if (!header.classList.contains('is-sticky')) { header.classList.add('is-sticky'); placeholder.style.display = 'block'; } const rect = kanbanTable.getBoundingClientRect(); placeholder.style.height = `${header.offsetHeight}px`; header.style.width = `${rect.width}px`; header.style.left = `${rect.left}px`; } else { if (header.classList.contains('is-sticky')) { header.classList.remove('is-sticky'); header.style.width = ''; header.style.left = ''; placeholder.style.display = 'none'; } } } const exportToPDF = async () => { const contentToPrint = document.querySelector('.kanban-board'); const originalButtonText = exportPdfButton.querySelector('span').textContent; exportPdfButton.disabled = true; exportPdfButton.querySelector('span').textContent = 'Exportando...'; document.querySelectorAll('.kanban-row').forEach(row => { const clientCell = row.querySelector('.cell-client'); const osInput = row.querySelector('.os-number-input'); const clientInput = row.querySelector('.client-name-input'); if (clientCell && osInput && clientInput) { const tempDiv = document.createElement('div'); tempDiv.className = 'pdf-client-info'; tempDiv.innerHTML = `<span class="pdf-os">${osInput.value}</span><span class="pdf-client">${clientInput.value}</span>`; clientCell.appendChild(tempDiv); } row.querySelectorAll('.status-control').forEach(control => { const dateInput = control.querySelector('.status-date-input'); if (dateInput && dateInput.value) { const tempSpan = document.createElement('span'); tempSpan.className = 'pdf-date-text'; tempSpan.textContent = dateInput.value; control.insertBefore(tempSpan, dateInput); } }); }); document.body.classList.add('print-mode'); try { const { jsPDF } = window.jspdf; const canvas = await html2canvas(contentToPrint, { scale: 2, useCORS: true, logging: false }); const pdf = new jsPDF('l', 'mm', 'a4'); const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight(); const canvasAspectRatio = canvas.width / canvas.height; let finalPdfHeight = pdfHeight - 20; let finalPdfWidth = finalPdfHeight / canvasAspectRatio; if (finalPdfWidth > pdfWidth - 20) { finalPdfWidth = pdfWidth - 20; finalPdfHeight = finalPdfWidth * canvasAspectRatio; } let position = 0; let heightLeft = canvas.height * (finalPdfWidth / canvas.width); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, finalPdfWidth, finalPdfHeight); heightLeft -= (pdfHeight - 20); while (heightLeft > 0) { position -= (pdfHeight - 20); pdf.addPage(); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position + 10, finalPdfWidth, finalPdfHeight); heightLeft -= (pdfHeight - 20); } pdf.save('quadro-kanban.pdf'); } catch (error) { console.error("Erro ao gerar o PDF:", error); alert("Ocorreu um erro ao gerar o PDF."); } finally { document.body.classList.remove('print-mode'); document.querySelectorAll('.pdf-client-info, .pdf-date-text').forEach(el => el.remove()); exportPdfButton.disabled = false; exportPdfButton.querySelector('span').textContent = originalButtonText; } };

document.getElementById("open-production-panel")?.addEventListener("click", () => {
  window.open("painel_programacao.html", "_blank");
});

document.getElementById("open-tools-panel")?.addEventListener("click", () => {
  window.open("ferramentas.html", "_blank");
});

// --- LÓGICA PARA AS ANOTAÇÕES DO PAINEL SEMANAL ---
const notesTextarea = document.getElementById('schedule-notes');

// Salva as notas ao digitar (com um pequeno atraso/debounce para não sobrecarregar o Firebase)
let notesTimeout;
notesTextarea.addEventListener('input', () => {
    clearTimeout(notesTimeout);
    notesTimeout = setTimeout(async () => {
        try {
            await setDoc(doc(db, "schedule", "general-notes"), { text: notesTextarea.value }, { merge: true });
        } catch (e) { console.error("Erro ao salvar notas:", e); }
    }, 1000);
});

// Carrega as notas e escuta mudanças em tempo real
onSnapshot(doc(db, "schedule", "general-notes"), (docSnap) => {
    if (docSnap.exists() && document.activeElement !== notesTextarea) {
        notesTextarea.value = docSnap.data().text || "";
    }
});
