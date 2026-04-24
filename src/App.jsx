import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Trash2, CheckCircle, Circle, Download, Search,
  Cloud, Loader2, Upload, Sun, Moon, Repeat, Camera,
  FileText, ChevronDown, LogOut, Filter, SortAsc,
  TrendingUp, TrendingDown, Wallet, AlertCircle, Bell,
  ChevronLeft, ChevronRight, BarChart2, X, Check,
  Tag, BookOpen, Zap, ArrowRight, Sparkles, Menu,
  MoreVertical, Edit3, Copy, ChevronsUpDown, Info,
  Home, PieChart, List, Settings, RefreshCw, Clock,
  Star, Archive, Eye, EyeOff, Target, Award, Shield
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore, collection, updateDoc, deleteDoc, doc,
  onSnapshot, writeBatch, query, orderBy,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqY-cooGvIPMykBfzdkdKO5EHd9vweTz4",
  authDomain: "controle-financeiro-gavs.firebaseapp.com",
  projectId: "controle-financeiro-gavs",
  storageBucket: "controle-financeiro-gavs.firebasestorage.app",
  messagingSenderId: "847168764881",
  appId: "1:847168764881:web:d89f8cc90cc21b3fbcbef0",
};

const appId = typeof __app_id !== "undefined" ? __app_id : "financeiro-gavs-01";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = [
  { id: "salary", label: "Salário", icon: "💼", color: "#10b981" },
  { id: "freelance", label: "Freelance", icon: "💻", color: "#6366f1" },
  { id: "rent", label: "Aluguel", icon: "🏠", color: "#f59e0b" },
  { id: "bills", label: "Contas", icon: "📄", color: "#ef4444" },
  { id: "food", label: "Alimentação", icon: "🍽️", color: "#f97316" },
  { id: "transport", label: "Transporte", icon: "🚗", color: "#3b82f6" },
  { id: "health", label: "Saúde", icon: "❤️", color: "#ec4899" },
  { id: "education", label: "Educação", icon: "📚", color: "#8b5cf6" },
  { id: "entertainment", label: "Lazer", icon: "🎮", color: "#14b8a6" },
  { id: "investment", label: "Investimento", icon: "📈", color: "#059669" },
  { id: "other", label: "Outros", icon: "📦", color: "#6b7280" },
];

