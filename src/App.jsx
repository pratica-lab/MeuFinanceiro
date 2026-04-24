import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Trash2, CheckCircle, Circle, Search, Loader2,
  Sun, Moon, Repeat, X, Check, LogOut,
  Edit3, Star, Eye, EyeOff, TrendingUp, TrendingDown, 
  Wallet, AlertCircle, Bell, ChevronLeft, ChevronRight, MessageCircle
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence,
  signInWithCustomToken
} from "firebase/auth";
import {
  getFirestore, collection, updateDoc, doc,
  onSnapshot, writeBatch
} from "firebase/firestore";

// Configurações do Firebase
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

// Lista de Ícones (Emojis)
const ICONS = [
  "💰", "💸", "💳", "🏦", "🏠", "🚗", "⚡", "💧", "📱", "💻", 
  "🛒", "🍔", "☕", "💊", "🏥", "📚", "🎓", "🎮", "🎬", "✈️", 
  "🏖️", "🐾", "🐶", "🎁", "🔧", "🛠️", "👗", "👟", "👶", "📦", "📄"
];

// Utilitários de Formatação
const fmtMoney = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d) => d ? d.split("-").reverse().join("/") : "-";
const fmtMonthYear = (str) => {
  if (!str) return "";
  const parts = str.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return months[parseInt(parts[1], 10) - 1] + " " + parts[0];
};

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
};

