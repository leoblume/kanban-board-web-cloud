import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- NOVO: Função para calcular a data - X dias e formatar para DD/MM ---
/**
 * Calcula uma data anterior com base em uma data string e a retorna formatada.
 * @param {string} dateStr - A data base no formato "DD/MM/YYYY".
 * @param {number} daysToSubtract - O número de dias a subtrair.
 * @returns {string} A nova data no formato "DD/MM".
 */
function calculateAndFormatPreviousDate(dateStr, daysToSubtract) {
  // Converte a string "DD/MM/YYYY" para um objeto Date
  const parts = dateStr.split('/');
  const [day, month, year] = parts.map(Number);
  // new Date(ano, mês - 1, dia) - Mês em JS é 0-indexado
  const dateObj = new Date(year, month - 1, day);

  // setDate lida automaticamente com a mudança de mês/ano
  dateObj.setDate(dateObj.getDate() - daysToSubtract);

  // Formata de volta para "DD/MM"
  const newDay = String(dateObj.getDate()).padStart(2, '0');
  const newMonth = String(dateObj.getMonth() + 1).padStart(2, '0');

  return `${newDay}/${newMonth}`;
}


window.extractData = async function () {
  const fileInput = document.getElementById('pdfFile');
  const file = fileInput.files[0];
  const resultArea = document.getElementById('resultArea');
  resultArea.innerHTML = "Processando...";

  if (!file) {
    alert("Por favor, selecione um arquivo PDF.");
    resultArea.innerHTML = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async function () {
    try {
      const typedarray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const sortedItems = content.items.sort((a, b) => {
          const yA = a.transform[5]; const yB = b.transform[5];
          const xA = a.transform[4]; const xB = b.transform[4];
          if (Math.abs(yA - yB) > 5) return yB - yA;
          return xA - xB;
        });
        fullText += sortedItems.map(item => item.str).join(' ') + ' ';
      }

      fullText = fullText.replace(/Total OSs.*?:\s*\d+/g, '').replace(/\s{2,}/g, ' ');

      const regex = /(\d{5})\s+(.*?)\s+PRO\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+(\d{2}\/\d{2}\/\d{4})/g;
      
      const tasksFromPdf = [];
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        tasksFromPdf.push({ os: match[1], clientAndDesc: match[2].trim(), prevEnt: match[3] });
      }

      const snapshot = await getDocs(tasksCollection);
      const existingTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        osNumber: doc.data().osNumber,
        clientName: doc.data().clientName,
        statuses: doc.data().statuses,
      }));

      const pdfOsNumbers = tasksFromPdf.map(t => t.os);
      const osToRemove = existingTasks.filter(
        t => !pdfOsNumbers.includes(t.osNumber) && !t.osNumber.startsWith('111')
      );

      let outputHTML = "<h3>Resultado da Importação:</h3><ul>";

      for (const task of tasksFromPdf) {
        const { os, clientAndDesc, prevEnt } = task; // prevEnt está como "DD/MM/YYYY"
        if (os.startsWith('111')) {
          outputHTML += `<li>🔒 OS ${os} ignorada (protegida)</li>`;
          continue;
        }
        
        // --- NOVO: Calcular as datas necessárias ---
        const deliveryDateShort = prevEnt.substring(0, 5); // Pega "DD/MM" da data de entrega
        const otherSectorsDate = calculateAndFormatPreviousDate(prevEnt, 2); // Calcula a data para os outros setores

        const { clientName, description } = splitClientAndDescription(clientAndDesc);
        const existing = existingTasks.find(t => t.osNumber === os);

        if (existing) {
          const docRef = doc(db, "tasks", existing.id);
          // --- ALTERADO: Atualizar as datas de todos os status ---
          await updateDoc(docRef, {
            clientName,
            description,
            deliveryDate: convertDateToSortable(prevEnt),
            statuses: existing.statuses.map(s => ({
              ...s, // Mantém o estado atual (ex: state-done)
              date: s.id === "entrega" ? deliveryDateShort : otherSectorsDate,
            }))
          });
          outputHTML += `<li>🔄 Atualizado: OS ${os} - ${clientName} (Entrega: ${deliveryDateShort})</li>`;
        } else {
          // --- ALTERADO: Criar a nova tarefa com as datas corretas ---
          const allStatuses = [
            { id: 'compras', label: 'Compras' },
            { id: 'arte', label: 'Arte Final' },
            { id: 'impressao', label: 'Impressão' },
            { id: 'acabamento', label: 'Acabamento' },
            { id: 'corte', label: 'Corte' },
            { id: 'faturamento', label: 'Faturamento' },
            { id: 'instalacao', label: 'Instalação' },
            { id: 'entrega', label: 'Entrega' }
          ];

          await addDoc(tasksCollection, {
            osNumber: os,
            clientName,
            description,
            order: Date.now(),
            deliveryDate: convertDateToSortable(prevEnt),
            statuses: allStatuses.map(s => ({
              ...s,
              state: 'state-pending',
              date: s.id === 'entrega' ? deliveryDateShort : otherSectorsDate
            }))
          });
          outputHTML += `<li>✅ Importado: OS ${os} - ${clientName} (Entrega: ${deliveryDateShort})</li>`;
        }
      }

      if (osToRemove.length > 0) {
        outputHTML += `</ul><h4>Itens não encontrados no PDF:</h4><ul>`;
        osToRemove.forEach(t => {
          outputHTML += `<li>❌ OS ${t.osNumber} - ${t.clientName}</li>`;
        });

        if (confirm(`Foram encontrados ${osToRemove.length} itens que não estão no PDF. Deseja excluí-los?`)) {
          for (const t of osToRemove) {
            const docRef = doc(db, "tasks", t.id);
            await deleteDoc(docRef);
            outputHTML += `<li>🗑️ Excluído: OS ${t.osNumber}</li>`;
          }
        } else {
          outputHTML += `<li>🟨 Nenhuma exclusão feita.</li>`;
        }
      }

      outputHTML += "</ul>";
      resultArea.innerHTML = outputHTML;
      fileInput.value = '';

    } catch (error) {
      console.error("Erro:", error);
      resultArea.innerHTML = `<p style="color:red;">Erro ao processar PDF. Verifique o console.</p>`;
    }
  };
  reader.readAsArrayBuffer(file);
};

function convertDateToSortable(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '9999-12-31';
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function splitClientAndDescription(str) {
  const descKeywords = ['ADESIVO', 'BANNER', 'LETRA CAIXA', 'REPARO', 'PAINEL', 'IMPRESSÃO', 'ACM', 'FACHADA', 'LONA', 'PLOTTER', 'MANUTENÇÃO'];
  for (const word of descKeywords) {
    const idx = str.indexOf(word);
    if (idx > 0) {
      return {
        clientName: str.substring(0, idx).trim(),
        description: str.substring(idx).trim()
      };
    }
  }
  return { clientName: str.trim(), description: 'Não especificada' };
}