const getCat = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const fmtMoney = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d) => d ? d.split("-").reverse().join("/") : "-";
const fmtMonthYear = (str) => {
  if (!str) return "";
  const [y, m] = str.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]} ${y}`;
};

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
};

const StatusBadge = ({ days, status, dark }) => {
  if (status) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Pago</span>;
  if (days === null) return null;
  if (days < 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{Math.abs(days)}d atraso</span>;
  if (days === 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Hoje</span>;
  if (days <= 3) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{days}d</span>;
  return null;
};

// Mini sparkline bar chart for month overview
const MiniBar = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 flex flex-col justify-end h-8 gap-0.5">
      <div className="w-full rounded-sm overflow-hidden" style={{ height: `${Math.max(4, pct * 0.28)}px`, background: color, opacity: 0.85 }} />
    </div>
  );
};

const ProgressRing = ({ pct, size = 56, stroke = 5, color = "#10b981" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
};

export default function FinanceApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("receivable");
  const [activePage, setActivePage] = useState("dashboard"); // dashboard, list, analytics
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [recurringEditModalOpen, setRecurringEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [toast, setToast] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showBalanceValues, setShowBalanceValues] = useState(true);
  const listRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("financeAppTheme");
      return saved !== "light";
    }
    return true;
  });

  const [formData, setFormData] = useState({
    description: "", amount: "", entity: "", date: new Date().toISOString().split("T")[0],
    repeatCount: 1, status: false, category: "other", notes: "", priority: false,
  });

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    document.title = "Meu Financeiro";
    localStorage.setItem("financeAppTheme", isDarkMode ? "dark" : "light");
    if (!document.querySelector('script[src*="html2canvas"]')) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(s);
    }
    const style = document.createElement("style");
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Sora', sans-serif; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #6366f1; cursor: pointer; box-shadow: 0 0 0 3px rgba(99,102,241,0.3); }
      input[type=month]::-webkit-calendar-picker-indicator { filter: ${isDarkMode ? 'invert(1)' : 'none'}; opacity: 0.5; }
      input[type=date]::-webkit-calendar-picker-indicator { filter: ${isDarkMode ? 'invert(1)' : 'none'}; opacity: 0.5; }
      .card-hover { transition: all 0.2s ease; }
      .card-hover:hover { transform: translateY(-1px); }
      .fade-in { animation: fadeIn 0.3s ease; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .slide-up { animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1); }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .toast-enter { animation: toastIn 0.3s ease; }
      @keyframes toastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      .spin-slow { animation: spin 3s linear infinite; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .pulse-dot { animation: pulseDot 2s infinite; }
      @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
      select option { background: #1e293b; color: white; }
      .glow-green { box-shadow: 0 0 20px rgba(16,185,129,0.15); }
      .glow-red { box-shadow: 0 0 20px rgba(239,68,68,0.15); }
      .glow-purple { box-shadow: 0 0 20px rgba(99,102,241,0.2); }
      .gradient-text { background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .number-anim { transition: all 0.4s ease; }
      .bottom-nav-item { transition: all 0.2s ease; }
      .priority-glow { box-shadow: inset 3px 0 0 #f59e0b; }
    `;
    document.head.appendChild(style);
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, "artifacts", appId, "users", user.uid, "transactions");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Firestore:", err);
      if (err.code === "permission-denied") {
        onSnapshot(collection(db, "users", user.uid, "transactions"), (snap) => {
          setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    setLoginError(null); setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoginError(error.message);
    } finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    if (confirm("Deseja realmente sair?")) { await signOut(auth); setTransactions([]); }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      description: item.description || "", amount: item.amount || "",
      entity: item.entity || "", date: item.date || new Date().toISOString().split("T")[0],
      repeatCount: 1, status: item.status || false,
      category: item.category || "other", notes: item.notes || "", priority: item.priority || false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditingItem(null);
    setFormData({ description: "", amount: "", entity: "", date: new Date().toISOString().split("T")[0], repeatCount: 1, status: false, category: "other", notes: "", priority: false });
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    if (editingItem && editingItem.groupId) setRecurringEditModalOpen(true);
    else executeSave("single");
  };

  const executeSave = async (mode) => {
    setIsSaving(true);
    try {
      const basePath = `artifacts/${appId}/users/${user.uid}/transactions`;
      if (editingItem) {
        if (mode === "series" && editingItem.groupId) {
          const batch = writeBatch(db);
          const sequenceRegex = /\s*\(\d+\/\d+\)$/;
          const cleanBase = formData.description.replace(sequenceRegex, "").trim();
          const series = transactions.filter((t) => t.groupId === editingItem.groupId && t.date >= editingItem.date);
          series.forEach((item) => {
            const docRef = doc(db, basePath, item.id);
            const origMatch = item.description.match(sequenceRegex);
            const finalDesc = origMatch ? `${cleanBase} ${origMatch[0].trim()}` : formData.description;
            batch.update(docRef, {
              description: finalDesc, amount: parseFloat(formData.amount),
              entity: formData.entity || "", category: formData.category || "other",
              notes: formData.notes || "", priority: formData.priority || false,
            });
          });
          await batch.commit();
        } else {
          const docRef = doc(db, basePath, editingItem.id);
          await updateDoc(docRef, {
            description: formData.description, amount: parseFloat(formData.amount),
            entity: formData.entity || "", date: formData.date,
            category: formData.category || "other", notes: formData.notes || "",
            priority: formData.priority || false,
          });
        }
        showToast("Lançamento atualizado!");
      } else {
        const batch = writeBatch(db);
        const baseDate = new Date(formData.date);
        const adj = new Date(baseDate.getTime() + baseDate.getTimezoneOffset() * 60000);
        const groupId = formData.repeatCount > 1 ? crypto.randomUUID() : null;
        for (let i = 0; i < Math.max(1, parseInt(formData.repeatCount)); i++) {
          const d = new Date(adj); d.setMonth(adj.getMonth() + i);
          const newRef = doc(collection(db, basePath));
          batch.set(newRef, {
            type: activeTab,
            description: formData.description + (formData.repeatCount > 1 ? ` (${i + 1}/${formData.repeatCount})` : ""),
            amount: parseFloat(formData.amount), entity: formData.entity || "",
            date: d.toISOString().split("T")[0], status: formData.status, groupId,
            category: formData.category || "other", notes: formData.notes || "",
            priority: formData.priority || false, createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
        showToast(`${formData.repeatCount > 1 ? formData.repeatCount + " lançamentos criados!" : "Lançamento criado!"}`);
      }
      setRecurringEditModalOpen(false); closeModal();
    } catch (err) { showToast("Erro ao salvar: " + err.message, "error"); }
    setIsSaving(false);
  };

  const handleDeleteRequest = (item, e) => {
    e.stopPropagation(); setItemToDelete(item);
    if (item.groupId) setDeleteModalOpen(true);
    else if (confirm("Deseja excluir este item?")) performDelete([item.id]);
  };

  const performDelete = async (ids) => {
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => batch.delete(doc(db, `artifacts/${appId}/users/${user.uid}/transactions`, id)));
      await batch.commit();
      setDeleteModalOpen(false); setItemToDelete(null);
      showToast("Excluído com sucesso!");
    } catch (err) { showToast("Erro ao excluir", "error"); }
  };

  const handleDeleteSeries = () => {
    if (!itemToDelete?.groupId) return;
    const ids = transactions.filter((t) => t.groupId === itemToDelete.groupId && t.date >= itemToDelete.date).map((t) => t.id);
    if (confirm(`Excluir ${ids.length} itens?`)) performDelete(ids);
  };

  const toggleStatus = async (id, current, e) => {
    e.stopPropagation();
    if (user) {
      await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/transactions`, id), { status: !current });
      showToast(current ? "Marcado como aberto" : "Marcado como pago! ✓");
    }
  };

  const togglePriority = async (item, e) => {
    e.stopPropagation();
    await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/transactions`, item.id), { priority: !item.priority });
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
        const colRef = collection(db, "artifacts", appId, "users", user.uid, "transactions");
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].trim().split(",");
          if (cols.length < 3) continue;
          const val = parseFloat(cols[1]?.replace("R$", "").replace(",", ".") || 0);
          if (!isNaN(val)) {
            batch.set(doc(colRef), {
              type: activeTab, description: cols[0]?.replace(/"/g, "") || "Importado",
              amount: val, date: cols[2]?.trim() || new Date().toISOString().split("T")[0],
              entity: cols[3]?.replace(/"/g, "").trim() || "", status: false,
              category: "other", notes: "", priority: false, createdAt: new Date().toISOString(),
            });
            count++;
          }
        }
        await batch.commit();
        showToast(`${count} itens importados!`);
        setImportModalOpen(false);
      } catch (err) { showToast("Erro: " + err.message, "error"); }
      finally { setIsSaving(false); }
    };
    reader.readAsText(csvFile);
  };

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter((t) => t.type === activeTab);
    if (selectedMonth) result = result.filter((t) => t.date?.startsWith(selectedMonth));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((t) => (t.description || "").toLowerCase().includes(s) || (t.entity || "").toLowerCase().includes(s) || (t.notes || "").toLowerCase().includes(s));
    }
    if (filterStatus !== "all") result = result.filter((t) => t.status === (filterStatus === "paid"));
    if (filterCategory !== "all") result = result.filter((t) => (t.category || "other") === filterCategory);

    result.sort((a, b) => {
      let v = 0;
      switch (sortBy) {
        case "date": v = new Date(a.date) - new Date(b.date); break;
        case "created": v = new Date(a.createdAt || 0) - new Date(b.createdAt || 0); break;
        case "amount": v = b.amount - a.amount; break;
        case "alpha": v = (a.description || "").localeCompare(b.description || ""); break;
        case "entity": v = (a.entity || "").localeCompare(b.entity || ""); break;
        case "priority": v = (b.priority ? 1 : 0) - (a.priority ? 1 : 0); break;
      }
      return sortDir === "desc" ? -v : v;
    });
    return result;
  }, [transactions, activeTab, selectedMonth, searchTerm, filterStatus, sortBy, sortDir, filterCategory]);

  const totals = useMemo(() => {
    const val = (l) => parseFloat(l.amount) || 0;
    const paid = filteredTransactions.filter((t) => t.status);
    const pending = filteredTransactions.filter((t) => !t.status);
    const total = filteredTransactions.reduce((acc, c) => acc + val(c), 0);
    const paidSum = paid.reduce((acc, c) => acc + val(c), 0);
    const pendingSum = pending.reduce((acc, c) => acc + val(c), 0);
    const pct = total > 0 ? Math.round((paidSum / total) * 100) : 0;
    return { total, paid: paidSum, pending: pendingSum, pct, count: filteredTransactions.length, paidCount: paid.length };
  }, [filteredTransactions]);

  const dashboardData = useMemo(() => {
    const receivable = transactions.filter((t) => t.type === "receivable" && t.date?.startsWith(selectedMonth));
    const payable = transactions.filter((t) => t.type === "payable" && t.date?.startsWith(selectedMonth));
    const totalRec = receivable.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
    const totalPay = payable.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
    const paidRec = receivable.filter((t) => t.status).reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
    const paidPay = payable.filter((t) => t.status).reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
    const balance = totalRec - totalPay;
    const realized = paidRec - paidPay;

    const overdue = transactions.filter((t) => !t.status && getDaysUntil(t.date) < 0);
    const dueToday = transactions.filter((t) => !t.status && getDaysUntil(t.date) === 0);
    const dueSoon = transactions.filter((t) => !t.status && getDaysUntil(t.date) > 0 && getDaysUntil(t.date) <= 3);

    // Category breakdown for current tab and month
    const catBreakdown = CATEGORIES.map((cat) => {
      const items = transactions.filter((t) => t.type === activeTab && t.date?.startsWith(selectedMonth) && (t.category || "other") === cat.id);
      return { ...cat, total: items.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0), count: items.length };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    // 6-month trend
    const now = new Date();
    const trend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = d.toISOString().slice(0, 7);
      const rec = transactions.filter((t) => t.type === "receivable" && t.date?.startsWith(key)).reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
      const pay = transactions.filter((t) => t.type === "payable" && t.date?.startsWith(key)).reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
      return { key, label: fmtMonthYear(key), rec, pay };
    });

    return { totalRec, totalPay, paidRec, paidPay, balance, realized, overdue, dueToday, dueSoon, catBreakdown, trend };
  }, [transactions, selectedMonth, activeTab]);

  const handleExportCSV = (mode) => {
    const data = mode === "all" ? transactions.filter((t) => t.type === activeTab) : filteredTransactions;
    const csv = ["Descricao,Valor,Data,Entidade,Status,Categoria,Notas",
      ...data.map((t) => `"${t.description}",${(t.amount || 0).toFixed(2).replace(".", ",")},${t.date},"${t.entity || ""}",${t.status ? "Pago" : "Aberto"},"${getCat(t.category || "other").label}","${t.notes || ""}"`)
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `financeiro_${mode}.csv`; link.click();
    setShowExportMenu(false);
    showToast("CSV exportado!");
  };

  const handleExportImage = async () => {
    setShowExportMenu(false);
    setTimeout(async () => {
      try {
        if (!listRef.current) return;
        let h2c = window.html2canvas;
        if (!h2c) { const m = await import("html2canvas"); h2c = m.default || m; }
        if (!h2c) { showToast("Aguarde o carregamento...", "error"); return; }
        const canvas = await h2c(listRef.current, {
          backgroundColor: isDarkMode ? "#0b1120" : "#f8fafc", scale: 2, useCORS: true, logging: false,
        });
        const link = document.createElement("a");
        link.download = "financeiro_print.png"; link.href = canvas.toDataURL("image/png"); link.click();
        showToast("Imagem exportada!");
      } catch (err) { showToast("Erro ao gerar imagem", "error"); }
    }, 300);
  };

  // ─── THEME ───────────────────────────────────────────────────────────────────
  const T = isDarkMode ? {
    bg: "#0b1120", surface: "#111827", card: "#161f30", border: "rgba(255,255,255,0.07)",
    text: "#f1f5f9", muted: "#64748b", soft: "#1e2a3d", accent: "#6366f1",
    input: "#1e2a3d", inputBorder: "rgba(255,255,255,0.1)",
  } : {
    bg: "#f0f4f8", surface: "#ffffff", card: "#ffffff", border: "rgba(0,0,0,0.07)",
    text: "#0f172a", muted: "#64748b", soft: "#f1f5f9", accent: "#6366f1",
    input: "#f8fafc", inputBorder: "rgba(0,0,0,0.12)",
  };

  // ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
  if (!user && !loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0b1120 0%, #1a0533 50%, #0b1120 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Sora, sans-serif", position: "relative", overflow: "hidden" }}>
        {/* Decorative orbs */}
        <div style={{ position: "absolute", top: "10%", left: "20%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "15%", width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)", filter: "blur(60px)" }} />

        <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: "rgba(17,24,39,0.8)", backdropFilter: "blur(24px)", borderRadius: 24, padding: "40px 36px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
              <Wallet size={32} color="white" />
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", textAlign: "center", margin: "0 0 6px" }}>Meu Financeiro</h1>
          <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", margin: "0 0 32px" }}>Controle inteligente das suas finanças</p>
          {loginError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#fca5a5" }}>{loginError}</div>
          )}
          <button onClick={handleGoogleLogin} disabled={authLoading} style={{ width: "100%", background: "white", color: "#0f172a", fontWeight: 700, fontSize: 15, fontFamily: "Sora, sans-serif", padding: "16px", borderRadius: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "all 0.2s", opacity: authLoading ? 0.7 : 1, boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
            {authLoading ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style={{ width: 22, height: 22 }} alt="G" />}
            Entrar com Google
          </button>
          <div style={{ display: "flex", gap: 16, marginTop: 28, justifyContent: "center" }}>
            {[{ icon: Shield, text: "Seguro" }, { icon: Cloud, text: "Nuvem" }, { icon: Zap, text: "Rápido" }].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <Icon size={16} color="#6366f1" />
                <span style={{ fontSize: 11, color: "#475569" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0b1120", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Loader2 size={28} color="white" style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <p style={{ color: "#475569", fontSize: 14, fontFamily: "Sora, sans-serif" }}>Carregando...</p>
      </div>
    </div>
  );

  // ─── MONTH NAVIGATOR ─────────────────────────────────────────────────────────
  const changeMonth = (dir) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const urgentAlerts = [...dashboardData.overdue, ...dashboardData.dueToday, ...dashboardData.dueSoon];

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "Sora, sans-serif", color: T.text, paddingBottom: 80, transition: "background 0.3s, color 0.3s" }}>

      {/* Toast */}
      {toast && (
        <div className="toast-enter" style={{ position: "fixed", top: 20, right: 16, zIndex: 9999, background: toast.type === "error" ? "#ef4444" : "#10b981", color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8, maxWidth: 280 }}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "16px", position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px" }}>Financeiro</div>
              <div style={{ fontSize: 11, color: T.muted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.displayName}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {urgentAlerts.length > 0 && (
              <div style={{ position: "relative" }}>
                <Bell size={20} color="#f59e0b" />
                <div className="pulse-dot" style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, background: "#ef4444", borderRadius: "50%", border: "2px solid " + T.surface }} />
              </div>
            )}
            <button onClick={() => setShowBalanceValues(!showBalanceValues)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: T.muted }}>
              {showBalanceValues ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: T.muted }}>
              {isDarkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} />}
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowExportMenu(!showExportMenu)} style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", gap: 4 }}>
                <Download size={14} /> <ChevronDown size={12} />
              </button>
              {showExportMenu && (
                <div className="fade-in" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 180, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,0.3)", zIndex: 50 }}>
                  {[
                    { icon: Upload, label: "Importar CSV", action: () => { setImportModalOpen(true); setShowExportMenu(false); } },
                    { icon: FileText, label: "CSV (filtrado)", action: () => handleExportCSV("filtered") },
                    { icon: FileText, label: "CSV (tudo)", action: () => handleExportCSV("all") },
                    { icon: Camera, label: "Imagem", action: handleExportImage },
                  ].map(({ icon: Icon, label, action }) => (
                    <button key={label} onClick={action} style={{ width: "100%", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, padding: "12px 16px", cursor: "pointer", color: T.text, fontSize: 13, display: "flex", alignItems: "center", gap: 10, fontFamily: "Sora, sans-serif" }}>
                      <Icon size={15} color={T.muted} />{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#ef4444" }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* MONTH NAVIGATOR */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, borderRadius: 14, padding: "10px 16px", border: `1px solid ${T.border}` }}>
          <button onClick={() => changeMonth(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.5px" }}>{fmtMonthYear(selectedMonth)}</div>
            <div style={{ fontSize: 11, color: T.muted }}>{totals.count} lançamentos</div>
          </div>
          <button onClick={() => changeMonth(1)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px" }}>

        {activePage === "dashboard" && (
          <div className="fade-in">
            {/* Balance Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div className="glow-green" style={{ background: "linear-gradient(135deg, #064e3b, #065f46)", borderRadius: 18, padding: "18px 16px", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingUp size={12} /> A Receber
                </div>
                <div className="mono" style={{ fontSize: showBalanceValues ? 18 : 14, fontWeight: 700, color: "#ecfdf5", letterSpacing: "-0.5px" }}>
                  {showBalanceValues ? fmtMoney(dashboardData.totalRec) : "R$ ••••"}
                </div>
                <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 4 }}>
                  {fmtMoney(dashboardData.paidRec)} recebido
                </div>
              </div>
              <div className="glow-red" style={{ background: "linear-gradient(135deg, #450a0a, #7f1d1d)", borderRadius: 18, padding: "18px 16px", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingDown size={12} /> A Pagar
                </div>
                <div className="mono" style={{ fontSize: showBalanceValues ? 18 : 14, fontWeight: 700, color: "#fef2f2", letterSpacing: "-0.5px" }}>
                  {showBalanceValues ? fmtMoney(dashboardData.totalPay) : "R$ ••••"}
                </div>
                <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>
                  {fmtMoney(dashboardData.paidPay)} pago
                </div>
              </div>
            </div>

            {/* Balance Net */}
            <div className="glow-purple" style={{ background: "linear-gradient(135deg, #1e1b4b, #2e1065)", borderRadius: 18, padding: "20px", border: "1px solid rgba(99,102,241,0.25)", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Saldo do Mês</div>
                <div className="mono" style={{ fontSize: showBalanceValues ? 26 : 18, fontWeight: 800, color: dashboardData.balance >= 0 ? "#a5b4fc" : "#fca5a5", letterSpacing: "-1px" }}>
                  {showBalanceValues ? fmtMoney(dashboardData.balance) : "R$ ••••••"}
                </div>
                <div style={{ fontSize: 12, color: "#6366f1", marginTop: 4 }}>
                  Realizado: {showBalanceValues ? fmtMoney(dashboardData.realized) : "R$ ••••"}
                </div>
              </div>
              <ProgressRing pct={totals.pct} size={64} stroke={6} color={totals.pct >= 80 ? "#10b981" : totals.pct >= 40 ? "#f59e0b" : "#6366f1"} />
            </div>

            {/* Alert cards */}
            {(dashboardData.overdue.length > 0 || dashboardData.dueToday.length > 0) && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <AlertCircle size={16} color="#ef4444" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>Atenção Necessária</span>
                </div>
                {dashboardData.overdue.length > 0 && (
                  <div style={{ fontSize: 13, color: "#fca5a5", marginBottom: 4 }}>🔴 {dashboardData.overdue.length} vencido{dashboardData.overdue.length > 1 ? "s" : ""}</div>
                )}
                {dashboardData.dueToday.length > 0 && (
                  <div style={{ fontSize: 13, color: "#fbbf24" }}>🟡 {dashboardData.dueToday.length} vence hoje</div>
                )}
                {dashboardData.dueSoon.length > 0 && (
                  <div style={{ fontSize: 13, color: "#a5b4fc" }}>🔵 {dashboardData.dueSoon.length} vence em até 3 dias</div>
                )}
              </div>
            )}

            {/* 6-Month Trend */}
            {dashboardData.trend.some((m) => m.rec > 0 || m.pay > 0) && (
              <div style={{ background: T.surface, borderRadius: 18, padding: "18px 16px", border: `1px solid ${T.border}`, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <BarChart2 size={15} color={T.muted} /> Histórico 6 meses
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 64 }}>
                  {dashboardData.trend.map((m) => {
                    const maxVal = Math.max(...dashboardData.trend.map((x) => Math.max(x.rec, x.pay)));
                    return (
                      <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", height: "100%" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, width: "100%" }}>
                          <div style={{ height: `${maxVal > 0 ? Math.max(4, (m.rec / maxVal) * 100) * 0.44 : 4}%`, background: "#10b981", borderRadius: "3px 3px 0 0", minHeight: 4, transition: "height 0.5s ease" }} />
                          <div style={{ height: `${maxVal > 0 ? Math.max(4, (m.pay / maxVal) * 100) * 0.44 : 4}%`, background: "#ef4444", borderRadius: "3px 3px 0 0", minHeight: 4, transition: "height 0.5s ease" }} />
                        </div>
                        <div style={{ fontSize: 9, color: T.muted, textAlign: "center" }}>{m.label.slice(0, 3)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.muted }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "#10b981" }} /> Receber
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.muted }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444" }} /> Pagar
                  </div>
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {dashboardData.catBreakdown.length > 0 && (
              <div style={{ background: T.surface, borderRadius: 18, padding: "18px 16px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <PieChart size={15} color={T.muted} /> Por Categoria — {activeTab === "receivable" ? "Receber" : "Pagar"}
                </div>
                {dashboardData.catBreakdown.slice(0, 5).map((cat) => {
                  const pct = dashboardData.catBreakdown[0].total > 0 ? (cat.total / dashboardData.catBreakdown[0].total) * 100 : 0;
                  return (
                    <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{cat.label}</span>
                          <span className="mono" style={{ fontSize: 12, color: T.muted }}>{fmtMoney(cat.total)}</span>
                        </div>
                        <div style={{ height: 4, background: T.soft, borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: cat.color, borderRadius: 99, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activePage === "list" && (
          <div className="fade-in">
            {/* Tabs */}
            <div style={{ display: "flex", background: T.surface, borderRadius: 14, padding: 4, marginBottom: 12, border: `1px solid ${T.border}` }}>
              {[{ id: "receivable", label: "A Receber", color: "#10b981" }, { id: "payable", label: "A Pagar", color: "#ef4444" }].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 13, transition: "all 0.2s", background: activeTab === tab.id ? (tab.id === "receivable" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)") : "transparent", color: activeTab === tab.id ? tab.color : T.muted }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ background: T.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{totals.paidCount} de {totals.count} {activeTab === "receivable" ? "recebidos" : "pagos"}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: totals.pct >= 80 ? "#10b981" : "#6366f1" }}>{totals.pct}%</span>
              </div>
              <div style={{ height: 6, background: T.soft, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${totals.pct}%`, height: "100%", background: totals.pct >= 80 ? "#10b981" : "#6366f1", borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>{fmtMoney(totals.paid)}</span>
                <span className="mono" style={{ fontSize: 12, color: T.muted }}>{fmtMoney(totals.pending)} restante</span>
              </div>
            </div>

            {/* Search + Filter Row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "0 12px" }}>
                <Search size={16} color={T.muted} />
                <input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, padding: "12px 0", background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 14, fontFamily: "Sora, sans-serif" }} />
                {searchTerm && <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 0 }}><X size={14} /></button>}
              </div>
              <button onClick={() => setShowFilters(!showFilters)} style={{ background: showFilters ? "#6366f1" : T.surface, border: `1px solid ${showFilters ? "#6366f1" : T.border}`, borderRadius: 12, padding: "0 14px", cursor: "pointer", color: showFilters ? "white" : T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                <Filter size={16} />
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "Sora, sans-serif" }}>Filtros</span>
              </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="fade-in" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {[{ v: "all", l: "Todos" }, { v: "paid", l: "Pago" }, { v: "open", l: "Aberto" }].map((opt) => (
                    <button key={opt.v} onClick={() => setFilterStatus(opt.v)} style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${filterStatus === opt.v ? "#6366f1" : T.border}`, background: filterStatus === opt.v ? "rgba(99,102,241,0.15)" : "transparent", color: filterStatus === opt.v ? "#818cf8" : T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SortAsc size={14} color={T.muted} />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ flex: 1, background: T.input, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 12, fontFamily: "Sora, sans-serif", outline: "none" }}>
                    <option value="date">Data vencimento</option>
                    <option value="created">Data inclusão</option>
                    <option value="amount">Maior valor</option>
                    <option value="alpha">Nome A-Z</option>
                    <option value="entity">Entidade</option>
                    <option value="priority">Prioridade</option>
                  </select>
                  <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, cursor: "pointer", fontSize: 12, fontFamily: "Sora, sans-serif" }}>
                    {sortDir === "asc" ? "↑" : "↓"}
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>CATEGORIA</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setFilterCategory("all")} style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${filterCategory === "all" ? "#6366f1" : T.border}`, background: filterCategory === "all" ? "rgba(99,102,241,0.15)" : "transparent", color: filterCategory === "all" ? "#818cf8" : T.muted, fontSize: 11, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>
                      Todas
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button key={cat.id} onClick={() => setFilterCategory(cat.id)} style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${filterCategory === cat.id ? cat.color : T.border}`, background: filterCategory === cat.id ? cat.color + "22" : "transparent", color: filterCategory === cat.id ? cat.color : T.muted, fontSize: 11, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transaction List */}
            <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredTransactions.map((t, idx) => {
                const cat = getCat(t.category || "other");
                const days = getDaysUntil(t.date);
                const isOverdue = !t.status && days !== null && days < 0;
                const isDueToday = !t.status && days === 0;
                return (
                  <div key={t.id} className="card-hover fade-in" onClick={() => openEditModal(t)} style={{ background: T.card, border: `1px solid ${t.priority ? "#f59e0b" : isOverdue ? "rgba(239,68,68,0.3)" : T.border}`, borderRadius: 16, padding: "14px 14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", position: "relative", overflow: "hidden", boxShadow: t.priority ? "inset 3px 0 0 #f59e0b" : "none" }}>
                    {/* Status toggle */}
                    <button onClick={(e) => toggleStatus(t.id, t.status, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 2 }}>
                      {t.status ? <CheckCircle size={22} color="#10b981" /> : <Circle size={22} color={isOverdue ? "#ef4444" : isDueToday ? "#f59e0b" : T.muted} />}
                    </button>

                    {/* Cat icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
                      {cat.icon}
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: t.status ? T.muted : T.text, textDecoration: t.status ? "line-through" : "none", wordBreak: "break-word", lineHeight: 1.3 }}>
                          {t.description}
                        </span>
                        <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: t.status ? T.muted : activeTab === "receivable" ? "#10b981" : "#ef4444", flexShrink: 0 }}>
                          {showBalanceValues ? fmtMoney(t.amount) : "••••"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: T.muted }}>{fmtDate(t.date)}</span>
                        {t.entity && <><span style={{ color: T.border }}>•</span><span style={{ fontSize: 12, color: T.muted }}>{t.entity}</span></>}
                        {t.groupId && <Repeat size={11} color="#6366f1" />}
                        <StatusBadge days={days} status={t.status} dark={isDarkMode} />
                      </div>
                      {t.notes && (
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 4, fontStyle: "italic", borderTop: `1px solid ${T.border}`, paddingTop: 4 }}>
                          📝 {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); togglePriority(t, e); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.priority ? "#f59e0b" : T.muted }}>
                        <Star size={14} fill={t.priority ? "#f59e0b" : "none"} />
                      </button>
                      <button onClick={(e) => handleDeleteRequest(t, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.muted }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredTransactions.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 24px", color: T.muted }}>
                  <Wallet size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum lançamento encontrado</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Tente ajustar os filtros ou adicione um novo</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activePage === "analytics" && (
          <div className="fade-in">
            <div style={{ background: T.surface, borderRadius: 18, padding: "18px 16px", border: `1px solid ${T.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Resumo Geral do Mês</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Total Receitas", val: dashboardData.totalRec, color: "#10b981" },
                  { label: "Total Despesas", val: dashboardData.totalPay, color: "#ef4444" },
                  { label: "Saldo Projetado", val: dashboardData.balance, color: dashboardData.balance >= 0 ? "#6366f1" : "#ef4444" },
                  { label: "Saldo Realizado", val: dashboardData.realized, color: dashboardData.realized >= 0 ? "#10b981" : "#ef4444" },
                ].map((item) => (
                  <div key={item.label} style={{ background: T.soft, borderRadius: 12, padding: "14px" }}>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>{item.label}</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{showBalanceValues ? fmtMoney(item.val) : "R$ ••••"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* All categories for both types */}
            {["receivable", "payable"].map((type) => {
              const cats = CATEGORIES.map((cat) => {
                const items = transactions.filter((t) => t.type === type && t.date?.startsWith(selectedMonth) && (t.category || "other") === cat.id);
                return { ...cat, total: items.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0), count: items.length };
              }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
              const total = cats.reduce((a, c) => a + c.total, 0);
              if (cats.length === 0) return null;
              return (
                <div key={type} style={{ background: T.surface, borderRadius: 18, padding: "18px 16px", border: `1px solid ${T.border}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: type === "receivable" ? "#10b981" : "#ef4444" }}>
                    {type === "receivable" ? "📥 Receitas por Categoria" : "📤 Despesas por Categoria"}
                  </div>
                  {cats.map((cat) => {
                    const pct = total > 0 ? (cat.total / total) * 100 : 0;
                    return (
                      <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</span>
                            <div style={{ textAlign: "right" }}>
                              <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(cat.total)}</div>
                              <div style={{ fontSize: 10, color: T.muted }}>{pct.toFixed(1)}% · {cat.count} itens</div>
                            </div>
                          </div>
                          <div style={{ height: 5, background: T.soft, borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: cat.color, borderRadius: 99, transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Priority items */}
            {transactions.filter((t) => t.priority && t.date?.startsWith(selectedMonth)).length > 0 && (
              <div style={{ background: T.surface, borderRadius: 18, padding: "18px 16px", border: `1px solid rgba(245,158,11,0.3)`, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                  <Star size={14} fill="#f59e0b" /> Itens Prioritários
                </div>
                {transactions.filter((t) => t.priority && t.date?.startsWith(selectedMonth)).map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.description}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{t.type === "receivable" ? "Receita" : "Despesa"} · {fmtDate(t.date)}</div>
                    </div>
                    <div className="mono" style={{ fontWeight: 700, color: t.type === "receivable" ? "#10b981" : "#ef4444" }}>{fmtMoney(t.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.border}`, padding: "8px 16px 20px", zIndex: 30, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {[
            { id: "dashboard", icon: Home, label: "Início" },
            { id: "list", icon: List, label: "Lançamentos" },
            { id: "analytics", icon: BarChart2, label: "Análise" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActivePage(id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 16px", fontFamily: "Sora, sans-serif" }}>
              <div style={{ width: 40, height: 32, borderRadius: 12, background: activePage === id ? "rgba(99,102,241,0.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                <Icon size={20} color={activePage === id ? "#6366f1" : T.muted} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: activePage === id ? "#6366f1" : T.muted }}>{label}</span>
            </button>
          ))}
          <button onClick={() => { setActivePage("list"); setIsModalOpen(true); }} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 18, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(99,102,241,0.5)", flexShrink: 0 }}>
            <Plus size={24} color="white" />
          </button>
        </div>
      </div>

      {/* ─── MODAL: NOVO/EDITAR LANÇAMENTO ─── */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 520, background: T.card, borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", border: `1px solid ${T.border}`, borderBottom: "none", boxShadow: "0 -20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ width: 36, height: 4, background: T.border, borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{editingItem ? "Editar" : "Novo Lançamento"}</h3>
              <button onClick={closeModal} style={{ background: T.soft, border: "none", borderRadius: 10, padding: "6px", cursor: "pointer", color: T.muted, display: "flex" }}><X size={18} /></button>
            </div>

            {/* Type indicator */}
            {!editingItem && (
              <div style={{ display: "flex", background: T.soft, borderRadius: 12, padding: 4, marginBottom: 16 }}>
                {[{ id: "receivable", l: "📥 Receita", c: "#10b981" }, { id: "payable", l: "📤 Despesa", c: "#ef4444" }].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", background: activeTab === tab.id ? tab.c + "22" : "transparent", color: activeTab === tab.id ? tab.c : T.muted, transition: "all 0.2s" }}>
                    {tab.l}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={onFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Descrição</label>
                <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required placeholder="Ex: Salário, Aluguel..." style={{ width: "100%", marginTop: 6, padding: "12px 14px", background: T.input, border: `1px solid ${T.inputBorder}`, borderRadius: 12, color: T.text, fontSize: 14, fontFamily: "Sora, sans-serif", outline: "none", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Valor (R$)</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required placeholder="0,00" style={{ width: "100%", marginTop: 6, padding: "12px 14px", background: T.input, border: `1px solid ${T.inputBorder}`, borderRadius: 12, color: T.text, fontSize: 14, fontFamily: "JetBrains Mono, monospace", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Data</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required style={{ width: "100%", marginTop: 6, padding: "12px 14px", background: T.input, border: `1px solid ${T.inputBorder}`, borderRadius: 12, color: T.text, fontSize: 14, fontFamily: "Sora, sans-serif", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Entidade / Devedor</label>
                <input value={formData.entity} onChange={(e) => setFormData({ ...formData, entity: e.target.value })} placeholder="Empresa, pessoa..." style={{ width: "100%", marginTop: 6, padding: "12px 14px", background: T.input, border: `1px solid ${T.inputBorder}`, borderRadius: 12, color: T.text, fontSize: 14, fontFamily: "Sora, sans-serif", outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Category Picker */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Categoria</label>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {CATEGORIES.map((cat) => (
                    <button type="button" key={cat.id} onClick={() => setFormData({ ...formData, category: cat.id })} style={{ padding: "6px 10px", borderRadius: 10, border: `1px solid ${formData.category === cat.id ? cat.color : T.inputBorder}`, background: formData.category === cat.id ? cat.color + "22" : "transparent", color: formData.category === cat.id ? cat.color : T.muted, fontSize: 12, cursor: "pointer", fontFamily: "Sora, sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{cat.icon}</span> {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Observações (opcional)</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Detalhes adicionais..." rows={2} style={{ width: "100%", marginTop: 6, padding: "12px 14px", background: T.input, border: `1px solid ${T.inputBorder}`, borderRadius: 12, color: T.text, fontSize: 13, fontFamily: "Sora, sans-serif", outline: "none", resize: "none", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" onClick={() => setFormData({ ...formData, priority: !formData.priority })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: `1px solid ${formData.priority ? "#f59e0b" : T.inputBorder}`, background: formData.priority ? "rgba(245,158,11,0.12)" : "transparent", color: formData.priority ? "#f59e0b" : T.muted, cursor: "pointer", fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600 }}>
                  <Star size={14} fill={formData.priority ? "#f59e0b" : "none"} /> Prioritário
                </button>
                {!editingItem && (
                  <button type="button" onClick={() => setFormData({ ...formData, status: !formData.status })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: `1px solid ${formData.status ? "#10b981" : T.inputBorder}`, background: formData.status ? "rgba(16,185,129,0.12)" : "transparent", color: formData.status ? "#10b981" : T.muted, cursor: "pointer", fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600 }}>
                    <Check size={14} /> Já pago/recebido
                  </button>
                )}
              </div>

              {/* Recurrence slider */}
              {!editingItem && (
                <div style={{ background: T.soft, borderRadius: 12, padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Repeat size={14} color={T.muted} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>Repetir por meses</span>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#6366f1" }}>{formData.repeatCount}x</span>
                  </div>
                  <input type="range" min="1" max="24" value={formData.repeatCount} onChange={(e) => setFormData({ ...formData, repeatCount: e.target.value })} style={{ width: "100%", background: `linear-gradient(to right, #6366f1 ${((formData.repeatCount - 1) / 23) * 100}%, ${T.border} ${((formData.repeatCount - 1) / 23) * 100}%)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
                    <span>1 mês</span><span>24 meses</span>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={closeModal} style={{ flex: 1, padding: "14px", borderRadius: 14, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} style={{ flex: 2, padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Sora, sans-serif", boxShadow: "0 8px 24px rgba(99,102,241,0.4)", opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? "Salvando..." : editingItem ? "Salvar Alterações" : "Criar Lançamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR RECORRENTE */}
      {recurringEditModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 24, padding: "28px 24px", border: `1px solid ${T.border}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Repeat size={22} color="#6366f1" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Lançamento Recorrente</h3>
            <p style={{ fontSize: 13, color: T.muted, textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>Deseja aplicar as alterações apenas a este mês ou a todos os próximos?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => executeSave("single")} style={{ padding: "14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Apenas este mês</button>
              <button onClick={() => executeSave("series")} style={{ padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Este e os próximos</button>
              <button onClick={() => setRecurringEditModalOpen(false)} style={{ padding: "10px", background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR RECORRENTE */}
      {deleteModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 24, padding: "28px 24px", border: `1px solid rgba(239,68,68,0.2)` }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px", color: "#ef4444" }}>Excluir Lançamento</h3>
            <p style={{ fontSize: 13, color: T.muted, textAlign: "center", margin: "0 0 24px" }}>Este item é recorrente. O que deseja fazer?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => performDelete([itemToDelete.id])} style={{ padding: "14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Excluir apenas este</button>
              <button onClick={handleDeleteSeries} style={{ padding: "14px", borderRadius: 14, border: "none", background: "#ef4444", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Excluir este e futuros</button>
              <button onClick={() => setDeleteModalOpen(false)} style={{ padding: "10px", background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR CSV */}
      {importModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 24, padding: "28px 24px", border: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>Importar CSV</h3>
            <p style={{ fontSize: 12, color: T.muted, margin: "0 0 20px", lineHeight: 1.6 }}>Formato esperado: Descricao, Valor, Data (YYYY-MM-DD), Entidade</p>
            <div style={{ border: `2px dashed ${T.border}`, borderRadius: 14, padding: "24px", textAlign: "center", marginBottom: 16, cursor: "pointer" }} onClick={() => document.getElementById("csvInput").click()}>
              <Upload size={24} color={T.muted} style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: T.muted }}>{csvFile ? csvFile.name : "Clique para selecionar arquivo CSV"}</div>
              <input id="csvInput" type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} style={{ display: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setImportModalOpen(false)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: "pointer", fontFamily: "Sora, sans-serif", fontSize: 13 }}>Cancelar</button>
              <button onClick={handleImportCSV} disabled={!csvFile || isSaving} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: csvFile ? "#6366f1" : T.soft, color: csvFile ? "white" : T.muted, cursor: csvFile ? "pointer" : "default", fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 700 }}>
                {isSaving ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
