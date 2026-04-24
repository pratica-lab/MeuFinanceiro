import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  PieChart,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  X,
  ChevronRight,
  MoreVertical,
  Check,
  Settings,
  Bell,
  CreditCard,
  Tag
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
  orderBy,
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE (MANTIDA) ---
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

// --- COMPONENTES AUXILIARES ---

const Card = ({ children, className = "", isDarkMode }) => (
  <div className={`rounded-2xl border transition-all duration-300 ${
    isDarkMode 
      ? "bg-slate-800/50 border-slate-700/50 backdrop-blur-md shadow-xl" 
      : "bg-white border-gray-100 shadow-sm"
  } ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, icon: Icon }) => {
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100",
    danger: "bg-rose-500 hover:bg-rose-600 text-white",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300",
    outline: "bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const Badge = ({ children, color = "indigo" }) => {
  const colors = {
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- APP PRINCIPAL ---

export default function FinanceApp() {
  // --- ESTADOS ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("receivable"); // 'receivable' ou 'payable'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("financeAppTheme") === "dark";
    }
    return false;
  });

  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [recurringEditModalOpen, setRecurringEditModalOpen] = useState(false);

  const listRef = useRef(null);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    entity: "",
    date: new Date().toISOString().split("T")[0],
    repeatCount: 1,
    status: false,
    category: "Geral"
  });

  // --- EFEITOS ---
  useEffect(() => {
    localStorage.setItem("financeAppTheme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;
    const colRef = collection(db, basePath);
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    }, (err) => {
      console.error("Firestore Error:", err);
    });
    
    return () => unsubscribe();
  }, [user]);

  // Carregar scripts externos (Tailwind e html2canvas)
  useEffect(() => {
    if (!document.querySelector('script[src*="tailwindcss"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
    if (!document.querySelector('script[src*="html2canvas"]')) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(script);
    }
  }, []);

  // --- LÓGICA DE DADOS ---
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => t.type === activeTab)
      .filter(t => t.date.startsWith(selectedMonth))
      .filter(t => {
        if (filterStatus === "paid") return t.status === true;
        if (filterStatus === "open") return t.status === false;
        return true;
      })
      .filter(t => {
        const search = searchTerm.toLowerCase();
        return (
          t.description.toLowerCase().includes(search) ||
          (t.entity && t.entity.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        if (sortBy === "date") return b.date.localeCompare(a.date);
        if (sortBy === "amount") return b.amount - a.amount;
        if (sortBy === "alpha") return a.description.localeCompare(b.description);
        return 0;
      });
  }, [transactions, activeTab, selectedMonth, filterStatus, searchTerm, sortBy]);

  const stats = useMemo(() => {
    const monthData = transactions.filter(t => t.date.startsWith(selectedMonth));
    const incomes = monthData.filter(t => t.type === "receivable").reduce((acc, t) => acc + t.amount, 0);
    const expenses = monthData.filter(t => t.type === "payable").reduce((acc, t) => acc + t.amount, 0);
    const pendingIncomes = monthData.filter(t => t.type === "receivable" && !t.status).reduce((acc, t) => acc + t.amount, 0);
    const pendingExpenses = monthData.filter(t => t.type === "payable" && !t.status).reduce((acc, t) => acc + t.amount, 0);
    
    return { incomes, expenses, balance: incomes - expenses, pendingIncomes, pendingExpenses };
  }, [transactions, selectedMonth]);

  // --- AÇÕES ---
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Deseja realmente sair?")) {
      await signOut(auth);
      setTransactions([]);
    }
  };

  const toggleStatus = async (item) => {
    const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;
    const docRef = doc(db, basePath, item.id);
    await updateDoc(docRef, { status: !item.status });
  };

  const handleDelete = async (mode = "single") => {
    if (!itemToDelete) return;
    const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;
    
    try {
      if (mode === "series" && itemToDelete.groupId) {
        const batch = writeBatch(db);
        const series = transactions.filter(t => t.groupId === itemToDelete.groupId && t.date >= itemToDelete.date);
        series.forEach(t => batch.delete(doc(db, basePath, t.id)));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, basePath, itemToDelete.id));
      }
    } catch (err) {
      console.error("Delete Error:", err);
    } finally {
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    if (editingItem && editingItem.groupId) {
      setRecurringEditModalOpen(true);
    } else {
      executeSave("single");
    }
  };

  const executeSave = async (mode) => {
    setIsSaving(true);
    const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;
    
    try {
      if (editingItem) {
        if (mode === "series" && editingItem.groupId) {
          const batch = writeBatch(db);
          const series = transactions.filter(t => t.groupId === editingItem.groupId && t.date >= editingItem.date);
          const sequenceRegex = /\s*\(\d+\/\d+\)$/;
          const cleanDesc = formData.description.replace(sequenceRegex, "").trim();

          series.forEach(t => {
            const originalMatch = t.description.match(sequenceRegex);
            const finalDesc = originalMatch ? `${cleanDesc} ${originalMatch[0].trim()}` : formData.description;
            batch.update(doc(db, basePath, t.id), {
              description: finalDesc,
              amount: parseFloat(formData.amount),
              entity: formData.entity || "",
              category: formData.category
            });
          });
          await batch.commit();
        } else {
          await updateDoc(doc(db, basePath, editingItem.id), {
            description: formData.description,
            amount: parseFloat(formData.amount),
            entity: formData.entity || "",
            date: formData.date,
            category: formData.category
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
            description: formData.description + (formData.repeatCount > 1 ? ` (${i + 1}/${formData.repeatCount})` : ""),
            amount: parseFloat(formData.amount),
            entity: formData.entity || "",
            date: d.toISOString().split("T")[0],
            status: formData.status,
            groupId: groupId,
            category: formData.category,
            createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
      }
      closeModal();
    } catch (err) {
      console.error("Save Error:", err);
    } finally {
      setIsSaving(false);
    }
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
      category: "Geral"
    });
    setRecurringEditModalOpen(false);
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
      category: item.category || "Geral"
    });
    setIsModalOpen(true);
  };

  const fmtMoney = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d) => d.split("-").reverse().join("/");

  const handleExportImage = async () => {
    setShowExportMenu(false);
    setTimeout(async () => {
      try {
        if (!listRef.current) return;
        const h2c = window.html2canvas;
        if (!h2c) return alert("Aguarde o carregamento...");
        
        const canvas = await h2c(listRef.current, {
          backgroundColor: isDarkMode ? "#0f172a" : "#f8fafc",
          scale: 2,
          useCORS: true,
        });
        const link = document.createElement("a");
        link.download = `meu-financeiro-${selectedMonth}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error("Export Error:", err);
      }
    }, 300);
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"}`}>
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <Cloud className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
        </div>
        <p className="font-medium animate-pulse">Carregando seu financeiro...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="w-full max-w-md relative">
          <div className="bg-white/5 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/10 shadow-2xl text-center">
            <div className="inline-flex p-5 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mb-8">
              <Wallet size={48} className="text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Meu Financeiro</h1>
            <p className="text-slate-400 mb-10 text-lg leading-relaxed">
              Sua vida financeira organizada, segura e sempre à mão.
            </p>
            
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white hover:bg-slate-50 text-slate-900 font-bold py-4 px-6 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
            >
              {authLoading ? (
                <Loader2 className="animate-spin text-indigo-600" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
              )}
              <span className="text-lg">Entrar com Google</span>
            </button>
            
            <div className="mt-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
              <ShieldCheck size={16} />
              <span>Dados protegidos pelo Google Firebase</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-30 backdrop-blur-lg border-b transition-colors ${
        isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"
      }`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Wallet size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="font-bold text-lg leading-none">Meu Financeiro</h2>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Dashboard Pessoal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? "bg-slate-800 text-amber-400 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Download size={20} />
              </button>
              {showExportMenu && (
                <div className={`absolute right-0 mt-2 w-48 py-2 rounded-2xl shadow-2xl border z-50 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}>
                  <button onClick={handleExportImage} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-indigo-500 hover:text-white transition-colors">
                    <Camera size={16} /> Capturar Imagem
                  </button>
                  <button onClick={handleLogout} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors">
                    <LogOut size={16} /> Sair da Conta
                  </button>
                </div>
              )}
            </div>

            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-indigo-500/20">
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-6" ref={listRef}>
        
        {/* RESUMO (CARDS) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card isDarkMode={isDarkMode} className="p-5 overflow-hidden relative group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <PieChart size={20} />
              </div>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold border-none focus:ring-0 p-0 text-slate-500 uppercase tracking-wider cursor-pointer"
              />
            </div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mb-1">Saldo do Mês</p>
            <h3 className={`text-3xl font-black tracking-tight ${stats.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {fmtMoney(stats.balance)}
            </h3>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card isDarkMode={isDarkMode} className="p-4 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Receitas</p>
              </div>
              <p className="text-lg font-bold text-emerald-500">{fmtMoney(stats.incomes)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Pendente: {fmtMoney(stats.pendingIncomes)}</p>
            </Card>
            <Card isDarkMode={isDarkMode} className="p-4 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Despesas</p>
              </div>
              <p className="text-lg font-bold text-rose-500">{fmtMoney(stats.expenses)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Pendente: {fmtMoney(stats.pendingExpenses)}</p>
            </Card>
          </div>
        </section>

        {/* NAVEGAÇÃO TABS */}
        <div className={`p-1.5 rounded-2xl flex gap-1 ${isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-slate-200/50"}`}>
          <button 
            onClick={() => setActiveTab("receivable")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === "receivable" 
                ? (isDarkMode ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-indigo-600 shadow-sm") 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <TrendingUp size={18} /> Receber
          </button>
          <button 
            onClick={() => setActiveTab("payable")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === "payable" 
                ? (isDarkMode ? "bg-rose-600 text-white shadow-lg" : "bg-white text-rose-600 shadow-sm") 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <TrendingDown size={18} /> Pagar
          </button>
        </div>

        {/* FILTROS E BUSCA */}
        <section className="flex flex-col sm:flex-row gap-3" data-html2canvas-ignore>
          <div className={`flex-1 relative group`}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Buscar lançamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border outline-none transition-all ${
                isDarkMode 
                  ? "bg-slate-900 border-slate-800 focus:border-indigo-500 text-white" 
                  : "bg-white border-slate-200 focus:border-indigo-500"
              }`}
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-4 py-3.5 rounded-2xl border outline-none font-medium text-sm appearance-none cursor-pointer ${
                isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200"
              }`}
            >
              <option value="all">Todos</option>
              <option value="open">Pendentes</option>
              <option value="paid">Concluídos</option>
            </select>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`px-4 py-3.5 rounded-2xl border outline-none font-medium text-sm appearance-none cursor-pointer ${
                isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200"
              }`}
            >
              <option value="date">Data</option>
              <option value="amount">Valor</option>
              <option value="alpha">A-Z</option>
            </select>
          </div>
        </section>

        {/* LISTA DE TRANSAÇÕES */}
        <section className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                <AlignLeft size={48} />
              </div>
              <p className="text-slate-500 font-medium">Nenhum lançamento encontrado para este período.</p>
              <Button onClick={() => setIsModalOpen(true)} variant="outline">Adicionar Lançamento</Button>
            </div>
          ) : (
            filteredTransactions.map((item) => (
              <Card 
                key={item.id} 
                isDarkMode={isDarkMode} 
                className={`p-4 group transition-all hover:translate-x-1 ${item.status ? "opacity-60" : "opacity-100"}`}
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleStatus(item)}
                    className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      item.status 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                        : (isDarkMode ? "bg-slate-800 text-slate-500 border border-slate-700" : "bg-slate-100 text-slate-400 border border-slate-200")
                    }`}
                  >
                    {item.status ? <Check size={24} strokeWidth={3} /> : <div className="w-3 h-3 rounded-full bg-current opacity-30"></div>}
                  </button>

                  <div className="flex-1 min-w-0" onClick={() => openEditModal(item)}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`font-bold truncate ${item.status ? "line-through" : ""}`}>{item.description}</h4>
                      {item.groupId && <Repeat size={12} className="text-indigo-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {fmtDate(item.date)}</span>
                      {item.entity && <span className="flex items-center gap-1 truncate"><Tag size={12} /> {item.entity}</span>}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-black tracking-tight ${activeTab === "receivable" ? "text-emerald-500" : "text-rose-500"}`}>
                      {fmtMoney(item.amount)}
                    </p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item);
                        setDeleteModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </section>
      </main>

      {/* FAB (Floating Action Button) */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-[2rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-600/40 flex items-center justify-center transition-all hover:scale-110 active:scale-90 z-40"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {/* MODAL ADICIONAR/EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeModal}></div>
          <Card isDarkMode={isDarkMode} className="relative w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black tracking-tight">
                {editingItem ? "Editar Lançamento" : `Novo ${activeTab === "receivable" ? "Recebimento" : "Pagamento"}`}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={onFormSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Descrição</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Ex: Aluguel, Salário, Mercado..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Valor (R$)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDarkMode ? "bg-slate-900 border-slate-700 text-white font-bold" : "bg-slate-50 border-slate-200 font-bold"
                    }`}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Data</label>
                  <input 
                    required
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Devedor / Origem</label>
                <input 
                  type="text" 
                  value={formData.entity}
                  onChange={(e) => setFormData({...formData, entity: e.target.value})}
                  className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                    isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nome da pessoa ou empresa"
                />
              </div>

              {!editingItem && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Repetir por quantos meses?</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="1" max="24"
                      value={formData.repeatCount}
                      onChange={(e) => setFormData({...formData, repeatCount: e.target.value})}
                      className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="w-12 text-center font-black text-indigo-600">{formData.repeatCount}x</span>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button variant="ghost" className="flex-1 py-4" onClick={closeModal}>Cancelar</Button>
                <Button 
                  disabled={isSaving}
                  className="flex-[2] py-4 text-lg shadow-xl"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : (editingItem ? "Salvar Alterações" : "Confirmar Lançamento")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DELEÇÃO */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setDeleteModalOpen(false)}></div>
          <Card isDarkMode={isDarkMode} className="relative w-full max-w-sm p-8 text-center animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-xl font-black mb-2">Excluir Lançamento?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Esta ação não pode ser desfeita. {itemToDelete?.groupId ? "Este item faz parte de uma série recorrente." : ""}
            </p>
            
            <div className="flex flex-col gap-2">
              <Button variant="danger" className="py-3.5" onClick={() => handleDelete("single")}>
                Excluir Apenas Este
              </Button>
              {itemToDelete?.groupId && (
                <Button variant="outline" className="py-3.5 border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white" onClick={() => handleDelete("series")}>
                  Excluir Toda a Série Futura
                </Button>
              )}
              <Button variant="ghost" className="py-3.5" onClick={() => setDeleteModalOpen(false)}>
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL DE EDIÇÃO RECORRENTE */}
      {recurringEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setRecurringEditModalOpen(false)}></div>
          <Card isDarkMode={isDarkMode} className="relative w-full max-w-sm p-8 text-center animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Repeat size={40} />
            </div>
            <h3 className="text-xl font-black mb-2">Editar Recorrência</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Deseja aplicar estas alterações apenas a este lançamento ou a todos os próximos da série?
            </p>
            
            <div className="flex flex-col gap-2">
              <Button className="py-3.5" onClick={() => executeSave("series")}>
                Atualizar Toda a Série
              </Button>
              <Button variant="outline" className="py-3.5" onClick={() => executeSave("single")}>
                Atualizar Apenas Este
              </Button>
              <Button variant="ghost" className="py-3.5" onClick={() => setRecurringEditModalOpen(false)}>
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* FOOTER MOBILE NAVIGATION (OPTIONAL DECORATION) */}
      <div className={`fixed bottom-0 left-0 right-0 h-20 border-t sm:hidden z-30 transition-colors ${
        isDarkMode ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-slate-200"
      }`}>
        <div className="flex h-full items-center justify-around px-6">
          <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex flex-col items-center gap-1 text-indigo-500">
            <Wallet size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Início</span>
          </button>
          <div className="w-12"></div> {/* Spacer for FAB */}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex flex-col items-center gap-1 text-slate-400">
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            <span className="text-[10px] font-bold uppercase tracking-widest">Tema</span>
          </button>
        </div>
      </div>

    </div>
  );
}