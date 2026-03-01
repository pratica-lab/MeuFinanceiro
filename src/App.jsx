import React, { useState, useEffect, useMemo, useRef } from "react";

// --- NOTA PARA O SEU VS CODE LOCAL ---
// No seu computador, você DEVE manter a linha abaixo ativa (remova as barras //).
// Ela é necessária para o Tailwind v4 funcionar. 
// No preview aqui do chat, ela está comentada apenas para evitar o erro de compilação do sistema.
// import "./index.css"; 

import {
  Plus, Trash2, CheckCircle, Circle, Download, Search, Cloud,
  Loader2, Upload, Sun, Moon, Repeat, FileText,
  ChevronDown, LogOut, SortAsc, DollarSign, Filter, Calendar
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence
} from "firebase/auth";
import {
  getFirestore, collection, updateDoc, deleteDoc, doc,
  onSnapshot, writeBatch
} from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDqY-cooGvIPMykBfzdkdKO5EHd9vweTz4",
  authDomain: "controle-financeiro-gavs.firebaseapp.com",
  projectId: "controle-financeiro-gavs",
  storageBucket: "controle-financeiro-gavs.firebasestorage.app",
  messagingSenderId: "847168764881",
  appId: "1:847168764881:web:d89f8cc90cc21b3fbcbef0",
};

