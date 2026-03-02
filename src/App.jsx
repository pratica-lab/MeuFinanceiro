import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Download,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Cloud,
  Loader2,
  AlertTriangle,
  Upload,
  Sun,
  Moon,
  Repeat,
  Camera,
  FileText,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Fingerprint,
  Copy,
  ExternalLink,
  Pencil,
  Filter,
  SortAsc,
  Calendar,
  DollarSign,
  AlignLeft,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
  query,
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

const appId = typeof __app_id !== "undefined" ? __app_id : "financeiro-gavs-01";

// Inicialização segura
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function FinanceApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Estados da UI e Filtros
  const [activeTab, setActiveTab] = useState("receivable");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const listRef = useRef(null);

  // NOVOS ESTADOS PARA FILTRO E ORDENAÇÃO
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'paid', 'open'
  const [sortBy, setSortBy] = useState("date"); // 'date', 'created', 'alpha', 'amount', 'entity'

  // Estado para Edição Recorrente
  const [recurringEditModalOpen, setRecurringEditModalOpen] = useState(false);

  // Persistência do Tema
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("financeAppTheme");
      return saved === "dark";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("financeAppTheme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    entity: "",
    date: new Date().toISOString().split("T")[0],
    repeatCount: 1,
    status: false,
  });

  // --- Efeitos ---
  useEffect(() => {
    document.title = "Meu Financeiro Seguro";

    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[src*="html2canvas"]')) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(script);
    }

    const style = document.createElement("style");
    style.innerHTML = `
      #csb-navigation, #csb-status-bar, #__codesandbox_preview_navigation, 
      a[href*="codesandbox.io"], div[class*="codesandbox"], iframe[src*="codesandbox"] { 
        display: none !important; opacity: 0 !important; pointer-events: none !important; visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "transactions"
    );
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTransactions(data);
      },
      (err) => {
        console.error("Erro Firestore:", err);
        if (err.code === "permission-denied") {
          onSnapshot(
            collection(db, "users", user.uid, "transactions"),
            (snap) => {
              setTransactions(
                snap.docs.map((d) => ({ id: d.id, ...d.data() }))
              );
            }
          );
        }
      }
    );
    return () => unsubscribe();
  }, [user]);

  // --- Funções ---
  const handleGoogleLogin = async () => {
    setLoginError(null);
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoginError({ type: "general", message: error.message });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Deseja realmente sair?")) {
      await signOut(auth);
      setTransactions([]);
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      description: item.description || "",
      amount: item.amount || "",
      entity: item.entity || "",
      date: item.date || new Date().toISOString().split("T")[0],
      repeatCount: 1,
      status: item.status || false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      description: "",
      amount: "",
      entity: "",
      date: new Date().toISOString().split("T")[0],
      repeatCount: 1,
      status: false,
    });
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (editingItem && editingItem.groupId) {
      setRecurringEditModalOpen(true);
    } else {
      executeSave("single");
    }
  };

  const executeSave = async (mode) => {
    setIsSaving(true);
    try {
      const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;

      if (editingItem) {
        if (mode === "series" && editingItem.groupId) {
          // --- LÓGICA DE ATUALIZAÇÃO EM SÉRIE INTELIGENTE ---
          const batch = writeBatch(db);
          const series = transactions.filter(
            (t) =>
              t.groupId === editingItem.groupId && t.date >= editingItem.date
          );

          // Regex para encontrar padrões como (1/3), (02/12), etc no final da string
          const sequenceRegex = /\s*\(\d+\/\d+\)$/;

          // Remove a numeração da descrição nova que o usuário digitou (se houver)
          const cleanBaseDescription = formData.description
            .replace(sequenceRegex, "")
            .trim();

          series.forEach((item) => {
            const docRef = doc(db, basePath, item.id);

            // Tenta encontrar a numeração original do item no banco de dados
            const originalMatch = item.description.match(sequenceRegex);

            // Se encontrou uma numeração original, anexa ela ao novo nome base
            let finalDescription = cleanBaseDescription;
            if (originalMatch) {
              finalDescription = `${cleanBaseDescription} ${originalMatch[0].trim()}`;
            } else {
              // Fallback: se não tinha numeração, usa o que o usuário digitou
              finalDescription = formData.description;
            }

            batch.update(docRef, {
              description: finalDescription,
              amount: parseFloat(formData.amount),
              entity: formData.entity || "",
            });
          });
          await batch.commit();
        } else {
          const docRef = doc(db, basePath, editingItem.id);
          await updateDoc(docRef, {
            description: formData.description,
            amount: parseFloat(formData.amount),
            entity: formData.entity || "",
            date: formData.date,
          });
        }
      } else {
        const batch = writeBatch(db);
        const baseDate = new Date(formData.date);
        const userOffset = baseDate.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(baseDate.getTime() + userOffset);
        const groupId = formData.repeatCount > 1 ? crypto.randomUUID() : null;

        for (let i = 0; i < Math.max(1, parseInt(formData.repeatCount)); i++) {
          const d = new Date(adjustedDate);
          d.setMonth(adjustedDate.getMonth() + i);
          const newDocRef = doc(collection(db, basePath));
          batch.set(newDocRef, {
            type: activeTab,
            description:
              formData.description +
              (formData.repeatCount > 1
                ? ` (${i + 1}/${formData.repeatCount})`
                : ""),
            amount: parseFloat(formData.amount),
            entity: formData.entity || "",
            date: d.toISOString().split("T")[0],
            status: formData.status,
            groupId: groupId,
            createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
      }
      setRecurringEditModalOpen(false);
      closeModal();
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
    setIsSaving(false);
  };

  const handleDeleteRequest = (item, e) => {
    e.stopPropagation();
    setItemToDelete(item);
    if (item.groupId) setDeleteModalOpen(true);
    else if (confirm("Deseja excluir este item?")) performDelete([item.id]);
  };

  const performDelete = async (ids) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        const docRef = doc(
          db,
          `artifacts/${appId}/users/${user.uid}/transactions`,
          id
        );
        batch.delete(docRef);
      });
      await batch.commit();
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err) {
      alert("Erro ao excluir");
    }
  };

  const handleDeleteSeries = () => {
    if (!itemToDelete?.groupId) return;
    const ids = transactions
      .filter(
        (t) => t.groupId === itemToDelete.groupId && t.date >= itemToDelete.date
      )
      .map((t) => t.id);
    if (confirm(`Excluir ${ids.length} itens futuros?`)) performDelete(ids);
  };

  const toggleStatus = async (id, current, e) => {
    e.stopPropagation();
    if (user) {
      const docRef = doc(
        db,
        `artifacts/${appId}/users/${user.uid}/transactions`,
        id
      );
      await updateDoc(docRef, { status: !current });
    }
  };

  const handleImportCSV = async (e) => {
    e.preventDefault();
    if (!csvFile || !user) return;
    setIsSaving(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const lines = event.target.result.split("\n");
        const batch = writeBatch(db);
        const colRef = collection(
          db,
          "artifacts",
          appId,
          "users",
          user.uid,
          "transactions"
        );
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].trim().split(",");
          if (cols.length < 3) continue;
          const val = parseFloat(
            cols[1]?.replace("R$", "").replace(",", ".") || 0
          );
          if (!isNaN(val)) {
            batch.set(doc(colRef), {
              type: activeTab,
              description: cols[0]?.replace(/"/g, "") || "Importado",
              amount: val,
              date: cols[2]?.trim() || new Date().toISOString().split("T")[0],
              entity: cols[3]?.replace(/"/g, "").trim() || "",
              status: false,
              createdAt: new Date().toISOString(),
            });
          }
        }
        await batch.commit();
        alert("Importado com sucesso!");
        setImportModalOpen(false);
      } catch (err) {
        alert("Erro: " + err.message);
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsText(csvFile);
  };

  // --- LÓGICA DE FILTRAGEM E ORDENAÇÃO ATUALIZADA ---
  const filteredTransactions = useMemo(() => {
    let result = transactions.filter((t) => t.type === activeTab);

    // Filtro de Mês (se houver mês selecionado)
    if (selectedMonth) {
      result = result.filter((t) => t.date.startsWith(selectedMonth));
    }

    // Filtro de Busca
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          (t.description || "").toLowerCase().includes(s) ||
          (t.entity || "").toLowerCase().includes(s)
      );
    }

    // Filtro de Status (Novo)
    if (filterStatus !== "all") {
      const isPaid = filterStatus === "paid";
      result = result.filter((t) => t.status === isPaid);
    }

    // Ordenação (Novo)
    return result.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(a.date) - new Date(b.date);
        case "created":
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case "amount":
          return b.amount - a.amount; // Maior valor primeiro
        case "alpha":
          return (a.description || "").localeCompare(b.description || "");
        case "entity":
          return (a.entity || "").localeCompare(b.entity || "");
        default:
          return 0;
      }
    });
  }, [
    transactions,
    activeTab,
    selectedMonth,
    searchTerm,
    filterStatus,
    sortBy,
  ]);

  const totals = useMemo(() => {
    const val = (l) => parseFloat(l.amount);
    return {
      totalValue: filteredTransactions.reduce((acc, c) => acc + val(c), 0),
      totalCompleted: filteredTransactions
        .filter((t) => t.status)
        .reduce((acc, c) => acc + val(c), 0),
      totalPending: filteredTransactions
        .filter((t) => !t.status)
        .reduce((acc, c) => acc + val(c), 0),
    };
  }, [filteredTransactions]);

  const handleExportCSV = (mode) => {
    const data =
      mode === "all"
        ? transactions.filter((t) => t.type === activeTab)
        : filteredTransactions;
    const csv = [
      "Descricao,Valor,Data,Devedor,Status",
      ...data.map(
        (t) =>
          `"${t.description}",${t.amount.toFixed(2).replace(".", ",")},${
            t.date
          },"${t.entity || ""}",${t.status ? "Pago" : "Aberto"}`
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    link.download = `financeiro_${mode}.csv`;
    link.click();
    setShowExportMenu(false);
  };

  const handleExportImage = async () => {
    setShowExportMenu(false);
    
    // Pequeno atraso para garantir que o menu feche completamente antes da captura
    setTimeout(async () => {
      try {
        if (!listRef.current) return;
        
        // Suporte tanto para o pacote NPM (local) quanto fallback de CDN
        let h2c = window.html2canvas;
        if (!h2c) {
          const module = await import("html2canvas");
          h2c = module.default || module;
        }
        
        if (!h2c) {
          alert("Aguarde o carregamento da ferramenta de captura...");
          return;
        }
        
        const canvas = await h2c(listRef.current, {
          backgroundColor: isDarkMode ? "#0f172a" : "#f9fafb",
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (document) => {
            // Remove as restrições de corte temporariamente apenas no momento de gerar a foto
            const elements = document.querySelectorAll('.truncate, .overflow-hidden');
            elements.forEach(el => {
              el.classList.remove('truncate', 'overflow-hidden');
              el.classList.add('break-words', 'whitespace-normal');
              el.style.overflow = 'visible';
            });
          }
        });
        
        const link = document.createElement("a");
        link.download = `financeiro_print.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error("Detalhes do erro na captura:", err);
        alert("Erro ao gerar imagem. Verifique se há algum item não suportado na tela.");
      }
    }, 300);
  };

  const fmtMoney = (v) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);
  const fmtDate = (d) => d.split("-").reverse().join("/");

  const theme = {
    bg: isDarkMode ? "bg-slate-900" : "bg-gray-50",
    text: isDarkMode ? "text-gray-100" : "text-gray-800",
    card: isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-gray-100",
    input: isDarkMode
      ? "bg-slate-700 border-slate-600 text-white placeholder-gray-400"
      : "bg-white border-gray-200 text-gray-700",
    modal: isDarkMode ? "bg-slate-800 text-white" : "bg-white text-gray-800",
    subtext: isDarkMode ? "text-gray-400" : "text-gray-500",
    accent: isDarkMode ? "bg-indigo-600" : "bg-indigo-100 text-indigo-700",
  };

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex flex-col items-center justify-center p-6 text-white overflow-y-auto">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 shadow-2xl text-center my-auto">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-500 p-4 rounded-full shadow-lg shadow-indigo-500/50">
              <Cloud size={48} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Meu Financeiro</h1>
          <p className="text-indigo-200 mb-8">
            Controle pessoal seguro e na nuvem.
          </p>
          {loginError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-left text-xs p-3 rounded">
              {loginError.message}
            </div>
          )}
          <button
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-50 transition transform hover:scale-105 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {authLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                className="w-6 h-6"
                alt="Google"
              />
            )}
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${theme.bg}`}
      >
        <Loader2 className="animate-spin text-indigo-600 w-12 h-12" />
      </div>
    );

  return (
    <div
      className={`min-h-screen ${theme.bg} ${theme.text} pb-20 font-sans transition-colors duration-300`}
    >
      <header
        className={`${
          isDarkMode ? "bg-slate-950" : "bg-indigo-900"
        } text-white p-4 shadow-lg sticky top-0 z-20`}
      >
        <div className="flex flex-col md:flex-row justify-between items-center max-w-3xl mx-auto gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Cloud size={24} className="text-indigo-400" />
            <div>
              <h1 className="font-bold text-xl">Meu Financeiro</h1>
              <div className="text-xs text-indigo-200 truncate max-w-[150px]">
                {user.displayName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              {isDarkMode ? (
                <Sun size={20} className="text-yellow-400" />
              ) : (
                <Moon size={20} className="text-indigo-100" />
              )}
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Upload size={16} />
              Importar
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition"
              >
                <Download size={16} />
                Exportar <ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div
                  className={`absolute right-0 mt-2 w-48 rounded-xl shadow-2xl overflow-hidden z-30 border ${theme.card}`}
                >
                  <button
                    onClick={() => handleExportCSV("filtered")}
                    className={`w-full text-left px-4 py-3 text-sm hover:opacity-80 flex items-center gap-2 border-b ${theme.text}`}
                  >
                    <FileText size={16} /> CSV (Atual)
                  </button>
                  <button
                    onClick={() => handleExportCSV("all")}
                    className={`w-full text-left px-4 py-3 text-sm hover:opacity-80 flex items-center gap-2 border-b ${theme.text}`}
                  >
                    <FileText size={16} /> CSV (Tudo)
                  </button>
                  <button
                    onClick={handleExportImage}
                    className={`w-full text-left px-4 py-3 text-sm hover:opacity-80 flex items-center gap-2 ${theme.text}`}
                  >
                    <Camera size={16} /> Imagem
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-500 hover:bg-indigo-600 p-2 rounded-full shadow-lg active:scale-95 transition"
            >
              <Plus size={24} color="white" />
            </button>
            <button
              onClick={handleLogout}
              className="ml-2 p-2 text-red-300 hover:bg-red-900/30 rounded-full transition"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-3xl mx-auto" ref={listRef}>
        {/* FILTROS E PESQUISA */}
        <div className="flex flex-col gap-3" data-html2canvas-ignore>
          {/* Linha 1: Mês e Pesquisa */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`w-full sm:w-auto min-w-[220px] p-3 rounded-lg border shadow-sm text-center font-bold text-sm ${theme.input}`}
            />
            <div
              className={`flex-1 flex items-center border rounded-lg px-3 shadow-sm ${theme.input}`}
            >
              <Search size={18} className="mr-2 opacity-50" />
              <input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-3 outline-none text-sm bg-transparent"
              />
            </div>
          </div>

          {/* Linha 2: Filtros de Status e Ordenação */}
          <div className="flex flex-col sm:flex-row gap-2 text-sm">
            {/* Filtro de Status */}
            <div
              className={`flex rounded-lg overflow-hidden border ${
                isDarkMode ? "border-slate-700" : "border-gray-200"
              }`}
            >
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-2 flex-1 ${
                  filterStatus === "all"
                    ? isDarkMode
                      ? "bg-indigo-600"
                      : "bg-indigo-100 text-indigo-700"
                    : theme.input
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus("paid")}
                className={`px-3 py-2 flex-1 border-l border-r ${
                  isDarkMode ? "border-slate-600" : "border-gray-200"
                } ${
                  filterStatus === "paid"
                    ? isDarkMode
                      ? "bg-emerald-600"
                      : "bg-emerald-100 text-emerald-700"
                    : theme.input
                }`}
              >
                Pagos
              </button>
              <button
                onClick={() => setFilterStatus("open")}
                className={`px-3 py-2 flex-1 ${
                  filterStatus === "open"
                    ? isDarkMode
                      ? "bg-amber-600"
                      : "bg-amber-100 text-amber-700"
                    : theme.input
                }`}
              >
                Abertos
              </button>
            </div>

            {/* Seletor de Ordenação */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 sm:flex-none ${theme.input}`}
            >
              <SortAsc size={16} className="opacity-50" />
              <span className="opacity-50 hidden sm:inline">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent outline-none flex-1 font-semibold"
              >
                <option value="date" className="text-black">
                  Data Vencimento
                </option>
                <option value="created" className="text-black">
                  Data Inclusão
                </option>
                <option value="amount" className="text-black">
                  Valor (Maior)
                </option>
                <option value="alpha" className="text-black">
                  Nome (A-Z)
                </option>
                <option value="entity" className="text-black">
                  Devedor/Entidade
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div
            className={`p-3 rounded-lg shadow-sm border text-center ${theme.card}`}
          >
            <span className="text-[10px] uppercase font-bold opacity-60">
              Total
            </span>
            <div className={`font-bold text-sm md:text-lg ${theme.text}`}>
              {fmtMoney(totals.totalValue)}
            </div>
          </div>
          <div
            className={`p-3 rounded-lg shadow-sm border text-center ${theme.card}`}
          >
            <span className="text-[10px] uppercase font-bold opacity-60">
              Pago
            </span>
            <div className="font-bold text-sm md:text-lg text-emerald-500">
              {fmtMoney(totals.totalCompleted)}
            </div>
          </div>
          <div
            className={`p-3 rounded-lg shadow-sm border text-center ${theme.card}`}
          >
            <span className="text-[10px] uppercase font-bold opacity-60">
              Aberto
            </span>
            <div className="font-bold text-sm md:text-lg text-amber-500">
              {fmtMoney(totals.totalPending)}
            </div>
          </div>
        </div>

        {/* Abas */}
        <div
          className={`flex p-1 rounded-lg ${
            isDarkMode ? "bg-slate-800" : "bg-gray-200"
          }`}
        >
          <button
            onClick={() => setActiveTab("receivable")}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition ${
              activeTab === "receivable"
                ? isDarkMode
                  ? "bg-slate-700 text-green-400"
                  : "bg-white shadow"
                : "opacity-50"
            }`}
          >
            Receber
          </button>
          <button
            onClick={() => setActiveTab("payable")}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition ${
              activeTab === "payable"
                ? isDarkMode
                  ? "bg-slate-700 text-red-400"
                  : "bg-white shadow"
                : "opacity-50"
            }`}
          >
            Pagar
          </button>
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {filteredTransactions.map((t) => (
            <div
              key={t.id}
              onClick={() => openEditModal(t)}
              className={`p-3 rounded-lg shadow-sm border flex items-center justify-between cursor-pointer hover:opacity-80 transition ${theme.card}`}
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <button
                  onClick={(e) => toggleStatus(t.id, t.status, e)}
                  className="flex-shrink-0 transition active:scale-125"
                >
                  {t.status ? (
                    <CheckCircle className="text-emerald-500 w-6 h-6" />
                  ) : (
                    <Circle
                      className={`w-6 h-6 ${
                        isDarkMode ? "text-slate-600" : "text-gray-300"
                      }`}
                    />
                  )}
                </button>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-semibold text-sm break-words whitespace-normal leading-tight pb-0.5 ${
                        t.status ? "opacity-40 line-through" : ""
                      }`}
                    >
                      {t.description}
                    </p>
                    {t.groupId && (
                      <Repeat size={12} className="text-indigo-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs break-words whitespace-normal mt-0.5 pb-0.5 ${theme.subtext}`}>
                    {fmtDate(t.date)} {t.entity && `• ${t.entity}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-3">
                <span
                  className={`font-bold text-sm ${
                    t.status
                      ? "opacity-40"
                      : activeTab === "receivable"
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {fmtMoney(t.amount)}
                </span>
                <button
                  onClick={(e) => handleDeleteRequest(t, e)}
                  className="text-gray-400 hover:text-red-500 p-1 transition"
                  data-html2canvas-ignore
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className={`text-center py-10 opacity-50 text-sm`}>
              <p>Nenhum lançamento encontrado com estes filtros.</p>
            </div>
          )}
        </div>
      </main>

      {/* MODAL LANÇAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-t-2xl sm:rounded-xl p-6 animate-in slide-in-from-bottom-10 ${theme.modal}`}
          >
            <h3 className="font-bold text-lg mb-6">
              {editingItem ? "Editar Lançamento" : "Novo Lançamento"}
            </h3>
            <form onSubmit={onFormSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold opacity-50 block mb-1">
                  DESCRIÇÃO
                </label>
                <input
                  className={`w-full p-3 rounded border outline-none ${theme.input}`}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold opacity-50 block mb-1">
                    VALOR
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={`w-full p-3 rounded border outline-none ${theme.input}`}
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold opacity-50 block mb-1">
                    DATA
                  </label>
                  <input
                    type="date"
                    className={`w-full p-3 rounded border outline-none ${theme.input}`}
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold opacity-50 block mb-1">
                  {activeTab === "receivable" ? "DEVEDOR" : "ENTIDADE"}
                </label>
                <input
                  className={`w-full p-3 rounded border outline-none ${theme.input}`}
                  value={formData.entity}
                  onChange={(e) =>
                    setFormData({ ...formData, entity: e.target.value })
                  }
                />
              </div>
              {!editingItem && (
                <div
                  className={`p-3 rounded border ${
                    isDarkMode ? "bg-slate-700 border-slate-600" : "bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold opacity-50">
                      REPETIR (Meses)
                    </label>
                    <span className="text-xs font-bold text-indigo-500">
                      {formData.repeatCount}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    className="w-full"
                    value={formData.repeatCount}
                    onChange={(e) =>
                      setFormData({ ...formData, repeatCount: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 font-bold opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] bg-indigo-600 text-white font-bold py-3 rounded-lg transition"
                >
                  {isSaving ? "Salvando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR RECORRENTE */}
      {recurringEditModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm rounded-xl p-6 shadow-2xl ${theme.modal}`}
          >
            <h3 className="font-bold text-lg mb-4 text-indigo-500">
              Editar Recorrência
            </h3>
            <p className="text-sm opacity-80 mb-6">
              Deseja aplicar as alterações apenas a este mês ou a todos os
              próximos também?
            </p>
            <button
              onClick={() => executeSave("single")}
              className={`w-full py-3 rounded-lg mb-2 font-semibold border ${
                isDarkMode ? "border-slate-600" : "border-gray-200"
              }`}
            >
              Apenas este mês
            </button>
            <button
              onClick={() => executeSave("series")}
              className="w-full py-3 rounded-lg mb-4 font-semibold bg-indigo-600 text-white"
            >
              Este e os futuros
            </button>
            <button
              onClick={() => setRecurringEditModalOpen(false)}
              className="w-full text-center text-sm opacity-50"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR RECORRENTE */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-xl p-6 ${theme.modal}`}>
            <h3 className="font-bold text-lg mb-4 text-red-500">
              Excluir Lançamento
            </h3>
            <p className="text-sm opacity-80 mb-6">
              Este item é recorrente. O que deseja fazer?
            </p>
            <button
              onClick={() => performDelete([itemToDelete.id])}
              className={`w-full py-3 rounded-lg mb-2 border ${
                isDarkMode ? "border-slate-600" : "border-gray-200"
              }`}
            >
              Excluir apenas este
            </button>
            <button
              onClick={handleDeleteSeries}
              className="w-full py-3 rounded-lg mb-4 bg-red-500 text-white font-bold"
            >
              Excluir este e futuros
            </button>
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="w-full text-center text-sm opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR CSV */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-xl p-6 ${theme.modal}`}>
            <h3 className="font-bold text-lg mb-4">Importar CSV</h3>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files[0])}
              className="w-full text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportCSV}
                disabled={!csvFile || isSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}