// Componente Visual de Status
const StatusBadge = ({ days, status }) => {
  if (status) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">Pago</span>;
  if (days === null) return null;
  if (days < 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">{Math.abs(days) + "d atraso"}</span>;
  if (days === 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500">Hoje</span>;
  if (days <= 3) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">{days + "d"}</span>;
  return null;
};

export default function FinanceApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("payable");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [recurringEditModalOpen, setRecurringEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [expandId, setExpandId] = useState(null);
  const [showBalanceValues, setShowBalanceValues] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("financeAppTheme") !== "light";
    return true;
  });

  const [formData, setFormData] = useState({
    description: "", amount: "", entity: "", date: new Date().toISOString().split("T")[0],
    recurrenceType: "none", repeatCount: 2, status: false, notes: "", priority: false, icon: "💸"
  });

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Injeção de Estilos CSS segura (Sem template literals e sem @import)
  useEffect(() => {
    document.title = "Meu Financeiro";
    localStorage.setItem("financeAppTheme", isDarkMode ? "dark" : "light");
    
    // Injeta a fonte via Link
    if (!document.getElementById("finance-fonts")) {
      const link = document.createElement("link");
      link.id = "finance-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap";
      document.head.appendChild(link);
    }

    // Injeta os estilos dinâmicos
    const styleId = "finance-dynamic-style";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    const bgVar = isDarkMode ? "#0b1120" : "#f0f4f8";
    const textVar = isDarkMode ? "#f1f5f9" : "#0f172a";
    const invertVar = isDarkMode ? "invert(1)" : "none";

    style.innerHTML = "" +
      "* { box-sizing: border-box; }\n" +
      "body { margin: 0; font-family: 'Sora', sans-serif; background: " + bgVar + "; color: " + textVar + "; transition: background 0.3s, color 0.3s; }\n" +
      "::-webkit-scrollbar { width: 4px; }\n" +
      "::-webkit-scrollbar-track { background: transparent; }\n" +
      "::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.3); border-radius: 4px; }\n" +
      ".mono { font-family: 'JetBrains Mono', monospace; }\n" +
      "input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; background: #334155; }\n" +
      "input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #6366f1; cursor: pointer; box-shadow: 0 0 0 3px rgba(99,102,241,0.3); }\n" +
      "input[type=month]::-webkit-calendar-picker-indicator, input[type=date]::-webkit-calendar-picker-indicator { filter: " + invertVar + "; opacity: 0.5; cursor: pointer; }\n" +
      ".fade-in { animation: fadeIn 0.3s ease; }\n" +
      "@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n" +
      ".slide-up { animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1); }\n" +
      "@keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }\n" +
      ".toast-enter { animation: toastIn 0.3s ease; }\n" +
      "@keyframes toastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }\n" +
      ".glow-green { box-shadow: 0 0 20px rgba(16,185,129,0.15); }\n" +
      ".glow-red { box-shadow: 0 0 20px rgba(239,68,68,0.15); }\n" +
      ".icon-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; transition: all 0.2s; }\n" +
      ".icon-btn:hover { background: rgba(120,120,120,0.1); }\n" +
      ".no-scrollbar::-webkit-scrollbar { display: none; }\n" +
      ".no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }\n" +
      ".spin-slow { animation: spin 2s linear infinite; }\n" +
      "@keyframes spin { 100% { transform: rotate(360deg); } }";

  }, [isDarkMode]);

  // Autenticação Firebase
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (e) {
        console.error("Auth init error:", e);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  // Banco de Dados Firestore
  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, "artifacts", appId, "users", user.uid, "transactions");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Firestore:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Funções de Ação ---

  const handleGoogleLogin = async () => {
    setLoginError(null); setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoginError("Login bloqueado. Tente abrir em nova aba.");
    } finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    setConfirmDialog({
      title: "Desconectar", message: "Deseja sair da sua conta?",
      onConfirm: async () => { await signOut(auth); setTransactions([]); setConfirmDialog(null); }
    });
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      description: "", amount: "", entity: "", date: new Date().toISOString().split("T")[0],
      recurrenceType: "none", repeatCount: 2, status: false, notes: "", priority: false, icon: activeTab === "payable" ? "💸" : "💰"
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      ...item,
      amount: item.amount || "",
      recurrenceType: "none", repeatCount: 2, // Reseta nas edições
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditingItem(null);
  };

  const executeSave = async (mode) => {
    setIsSaving(true);
    try {
      const basePath = "artifacts/" + appId + "/users/" + user.uid + "/transactions";
      if (editingItem) {
        if (mode === "series" && editingItem.groupId) {
          const batch = writeBatch(db);
          const seqRegex = /\s*\(\d+\/\d+\)$/;
          const cleanBase = formData.description.replace(seqRegex, "").trim();
          const series = transactions.filter((t) => t.groupId === editingItem.groupId && t.date >= editingItem.date);
          
          series.forEach((item) => {
            const origMatch = item.description.match(seqRegex);
            const finalDesc = origMatch ? cleanBase + " " + origMatch[0].trim() : formData.description;
            batch.update(doc(db, basePath, item.id), {
              description: finalDesc, amount: parseFloat(formData.amount),
              entity: formData.entity || "", notes: formData.notes || "", 
              priority: formData.priority || false, icon: formData.icon
            });
          });
          await batch.commit();
        } else {
          await updateDoc(doc(db, basePath, editingItem.id), {
            description: formData.description, amount: parseFloat(formData.amount),
            entity: formData.entity || "", date: formData.date, status: formData.status,
            notes: formData.notes || "", priority: formData.priority || false, icon: formData.icon
          });
        }
        showToast("Lançamento atualizado!");
      } else {
        const batch = writeBatch(db);
        const baseDate = new Date(formData.date);
        const adj = new Date(baseDate.getTime() + baseDate.getTimezoneOffset() * 60000);
        
        let count = 1;
        let isInfinite = false;

        // Se for Fixa, cria 120 meses (10 anos), se for parcelado pega a quantidade
        if (formData.recurrenceType === "fixed") { count = 120; isInfinite = true; } 
        else if (formData.recurrenceType === "installments") { count = Math.max(2, parseInt(formData.repeatCount, 10)); }
        
        const groupId = count > 1 ? crypto.randomUUID() : null;
        
        for (let i = 0; i < count; i++) {
          const d = new Date(adj); d.setMonth(adj.getMonth() + i);
          const descSuffix = (formData.recurrenceType === "installments") ? " (" + (i + 1) + "/" + count + ")" : "";
          
          batch.set(doc(collection(db, basePath)), {
            type: activeTab,
            description: formData.description + descSuffix,
            amount: parseFloat(formData.amount), entity: formData.entity || "",
            date: d.toISOString().split("T")[0], status: formData.status, 
            groupId, isInfinite, notes: formData.notes || "", priority: formData.priority || false, 
            icon: formData.icon, createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
        showToast(count > 1 ? "Série criada com sucesso!" : "Lançamento criado!");
      }
      setRecurringEditModalOpen(false); closeModal();
    } catch (err) { showToast("Erro ao salvar", "error"); }
    setIsSaving(false);
  };

  const onFormSubmit = (e) => {
    e.preventDefault();
    if (editingItem && editingItem.groupId) setRecurringEditModalOpen(true);
    else executeSave("single");
  };

  const handleDeleteRequest = (item, e) => {
    e.stopPropagation(); 
    if (item.groupId) {
      setItemToDelete(item);
      setDeleteModalOpen(true);
    } else {
      setConfirmDialog({
        title: "Excluir lançamento", message: "Deseja realmente excluir este item?",
        onConfirm: () => { performDelete([item.id]); setConfirmDialog(null); }
      });
    }
  };

  const performDelete = async (ids) => {
    try {
      const batch = writeBatch(db);
      const basePath = "artifacts/" + appId + "/users/" + user.uid + "/transactions";
      ids.forEach((id) => batch.delete(doc(db, basePath, id)));
      await batch.commit();
      setDeleteModalOpen(false); setItemToDelete(null);
      showToast("Excluído com sucesso!");
    } catch (err) { showToast("Erro ao excluir", "error"); }
  };

  const handleDeleteSeries = () => {
    if (!itemToDelete?.groupId) return;
    const ids = transactions.filter((t) => t.groupId === itemToDelete.groupId && t.date >= itemToDelete.date).map((t) => t.id);
    setDeleteModalOpen(false);
    setConfirmDialog({
      title: "Excluir Série", message: "Deseja realmente excluir " + ids.length + " itens da série?",
      onConfirm: () => { performDelete(ids); setConfirmDialog(null); }
    });
  };

  const toggleStatus = async (id, current, e) => {
    e.stopPropagation();
    if (user) {
      const itemPath = "artifacts/" + appId + "/users/" + user.uid + "/transactions";
      await updateDoc(doc(db, itemPath, id), { status: !current });
      showToast(current ? "Marcado como aberto" : "Marcado como liquidado! ✓");
    }
  };

  const handleWhatsApp = (t, e) => {
    e.stopPropagation();
    const msg = "Olá" + (t.entity ? " " + t.entity : "") + "! Tudo bem?\nPassando para lembrar do valor de *" + fmtMoney(t.amount) + "* referente a *" + t.description + "* com vencimento em *" + fmtDate(t.date) + "*.\nQualquer dúvida, estou à disposição!";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  // --- Processamento de Dados (Filtros e Cálculos) ---

  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date?.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const dashboardData = useMemo(() => {
    const rec = monthTransactions.filter(t => t.type === "receivable");
    const pay = monthTransactions.filter(t => t.type === "payable");
    
    const totalRec = rec.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    const totalPay = pay.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    const balance = totalRec - totalPay;
    
    const pctPay = totalPay > 0 ? (pay.filter(t => t.status).reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0) / totalPay) * 100 : 0;
    const pctRec = totalRec > 0 ? (rec.filter(t => t.status).reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0) / totalRec) * 100 : 0;

    const overdue = pay.filter(t => !t.status && getDaysUntil(t.date) < 0).length;

    return { totalRec, totalPay, balance, pctPay: Math.round(pctPay), pctRec: Math.round(pctRec), overdue };
  }, [monthTransactions]);

  const filteredList = useMemo(() => {
    let result = monthTransactions.filter(t => t.type === activeTab);
    
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(t => (t.description || "").toLowerCase().includes(s) || (t.entity || "").toLowerCase().includes(s));
    }
    
    if (filterStatus === "paid") result = result.filter(t => t.status);
    if (filterStatus === "open") result = result.filter(t => !t.status);

    return result.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [monthTransactions, activeTab, searchTerm, filterStatus]);

  // Tema
  const T = isDarkMode ? {
    bg: "#0b1120", surface: "#111827", card: "#161f30", border: "rgba(255,255,255,0.07)",
    text: "#f1f5f9", muted: "#64748b", soft: "#1e2a3d", input: "#1e2a3d"
  } : {
    bg: "#f0f4f8", surface: "#ffffff", card: "#ffffff", border: "rgba(0,0,0,0.07)",
    text: "#0f172a", muted: "#64748b", soft: "#f1f5f9", input: "#f8fafc"
  };

  // ─── TELA DE LOGIN ───
  if (!user && !loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0b1120 0%, #1a0533 50%, #0b1120 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: "rgba(17,24,39,0.8)", backdropFilter: "blur(24px)", borderRadius: 24, padding: "40px 36px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
              <Wallet size={32} color="white" />
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", textAlign: "center", margin: "0 0 6px" }}>Meu Financeiro</h1>
          <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", margin: "0 0 32px" }}>Seu controle prático e direto</p>
          {loginError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#fca5a5" }}>{loginError}</div>}
          <button onClick={handleGoogleLogin} disabled={authLoading} style={{ width: "100%", background: "white", color: "#0f172a", fontWeight: 700, fontSize: 15, padding: "16px", borderRadius: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "all 0.2s" }}>
            {authLoading ? <Loader2 size={20} className="spin-slow" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style={{ width: 22, height: 22 }} alt="G" />}
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0b1120", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={36} color="#6366f1" className="spin-slow" />
    </div>
  );

  // ─── APLICATIVO PRINCIPAL ───
  return (
    <>
      {/* Toast Notificações */}
      {toast && (
        <div className="toast-enter" style={{ position: "fixed", top: 20, right: 16, zIndex: 9999, background: toast.type === "error" ? "#ef4444" : "#10b981", color: "white", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 8, maxWidth: 280 }}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Modal de Confirmação Customizado (Substitui confirm do Navegador) */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 360, background: T.card, borderRadius: 24, padding: "28px 24px", border: "1px solid " + T.border }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <AlertCircle size={24} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px", color: T.text }}>{confirmDialog.title}</h3>
            <p style={{ fontSize: 13, color: T.muted, textAlign: "center", margin: "0 0 24px", lineHeight: 1.5 }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid " + T.border, background: T.soft, color: T.text, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmDialog.onConfirm} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER FIXO */}
      <div style={{ background: T.surface, borderBottom: "1px solid " + T.border, padding: "12px 16px", position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.3px" }}>Financeiro</div>
              <div style={{ fontSize: 11, color: T.muted }}>Olá, {user?.displayName?.split(" ")[0] || "Usuário"}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={() => setShowBalanceValues(!showBalanceValues)} className="icon-btn" style={{ background: "none", border: "none", color: T.muted }}>
              {showBalanceValues ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="icon-btn" style={{ background: "none", border: "none", color: T.muted }}>
              {isDarkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} />}
            </button>
            <button onClick={handleLogout} className="icon-btn" style={{ background: "none", border: "none", color: "#ef4444" }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px", paddingBottom: 100 }}>
        
        {/* NAVEGADOR DE MÊS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, borderRadius: 16, padding: "10px 16px", border: "1px solid " + T.border, marginBottom: 16 }}>
          <button onClick={() => { const parts = selectedMonth.split("-"); setSelectedMonth(new Date(parts[0], parts[1] - 2, 1).toISOString().slice(0, 7)); }} className="icon-btn" style={{ background: "none", border: "none", color: T.muted }}><ChevronLeft size={20} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, textTransform: "capitalize" }}>{fmtMonthYear(selectedMonth)}</div>
          </div>
          <button onClick={() => { const parts = selectedMonth.split("-"); setSelectedMonth(new Date(parts[0], parts[1], 1).toISOString().slice(0, 7)); }} className="icon-btn" style={{ background: "none", border: "none", color: T.muted }}><ChevronRight size={20} /></button>
        </div>

        {/* DASHBOARD COMPACTO (VISÃO ÚNICA) */}
        <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {/* Receitas */}
          <div className="glow-green" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 18, padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#10b981", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={12} /> A Receber</div>
            <div className="mono" style={{ fontSize: showBalanceValues ? 18 : 14, fontWeight: 800, color: T.text }}>{showBalanceValues ? fmtMoney(dashboardData.totalRec) : "R$ ••••"}</div>
            <div style={{ height: 4, background: "rgba(16,185,129,0.2)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: dashboardData.pctRec + "%", height: "100%", background: "#10b981", borderRadius: 4, transition: "width 0.5s ease" }} />
            </div>
          </div>
          
          {/* Despesas */}
          <div className="glow-red" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 18, padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><TrendingDown size={12} /> A Pagar</div>
            <div className="mono" style={{ fontSize: showBalanceValues ? 18 : 14, fontWeight: 800, color: T.text }}>{showBalanceValues ? fmtMoney(dashboardData.totalPay) : "R$ ••••"}</div>
            <div style={{ height: 4, background: "rgba(239,68,68,0.2)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: dashboardData.pctPay + "%", height: "100%", background: "#ef4444", borderRadius: 4, transition: "width 0.5s ease" }} />
            </div>
          </div>

          {/* Saldo Final */}
          <div style={{ gridColumn: "1 / -1", background: T.surface, border: "1px solid " + T.border, borderRadius: 18, padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, textTransform: "uppercase", marginBottom: 2 }}>Saldo Projetado</div>
              <div className="mono" style={{ fontSize: showBalanceValues ? 24 : 18, fontWeight: 800, color: dashboardData.balance >= 0 ? "#10b981" : "#ef4444", letterSpacing: "-0.5px" }}>
                {showBalanceValues ? fmtMoney(dashboardData.balance) : "R$ ••••••"}
              </div>
            </div>
            {dashboardData.overdue > 0 && (
              <div style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "6px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={14} /> {dashboardData.overdue} atrasos
              </div>
            )}
          </div>
        </div>

        {/* ABAS DA LISTA DE LANÇAMENTOS */}
        <div style={{ display: "flex", background: T.surface, borderRadius: 12, padding: 4, marginBottom: 12, border: "1px solid " + T.border }}>
          {[{ id: "receivable", l: "Receitas", c: "#10b981" }, { id: "payable", l: "Despesas", c: "#ef4444" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s", background: activeTab === tab.id ? (tab.id === "receivable" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)") : "transparent", color: activeTab === tab.id ? tab.c : T.muted }}>
              {tab.l}
            </button>
          ))}
        </div>

        {/* FILTROS E BUSCA */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: "0 12px" }}>
            <Search size={16} color={T.muted} />
            <input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, padding: "12px 0", background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 14 }} />
            {searchTerm && <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={14} /></button>}
          </div>
          <div style={{ display: "flex", background: T.surface, border: "1px solid " + T.border, borderRadius: 12, overflow: "hidden" }}>
            {[{ v: "all", l: "T" }, { v: "paid", l: "P" }, { v: "open", l: "A" }].map((opt) => (
              <button key={opt.v} onClick={() => setFilterStatus(opt.v)} style={{ padding: "0 14px", border: "none", background: filterStatus === opt.v ? "#6366f1" : "transparent", color: filterStatus === opt.v ? "white" : T.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{opt.l}</button>
            ))}
          </div>
        </div>

        {/* LISTA DE LANÇAMENTOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredList.map((t) => {
            const days = getDaysUntil(t.date);
            const isOverdue = !t.status && days !== null && days < 0;
            const isExpanded = expandId === t.id;

            return (
              <div key={t.id} className="fade-in" style={{ background: T.card, border: "1px solid " + (t.priority ? "#f59e0b" : (isOverdue ? "rgba(239,68,68,0.4)" : T.border)), borderRadius: 16, overflow: "hidden", boxShadow: t.priority ? "inset 3px 0 0 #f59e0b" : "none" }}>
                <div onClick={() => setExpandId(isExpanded ? null : t.id)} style={{ padding: "14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  
                  {/* Toggle Circular */}
                  <button onClick={(e) => toggleStatus(t.id, t.status, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 2 }}>
                    {t.status ? <CheckCircle size={24} color="#10b981" /> : <Circle size={24} color={isOverdue ? "#ef4444" : T.muted} />}
                  </button>

                  {/* Ícone Emojis */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: T.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {t.icon || "💸"}
                  </div>

                  {/* Informações Centrais */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.status ? T.muted : T.text, textDecoration: t.status ? "line-through" : "none", lineHeight: 1.3 }}>
                        {t.description}
                      </span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: t.status ? T.muted : activeTab === "receivable" ? "#10b981" : "#ef4444", flexShrink: 0 }}>
                        {showBalanceValues ? fmtMoney(t.amount) : "••••"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: T.muted }}>{fmtDate(t.date)}</span>
                      {t.entity && <><span style={{ color: T.border }}>•</span><span style={{ fontSize: 12, color: T.muted }}>{t.entity}</span></>}
                      {t.groupId && <span style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", fontSize: 9, padding: "2px 4px", borderRadius: 4, fontWeight: 700 }}>↻ {t.isInfinite ? "Fixa" : "Rec"}</span>}
                      <StatusBadge days={days} status={t.status} />
                    </div>
                  </div>
                </div>

                {/* Ações ao Expandir o Item */}
                {isExpanded && (
                  <div className="slide-up" style={{ padding: "0 14px 14px 78px", display: "flex", gap: 8 }}>
                    <button onClick={() => openEditModal(t)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 10, border: "none", background: T.soft, color: T.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <Edit3 size={14} /> Editar
                    </button>
                    {/* Botão de WhatsApp para Lançamentos a Receber Pendentes */}
                    {t.type === "receivable" && !t.status && (
                      <button onClick={(e) => handleWhatsApp(t, e)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 10, border: "none", background: "rgba(34,197,94,0.15)", color: "#10b981", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <MessageCircle size={14} /> Cobrar
                      </button>
                    )}
                    <button onClick={(e) => handleDeleteRequest(t, e)} style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: 10, border: "none", background: "rgba(239,68,68,0.15)", color: "#ef4444", cursor: "pointer", flexShrink: 0 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredList.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 24px", color: T.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🍃</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Tudo limpo por aqui</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Nenhum lançamento para exibir.</div>
            </div>
          )}
        </div>
      </div>

      {/* FAB - BOTÃO ADICIONAR FLUTUANTE */}
      <button onClick={openAddModal} style={{ position: "fixed", bottom: 24, right: 24, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 20, width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 32px rgba(99,102,241,0.5)", zIndex: 30 }}>
        <Plus size={28} color="white" />
      </button>

      {/* ─── MODAL DE ADIÇÃO / EDIÇÃO ─── */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 520, background: T.card, borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", border: "1px solid " + T.border, borderBottom: "none", boxShadow: "0 -20px 60px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, background: T.border, borderRadius: 99, margin: "0 auto 20px" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{editingItem ? "Editar Lançamento" : "Novo Lançamento"}</h3>
              <button onClick={closeModal} style={{ background: T.soft, border: "none", borderRadius: 10, padding: "6px", cursor: "pointer", color: T.muted }}><X size={18} /></button>
            </div>

            {/* Abas Receita/Despesa (só aparece na criação) */}
            {!editingItem && (
              <div style={{ display: "flex", background: T.soft, borderRadius: 12, padding: 4, marginBottom: 20 }}>
                {[{ id: "receivable", l: "📥 Receita", c: "#10b981" }, { id: "payable", l: "📤 Despesa", c: "#ef4444" }].map((tab) => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setFormData(f => ({ ...f, icon: tab.id === "payable" ? "💸" : "💰" })); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: activeTab === tab.id ? tab.c + "22" : "transparent", color: activeTab === tab.id ? tab.c : T.muted, transition: "all 0.2s" }}>
                    {tab.l}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={onFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Seletor de Ícone Horizontal Customizado */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>Ícone Visual</label>
                <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {ICONS.map(ic => (
                    <button type="button" key={ic} onClick={() => setFormData({ ...formData, icon: ic })} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: "2px solid " + (formData.icon === ic ? "#6366f1" : T.border), background: formData.icon === ic ? "rgba(99,102,241,0.15)" : T.soft, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Descrição</label>
                <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required placeholder="Ex: Conta de Luz, Aluguel..." style={{ width: "100%", marginTop: 6, padding: "14px", background: T.input, border: "1px solid " + T.border, borderRadius: 12, color: T.text, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Valor (R$)</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required placeholder="0,00" className="mono" style={{ width: "100%", marginTop: 6, padding: "14px", background: T.input, border: "1px solid " + T.border, borderRadius: 12, color: T.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Data Vencimento</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required style={{ width: "100%", marginTop: 6, padding: "14px", background: T.input, border: "1px solid " + T.border, borderRadius: 12, color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Entidade (Devedor/Credor)</label>
                <input value={formData.entity} onChange={(e) => setFormData({ ...formData, entity: e.target.value })} placeholder="Nome da pessoa ou empresa..." style={{ width: "100%", marginTop: 6, padding: "14px", background: T.input, border: "1px solid " + T.border, borderRadius: 12, color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Controles de Status */}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setFormData({ ...formData, priority: !formData.priority })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", borderRadius: 12, border: "1px solid " + (formData.priority ? "#f59e0b" : T.border), background: formData.priority ? "rgba(245,158,11,0.15)" : T.soft, color: formData.priority ? "#f59e0b" : T.text, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                  <Star size={16} fill={formData.priority ? "#f59e0b" : "none"} /> Prioridade
                </button>
                {!editingItem && (
                  <button type="button" onClick={() => setFormData({ ...formData, status: !formData.status })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", borderRadius: 12, border: "1px solid " + (formData.status ? "#10b981" : T.border), background: formData.status ? "rgba(16,185,129,0.15)" : T.soft, color: formData.status ? "#10b981" : T.text, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    <Check size={16} /> Já liquidado
                  </button>
                )}
              </div>

              {/* Configuração de Recorrência Melhorada */}
              {!editingItem && (
                <div style={{ background: T.soft, borderRadius: 14, padding: "16px", border: "1px solid " + T.border }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 12 }}>Como funciona essa conta?</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: formData.recurrenceType === "installments" ? 16 : 0 }}>
                    {[{ id: "none", l: "Única Vez" }, { id: "fixed", l: "Conta Fixa" }, { id: "installments", l: "Parcelado" }].map(rt => (
                      <button type="button" key={rt.id} onClick={() => setFormData({ ...formData, recurrenceType: rt.id })} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid " + (formData.recurrenceType === rt.id ? "#6366f1" : T.border), background: formData.recurrenceType === rt.id ? "rgba(99,102,241,0.15)" : "transparent", color: formData.recurrenceType === rt.id ? "#6366f1" : T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {rt.l}
                      </button>
                    ))}
                  </div>

                  {formData.recurrenceType === "fixed" && (
                    <div className="fade-in" style={{ fontSize: 11, color: T.muted, marginTop: 12, lineHeight: 1.4 }}>
                      <AlertCircle size={12} style={{ display: "inline", marginBottom: -2 }} /> Esta opção gera a cobrança automaticamente todos os meses de forma ininterrupta.
                    </div>
                  )}

                  {formData.recurrenceType === "installments" && (
                    <div className="fade-in">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: T.muted }}>Quantidade de meses</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#6366f1" }}>{formData.repeatCount + "x"}</span>
                      </div>
                      <input type="range" min="2" max="48" value={formData.repeatCount} onChange={(e) => setFormData({ ...formData, repeatCount: e.target.value })} style={{ width: "100%", cursor: "pointer" }} />
                    </div>
                  )}
                </div>
              )}

              {/* Botões do Formulário */}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={closeModal} style={{ flex: 1, padding: "16px", borderRadius: 14, border: "1px solid " + T.border, background: "transparent", color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} style={{ flex: 2, padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 24px rgba(99,102,241,0.4)", opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? "Salvando..." : editingItem ? "Salvar Alterações" : "Criar Lançamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIÇÃO RECORRENTE */}
      {recurringEditModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 24, padding: "28px 24px", border: "1px solid " + T.border }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Repeat size={22} color="#6366f1" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Edição de Série</h3>
            <p style={{ fontSize: 13, color: T.muted, textAlign: "center", margin: "0 0 24px" }}>Deseja aplicar as alterações apenas a este mês ou a todos os próximos?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => executeSave("single")} style={{ padding: "14px", borderRadius: 14, border: "1px solid " + T.border, background: T.soft, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Apenas este mês</button>
              <button onClick={() => executeSave("series")} style={{ padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Este e os próximos</button>
              <button onClick={() => setRecurringEditModalOpen(false)} style={{ padding: "10px", background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO RECORRENTE */}
      {deleteModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(8px)" }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 24, padding: "28px 24px", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px", color: "#ef4444" }}>Excluir Série</h3>
            <p style={{ fontSize: 13, color: T.muted, textAlign: "center", margin: "0 0 24px" }}>Este item pertence a uma série. O que deseja fazer?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => performDelete([itemToDelete.id])} style={{ padding: "14px", borderRadius: 14, border: "1px solid " + T.border, background: T.soft, color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Excluir apenas este</button>
              <button onClick={handleDeleteSeries} style={{ padding: "14px", borderRadius: 14, border: "none", background: "#ef4444", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Excluir este e futuros</button>
              <button onClick={() => setDeleteModalOpen(false)} style={{ padding: "10px", background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}