const appId = "financeiro-gavs-01";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);

  // Estados da UI
  const [activeTab, setActiveTab] = useState("receivable");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Filtros e Ordenação Restaurados
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  // Modais de Recorrência e Importação
  const [recurringEditModalOpen, setRecurringEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  
  const listRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("financeAppTheme") === "dark";
    }
    return false;
  });

  const [formData, setFormData] = useState({
    description: "", amount: "", entity: "",
    date: new Date().toISOString().split("T")[0],
    repeatCount: 1, status: false,
  });

  useEffect(() => {
    localStorage.setItem("financeAppTheme", isDarkMode ? "dark" : "light");
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, "artifacts", appId, "users", user.uid, "transactions");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Erro Firestore:", err));
    return () => unsubscribe();
  }, [user]);

  // --- Funções de Negócio ---
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) { console.error(error); }
    finally { setAuthLoading(false); }
  };

  const onFormSubmit = (e) => {
    e.preventDefault();
    if (editingItem && editingItem.groupId) {
      setRecurringEditModalOpen(true);
    } else {
      executeSave("single");
    }
  };

  const executeSave = async (mode) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;
      if (editingItem) {
        if (mode === "series" && editingItem.groupId) {
          const batch = writeBatch(db);
          const series = transactions.filter(t => t.groupId === editingItem.groupId && t.date >= editingItem.date);
          const seqRegex = /\s*\(\d+\/\d+\)$/;
          const cleanDesc = formData.description.replace(seqRegex, "").trim();
          series.forEach((item) => {
            const match = item.description.match(seqRegex);
            batch.update(doc(db, basePath, item.id), {
              description: match ? `${cleanDesc} ${match[0].trim()}` : formData.description,
              amount: parseFloat(formData.amount),
              entity: formData.entity || "",
            });
          });
          await batch.commit();
        } else {
          await updateDoc(doc(db, basePath, editingItem.id), {
            description: formData.description,
            amount: parseFloat(formData.amount),
            entity: formData.entity || "",
            date: formData.date,
          });
        }
      } else {
        const batch = writeBatch(db);
        const baseDate = new Date(formData.date);
        const adjustedDate = new Date(baseDate.getTime() + baseDate.getTimezoneOffset() * 60000);
        const groupId = formData.repeatCount > 1 ? crypto.randomUUID() : null;
        for (let i = 0; i < Math.max(1, parseInt(formData.repeatCount)); i++) {
          const d = new Date(adjustedDate);
          d.setMonth(adjustedDate.getMonth() + i);
          const newRef = doc(collection(db, basePath));
          batch.set(newRef, {
            type: activeTab,
            description: formData.description + (formData.repeatCount > 1 ? ` (${i + 1}/${formData.repeatCount})` : ""),
            amount: parseFloat(formData.amount),
            entity: formData.entity || "",
            date: d.toISOString().split("T")[0],
            status: formData.status,
            groupId, createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setRecurringEditModalOpen(false);
    } catch (err) { alert("Erro ao salvar"); }
    setIsSaving(false);
  };

  const handleDeleteRequest = (item, e) => {
    e.stopPropagation();
    setItemToDelete(item);
    if (item.groupId) setDeleteModalOpen(true);
    else if (window.confirm("Deseja excluir este item?")) performDelete([item.id]);
  };

  const performDelete = async (ids) => {
    if (!user) return;
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, `artifacts/${appId}/users/${user.uid}/transactions`, id)));
    await batch.commit();
    setDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const toggleStatus = async (id, current, e) => {
    e.stopPropagation();
    if (user) {
      await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/transactions`, id), { status: !current });
    }
  };

  const filteredTransactions = useMemo(() => {
    let res = transactions.filter(t => t.type === activeTab);
    if (selectedMonth) res = res.filter(t => t.date.startsWith(selectedMonth));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      res = res.filter(t => (t.description || "").toLowerCase().includes(s) || (t.entity || "").toLowerCase().includes(s));
    }
    if (filterStatus !== "all") res = res.filter(t => t.status === (filterStatus === "paid"));
    
    return res.sort((a, b) => {
      if (sortBy === "date") return new Date(a.date) - new Date(b.date);
      if (sortBy === "amount") return b.amount - a.amount;
      if (sortBy === "alpha") return (a.description || "").localeCompare(b.description || "");
      return (a.entity || "").localeCompare(b.entity || "");
    });
  }, [transactions, activeTab, selectedMonth, searchTerm, filterStatus, sortBy]);

  const totals = useMemo(() => {
    const val = (l) => parseFloat(l.amount || 0);
    return {
      total: filteredTransactions.reduce((acc, c) => acc + val(c), 0),
      paid: filteredTransactions.filter(t => t.status).reduce((acc, c) => acc + val(c), 0),
      open: filteredTransactions.filter(t => !t.status).reduce((acc, c) => acc + val(c), 0),
    };
  }, [filteredTransactions]);

  const handleExportCSV = (mode) => {
    const data = mode === "all" ? transactions.filter(t => t.type === activeTab) : filteredTransactions;
    const csv = ["Descricao,Valor,Data,Entidade,Status", ...data.map(t => `"${t.description}",${t.amount},${t.date},"${t.entity || ""}",${t.status ? "Pago" : "Aberto"}`)].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `financeiro.csv`;
    link.click();
    setShowExportMenu(false);
  };

  const handleImportCSV = async (e) => {
    e.preventDefault();
    if (!csvFile || !user) return;
    setIsSaving(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split("\n");
        const batch = writeBatch(db);
        const colRef = collection(db, "artifacts", appId, "users", user.uid, "transactions");
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].trim().split(",");
          if (cols.length < 3) continue;
          batch.set(doc(colRef), {
            type: activeTab,
            description: cols[0]?.replace(/"/g, "") || "Importado",
            amount: parseFloat(cols[1]?.replace("R$", "").replace(",", ".") || 0),
            date: cols[2]?.trim() || new Date().toISOString().split("T")[0],
            entity: cols[3]?.replace(/"/g, "").trim() || "",
            status: false,
            createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
        setImportModalOpen(false);
      } catch (err) { alert("Erro na importação"); }
      finally { setIsSaving(false); }
    };
    reader.readAsText(csvFile);
  };

  // --- Definição Visual ---
  const theme = {
    bg: isDarkMode ? "bg-slate-900" : "bg-gray-50",
    text: isDarkMode ? "text-slate-100" : "text-black",
    subText: isDarkMode ? "text-slate-400" : "text-gray-500",
    card: isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200",
    input: isDarkMode ? "bg-slate-700 border-slate-600 text-white" : "bg-white border-gray-300 text-black",
    modal: isDarkMode ? "bg-slate-800" : "bg-white",
    trash: isDarkMode ? "text-red-400 hover:text-red-300" : "text-black hover:text-red-600", // Lixeira preta no tema claro
    circle: isDarkMode ? "text-gray-600" : "text-slate-200", // Borda do círculo mais clara no tema claro
    
    // Configurações específicas para o Menu/Filtros
    tabContainer: isDarkMode ? "bg-slate-800" : "bg-[#E5E7EB]",
    tabSelected: isDarkMode ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow" : "bg-white text-[#1F2937] shadow",
    tabUnselected: isDarkMode ? "opacity-50 text-white" : "text-[#828891] bg-transparent"
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-indigo-400"><Loader2 className="animate-spin w-10 h-10" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-2xl border border-white/10 text-center shadow-2xl">
        <Cloud size={48} className="mx-auto mb-4 text-indigo-400" />
        <h1 className="text-2xl font-bold mb-8 uppercase tracking-wider">PráticaLab - Meu Financeiro</h1>
        <button onClick={handleGoogleLogin} className="w-full bg-white text-slate-950 font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />
          Entrar com Google
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} pb-10 transition-colors font-sans`}>
      <header className={`bg-indigo-900 text-white p-5 sticky top-0 z-20 shadow-lg`}>
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Cloud size={22} className="text-indigo-300" />
              <span className="font-bold tracking-tight">PráticaLab - Meu Financeiro</span>
            </div>
            {user && (
              <p className="text-[10px] opacity-70 font-light mt-0.5 tracking-wide italic">
                conectado como: {user.displayName || user.email.split('@')[0]}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-white/10 rounded-lg transition">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setImportModalOpen(true)} className="p-2 hover:bg-white/10 rounded-lg"><Upload size={20} /></button>
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 hover:bg-white/10 rounded-lg flex items-center gap-1"><Download size={20} /> <ChevronDown size={14} /></button>
              {showExportMenu && (
                <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-2xl overflow-hidden z-30 border ${theme.card}`}>
                  <button onClick={() => handleExportCSV("filtered")} className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${theme.text}`}>Exportar CSV (Atual)</button>
                  <button onClick={() => handleExportCSV("all")} className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${theme.text}`}>Exportar CSV (Tudo)</button>
                </div>
              )}
            </div>
            <button onClick={() => { setEditingItem(null); setFormData({ description: "", amount: "", entity: "", date: new Date().toISOString().split("T")[0], repeatCount: 1, status: false }); setIsModalOpen(true); }} className="bg-indigo-500 p-2 rounded-lg shadow-lg active:scale-90 transition"><Plus size={20} /></button>
            <button onClick={() => signOut(auth)} className="p-2 text-red-300 hover:bg-red-900/20 rounded-lg"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Busca e Data */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={`flex-1 p-3 rounded-xl border font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 ${theme.input}`} />
          <div className={`flex-[2] flex items-center border rounded-xl px-4 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 ${theme.input}`}>
            <Search size={18} className="opacity-40 mr-2" />
            <input placeholder="Buscar lançamentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent outline-none text-sm w-full py-3 font-medium" />
          </div>
        </div>

        {/* Barra de Filtros Restaurada com Novas Cores */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className={`flex ${theme.tabContainer} p-1 rounded-xl flex-1`}>
            <button 
              onClick={() => setFilterStatus("all")} 
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${filterStatus === "all" ? theme.tabSelected : theme.tabUnselected}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterStatus("paid")} 
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${filterStatus === "paid" ? theme.tabSelected : theme.tabUnselected}`}
            >
              Pagos
            </button>
            <button 
              onClick={() => setFilterStatus("open")} 
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${filterStatus === "open" ? theme.tabSelected : theme.tabUnselected}`}
            >
              Abertos
            </button>
          </div>
          <div className={`flex items-center gap-2 border rounded-xl px-3 ${theme.input} text-xs`}>
            <SortAsc size={16} className="opacity-40" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent outline-none font-bold py-2 w-full cursor-pointer">
              <option value="date">Vencimento</option>
              <option value="amount">Maior Valor</option>
              <option value="alpha">Nome A-Z</option>
              <option value="entity">Entidade</option>
            </select>
          </div>
        </div>

        {/* Dashboards */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`p-4 rounded-xl border text-center ${theme.card}`}>
            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-widest mb-1">Total</span>
            <span className="font-bold text-sm sm:text-lg">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={`p-4 rounded-xl border text-center ${theme.card}`}>
            <span className="text-[10px] font-bold text-emerald-500 block uppercase tracking-widest mb-1">Pago</span>
            <span className="font-bold text-sm sm:text-lg text-emerald-500">R$ {totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={`p-4 rounded-xl border text-center ${theme.card}`}>
            <span className="text-[10px] font-bold text-red-500 block uppercase tracking-widest mb-1">Aberto</span>
            <span className="font-bold text-sm sm:text-lg text-red-500">R$ {totals.open.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Abas Receber/Pagar com Configurações Específicas */}
        <div className={`flex ${theme.tabContainer} p-1 rounded-xl`}>
          <button 
            onClick={() => setActiveTab("receivable")} 
            className={`flex-1 py-3 rounded-lg text-xs font-semibold transition-all duration-300 ${
              activeTab === "receivable" 
                ? theme.tabSelected
                : theme.tabUnselected
            }`}
          >
            Receber
          </button>
          <button 
            onClick={() => setActiveTab("payable")} 
            className={`flex-1 py-3 rounded-lg text-xs font-semibold transition-all duration-300 ${
              activeTab === "payable" 
                ? theme.tabSelected
                : theme.tabUnselected
            }`}
          >
            Pagar
          </button>
        </div>

        {/* Lista Principal */}
        <div className="space-y-3">
          {filteredTransactions.map(t => (
            <div key={t.id} onClick={() => { setEditingItem(t); setFormData({ ...t }); setIsModalOpen(true); }} className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer hover:shadow-lg transition-all group ${theme.card}`}>
              <div className="flex items-center gap-4 overflow-hidden">
                <button onClick={(e) => toggleStatus(t.id, t.status, e)} className="transition transform active:scale-125">
                  {t.status ? <CheckCircle size={26} className="text-emerald-500" /> : <Circle size={26} className={`${theme.circle} dark:text-gray-600 hover:text-indigo-400`} />}
                </button>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    {/* Alterado font-bold para font-normal conforme item 4 */}
                    <p className={`text-sm font-normal truncate ${t.status ? "line-through opacity-30" : theme.text}`}>{t.description}</p>
                    {t.groupId && <Repeat size={12} className="text-indigo-400 opacity-60" />}
                  </div>
                  <p className={`text-[10px] font-medium uppercase tracking-tight ${theme.subText}`}>{t.date.split("-").reverse().join("/")} {t.entity && `• ${t.entity}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm sm:text-base ${t.status ? "opacity-30" : activeTab === "receivable" ? "text-emerald-600" : "text-red-600"}`}>
                  R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                {/* Lixeira com cor do texto no tema claro conforme item 1 */}
                <button onClick={(e) => handleDeleteRequest(t, e)} className={`p-2 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 sm:opacity-0 sm:group-hover:opacity-100 ${theme.trash}`}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-20 opacity-30 flex flex-col items-center">
              <FileText size={48} className="mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Lista Vazia</p>
            </div>
          )}
        </div>
      </main>

      {/* Modais */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl p-8 shadow-2xl border border-gray-100 dark:border-slate-700 ${theme.modal}`}>
            <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${theme.text}`}>
              <DollarSign className="text-indigo-500" />
              {editingItem ? "Editar Lançamento" : "Novo Lançamento"}
            </h2>
            <form onSubmit={onFormSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold opacity-50 uppercase ml-1 tracking-widest">Descrição</label>
                <input placeholder="Ex: Aluguel..." className={`w-full p-4 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 transition ${theme.input}`} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold opacity-50 uppercase ml-1 tracking-widest">Valor</label>
                  <input type="number" step="0.01" className={`w-full p-4 rounded-xl border ${theme.input}`} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold opacity-50 uppercase ml-1 tracking-widest">Vencimento</label>
                  <input type="date" className={`w-full p-4 rounded-xl border ${theme.input}`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold opacity-50 uppercase ml-1 tracking-widest">Entidade / Devedor</label>
                <input placeholder="Nome" className={`w-full p-4 rounded-xl border ${theme.input}`} value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
              </div>
              
              {!editingItem && (
                <div className={`p-5 rounded-xl border ${isDarkMode ? "bg-slate-700/30 border-slate-600" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Repetir (Meses)</label>
                    <span className="text-sm font-bold text-indigo-600">{formData.repeatCount}x</span>
                  </div>
                  <input type="range" min="1" max="24" className="w-full accent-indigo-600 cursor-pointer" value={formData.repeatCount} onChange={e => setFormData({...formData, repeatCount: e.target.value})} />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4">
                <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg transition active:scale-95 disabled:opacity-50">
                  {isSaving ? "Gravando..." : "Confirmar Lançamento"}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className={`w-full py-2 text-sm font-semibold opacity-40 hover:opacity-100 transition ${theme.text}`}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recurringEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl p-8 shadow-2xl ${theme.modal}`}>
            <h3 className="font-bold text-lg mb-3 text-indigo-500">Editar Recorrência</h3>
            <p className={`text-sm mb-6 ${theme.text} opacity-70`}>Deseja aplicar as alterações apenas a este mês ou a todos os próximos também?</p>
            <button onClick={() => executeSave("single")} className={`w-full py-3.5 rounded-xl mb-2 font-bold border ${theme.input} hover:opacity-80`}>Apenas este mês</button>
            <button onClick={() => executeSave("series")} className="w-full py-3.5 rounded-xl mb-4 font-bold bg-indigo-600 text-white shadow-lg">Este e os futuros</button>
            <button onClick={() => setRecurringEditModalOpen(false)} className={`w-full text-center text-xs font-bold opacity-40 uppercase tracking-widest ${theme.text}`}>Voltar</button>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl p-8 ${theme.modal}`}>
            <h3 className="font-bold text-lg mb-3 text-red-500">Excluir Registro</h3>
            <p className={`text-sm mb-6 ${theme.text} opacity-70`}>Este item é recorrente. O que deseja fazer?</p>
            <button onClick={() => performDelete([itemToDelete.id])} className={`w-full py-3.5 rounded-2xl mb-2 border ${theme.input} font-bold`}>Excluir apenas este</button>
            <button onClick={() => performDelete(transactions.filter(t => t.groupId === itemToDelete.groupId && t.date >= itemToDelete.date).map(t => t.id))} className="w-full py-3 rounded-xl mb-4 bg-red-500 text-white font-bold shadow-lg">Excluir este e futuros</button>
            <button onClick={() => setDeleteModalOpen(false)} className={`w-full text-center text-xs font-bold opacity-40 uppercase tracking-widest ${theme.text}`}>Cancelar</button>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl p-8 ${theme.modal}`}>
            <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${theme.text}`}><Upload size={20} className="text-indigo-500"/> Importar Backup</h3>
            <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} className={`w-full text-sm mb-6 ${theme.text}`} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setImportModalOpen(false)} className={`px-4 py-2 text-sm font-bold opacity-50 ${theme.text}`}>Cancelar</button>
              <button onClick={handleImportCSV} disabled={!csvFile || isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg disabled:opacity-50">
                {isSaving ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}