import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Search, X, Droplet, Users, History, LayoutDashboard, Settings as SettingsIcon, ChevronRight, Phone, Check, ArrowDownCircle, ArrowUpCircle, Receipt, Pencil, Trash2, Printer, ArrowLeft, Wallet, CalendarDays, ShoppingBag, Download, Share2, Filter, MessageCircle, Send, Loader2, Sparkles, Image as ImageIcon, Building2, CloudUpload, CloudDownload, Fingerprint, Languages, ScrollText, LockKeyhole, UserCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Share } from "@capacitor/share";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { jsPDF } from "jspdf";

// ---------- helpers ----------
const todayStr = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
};

const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[parseInt(m,10)-1]} ${y}`;
};

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
};

const normalizeSampleWeight = (raw) => {
  const v = parseFloat(raw);
  if (isNaN(v)) return 0;
  return v >= 1 ? v / 1000 : v;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toISODate = (d) => { const tz = d.getTimezoneOffset() * 60000; return new Date(d - tz).toISOString().slice(0, 10); };

const STATUS_META = {
  paid: { label: "Paid", color: "#1b7a5e", bg: "#e6f4ef" },
  credit: { label: "Credit", color: "#a1690a", bg: "#fbf0dc" },
  debit: { label: "Udhaar", color: "#b3391f", bg: "#fbeae6" },
};

const FLOW_META = {
  purchase: { label: "Purchase", color: "#215464", icon: ArrowDownCircle, noun: "Supplier" },
  sale: { label: "Sale", color: "#6b4fa0", icon: ArrowUpCircle, noun: "Customer" },
};

const TYPE_OPTIONS = ["Buffalo", "Cow", "Goat", "Other"];
const CATEGORY_OPTIONS = ["Fresh", "Kachcha"];
const SHIFT_OPTIONS = ["Morning", "Evening"]; // Purchase-side shift
const SALE_SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening"]; // Sale-side shift

// Purchase rate by Category + Type. Combos not listed here (e.g. Fresh Goat,
// or "Other" type) fall back to the general Purchase Rate set in Settings.
const DEFAULT_PURCHASE_RATE_MATRIX = {
  Fresh: { Buffalo: 200, Cow: 170 },
  Kachcha: { Buffalo: 50, Cow: 30, Goat: 20 },
};

// Sale-side item catalog. Khoya is split by milk type since Buffalo/Cow khoya
// price differently. "Other" is free-form with no fixed rate.
const SALE_ITEMS = [
  { key: "milk_cow", label: "Milk - Cow", defaultRate: 80 },
  { key: "milk_buffalo", label: "Milk - Buffalo", defaultRate: 50 },
  { key: "milk_goat", label: "Milk - Goat", defaultRate: 40 },
  { key: "khoya_buffalo", label: "Khoya - Buffalo", defaultRate: 320 },
  { key: "khoya_cow", label: "Khoya - Cow", defaultRate: 300 },
  { key: "sweets", label: "Sweets", defaultRate: 320 },
  { key: "ghee", label: "Ghee", defaultRate: 600 },
  { key: "curd", label: "Curd", defaultRate: 100 },
  { key: "topla", label: "Topla", defaultRate: 750 },
  { key: "other", label: "Other", defaultRate: 0 },
];
const DEFAULT_SALE_ITEM_RATES = Object.fromEntries(SALE_ITEMS.map((i) => [i.key, i.defaultRate]));

// Translations cover core navigation and common actions — the app chrome
// you see constantly. Full translation of every dialog's microcopy would be
// a much larger follow-up; this gives working language switching for the
// parts of the app you look at every time you open it.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "hi", label: "हिन्दी" },
];

const TRANSLATIONS = {
  en: {
    appName: "Milk Ledger", navDashboard: "Dashboard", navParties: "Parties", navHistory: "History", navAccount: "Account",
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", back: "Back", search: "Search", close: "Close", add: "Add",
    today: "Today", newTransaction: "New Transaction", statement: "Statement", previousBalance: "Previous Balance", balance: "Balance",
    accountMenu: "Account", businessProfile: "Business Profile", ratesAndData: "Rates & Data", backupRestore: "Backup & Restore",
    security: "Security", language: "Language", activityLog: "Activity Log",
  },
  gu: {
    appName: "મિલ્ક લેજર", navDashboard: "ડેશબોર્ડ", navParties: "પક્ષો", navHistory: "ઇતિહાસ", navAccount: "ખાતું",
    save: "સાચવો", cancel: "રદ કરો", delete: "કાઢી નાખો", edit: "સંપાદિત કરો", back: "પાછળ", search: "શોધો", close: "બંધ કરો", add: "ઉમેરો",
    today: "આજે", newTransaction: "નવો વ્યવહાર", statement: "સ્ટેટમેન્ટ", previousBalance: "અગાઉનું બેલેન્સ", balance: "બેલેન્સ",
    accountMenu: "ખાતું", businessProfile: "વ્યવસાય પ્રોફાઇલ", ratesAndData: "દરો અને ડેટા", backupRestore: "બેકઅપ અને પુનઃસ્થાપિત",
    security: "સુરક્ષા", language: "ભાષા", activityLog: "પ્રવૃત્તિ લોગ",
  },
  hi: {
    appName: "मिल्क लेजर", navDashboard: "डैशबोर्ड", navParties: "पार्टियाँ", navHistory: "इतिहास", navAccount: "खाता",
    save: "सेव करें", cancel: "रद्द करें", delete: "हटाएं", edit: "संपादित करें", back: "वापस", search: "खोजें", close: "बंद करें", add: "जोड़ें",
    today: "आज", newTransaction: "नया लेनदेन", statement: "स्टेटमेंट", previousBalance: "पिछला बैलेंस", balance: "बैलेंस",
    accountMenu: "खाता", businessProfile: "व्यवसाय प्रोफ़ाइल", ratesAndData: "दरें और डेटा", backupRestore: "बैकअप और पुनर्स्थापना",
    security: "सुरक्षा", language: "भाषा", activityLog: "गतिविधि लॉग",
  },
};

// ---------- small UI atoms ----------
const PillGroup = ({ options, value, onChange, columns = options.length, activeColor = "#215464" }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
    {options.map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            active ? "text-white" : "bg-white border-slate-200 text-slate-600 active:bg-slate-50"
          }`}
          style={active ? { background: activeColor, borderColor: activeColor } : {}}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

const Field = ({ label, children, hint }) => (
  <div className="mb-4">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{label}</div>
    {children}
    {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
  </div>
);

export default function MilkLedger() {
  const [ready, setReady] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rates, setRates] = useState({ purchase: 200, sale: 220, saleItems: DEFAULT_SALE_ITEM_RATES, purchaseMatrix: DEFAULT_PURCHASE_RATE_MATRIX });
  const [tab, setTab] = useState("dashboard");
  const [customerFlow, setCustomerFlow] = useState("purchase"); // which list is shown on Customers tab
  const [search, setSearch] = useState("");
  const [dialogCustomer, setDialogCustomer] = useState(null);
  const [dialogKind, setDialogKind] = useState(null); // null | "milk" | "money"
  const [viewingParty, setViewingParty] = useState(null); // customer object whose full statement is open
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerOpeningBalance, setNewCustomerOpeningBalance] = useState("0");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyFlowFilter, setHistoryFlowFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [rateInputs, setRateInputs] = useState({ purchase: "200", sale: "220" });
  const [saleItemRateInputs, setSaleItemRateInputs] = useState(
    Object.fromEntries(SALE_ITEMS.map((i) => [i.key, String(i.defaultRate)]))
  );
  const [purchaseMatrixInputs, setPurchaseMatrixInputs] = useState({
    Fresh: { Buffalo: "200", Cow: "170" },
    Kachcha: { Buffalo: "50", Cow: "30", Goat: "20" },
  });
  const [savingRate, setSavingRate] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [invoiceTxn, setInvoiceTxn] = useState(null);
  const [shareSheet, setShareSheet] = useState(null); // { title, text } | null
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("0");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAssistant, setShowAssistant] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // ---------- Account tab state ----------
  const [accountView, setAccountView] = useState("menu"); // menu | profile | rates | backup | security | language | activity
  const [businessProfile, setBusinessProfile] = useState({ businessName: "", ownerName: "", phone: "", address: "", regNo: "" });
  const [profileInputs, setProfileInputs] = useState({ businessName: "", ownerName: "", phone: "", address: "", regNo: "" });
  const [activityLog, setActivityLog] = useState([]);
  const [security, setSecurity] = useState({ pinEnabled: false, pinHash: "", biometricEnabled: false });
  const [locked, setLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSetupStep, setPinSetupStep] = useState(null); // null | "new" | "confirm" | "remove"
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(null); // null=unchecked, true/false after check
  const [lang, setLang] = useState("en");
  const [autoBackup, setAutoBackup] = useState({ onEveryEntry: false, scheduled: false, scheduledTime: "20:00", lastBackupAt: null, lastAutoSnapshotAt: null });
  const [restoreError, setRestoreError] = useState("");
  const fileInputRef = useRef(null);

  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "Hi! Tap a quick action below, or type something like \"sold 5 ltr cow milk to Ramesh paid\"." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [assistantView, setAssistantView] = useState("chat"); // "chat" | "pickParty"
  const [pickPartyFlow, setPickPartyFlow] = useState("purchase");
  const [pickPartyThen, setPickPartyThen] = useState(null); // "milk" | "money" — what to open after picking

  useEffect(() => {
    (async () => {
      try {
        const c = await window.storage.get("customers");
        setCustomers(c ? JSON.parse(c.value) : []);
      } catch { setCustomers([]); }
      try {
        const t = await window.storage.get("transactions");
        setTransactions(t ? JSON.parse(t.value) : []);
      } catch { setTransactions([]); }
      try {
        const s = await window.storage.get("settings");
        const parsed = s ? JSON.parse(s.value) : { purchase: 200, sale: 220, saleItems: DEFAULT_SALE_ITEM_RATES, purchaseMatrix: DEFAULT_PURCHASE_RATE_MATRIX };
        const saleItems = { ...DEFAULT_SALE_ITEM_RATES, ...(parsed.saleItems || {}) };
        const purchaseMatrix = {
          Fresh: { ...DEFAULT_PURCHASE_RATE_MATRIX.Fresh, ...(parsed.purchaseMatrix?.Fresh || {}) },
          Kachcha: { ...DEFAULT_PURCHASE_RATE_MATRIX.Kachcha, ...(parsed.purchaseMatrix?.Kachcha || {}) },
        };
        const merged = { purchase: parsed.purchase ?? 200, sale: parsed.sale ?? 220, saleItems, purchaseMatrix };
        setRates(merged);
        setRateInputs({ purchase: String(merged.purchase), sale: String(merged.sale) });
        setSaleItemRateInputs(Object.fromEntries(SALE_ITEMS.map((i) => [i.key, String(saleItems[i.key] ?? i.defaultRate)])));
        setPurchaseMatrixInputs({
          Fresh: { Buffalo: String(purchaseMatrix.Fresh.Buffalo), Cow: String(purchaseMatrix.Fresh.Cow) },
          Kachcha: { Buffalo: String(purchaseMatrix.Kachcha.Buffalo), Cow: String(purchaseMatrix.Kachcha.Cow), Goat: String(purchaseMatrix.Kachcha.Goat) },
        });
      } catch { setRates({ purchase: 200, sale: 220, saleItems: DEFAULT_SALE_ITEM_RATES, purchaseMatrix: DEFAULT_PURCHASE_RATE_MATRIX }); }
      try {
        const bp = await window.storage.get("businessProfile");
        const parsedBp = bp ? JSON.parse(bp.value) : { businessName: "", ownerName: "", phone: "", address: "", regNo: "" };
        setBusinessProfile(parsedBp);
        setProfileInputs(parsedBp);
      } catch {}
      try {
        const al = await window.storage.get("activityLog");
        setActivityLog(al ? JSON.parse(al.value) : []);
      } catch { setActivityLog([]); }
      try {
        const sec = await window.storage.get("security");
        const parsedSec = sec ? JSON.parse(sec.value) : { pinEnabled: false, pinHash: "", biometricEnabled: false };
        setSecurity(parsedSec);
        setLocked(!!parsedSec.pinEnabled);
      } catch {}
      try {
        const l = await window.storage.get("language");
        setLang(l ? JSON.parse(l.value) : "en");
      } catch {}
      try {
        const ab = await window.storage.get("autoBackup");
        const parsedAb = ab ? JSON.parse(ab.value) : { onEveryEntry: false, scheduled: false, scheduledTime: "20:00", lastBackupAt: null, lastAutoSnapshotAt: null };
        setAutoBackup(parsedAb);
      } catch {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (viewingParty) {
      setBalanceInput(String(viewingParty.openingBalance || 0));
      setEditingBalance(false);
    }
  }, [viewingParty?.id]);

  const persist = {
    customers: async (list) => {
      setCustomers(list);
      try { await window.storage.set("customers", JSON.stringify(list)); } catch {}
    },
    transactions: async (list) => {
      setTransactions(list);
      try { await window.storage.set("transactions", JSON.stringify(list)); } catch {}
    },
    settings: async (s) => {
      try { await window.storage.set("settings", JSON.stringify(s)); } catch {}
    },
    businessProfile: async (p) => {
      setBusinessProfile(p);
      try { await window.storage.set("businessProfile", JSON.stringify(p)); } catch {}
    },
    activityLog: async (list) => {
      try { await window.storage.set("activityLog", JSON.stringify(list)); } catch {}
    },
    security: async (s) => {
      setSecurity(s);
      try { await window.storage.set("security", JSON.stringify(s)); } catch {}
    },
    language: async (l) => {
      setLang(l);
      try { await window.storage.set("language", JSON.stringify(l)); } catch {}
    },
    autoBackup: async (s) => {
      setAutoBackup(s);
      try { await window.storage.set("autoBackup", JSON.stringify(s)); } catch {}
    },
  };

  // Records a timestamped entry for the Activity Log. Uses a functional
  // update so rapid-fire calls (e.g. several saves in a row) never clobber
  // each other from a stale closure.
  const logActivity = (type, message) => {
    setActivityLog((prev) => {
      const next = [{ id: uid(), ts: Date.now(), type, message }, ...prev].slice(0, 500);
      window.storage.set("activityLog", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const addCustomer = async () => {
    const name = newCustomerName.trim();
    if (!name) return;
    const ob = parseFloat(newCustomerOpeningBalance);
    const c = { id: uid(), name, phone: newCustomerPhone.trim(), flow: customerFlow, openingBalance: isNaN(ob) ? 0 : ob };
    await persist.customers([c, ...customers]);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerOpeningBalance("0");
    setShowAddCustomer(false);
    showToast(`${name} added as ${FLOW_META[customerFlow].noun.toLowerCase()}`);
    logActivity("customer", `Added ${FLOW_META[customerFlow].noun.toLowerCase()}: ${name}`);
  };

  const updateCustomerBalance = async (customerId, newBalance) => {
    const list = customers.map((c) => (c.id === customerId ? { ...c, openingBalance: newBalance } : c));
    await persist.customers(list);
    if (viewingParty?.id === customerId) setViewingParty((v) => ({ ...v, openingBalance: newBalance }));
    showToast(`Previous balance set to ₹${round2(newBalance)}`);
    logActivity("customer", `Set previous balance for ${customerById(customerId)?.name || "party"} to ₹${round2(newBalance)}`);
  };

  const saveTransaction = async (txn) => {
    await persist.transactions([txn, ...transactions]);
    logActivity("transaction", `Logged ${txn.kind === "money" ? "money" : "milk/item"} entry ₹${round2(txn.amount)} for ${customerById(txn.customerId)?.name || "party"} (${STATUS_META[txn.status].label})`);
    maybeAutoBackupSnapshot();
  };

  const updateTransaction = async (txn) => {
    await persist.transactions(transactions.map((t) => (t.id === txn.id ? txn : t)));
    logActivity("transaction", `Edited entry ₹${round2(txn.amount)} for ${customerById(txn.customerId)?.name || "party"}`);
    maybeAutoBackupSnapshot();
  };

  const deleteTransaction = async (id) => {
    const txn = transactions.find((t) => t.id === id);
    await persist.transactions(transactions.filter((t) => t.id !== id));
    setDeleteTarget(null);
    showToast("Transaction deleted");
    logActivity("transaction", `Deleted ₹${round2(txn?.amount || 0)} entry for ${customerById(txn?.customerId)?.name || "party"}`);
    maybeAutoBackupSnapshot();
  };

  const customerById = (id) => customers.find((c) => c.id === id);

  const openNewEntry = (customer) => {
    setDialogCustomer(customer);
    setEditingTxn(null);
    setDialogKind(null); // null + a customer means "show the Milk/Money chooser"
  };

  const openEdit = (txn) => {
    setDialogCustomer(customerById(txn.customerId));
    setEditingTxn(txn);
    // "item" (sale-side) and "milk" (purchase-side) both use the same dialogKind
    // slot; the flow on dialogCustomer decides which dialog component renders.
    setDialogKind(txn.kind === "money" ? "money" : "milk");
  };

  const closeDialog = () => {
    setDialogCustomer(null);
    setEditingTxn(null);
    setDialogKind(null);
  };

  // Manual tap from the Parties tab — always starts with a clean, unfiltered statement.
  const openPartyDetail = (customer) => {
    setViewingParty(customer);
    setShowDateFilter(false);
    setDateFrom("");
    setDateTo("");
  };

  // Assistant-driven navigation — can jump straight to a pre-applied date range.
  const openPartyStatement = (customer, range) => {
    setShowAssistant(false);
    setViewingParty(customer);
    if (range) {
      setDateFrom(range.from);
      setDateTo(range.to);
      setShowDateFilter(true);
    } else {
      setDateFrom("");
      setDateTo("");
      setShowDateFilter(false);
    }
  };

  // ---------- Demo data generator ----------
  // 5 purchase + 5 sale customers, 10 transactions each, spread across the
  // current month up through today. Adds to existing data, never overwrites.
  const seedDemoData = async () => {
    const PURCHASE_NAMES = ["Ramesh Yadav", "Suresh Patil", "Mahesh Chandra", "Dinesh Kumar", "Ganesh Rao"];
    const SALE_NAMES = ["Anita Sharma", "Priya Verma", "Sunita Joshi", "Kavita Singh", "Rekha Gupta"];
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const weightedStatus = () => {
      const r = Math.random();
      return r < 0.55 ? "paid" : r < 0.8 ? "credit" : "debit";
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const maxDay = now.getDate();
    const mkDate = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const newCustomers = [];
    const newTxns = [];

    PURCHASE_NAMES.forEach((name) => {
      const cust = { id: uid(), name, phone: `9${randInt(100000000, 999999999)}`, flow: "purchase", openingBalance: randInt(0, 500) };
      newCustomers.push(cust);
      for (let i = 0; i < 10; i++) {
        const day = randInt(1, maxDay);
        const shift = pick(SHIFT_OPTIONS);
        const category = pick(CATEGORY_OPTIONS);
        const type = pick(["Buffalo", "Cow", "Goat"]);
        const qty = Math.round(rand(3, 15) * 10) / 10;
        const sampleWeight = randInt(200, 320);
        const rate = rates.purchase;
        const amount = round2(qty * normalizeSampleWeight(sampleWeight) * rate);
        newTxns.push({
          id: uid(), customerId: cust.id, date: mkDate(day), shift, category, type,
          qty, sampleWeightRaw: String(sampleWeight), sampleWeightKg: normalizeSampleWeight(sampleWeight),
          rate, amount, note: "", status: weightedStatus(),
          createdAt: new Date(year, month, day, randInt(6, 19), randInt(0, 59)).getTime(),
        });
      }
    });

    SALE_NAMES.forEach((name) => {
      const cust = { id: uid(), name, phone: `9${randInt(100000000, 999999999)}`, flow: "sale", openingBalance: randInt(0, 300) };
      newCustomers.push(cust);
      for (let i = 0; i < 10; i++) {
        const day = randInt(1, maxDay);
        const itemDef = pick(SALE_ITEMS.filter((x) => x.key !== "other"));
        const qty = itemDef.key.startsWith("milk") ? Math.round(rand(1, 6) * 10) / 10 : Math.round(rand(0.5, 3) * 10) / 10;
        const rate = rates.saleItems?.[itemDef.key] ?? itemDef.defaultRate;
        const amount = round2(qty * rate);
        newTxns.push({
          id: uid(), customerId: cust.id, kind: "item", date: mkDate(day), itemKey: itemDef.key, itemName: itemDef.label,
          qty, rate, amount, note: "", status: weightedStatus(),
          createdAt: new Date(year, month, day, randInt(7, 20), randInt(0, 59)).getTime(),
        });
      }
    });

    await persist.customers([...newCustomers, ...customers]);
    await persist.transactions([...newTxns, ...transactions]);
    setShowSeedConfirm(false);
    showToast("Demo data added: 10 parties, 100 transactions");
    logActivity("system", "Loaded demo data: 10 parties, 100 transactions");
  };

  const handleSaveTxn = async (txn) => {
    if (editingTxn) {
      await updateTransaction(txn);
    } else {
      await saveTransaction(txn);
    }
    closeDialog();
    showToast(`${editingTxn ? "Updated" : "Saved"} · ${STATUS_META[txn.status].label}`);
  };

  const savePurchaseRate = async () => {
    const p = parseFloat(rateInputs.purchase);
    if (isNaN(p) || p <= 0) return;
    setSavingRate(true);
    const next = { ...rates, purchase: p };
    setRates(next);
    await persist.settings(next);
    setTimeout(() => setSavingRate(false), 600);
    showToast("Purchase rate updated");
    logActivity("settings", `Fallback purchase rate updated to ₹${p}`);
  };

  const saveSaleItemRates = async () => {
    const parsed = {};
    for (const item of SALE_ITEMS) {
      if (item.key === "other") continue;
      const v = parseFloat(saleItemRateInputs[item.key]);
      parsed[item.key] = isNaN(v) || v < 0 ? item.defaultRate : v;
    }
    const next = { ...rates, saleItems: { ...rates.saleItems, ...parsed } };
    setRates(next);
    await persist.settings(next);
    showToast("Item rates updated");
    logActivity("settings", "Sale item rates updated");
  };

  const savePurchaseMatrix = async () => {
    const clean = (val, fallback) => { const v = parseFloat(val); return isNaN(v) || v < 0 ? fallback : v; };
    const nextMatrix = {
      Fresh: {
        Buffalo: clean(purchaseMatrixInputs.Fresh.Buffalo, rates.purchaseMatrix.Fresh.Buffalo),
        Cow: clean(purchaseMatrixInputs.Fresh.Cow, rates.purchaseMatrix.Fresh.Cow),
      },
      Kachcha: {
        Buffalo: clean(purchaseMatrixInputs.Kachcha.Buffalo, rates.purchaseMatrix.Kachcha.Buffalo),
        Cow: clean(purchaseMatrixInputs.Kachcha.Cow, rates.purchaseMatrix.Kachcha.Cow),
        Goat: clean(purchaseMatrixInputs.Kachcha.Goat, rates.purchaseMatrix.Kachcha.Goat),
      },
    };
    const next = { ...rates, purchaseMatrix: nextMatrix };
    setRates(next);
    await persist.settings(next);
    showToast("Purchase rates updated");
    logActivity("settings", "Purchase rate matrix updated");
  };

  // ---------- Language ----------
  const t = (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  const changeLanguage = async (code) => {
    await persist.language(code);
    logActivity("settings", `Language changed to ${LANGUAGES.find((l) => l.code === code)?.label}`);
  };

  // ---------- Business Profile ----------
  const saveBusinessProfile = async () => {
    await persist.businessProfile(profileInputs);
    showToast("Business profile saved");
    logActivity("settings", "Business profile updated");
  };

  // ---------- Backup & Restore ----------
  // "Backup" builds a single JSON snapshot of everything and hands it to the
  // device's native share sheet (same mechanism as the statement Share
  // buttons) — on most phones that share sheet already includes Google
  // Drive, OneDrive, email, WhatsApp, etc. as destinations, plus a plain
  // download if the person just wants the file locally. There's no direct
  // Drive/OneDrive API integration here — that would need a registered app
  // with Google/Microsoft — but this reaches the same places in practice.
  const buildBackupPayload = () => ({
    app: "MilkLedger",
    version: 1,
    exportedAt: new Date().toISOString(),
    customers,
    transactions,
    rates,
    businessProfile,
  });

  const downloadBackupFile = async () => {
    const payload = buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    await shareBlobAsFile(blob, `milk_ledger_backup_${todayStr()}.json`, "Milk Ledger Backup");
    const next = { ...autoBackup, lastBackupAt: Date.now() };
    await persist.autoBackup(next);
    logActivity("backup", "Manual backup created");
  };

  const [pendingRestore, setPendingRestore] = useState(null);

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.customers) || !Array.isArray(data.transactions)) {
        throw new Error("not a backup file");
      }
      setPendingRestore(data);
    } catch {
      setRestoreError("Couldn't read that file — make sure it's a Milk Ledger backup JSON.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmRestore = async () => {
    const data = pendingRestore;
    if (!data) return;
    await persist.customers(data.customers);
    await persist.transactions(data.transactions);
    if (data.rates) { setRates(data.rates); await persist.settings(data.rates); }
    if (data.businessProfile) { await persist.businessProfile(data.businessProfile); }
    setPendingRestore(null);
    showToast("Backup restored");
    logActivity("backup", `Restored backup from ${data.exportedAt ? fmtDate(data.exportedAt.slice(0, 10)) : "file"}`);
  };

  // ---------- Auto-backup ----------
  // "On every entry" keeps a fresh local JSON snapshot in storage after each
  // save — real and automatic, but local-only (silently pushing to a cloud
  // service on every save isn't possible without a signed-in cloud API, and
  // triggering the share sheet on every single entry would be disruptive).
  // "Scheduled" is an honest reminder system: it nudges you at your chosen
  // time if you haven't backed up yet that day, rather than claiming to
  // upload silently in the background.
  const maybeAutoBackupSnapshot = () => {
    if (!autoBackup.onEveryEntry) return;
    const payload = buildBackupPayload();
    window.storage.set("autoBackupSnapshot", JSON.stringify(payload)).catch(() => {});
  };

  const saveAutoBackupSettings = async (patch) => {
    const next = { ...autoBackup, ...patch };
    await persist.autoBackup(next);
    logActivity("settings", "Auto-backup settings updated");
  };

  // ---------- Security / PIN lock ----------
  // Uses the browser's native SHA-256 (window.crypto.subtle) so the PIN
  // itself is never stored — only its hash. This is a practical local-device
  // lock (keeps a casual snooper out), not a server-verified auth system —
  // there's no backend here for a real JWT to authenticate against.
  const hashPin = async (pin) => {
    const enc = new TextEncoder().encode(pin);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const startSetPin = () => { setPinSetupStep("new"); setPinNew(""); setPinConfirm(""); setPinError(""); };

  const submitNewPin = () => {
    if (pinNew.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
    setPinError("");
    setPinSetupStep("confirm");
  };

  const submitConfirmPin = async () => {
    if (pinConfirm !== pinNew) {
      setPinError("PINs didn't match — try again");
      setPinSetupStep("new");
      setPinNew("");
      setPinConfirm("");
      return;
    }
    const hash = await hashPin(pinNew);
    const next = { ...security, pinEnabled: true, pinHash: hash };
    await persist.security(next);
    setPinSetupStep(null);
    setPinNew("");
    setPinConfirm("");
    setPinError("");
    showToast("PIN lock enabled");
    logActivity("security", "PIN lock enabled");
  };

  const removePin = async () => {
    const next = { pinEnabled: false, pinHash: "", biometricEnabled: false };
    await persist.security(next);
    showToast("PIN lock removed");
    logActivity("security", "PIN lock removed");
  };

  const attemptUnlock = async () => {
    const hash = await hashPin(pinEntry);
    if (hash === security.pinHash) {
      setLocked(false);
      setPinEntry("");
      setPinError("");
      logActivity("security", "App unlocked with PIN");
    } else {
      setPinError("Incorrect PIN");
      setPinEntry("");
    }
  };

  const checkBiometricAvailability = async () => {
    try {
      if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(avail);
        showToast(avail ? "Biometric hardware detected on this device" : "No biometric hardware detected here");
      } else {
        setBiometricAvailable(false);
        showToast("Biometric check isn't supported in this browser");
      }
    } catch {
      setBiometricAvailable(false);
      showToast("Couldn't check biometric support");
    }
  };

  // Reminds (doesn't silently act) when a scheduled backup time has passed
  // and no backup has been taken yet today.
  useEffect(() => {
    if (!ready || !autoBackup.scheduled) return;
    const check = () => {
      const now = new Date();
      const [h, m] = (autoBackup.scheduledTime || "20:00").split(":").map(Number);
      const scheduledToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0);
      const lastBackup = autoBackup.lastBackupAt ? new Date(autoBackup.lastBackupAt) : null;
      const backedUpToday = lastBackup && lastBackup.toDateString() === now.toDateString();
      if (now >= scheduledToday && !backedUpToday) {
        showToast("⏰ Scheduled backup time — open Account → Backup to back up now");
      }
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [ready, autoBackup.scheduled, autoBackup.scheduledTime, autoBackup.lastBackupAt]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => c.flow === customerFlow)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q));
  }, [customers, search, customerFlow]);

  const today = todayStr();
  const dashboard = useMemo(() => {
    const withFlow = transactions.map((t) => ({ ...t, flow: customerById(t.customerId)?.flow || "purchase" }));
    const todays = withFlow.filter((t) => t.date === today);

    const sums = (list) => ({
      ltr: round2(list.reduce((s, t) => s + (t.kind === "money" ? 0 : (t.qty || 0)), 0)),
      amt: round2(list.reduce((s, t) => s + t.amount, 0)),
      count: list.length,
    });
    // Milk volume/value stats should reflect actual milk trade, not money settlements
    const todayPurchase = sums(todays.filter((t) => t.flow === "purchase" && t.kind !== "money"));
    const todaySale = sums(todays.filter((t) => t.flow === "sale" && t.kind !== "money"));

    const byStatus = { paid: 0, credit: 0, debit: 0 };
    withFlow.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + t.amount; });

    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const dayTxns = withFlow.filter((t) => t.date === iso);
      const purchaseAmt = round2(dayTxns.filter((t) => t.flow === "purchase").reduce((s, t) => s + t.amount, 0));
      const saleAmt = round2(dayTxns.filter((t) => t.flow === "sale").reduce((s, t) => s + t.amount, 0));
      return { label: iso.slice(5), purchase: purchaseAmt, sale: saleAmt, isToday: iso === today };
    });

    const duesByCustomer = {};
    withFlow.forEach((t) => {
      if (t.status !== "paid") {
        const key = t.customerId;
        duesByCustomer[key] = duesByCustomer[key] || { amt: 0, flow: t.flow };
        duesByCustomer[key].amt += t.amount;
      }
    });
    const topDebtors = Object.entries(duesByCustomer)
      .map(([id, v]) => ({ id, amt: v.amt, flow: v.flow, name: customerById(id)?.name || "Unknown" }))
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 5);

    return { todayPurchase, todaySale, byStatus, days, topDebtors, outstanding: byStatus.credit + byStatus.debit, netToday: round2(todaySale.amt - todayPurchase.amt) };
  }, [transactions, customers, today]);

  const historyList = useMemo(() => {
    let list = transactions.map((t) => ({ ...t, flow: customerById(t.customerId)?.flow || "purchase" }));
    if (historyFlowFilter !== "all") list = list.filter((t) => t.flow === historyFlowFilter);
    if (historyFilter !== "all") list = list.filter((t) => t.customerId === historyFilter);
    return list;
  }, [transactions, historyFilter, historyFlowFilter, customers]);

  const historyRows = useMemo(
    () => historyList.map((t) => ({ ...t, customerName: customerById(t.customerId)?.name })),
    [historyList, customers]
  );

  const srNoMap = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const map = {};
    sorted.forEach((t, i) => { map[t.id] = i + 1; });
    return map;
  }, [transactions]);

  const saveBalance = async () => {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && viewingParty) {
      await updateCustomerBalance(viewingParty.id, v);
    }
    setEditingBalance(false);
  };

  // Full statement for whichever party is currently open: chronological rows +
  // totals where Balance = Credit − Debit + Previous Balance (Previous Balance
  // carries its own sign — a negative previous balance reduces the total,
  // a positive one adds to it — rather than always being subtracted).
  const partyStatement = useMemo(() => {
    if (!viewingParty) return null;
    const allRows = transactions
      .filter((t) => t.customerId === viewingParty.id)
      .map((t) => ({ ...t, flow: viewingParty.flow }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const hasFilter = !!(dateFrom || dateTo);
    const rows = allRows.filter((t) => {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });

    // Effective "previous balance" going into the visible range: everything
    // before dateFrom, folded through the same Credit − Debit + Previous formula.
    const carried = dateFrom ? allRows.filter((t) => t.date < dateFrom) : [];
    const carriedCredit = carried.filter((t) => t.status === "credit").reduce((s, t) => s + t.amount, 0);
    const carriedDebit = carried.filter((t) => t.status === "debit").reduce((s, t) => s + t.amount, 0);
    const opening = dateFrom
      ? round2(carriedCredit - carriedDebit + (viewingParty.openingBalance || 0))
      : round2(viewingParty.openingBalance || 0);

    // Paid entries are settled on the spot and never affect the balance —
    // only credit and debit entries count.
    const qty = rows.reduce((s, t) => s + (t.kind === "money" ? 0 : (t.qty || 0)), 0);
    const amount = rows.reduce((s, t) => s + t.amount, 0);
    const credit = rows.filter((t) => t.status === "credit").reduce((s, t) => s + t.amount, 0);
    const debit = rows.filter((t) => t.status === "debit").reduce((s, t) => s + t.amount, 0);

    return {
      rows,
      hasFilter,
      qty: round2(qty),
      amount: round2(amount),
      credit: round2(credit),
      debit: round2(debit),
      balance: round2(credit - debit + opening),
      opening,
    };
  }, [transactions, viewingParty, dateFrom, dateTo]);

  // ---------- Generic export helpers (usable from Statement, History, Dashboard) ----------
  const buildCsvLines = (rows, { previousBalance, totals } = {}) => {
    const headers = ["Sr No", "Date", "Time", "Party", "Shift", "Item", "Type", "Qty", "Rate", "Amount", "Status", "Credit", "Debit", "Note"];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    if (previousBalance != null) {
      lines.push(["", "", "", "", "", "Previous Balance", "", "", "", previousBalance, "", "", "", ""].map(esc).join(","));
    }
    rows.forEach((t) => {
      const isMoney = t.kind === "money";
      const isItem = t.kind === "item";
      lines.push(
        [
          srNoMap[t.id],
          t.date,
          fmtTime(t.createdAt),
          t.customerName || "",
          isMoney ? "" : t.shift || "",
          isMoney ? "Money" : isItem ? t.itemName : t.category,
          isMoney || isItem ? "" : t.type,
          isMoney ? "" : t.qty,
          isMoney ? "" : t.rate,
          round2(t.amount),
          STATUS_META[t.status].label,
          t.status === "credit" ? round2(t.amount) : "",
          t.status === "debit" ? round2(t.amount) : "",
          t.note || "",
        ].map(esc).join(",")
      );
    });
    if (totals) {
      lines.push("");
      if (previousBalance != null) lines.push(`Previous Balance,,${previousBalance}`);
      lines.push(`Total Qty,,${totals.qty}`);
      lines.push(`Total Amount,,${totals.amount}`);
      lines.push(`Total Credit,,${totals.credit}`);
      lines.push(`Total Debit,,${totals.debit}`);
      if (totals.balance != null) lines.push(`Balance (Credit - Debit + Previous),,${totals.balance}`);
    }
    return lines;
  };

  const shareNativeText = async (title, text) => {
    try {
      await Share.share({ title, text, dialogTitle: title });
      return true;
    } catch {
      return false;
    }
  };

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const writeCacheFile = async (path, data, encoding) => {
    await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Cache,
      ...(encoding ? { encoding } : {}),
      recursive: true,
    });
    const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
    return uri.uri;
  };

  const shareNativeFile = async ({ title, text, path, data, encoding }) => {
    try {
      const url = await writeCacheFile(path, data, encoding);
      await Share.share({ title, text, url, dialogTitle: title });
      return true;
    } catch {
      return false;
    }
  };

  const downloadCSV = async (rows, filename, opts) => {
    const csvText = buildCsvLines(rows, opts).join("\n");
    if (await shareNativeFile({
      title: filename,
      text: "CSV export generated from Milk Ledger.",
      path: filename,
      data: csvText,
      encoding: Encoding.UTF8,
    })) return;

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  };

  // Draws a table (header, optional Previous Balance row, transaction rows,
  // optional totals) onto a <canvas> and exports it as a JPEG — no external
  // library needed. This is what makes "share as image" possible; there's no
  // PDF-generation library available in this sandbox, so PDF stays covered by
  // Print → Save as PDF.
  const generateTableImageBlob = (rows, { title, subtitle, showParty, previousBalance, totals, flowColorHex }) => {
    return new Promise((resolve) => {
      const scale = 2;
      const pad = 24;
      const headerH = 86;
      const rowH = 30;
      const colHeaderH = 26;
      const flowColor = flowColorHex || "#215464";

      // Full column set matching the on-screen table (minus Action, which is
      // meaningless in a static image).
      const cols = showParty
        ? [
            { key: "sr", label: "Sr", w: 26 },
            { key: "date", label: "Date/Time", w: 66 },
            { key: "party", label: "Party", w: 92 },
            { key: "shift", label: "Shift", w: 56 },
            { key: "item", label: "Item", w: 86 },
            { key: "type", label: "Type", w: 54 },
            { key: "qty", label: "Qty", w: 40 },
            { key: "rate", label: "Rate", w: 48 },
            { key: "amount", label: "Amount", w: 62 },
            { key: "status", label: "Status", w: 52 },
            { key: "credit", label: "Credit", w: 54 },
            { key: "debit", label: "Debit", w: 54 },
            { key: "note", label: "Note", w: 80 },
          ]
        : [
            { key: "sr", label: "Sr", w: 28 },
            { key: "date", label: "Date/Time", w: 70 },
            { key: "shift", label: "Shift", w: 60 },
            { key: "item", label: "Item", w: 96 },
            { key: "type", label: "Type", w: 58 },
            { key: "qty", label: "Qty", w: 44 },
            { key: "rate", label: "Rate", w: 52 },
            { key: "amount", label: "Amount", w: 68 },
            { key: "status", label: "Status", w: 56 },
            { key: "credit", label: "Credit", w: 58 },
            { key: "debit", label: "Debit", w: 58 },
            { key: "note", label: "Note", w: 90 },
          ];

      // Precompute each column's x start so spanning text (Previous Balance /
      // TOTAL labels) can be placed precisely without a real colSpan.
      let cum = 0;
      const colX = cols.map((c) => { const x = cum; cum += c.w; return x; });
      const tableW = cum;
      const width = tableW + pad * 2;
      const idx = (key) => cols.findIndex((c) => c.key === key);

      const prevRowCount = previousBalance != null ? 1 : 0;
      const totalRowCount = totals ? 1 : 0;
      const bodyRows = rows.length + prevRowCount + totalRowCount;
      const height = headerH + colHeaderH + bodyRows * rowH + pad;

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);

      const tableX = pad;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = flowColor;
      ctx.fillRect(0, 0, width, headerH);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(title, pad, 30);
      ctx.font = "12px sans-serif";
      ctx.fillText(subtitle, pad, 52);
      ctx.font = "11px sans-serif";
      ctx.fillText(`Generated ${fmtDate(todayStr())}`, pad, 70);

      let y = headerH + 18;
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(tableX, y - 16, tableW, colHeaderH);
      ctx.fillStyle = "#475569";
      ctx.font = "bold 8.5px sans-serif";
      cols.forEach((c, i) => ctx.fillText(c.label, tableX + colX[i] + 3, y - 1));
      y += rowH - 6;

      const drawLine = () => {
        ctx.strokeStyle = "#eef2f6";
        ctx.beginPath();
        ctx.moveTo(tableX, y - rowH + 10);
        ctx.lineTo(tableX + tableW, y - rowH + 10);
        ctx.stroke();
      };

      const cell = (text, colIdx, opts = {}) => {
        ctx.fillStyle = opts.color || "#334155";
        ctx.font = opts.bold ? "700 9px sans-serif" : "9px sans-serif";
        const maxChars = Math.floor(cols[colIdx].w / 4.6);
        const s = String(text ?? "");
        ctx.fillText(s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s, tableX + colX[colIdx] + 3, y);
      };

      if (previousBalance != null) {
        cell("Previous Balance", idx("sr"), { bold: true, color: "#64748b" });
        cell(`₹${previousBalance}`, idx("amount"), { bold: true, color: "#1e293b" });
        y += rowH;
        drawLine();
      }

      rows.forEach((t) => {
        const isMoney = t.kind === "money";
        const isItem = t.kind === "item";
        const itemText = isMoney ? "Money" : isItem ? t.itemName : t.category;
        const statusMeta = STATUS_META[t.status];

        cell(srNoMap[t.id], idx("sr"));
        cell(`${fmtDate(t.date).replace(/ \d{4}$/, "")} ${fmtTime(t.createdAt)}`, idx("date"));
        if (showParty) cell(t.customerName || "", idx("party"));
        cell(isMoney ? "—" : t.shift || "—", idx("shift"));
        cell(itemText, idx("item"));
        cell(isMoney || isItem ? "—" : t.type, idx("type"));
        cell(isMoney ? "—" : t.qty ?? "—", idx("qty"));
        cell(isMoney ? "—" : `₹${t.rate}`, idx("rate"));
        cell(`₹${round2(t.amount)}`, idx("amount"), { bold: true });
        cell(statusMeta.label, idx("status"), { color: statusMeta.color, bold: true });
        cell(t.status === "credit" ? `₹${round2(t.amount)}` : "—", idx("credit"), { color: STATUS_META.credit.color });
        cell(t.status === "debit" ? `₹${round2(t.amount)}` : "—", idx("debit"), { color: STATUS_META.debit.color });
        cell(t.note || "—", idx("note"));

        y += rowH;
        drawLine();
      });

      if (totals) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(tableX, y - rowH + 10, tableW, rowH);
        cell("TOTAL", idx("sr"), { bold: true, color: "#475569" });
        cell(totals.qty, idx("qty"), { bold: true });
        cell(`₹${totals.amount}`, idx("amount"), { bold: true });
        cell(`₹${totals.credit}`, idx("credit"), { bold: true, color: STATUS_META.credit.color });
        cell(`₹${totals.debit}`, idx("debit"), { bold: true, color: STATUS_META.debit.color });
        if (totals.balance != null) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = "7.5px sans-serif";
          ctx.fillText("Balance", tableX + colX[idx("note")] + 3, y - 9);
          ctx.fillStyle = flowColor;
          ctx.font = "700 10px sans-serif";
          ctx.fillText(`₹${totals.balance}`, tableX + colX[idx("note")] + 3, y + 2);
        }
      }

      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
    });
  };

  const generateTablePdfBlob = (rows, { title, subtitle, showParty, previousBalance, totals }) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 28;
    const headerH = 86;
    const rowH = 22;
    const money = (value) => `Rs ${round2(value || 0)}`;

    const cols = showParty
      ? [
          ["Sr", 24], ["Date / Time", 64], ["Party", 88], ["Shift", 54], ["Item", 84], ["Type", 48],
          ["Qty", 34], ["Rate", 46], ["Amount", 56], ["Status", 50], ["Credit", 54], ["Debit", 54], ["Note", 88],
        ]
      : [
          ["Sr", 26], ["Date / Time", 74], ["Shift", 58], ["Item", 110], ["Type", 54], ["Qty", 38],
          ["Rate", 50], ["Amount", 60], ["Status", 54], ["Credit", 58], ["Debit", 58], ["Note", 118],
        ];

    const scale = (pageW - margin * 2) / cols.reduce((sum, [, w]) => sum + w, 0);
    const widths = cols.map(([, w]) => w * scale);
    const xPositions = widths.reduce((list, w, i) => {
      list.push(i === 0 ? margin : list[i - 1] + widths[i - 1]);
      return list;
    }, []);

    const cell = (text, col, y, opts = {}) => {
      const x = xPositions[col] + 3;
      const maxWidth = widths[col] - 6;
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.size || 8);
      doc.setTextColor(opts.color || "#334155");
      const clipped = doc.splitTextToSize(String(text ?? "-"), maxWidth)[0] || "";
      doc.text(clipped, x, y);
    };

    const drawHeader = () => {
      doc.setFillColor("#0f172a");
      doc.rect(0, 0, pageW, headerH, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(title, margin, 36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(subtitle, margin, 56);
      doc.text(`Generated ${fmtDate(todayStr())}`, pageW - margin - 120, 56);
      doc.setDrawColor("#215464");
      doc.setLineWidth(5);
      doc.line(0, headerH, pageW, headerH);
    };

    const drawColumns = (y) => {
      doc.setFillColor("#f1f5f9");
      doc.rect(margin, y - 15, pageW - margin * 2, rowH, "F");
      cols.forEach(([label], i) => cell(label, i, y, { bold: true, color: "#475569" }));
    };

    const ensureRoom = (y) => {
      if (y + rowH < pageH - margin) return y;
      doc.addPage();
      drawHeader();
      const nextY = headerH + 34;
      drawColumns(nextY);
      return nextY + rowH;
    };

    const rowCells = (t) => {
      const isMoney = t.kind === "money";
      const isItem = t.kind === "item";
      const common = [
        srNoMap[t.id],
        `${fmtDate(t.date).replace(/ \d{4}$/, "")} ${fmtTime(t.createdAt)}`,
      ];
      if (showParty) common.push(t.customerName || "");
      common.push(
        isMoney ? "-" : t.shift || "-",
        isMoney ? "Money" : isItem ? t.itemName : t.category,
        isMoney || isItem ? "-" : t.type,
        isMoney ? "-" : t.qty ?? "-",
        isMoney ? "-" : money(t.rate),
        money(t.amount),
        STATUS_META[t.status].label,
        t.status === "credit" ? money(t.amount) : "-",
        t.status === "debit" ? money(t.amount) : "-",
        t.note || "-"
      );
      return common;
    };

    drawHeader();
    let y = headerH + 34;
    drawColumns(y);
    y += rowH;

    if (previousBalance != null) {
      y = ensureRoom(y);
      cell("Previous Balance", 0, y, { bold: true, color: "#64748b" });
      cell(money(previousBalance), showParty ? 8 : 7, y, { bold: true, color: "#0f172a" });
      y += rowH;
    }

    rows.forEach((t) => {
      y = ensureRoom(y);
      rowCells(t).forEach((value, i) => cell(value, i, y, { bold: i === (showParty ? 8 : 7) }));
      y += rowH;
    });

    if (totals) {
      y = ensureRoom(y);
      doc.setFillColor("#f8fafc");
      doc.rect(margin, y - 15, pageW - margin * 2, rowH, "F");
      const totalCells = Array(cols.length).fill("");
      totalCells[0] = "TOTAL";
      totalCells[showParty ? 6 : 5] = totals.qty ?? "";
      totalCells[showParty ? 8 : 7] = money(totals.amount);
      totalCells[showParty ? 10 : 9] = money(totals.credit);
      totalCells[showParty ? 11 : 10] = money(totals.debit);
      totalCells[showParty ? 12 : 11] = totals.balance != null ? `Balance ${money(totals.balance)}` : "";
      totalCells.forEach((value, i) => cell(value, i, y, { bold: true, color: "#0f172a" }));
    }

    return doc.output("blob");
  };

  // Shares a Blob as a file via the native Android share sheet when available,
  // falling back to browser file sharing/download for web preview.
  const shareBlobAsFile = async (blob, filename, title) => {
    if (!blob) { showToast("Couldn't generate the file"); return; }
    const data = await blobToBase64(blob);
    if (await shareNativeFile({
      title,
      text: "File generated from Milk Ledger.",
      path: filename,
      data,
    })) return;

    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
        // fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${filename} downloaded — share it from your gallery/downloads`);
  };

  const buildShareText = (title, subtitle, totals) => {
    const lines = [title, subtitle];
    if (totals) {
      if (totals.opening != null) lines.push(`Previous Balance: ₹${totals.opening}`);
      lines.push(`Total Qty: ${totals.qty} L`);
      lines.push(`Total Amount: ₹${totals.amount}`);
      lines.push(`Total Credit: ₹${totals.credit}`);
      lines.push(`Total Debit: ₹${totals.debit}`);
      if (totals.balance != null) lines.push(`Balance (Credit − Debit + Previous): ₹${totals.balance}`);
    }
    return lines.join("\n");
  };

  const shareAsText = async (title, text) => {
    if (await shareNativeText(title, text)) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    setShareSheet({ title, text });
  };

  // Aggregate totals (no "balance" — that only makes sense for a single
  // party's own previous-balance chain) used by History and Dashboard exports.
  const aggregateTotals = (rows) => {
    const qty = rows.reduce((s, t) => s + (t.kind === "money" ? 0 : (t.qty || 0)), 0);
    const amount = rows.reduce((s, t) => s + t.amount, 0);
    const credit = rows.filter((t) => t.status === "credit").reduce((s, t) => s + t.amount, 0);
    const debit = rows.filter((t) => t.status === "debit").reduce((s, t) => s + t.amount, 0);
    return { qty: round2(qty), amount: round2(amount), credit: round2(credit), debit: round2(debit) };
  };

  // ---------- Party Statement-specific wrappers ----------
  const exportPartyCSV = () => {
    const rangeTag = dateFrom || dateTo ? `_${dateFrom || "start"}_to_${dateTo || "today"}` : "";
    downloadCSV(
      partyStatement.rows.map((t) => ({ ...t, customerName: viewingParty.name })),
      `${viewingParty.name.replace(/\s+/g, "_")}${rangeTag}_statement.csv`,
      { previousBalance: partyStatement.opening, totals: partyStatement }
    );
  };

  const shareStatementImage = async () => {
    const rangeLabel = partyStatement.hasFilter ? `${dateFrom || "Start"} to ${dateTo || "Today"}` : "Full history";
    const blob = await generateTableImageBlob(partyStatement.rows, {
      title: "Milk Ledger — Statement",
      subtitle: `${viewingParty.name} · ${rangeLabel}`,
      showParty: false,
      previousBalance: partyStatement.opening,
      totals: partyStatement,
      flowColorHex: FLOW_META[viewingParty.flow].color,
    });
    const rangeTag = dateFrom || dateTo ? `_${dateFrom || "start"}_to_${dateTo || "today"}` : "";
    await shareBlobAsFile(blob, `${viewingParty.name.replace(/\s+/g, "_")}${rangeTag}_statement.jpg`, `${viewingParty.name} Statement`);
  };

  const shareStatementPdf = async () => {
    const rangeLabel = partyStatement.hasFilter ? `${dateFrom || "Start"} to ${dateTo || "Today"}` : "Full history";
    const blob = generateTablePdfBlob(partyStatement.rows, {
      title: "Milk Ledger - Statement",
      subtitle: `${viewingParty.name} - ${rangeLabel}`,
      showParty: false,
      previousBalance: partyStatement.opening,
      totals: partyStatement,
    });
    const rangeTag = dateFrom || dateTo ? `_${dateFrom || "start"}_to_${dateTo || "today"}` : "";
    await shareBlobAsFile(blob, `${viewingParty.name.replace(/\s+/g, "_")}${rangeTag}_statement.pdf`, `${viewingParty.name} Statement`);
  };

  const shareStatement = () => {
    const rangeLabel = partyStatement.hasFilter ? `${dateFrom || "Start"} to ${dateTo || "Today"}` : "Full history";
    const text = buildShareText(`${viewingParty.name} — Milk Ledger Statement`, rangeLabel, partyStatement);
    shareAsText(`${viewingParty.name} Statement`, text);
  };

  // ---------- History tab export wrappers ----------
  const historyFilterLabel = () => {
    const flowLabel = historyFlowFilter === "all" ? "All Parties" : `${FLOW_META[historyFlowFilter].label}s`;
    const partyLabel = historyFilter !== "all" ? ` · ${customerById(historyFilter)?.name}` : "";
    return `${flowLabel}${partyLabel}`;
  };

  const exportHistoryCSV = () => {
    downloadCSV(historyRows, `milk_ledger_history_${todayStr()}.csv`, { totals: aggregateTotals(historyList) });
  };

  const shareHistoryImage = async () => {
    const blob = await generateTableImageBlob(historyRows, {
      title: "Milk Ledger — History",
      subtitle: historyFilterLabel(),
      showParty: true,
      totals: aggregateTotals(historyList),
      flowColorHex: "#334155",
    });
    await shareBlobAsFile(blob, `milk_ledger_history_${todayStr()}.jpg`, "Milk Ledger History");
  };

  const shareHistoryPdf = async () => {
    const blob = generateTablePdfBlob(historyRows, {
      title: "Milk Ledger - History",
      subtitle: historyFilterLabel(),
      showParty: true,
      totals: aggregateTotals(historyList),
    });
    await shareBlobAsFile(blob, `milk_ledger_history_${todayStr()}.pdf`, "Milk Ledger History");
  };

  const shareHistoryText = () => {
    const text = buildShareText("Milk Ledger — Transaction History", historyFilterLabel(), aggregateTotals(historyList));
    shareAsText("Milk Ledger History", text);
  };

  // ---------- Assistant: local answers (fast, no API, always accurate) ----------
  const findCustomerMatches = (nameGuess, flowHint) => {
    if (!nameGuess) return [];
    const q = nameGuess.trim().toLowerCase();
    if (!q) return [];
    let pool = customers;
    if (flowHint) pool = pool.filter((c) => c.flow === flowHint);
    return pool.filter((c) => c.name.toLowerCase().includes(q));
  };

  const localQuickAnswer = (text) => {
    const q = text.trim().toLowerCase();
    const today = todayStr();

    if (/\btoday'?s?\s+(summary|total)\b|\bsummary\b/.test(q)) {
      const todays = transactions.filter((t) => t.date === today);
      const purchAmt = round2(todays.filter((t) => customerById(t.customerId)?.flow === "purchase" && t.kind !== "money").reduce((s, t) => s + t.amount, 0));
      const saleAmt = round2(todays.filter((t) => customerById(t.customerId)?.flow === "sale" && t.kind !== "money").reduce((s, t) => s + t.amount, 0));
      return `Today (${fmtDate(today)}): Purchase ₹${purchAmt} · Sale ₹${saleAmt} · Net ₹${round2(saleAmt - purchAmt)} · ${todays.length} entries logged.`;
    }

    if (/\bdues?\b|\boutstanding\b/.test(q)) {
      const dueMap = {};
      transactions.forEach((t) => {
        if (t.status !== "paid") dueMap[t.customerId] = (dueMap[t.customerId] || 0) + t.amount;
      });
      const top = Object.entries(dueMap)
        .map(([id, amt]) => ({ name: customerById(id)?.name || "Unknown", amt: round2(amt) }))
        .filter((d) => d.amt > 0)
        .sort((a, b) => b.amt - a.amt)
        .slice(0, 5);
      if (top.length === 0) return "No outstanding dues right now. 🎉";
      return "Top outstanding:\n" + top.map((d) => `• ${d.name}: ₹${d.amt}`).join("\n");
    }

    const balanceMatch = q.match(/balance.*?(?:of|for)\s+([a-z\s]+)$/) || q.match(/^([a-z\s]+?)'s?\s+balance/);
    if (balanceMatch) {
      const nameGuess = balanceMatch[1].trim();
      const matches = findCustomerMatches(nameGuess);
      if (matches.length === 1) {
        const c = matches[0];
        const partyTxns = transactions.filter((t) => t.customerId === c.id);
        const credit = round2(partyTxns.filter((t) => t.status === "credit").reduce((s, t) => s + t.amount, 0));
        const debit = round2(partyTxns.filter((t) => t.status === "debit").reduce((s, t) => s + t.amount, 0));
        const bal = round2(credit - debit + (c.openingBalance || 0));
        return `${c.name}: balance ₹${bal} (Credit ₹${credit} − Debit ₹${debit} + Previous ₹${round2(c.openingBalance || 0)}).`;
      }
    }
    return null;
  };

  // ---------- Assistant: "show me X's statement/transactions" navigation ----------
  const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthRange = (year, monthIdx) => ({
    from: toISODate(new Date(year, monthIdx, 1)),
    to: toISODate(new Date(year, monthIdx + 1, 0)),
  });

  const parseDateRangeFromText = (text) => {
    const q = text.toLowerCase();
    const now = new Date();
    if (/\bthis month\b/.test(q)) return monthRange(now.getFullYear(), now.getMonth());
    if (/\blast month\b/.test(q)) {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return monthRange(d.getFullYear(), d.getMonth());
    }
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const m = q.match(new RegExp(`\\b${MONTH_NAMES[i]}\\b(?:\\s+(\\d{4}))?`));
      if (m) return monthRange(m[1] ? parseInt(m[1], 10) : now.getFullYear(), i);
    }
    return null;
  };

  const STATEMENT_KEYWORDS = /\b(statement|transactions?|history|ledger|entries|records?)\b/i;

  const tryStatementIntent = (text) => {
    if (!STATEMENT_KEYWORDS.test(text)) return null;
    const lower = text.toLowerCase();
    const matches = customers.filter((c) => lower.includes(c.name.toLowerCase()));
    return { matches, range: parseDateRangeFromText(text) };
  };

  // ---------- Assistant: AI parsing for transaction logging ----------
  const callParseAPI = async (text) => {
    const customerNames = customers.map((c) => `${c.name} (${c.flow})`).join(", ") || "none saved yet";
    const prompt = `You convert one sentence into JSON for a dairy ledger app. Reply with ONLY raw JSON, no markdown fences, no prose.
Today's date: ${todayStr()}.
Known parties: ${customerNames}.
Sale item keys: milk_cow, milk_buffalo, milk_goat, khoya_buffalo, khoya_cow, sweets, ghee, curd, topla, other.
Schema:
{"intent":"log_transaction"|"unknown","flow":"purchase"|"sale"|null,"kind":"milk"|"item"|"money"|null,"customerName":string|null,"date":"YYYY-MM-DD"|null,"shift":"Morning"|"Evening"|null,"category":"Fresh"|"Kachcha"|null,"type":"Buffalo"|"Cow"|"Goat"|"Other"|null,"itemKey":string|null,"itemName":string|null,"qty":number|null,"sampleWeight":number|null,"rate":number|null,"amount":number|null,"status":"paid"|"credit"|"debit"|null,"note":string|null}
Rules: "flow":"purchase" means buying milk FROM a supplier; "sale" means selling TO a customer. If unclear, guess from context (e.g. "sold"/"to customer" = sale, "bought"/"from supplier" = purchase). "kind":"milk" only for purchase-side milk with sample weight; sale-side milk/items always use "kind":"item" with the matching itemKey. "kind":"money" for plain payments with no item — put the number in "amount", not "qty"/"rate". Use null for anything not mentioned. Date defaults to today if not stated.
Sentence: "${text}"`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => b.text || "").join("").trim();
      const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  const buildDraftFromParsed = (parsed) => {
    const flow = parsed.flow || "purchase";
    const matches = findCustomerMatches(parsed.customerName, flow);
    const kind = parsed.kind || (flow === "sale" ? "item" : "milk");
    return {
      kind,
      flow,
      customerId: matches.length === 1 ? matches[0].id : null,
      customerNameGuess: parsed.customerName || "",
      candidates: matches,
      date: parsed.date || todayStr(),
      shift: parsed.shift || "Morning",
      category: parsed.category || "Fresh",
      type: parsed.type || "Buffalo",
      itemKey: parsed.itemKey || "milk_cow",
      itemName: parsed.itemName || "",
      qty: parsed.qty ?? "",
      sampleWeight: parsed.sampleWeight ?? "",
      rate: parsed.rate ?? (kind === "item" ? rates.saleItems?.[parsed.itemKey] : rates.purchase) ?? "",
      amount: parsed.amount ?? "",
      status: parsed.status || "paid",
      note: parsed.note || "",
    };
  };

  const draftAmount = (d) => {
    if (d.kind === "money") return round2(parseFloat(d.amount) || 0);
    if (d.kind === "item") return round2((parseFloat(d.qty) || 0) * (parseFloat(d.rate) || 0));
    return round2((parseFloat(d.qty) || 0) * normalizeSampleWeight(d.sampleWeight) * (parseFloat(d.rate) || 0));
  };

  const confirmDraft = async (draft) => {
    if (!draft.customerId) return;
    const cust = customerById(draft.customerId);
    const amount = draftAmount(draft);
    let txn;
    if (draft.kind === "money") {
      txn = { id: uid(), customerId: cust.id, kind: "money", date: draft.date, amount, note: draft.note, status: draft.status, createdAt: Date.now() };
    } else if (draft.kind === "item") {
      const itemDef = SALE_ITEMS.find((i) => i.key === draft.itemKey);
      const itemName = draft.itemKey === "other" ? (draft.itemName || "Other") : itemDef?.label;
      txn = { id: uid(), customerId: cust.id, kind: "item", date: draft.date, itemKey: draft.itemKey, itemName, qty: parseFloat(draft.qty) || 0, rate: parseFloat(draft.rate) || 0, amount, note: draft.note, status: draft.status, createdAt: Date.now() };
    } else {
      txn = {
        id: uid(), customerId: cust.id, date: draft.date, shift: draft.shift, category: draft.category, type: draft.type,
        qty: parseFloat(draft.qty) || 0, sampleWeightRaw: String(draft.sampleWeight), sampleWeightKg: normalizeSampleWeight(draft.sampleWeight),
        rate: parseFloat(draft.rate) || 0, amount, note: draft.note, status: draft.status, createdAt: Date.now(),
      };
    }
    await saveTransaction(txn);
    setChatMessages((m) => [...m, { role: "assistant", text: `Saved ✓ ${cust.name} · ₹${amount} · ${STATUS_META[draft.status].label}` }]);
    showToast("Logged via Assistant");
  };

  const sendChatMessage = async (rawText) => {
    const text = (rawText ?? chatInput).trim();
    if (!text || chatLoading) return;
    setChatMessages((m) => [...m, { role: "user", text }]);
    setChatInput("");

    const stmt = tryStatementIntent(text);
    if (stmt) {
      if (stmt.matches.length === 1) {
        openPartyStatement(stmt.matches[0], stmt.range);
        return;
      }
      if (stmt.matches.length > 1) {
        setChatMessages((m) => [...m, { role: "statementPick", candidates: stmt.matches, range: stmt.range }]);
        return;
      }
      setChatMessages((m) => [...m, { role: "assistant", text: "I couldn't find that party by name — check the spelling, or open them from the Parties tab." }]);
      return;
    }

    const local = localQuickAnswer(text);
    if (local) {
      setChatMessages((m) => [...m, { role: "assistant", text: local }]);
      return;
    }

    setChatLoading(true);
    const parsed = await callParseAPI(text);
    setChatLoading(false);

    if (!parsed || parsed.intent !== "log_transaction") {
      setChatMessages((m) => [...m, { role: "assistant", text: "I couldn't quite parse that as an entry. Try e.g. \"bought 10 ltr sample 240 rate 200 from Suresh credit\", \"give me Vinay's statement\", or use a quick action below." }]);
      return;
    }
    const draft = buildDraftFromParsed(parsed);
    setChatMessages((m) => [...m, { role: "confirm", draft }]);
  };

  const openPartyPicker = (flow, then) => {
    setPickPartyFlow(flow);
    setPickPartyThen(then);
    setAssistantView("pickParty");
  };

  const handlePickParty = (customer) => {
    setShowAssistant(false);
    setAssistantView("chat");
    if (pickPartyThen === "money") {
      setDialogCustomer(customer);
      setEditingTxn(null);
      setDialogKind("money");
    } else {
      openNewEntry(customer);
    }
  };

  if (!ready) {
    return (
      <div className="h-full min-h-[600px] flex items-center justify-center bg-[#F7F8F6]">
        <div className="text-slate-400 text-sm">Loading ledger…</div>
      </div>
    );
  }

  if (security.pinEnabled && locked) {
    return (
      <div className="min-h-[700px] bg-[#0f172a] flex flex-col items-center justify-center px-6" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
          <LockKeyhole size={28} className="text-white" />
        </div>
        <div className="text-white text-lg font-semibold mb-1">{businessProfile.businessName || "Milk Ledger"}</div>
        <div className="text-white/50 text-sm mb-6">Enter PIN to unlock</div>
        <input
          type="password"
          inputMode="numeric"
          value={pinEntry}
          onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, "").slice(0, 8))}
          onKeyDown={(e) => { if (e.key === "Enter") attemptUnlock(); }}
          autoFocus
          className="w-40 text-center text-2xl tracking-[0.5em] bg-white/10 text-white rounded-xl py-3 mb-3 outline-none border border-white/20"
          placeholder="••••"
        />
        {pinError && <div className="text-red-400 text-xs mb-3">{pinError}</div>}
        <button onClick={attemptUnlock} className="w-40 py-3 rounded-xl bg-white text-slate-800 font-semibold text-sm">
          Unlock
        </button>
      </div>
    );
  }

  if (invoiceTxn) {
    return (
      <InvoiceView
        txn={invoiceTxn}
        customer={customerById(invoiceTxn.customerId)}
        srNo={srNoMap[invoiceTxn.id]}
        onClose={() => setInvoiceTxn(null)}
      />
    );
  }

  return (
    <div className="min-h-[700px] bg-[#F7F8F6] flex flex-col font-[system-ui]" style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
      {viewingParty ? (
        <>
          <div className="px-5 pt-6 pb-4 text-white rounded-b-2xl print:hidden" style={{ background: FLOW_META[viewingParty.flow].color }}>
            <button onClick={() => setViewingParty(null)} className="flex items-center gap-1.5 text-sm text-white/80 mb-3">
              <ArrowLeft size={15} /> Back
            </button>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[18px] font-bold leading-tight">{viewingParty.name}</div>
                {viewingParty.phone && <div className="text-xs text-white/70 mt-0.5">{viewingParty.phone}</div>}
              </div>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white/15">
                {FLOW_META[viewingParty.flow].label} {FLOW_META[viewingParty.flow].noun}
              </span>
            </div>
          </div>

          <div className="hidden print:block px-1 pt-2 pb-3">
            <div className="text-lg font-bold text-slate-800">{viewingParty.name} — Statement</div>
            <div className="text-xs text-slate-500">
              {viewingParty.phone ? `${viewingParty.phone} · ` : ""}{FLOW_META[viewingParty.flow].label} {FLOW_META[viewingParty.flow].noun}
              {partyStatement.hasFilter ? ` · ${dateFrom || "Start"} to ${dateTo || "Today"}` : ""}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 flex items-center justify-between print:hidden">
              <div className="flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Previous Balance</div>
                {editingBalance ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={balanceInput}
                      onChange={(e) => setBalanceInput(e.target.value)}
                      className="w-28 border border-slate-200 rounded-lg px-2 py-2 text-base outline-none"
                    />
                    <button
                      onClick={saveBalance}
                      className="text-white text-xs font-semibold px-3 py-2 rounded-lg"
                      style={{ background: FLOW_META[viewingParty.flow].color }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-slate-800 mt-0.5">₹{round2(viewingParty.openingBalance || 0)}</div>
                )}
              </div>
              {!editingBalance && (
                <button onClick={() => setEditingBalance(true)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <Pencil size={14} />
                </button>
              )}
            </div>

            <button
              onClick={() => openNewEntry(viewingParty)}
              className="w-full mb-4 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 print:hidden"
              style={{ background: FLOW_META[viewingParty.flow].color }}
            >
              <Plus size={17} /> New Transaction
            </button>

            <div className="flex items-center justify-between mb-2 print:hidden">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Statement</div>
              <button
                onClick={() => setShowDateFilter((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500"
              >
                <Filter size={13} /> {partyStatement.hasFilter ? "Filtered" : "Filter"}
              </button>
            </div>

            {showDateFilter && (
              <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 print:hidden">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-[10px] text-slate-400 mb-1">From</div>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 mb-1">To</div>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none"
                    />
                  </div>
                </div>
                {partyStatement.hasFilter && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="text-xs font-medium text-slate-400 underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {partyStatement.rows.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-3">
                {partyStatement.hasFilter ? "No transactions in this date range — showing balance only." : "No transactions yet — showing opening balance only."}
              </div>
            )}
            <TxnTable
              rows={partyStatement.rows}
              srNoMap={srNoMap}
              showParty={false}
              onInvoice={setInvoiceTxn}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              previousBalance={partyStatement.opening}
              totals={{
                qty: partyStatement.qty,
                amount: partyStatement.amount,
                credit: partyStatement.credit,
                debit: partyStatement.debit,
                balance: partyStatement.balance,
                flowColor: FLOW_META[viewingParty.flow].color,
              }}
            />
            <div className="text-[11px] text-slate-400 mt-2 text-center print:hidden">Scroll sideways to see all columns →</div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <StatCard label="Total Qty" value={`${partyStatement.qty} L`} />
              <StatCard label="Total Amount" value={`₹${partyStatement.amount}`} />
              <StatCard label="Total Credit" value={`₹${partyStatement.credit}`} accent={STATUS_META.credit.color} />
              <StatCard label="Total Debit" value={`₹${partyStatement.debit}`} accent={STATUS_META.debit.color} />
            </div>
            <div className="mt-2">
              <StatCard label="Balance" value={`₹${partyStatement.balance}`} accent={FLOW_META[viewingParty.flow].color} sub="Credit − Debit + Previous Balance" />
            </div>

            {partyStatement.rows.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3 print:hidden">
                <button onClick={exportPartyCSV} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Download size={14} /> CSV
                </button>
                <button onClick={shareStatementPdf} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Printer size={14} /> PDF
                </button>
                <button onClick={shareStatementImage} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <ImageIcon size={14} /> Share as Image
                </button>
                <button onClick={shareStatement} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Share2 size={14} /> Share as Text
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
      <div className="px-5 pt-6 pb-4 bg-[#215464] text-white rounded-b-2xl">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <Droplet size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[17px] font-semibold leading-tight">{businessProfile.businessName || t("appName")}</div>
            <div className="text-[12px] text-white/70 leading-tight">
              Purchase ₹{rates.purchase}/ltr · Sale items from ₹{Math.min(...Object.values(rates.saleItems || DEFAULT_SALE_ITEM_RATES).filter((v) => v > 0))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {tab === "dashboard" && (
          <Dashboard
            dashboard={dashboard}
            transactions={transactions}
            customerById={customerById}
            srNoMap={srNoMap}
            onInvoice={setInvoiceTxn}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            exportCSV={downloadCSV}
            imageBlob={generateTableImageBlob}
            pdfBlob={generateTablePdfBlob}
            shareFile={shareBlobAsFile}
            shareTextBuilder={buildShareText}
            doShare={shareAsText}
            totalsOf={aggregateTotals}
          />
        )}

        {tab === "customers" && (
          <div>
            <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-200/60 p-1 rounded-xl">
              {["purchase", "sale"].map((f) => (
                <button
                  key={f}
                  onClick={() => setCustomerFlow(f)}
                  className={`py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${
                    customerFlow === f ? "bg-white shadow-sm" : "text-slate-500"
                  }`}
                  style={customerFlow === f ? { color: FLOW_META[f].color } : {}}
                >
                  {FLOW_META[f].label} {FLOW_META[f].noun}s
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${FLOW_META[customerFlow].noun.toLowerCase()}…`}
                  enterKeyHint="search"
                  autoComplete="off"
                  className="flex-1 outline-none text-base bg-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddCustomer(true)}
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
                style={{ background: FLOW_META[customerFlow].color }}
              >
                <Plus size={19} />
              </button>
            </div>

            {filteredCustomers.length === 0 && (
              <div className="text-center text-slate-400 text-sm mt-16">
                No {FLOW_META[customerFlow].noun.toLowerCase()}s yet.<br />Tap + to add your first one.
              </div>
            )}

            <div className="flex flex-col gap-2">
              {filteredCustomers.map((c) => {
                const due = transactions
                  .filter((t) => t.customerId === c.id && t.status !== "paid")
                  .reduce((s, t) => s + t.amount, 0);
                return (
                  <button
                    key={c.id}
                    onClick={() => openPartyDetail(c)}
                    className="w-full text-left bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between active:bg-slate-50"
                  >
                    <div>
                      <div className="text-[15px] font-medium text-slate-800">{c.name}</div>
                      {c.phone && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {c.phone}
                        </div>
                      )}
                      {due > 0 && (
                        <div className="text-xs text-[#b3391f] font-medium mt-0.5">₹{round2(due)} due</div>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div>
            <div className="hidden print:block px-1 pt-1 pb-3">
              <div className="text-lg font-bold text-slate-800">Milk Ledger — Transaction History</div>
              <div className="text-xs text-slate-500">
                {historyFlowFilter === "all" ? "All parties" : `${FLOW_META[historyFlowFilter].label}s`}
                {historyFilter !== "all" ? ` · ${customerById(historyFilter)?.name}` : ""} · Generated {fmtDate(todayStr())}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2 print:hidden">
              {["all", "purchase", "sale"].map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFlowFilter(f)}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    historyFlowFilter === f ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-500"
                  }`}
                  style={historyFlowFilter === f ? { background: f === "all" ? "#334155" : FLOW_META[f].color } : {}}
                >
                  {f === "all" ? "All" : `${FLOW_META[f].label}s`}
                </button>
              ))}
            </div>

            <select
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              className="w-full mb-3 bg-white border border-slate-200 rounded-xl px-3 py-3 text-base outline-none print:hidden"
            >
              <option value="all">All parties</option>
              {customers
                .filter((c) => historyFlowFilter === "all" || c.flow === historyFlowFilter)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({FLOW_META[c.flow].label})</option>
                ))}
            </select>

            {historyList.length === 0 && (
              <div className="text-center text-slate-400 text-sm mt-16">No transactions yet.</div>
            )}

            {historyList.length > 0 && (
              <TxnTable
                rows={historyRows}
                srNoMap={srNoMap}
                showParty
                onInvoice={setInvoiceTxn}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            )}
            {historyList.length > 0 && (
              <>
                <div className="text-[11px] text-slate-400 mt-2 text-center print:hidden">Scroll sideways to see all columns →</div>
                <div className="grid grid-cols-2 gap-2 mt-3 print:hidden">
                  <button onClick={exportHistoryCSV} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Download size={14} /> CSV
                  </button>
                  <button onClick={shareHistoryPdf} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Printer size={14} /> PDF
                  </button>
                  <button onClick={shareHistoryImage} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <ImageIcon size={14} /> Share as Image
                  </button>
                  <button onClick={shareHistoryText} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Share2 size={14} /> Share as Text
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "account" && (
          <div>
            {accountView === "menu" && (
              <div className="flex flex-col gap-2">
                {[
                  { key: "profile", icon: Building2, label: t("businessProfile"), sub: businessProfile.businessName || "Not set", color: "#215464" },
                  { key: "rates", icon: SettingsIcon, label: t("ratesAndData"), sub: "Purchase & sale rates, demo data", color: "#215464" },
                  { key: "backup", icon: CloudUpload, label: t("backupRestore"), sub: autoBackup.lastBackupAt ? `Last backup ${fmtDate(new Date(autoBackup.lastBackupAt).toISOString().slice(0, 10))}` : "No backup yet", color: "#1b7a5e" },
                  { key: "security", icon: LockKeyhole, label: t("security"), sub: security.pinEnabled ? "PIN lock on" : "No lock set", color: "#a1690a" },
                  { key: "language", icon: Languages, label: t("language"), sub: LANGUAGES.find((l) => l.code === lang)?.label, color: "#6b4fa0" },
                  { key: "activity", icon: ScrollText, label: t("activityLog"), sub: `${activityLog.length} events logged`, color: "#334155" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setAccountView(item.key)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-3 text-left active:bg-slate-50"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: item.color + "1A" }}>
                      <item.icon size={18} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                      <div className="text-xs text-slate-400 truncate">{item.sub}</div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {accountView === "profile" && (
              <div>
                <button onClick={() => setAccountView("menu")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="text-base font-semibold text-slate-800 mb-3">{t("businessProfile")}</div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                  <Field label="Business Name">
                    <input
                      value={profileInputs.businessName}
                      onChange={(e) => setProfileInputs((p) => ({ ...p, businessName: e.target.value }))}
                      placeholder="e.g. Shree Krishna Dairy"
                      className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                    />
                  </Field>
                  <Field label="Owner / Manager Name">
                    <input
                      value={profileInputs.ownerName}
                      onChange={(e) => setProfileInputs((p) => ({ ...p, ownerName: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={profileInputs.phone}
                      onChange={(e) => setProfileInputs((p) => ({ ...p, phone: e.target.value }))}
                      inputMode="tel"
                      className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                    />
                  </Field>
                  <Field label="Address">
                    <input
                      value={profileInputs.address}
                      onChange={(e) => setProfileInputs((p) => ({ ...p, address: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                    />
                  </Field>
                  <Field label="Registration / GST No. (optional)">
                    <input
                      value={profileInputs.regNo}
                      onChange={(e) => setProfileInputs((p) => ({ ...p, regNo: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                    />
                  </Field>
                  <button onClick={saveBusinessProfile} className="w-full py-3 rounded-xl bg-[#215464] text-white text-sm font-semibold">
                    {t("save")} Profile
                  </button>
                </div>
              </div>
            )}

            {accountView === "rates" && (
              <div>
                <button onClick={() => setAccountView("menu")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="text-base font-semibold text-slate-800 mb-3">{t("ratesAndData")}</div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                    Purchase Rates by Type (₹ / ltr basis)
                  </div>

                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Fresh</div>
                  <div className="flex flex-col gap-2 mb-3">
                    {["Buffalo", "Cow"].map((type) => (
                      <div key={type} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">{type}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          enterKeyHint="done"
                          value={purchaseMatrixInputs.Fresh[type]}
                          onChange={(e) => setPurchaseMatrixInputs((m) => ({ ...m, Fresh: { ...m.Fresh, [type]: e.target.value } }))}
                          className="w-24 border border-slate-200 rounded-lg px-2.5 py-2 text-base outline-none focus:border-slate-400 text-right"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Kachcha</div>
                  <div className="flex flex-col gap-2 mb-3">
                    {["Buffalo", "Cow", "Goat"].map((type) => (
                      <div key={type} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">{type}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          enterKeyHint="done"
                          value={purchaseMatrixInputs.Kachcha[type]}
                          onChange={(e) => setPurchaseMatrixInputs((m) => ({ ...m, Kachcha: { ...m.Kachcha, [type]: e.target.value } }))}
                          className="w-24 border border-slate-200 rounded-lg px-2.5 py-2 text-base outline-none focus:border-slate-400 text-right"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={savePurchaseMatrix}
                    className="w-full py-2.5 rounded-lg text-white text-sm font-semibold"
                    style={{ background: FLOW_META.purchase.color }}
                  >
                    Save Purchase Rates
                  </button>
                  <div className="text-xs text-slate-400 mt-2">
                    Selecting a Category + Type in a purchase entry auto-fills the rate from this table — still editable per-entry.
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Fallback Rate (₹ / ltr basis)
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={rateInputs.purchase}
                    onChange={(e) => setRateInputs((r) => ({ ...r, purchase: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                  />
                  <div className="text-xs text-slate-400 mt-1.5 mb-3">Used for Goat/Other combos not covered by the table above.</div>
                  <button
                    onClick={savePurchaseRate}
                    className="w-full py-2.5 rounded-lg bg-[#215464] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    {savingRate ? <Check size={16} /> : "Save Fallback Rate"}
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                    Sale Item Rates (₹ default per unit)
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {SALE_ITEMS.filter((i) => i.key !== "other").map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">{item.label}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          enterKeyHint="done"
                          value={saleItemRateInputs[item.key]}
                          onChange={(e) => setSaleItemRateInputs((r) => ({ ...r, [item.key]: e.target.value }))}
                          className="w-24 border border-slate-200 rounded-lg px-2.5 py-2 text-base outline-none focus:border-slate-400 text-right"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={saveSaleItemRates}
                    className="w-full mt-3 py-2.5 rounded-lg text-white text-sm font-semibold"
                    style={{ background: FLOW_META.sale.color }}
                  >
                    Save Item Rates
                  </button>
                  <div className="text-xs text-slate-400 mt-2">
                    "Other" has no fixed rate — you'll name the item and set qty/rate at entry time.
                  </div>
                </div>

                <div className="text-center text-[11px] text-slate-300 mt-6">
                  Purchase: Amount = Qty × Sample Weight (kg) × Rate. Sale items: Amount = Qty × Rate. Rates stay editable per-entry too.
                </div>

                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4 mt-6">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Demo Data</div>
                  <div className="text-xs text-slate-400 mb-3">
                    Adds 5 purchase suppliers + 5 sale customers, 10 transactions each, spread across this month. Useful for trying the app out — doesn't touch your existing parties or entries.
                  </div>
                  <button
                    onClick={() => setShowSeedConfirm(true)}
                    className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold"
                  >
                    Load Demo Data
                  </button>
                </div>
              </div>
            )}

            {accountView === "backup" && (
              <div>
                <button onClick={() => setAccountView("menu")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="text-base font-semibold text-slate-800 mb-3">{t("backupRestore")}</div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Manual Backup</div>
                  <div className="text-xs text-slate-400 mb-3">
                    Creates a full backup file (parties, transactions, rates, profile) and opens your device's share menu — pick Google Drive, OneDrive, email, or Save to keep it locally. There's no direct Drive/OneDrive login here, this just hands the file to whatever your share menu offers.
                  </div>
                  {autoBackup.lastBackupAt && (
                    <div className="text-xs text-slate-500 mb-3">
                      Last backup: {fmtDate(new Date(autoBackup.lastBackupAt).toISOString().slice(0, 10))} · {fmtTime(autoBackup.lastBackupAt)}
                    </div>
                  )}
                  <button
                    onClick={downloadBackupFile}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: "#1b7a5e" }}
                  >
                    <CloudUpload size={16} /> Backup Now
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Restore from Backup</div>
                  <div className="text-xs text-slate-400 mb-3">
                    Choose a previously saved backup .json file. This replaces your current parties, transactions, and rates — you'll be asked to confirm first.
                  </div>
                  {restoreError && <div className="text-xs text-red-500 mb-2">{restoreError}</div>}
                  <input ref={fileInputRef} type="file" accept="application/json" onChange={handleRestoreFile} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <CloudDownload size={16} /> Choose Backup File
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">Auto-Backup</div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="pr-3">
                      <div className="text-sm text-slate-700 font-medium">Snapshot on every entry</div>
                      <div className="text-xs text-slate-400">Keeps a fresh local backup file ready after each save</div>
                    </div>
                    <button
                      onClick={() => saveAutoBackupSettings({ onEveryEntry: !autoBackup.onEveryEntry })}
                      className="w-11 h-6 rounded-full relative shrink-0"
                      style={{ background: autoBackup.onEveryEntry ? "#1b7a5e" : "#e2e8f0" }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: autoBackup.onEveryEntry ? 22 : 2 }} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="pr-3">
                      <div className="text-sm text-slate-700 font-medium">Scheduled backup reminder</div>
                      <div className="text-xs text-slate-400">Nudges you at this time if you haven't backed up yet today</div>
                    </div>
                    <button
                      onClick={() => saveAutoBackupSettings({ scheduled: !autoBackup.scheduled })}
                      className="w-11 h-6 rounded-full relative shrink-0"
                      style={{ background: autoBackup.scheduled ? "#1b7a5e" : "#e2e8f0" }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: autoBackup.scheduled ? 22 : 2 }} />
                    </button>
                  </div>
                  {autoBackup.scheduled && (
                    <input
                      type="time"
                      value={autoBackup.scheduledTime}
                      onChange={(e) => saveAutoBackupSettings({ scheduledTime: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base outline-none mt-2"
                    />
                  )}
                </div>
              </div>
            )}

            {accountView === "security" && (
              <div>
                <button onClick={() => setAccountView("menu")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="text-base font-semibold text-slate-800 mb-3">{t("security")}</div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">PIN Lock</div>
                  <div className="text-xs text-slate-400 mb-3">
                    Locks the app behind a PIN, stored only as a secure hash on this device. This is a local device lock — there's no backend here for a real server-verified login (JWT), so this is the practical equivalent.
                  </div>

                  {!security.pinEnabled && pinSetupStep === null && (
                    <button onClick={startSetPin} className="w-full py-3 rounded-xl text-white text-sm font-semibold" style={{ background: "#215464" }}>
                      Set a PIN
                    </button>
                  )}

                  {pinSetupStep === "new" && (
                    <div>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinNew}
                        onChange={(e) => setPinNew(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="Enter new PIN (4–8 digits)"
                        className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none mb-2 text-center tracking-[0.3em]"
                      />
                      {pinError && <div className="text-xs text-red-500 mb-2">{pinError}</div>}
                      <button onClick={submitNewPin} className="w-full py-3 rounded-xl text-white text-sm font-semibold" style={{ background: "#215464" }}>
                        Continue
                      </button>
                    </div>
                  )}

                  {pinSetupStep === "confirm" && (
                    <div>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="Confirm PIN"
                        className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none mb-2 text-center tracking-[0.3em]"
                      />
                      {pinError && <div className="text-xs text-red-500 mb-2">{pinError}</div>}
                      <button onClick={submitConfirmPin} className="w-full py-3 rounded-xl text-white text-sm font-semibold" style={{ background: "#215464" }}>
                        Confirm &amp; Enable
                      </button>
                    </div>
                  )}

                  {security.pinEnabled && pinSetupStep === null && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-emerald-700 font-medium flex items-center gap-1.5">
                        <Check size={14} /> PIN lock is on
                      </div>
                      <div className="flex gap-2">
                        <button onClick={startSetPin} className="text-xs font-semibold text-slate-500 px-3 py-2 rounded-lg bg-slate-100">Change</button>
                        <button onClick={removePin} className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ color: STATUS_META.debit.color, background: STATUS_META.debit.bg }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Biometric Unlock</div>
                  <div className="text-xs text-slate-400 mb-3">
                    Full fingerprint/face unlock needs a native app shell to work reliably — inside this web preview it can only check whether your device reports biometric hardware. PIN above is what actually locks the app here.
                  </div>
                  <button onClick={checkBiometricAvailability} className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold flex items-center justify-center gap-1.5">
                    <Fingerprint size={16} /> Check Biometric Support
                  </button>
                  {biometricAvailable !== null && (
                    <div className={`text-xs mt-2 text-center ${biometricAvailable ? "text-emerald-600" : "text-slate-400"}`}>
                      {biometricAvailable ? "✓ This device reports biometric hardware is available" : "No biometric hardware detected / not supported here"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {accountView === "language" && (
              <div>
                <button onClick={() => setAccountView("menu")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="text-base font-semibold text-slate-800 mb-3">{t("language")}</div>
                <div className="flex flex-col gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => changeLanguage(l.code)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${lang === l.code ? "border-[#215464]" : "border-slate-200 bg-white"}`}
                      style={lang === l.code ? { background: "#21546410" } : {}}
                    >
                      <span className="text-sm font-medium text-slate-800">{l.label}</span>
                      {lang === l.code && <Check size={16} className="text-[#215464]" />}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-3">
                  Translates the main navigation and common actions. Deeper translation of every dialog is a larger follow-up if you'd like it.
                </div>
              </div>
            )}

            {accountView === "activity" && (
              <div>
                <button onClick={() => setAccountView("menu")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                  <ArrowLeft size={14} /> {t("back")}
                </button>
                <div className="text-base font-semibold text-slate-800 mb-3">{t("activityLog")}</div>
                {activityLog.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-10">No activity recorded yet.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activityLog.map((entry) => (
                      <div key={entry.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{entry.type}</span>
                          <span className="text-[11px] text-slate-400">{fmtDate(new Date(entry.ts).toISOString().slice(0, 10))} · {fmtTime(entry.ts)}</span>
                        </div>
                        <div className="text-sm text-slate-700">{entry.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 rounded-b-2xl">
        {[
          { id: "dashboard", icon: LayoutDashboard, label: t("navDashboard") },
          { id: "customers", icon: Users, label: t("navParties") },
          { id: "history", icon: History, label: t("navHistory") },
          { id: "account", icon: UserCircle2, label: t("navAccount") },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)} className="flex flex-col items-center gap-0.5 px-3 py-1">
            <Icon size={19} color={tab === id ? "#215464" : "#94a3b8"} strokeWidth={tab === id ? 2.4 : 2} />
            <span className={`text-[10px] ${tab === id ? "text-[#215464] font-semibold" : "text-slate-400"}`}>{label}</span>
          </button>
        ))}
      </div>
        </>
      )}

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 bg-slate-900 text-white text-xs px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {showAddCustomer && (
        <Modal
          onClose={() => setShowAddCustomer(false)}
          title={`Add ${FLOW_META[customerFlow].noun}`}
          footer={
            <button
              onClick={addCustomer}
              disabled={!newCustomerName.trim()}
              className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-40"
              style={{ background: FLOW_META[customerFlow].color }}
            >
              Add {FLOW_META[customerFlow].noun}
            </button>
          }
        >
          <div className="pb-4">
            <Field label="This party is a">
              <PillGroup
                options={["purchase", "sale"]}
                value={customerFlow}
                onChange={setCustomerFlow}
                columns={2}
              />
              <div className="text-xs text-slate-400 mt-1.5">
                Purchase = you buy milk from them · Sale = you sell milk to them
              </div>
            </Field>
            <Field label="Name">
              <input
                autoFocus
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                enterKeyHint="next"
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="e.g. 98765 43210"
                inputMode="tel"
                enterKeyHint="done"
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
              />
            </Field>
            <Field label="Opening Balance (optional)" hint="Any balance already outstanding before you started using this app">
              <input
                value={newCustomerOpeningBalance}
                onChange={(e) => setNewCustomerOpeningBalance(e.target.value)}
                type="number"
                inputMode="decimal"
                enterKeyHint="done"
                className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Milk/Sales vs Money chooser — shown once a party is picked for a new entry */}
      {dialogCustomer && !dialogKind && (
        <Modal title="New Transaction" onClose={closeDialog}>
          <div className="pb-2 flex flex-col gap-3">
            <button
              onClick={() => setDialogKind("milk")}
              className="p-4 rounded-xl border border-slate-200 flex items-center gap-3 text-left active:bg-slate-50"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: FLOW_META[dialogCustomer.flow].color + "1A" }}
              >
                {dialogCustomer.flow === "sale" ? (
                  <ShoppingBag size={18} style={{ color: FLOW_META[dialogCustomer.flow].color }} />
                ) : (
                  <Droplet size={18} style={{ color: FLOW_META[dialogCustomer.flow].color }} />
                )}
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">
                  {dialogCustomer.flow === "sale" ? "Sales Transaction" : "Milk Transaction"}
                </div>
                <div className="text-xs text-slate-400">
                  {dialogCustomer.flow === "sale"
                    ? "Pick item, qty & rate"
                    : "Shift, item, type, qty, sample weight & rate"}
                </div>
              </div>
            </button>
            <button
              onClick={() => setDialogKind("money")}
              className="p-4 rounded-xl border border-slate-200 flex items-center gap-3 text-left active:bg-slate-50"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Wallet size={18} className="text-slate-500" />
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">Money Transaction</div>
                <div className="text-xs text-slate-400">Just a date, amount &amp; note — payment or adjustment</div>
              </div>
            </button>
          </div>
        </Modal>
      )}

      {dialogCustomer && dialogKind === "milk" && dialogCustomer.flow === "purchase" && (
        <EntryDialog
          customer={dialogCustomer}
          defaultRate={rates.purchase}
          rateMatrix={rates.purchaseMatrix}
          existing={editingTxn}
          onClose={closeDialog}
          onSave={handleSaveTxn}
        />
      )}

      {dialogCustomer && dialogKind === "milk" && dialogCustomer.flow === "sale" && (
        <SalesDialog
          customer={dialogCustomer}
          defaultRates={rates.saleItems}
          existing={editingTxn}
          onClose={closeDialog}
          onSave={handleSaveTxn}
        />
      )}

      {dialogCustomer && dialogKind === "money" && (
        <MoneyDialog
          customer={dialogCustomer}
          existing={editingTxn}
          onClose={closeDialog}
          onSave={handleSaveTxn}
          onSetOpeningBalance={updateCustomerBalance}
        />
      )}

      {deleteTarget && (
        <Modal title="Delete Transaction?" onClose={() => setDeleteTarget(null)}>
          <div className="pb-2">
            <p className="text-sm text-slate-600 mb-4">
              This will permanently remove the ₹{round2(deleteTarget.amount)} entry for{" "}
              <span className="font-semibold">{customerById(deleteTarget.customerId)?.name}</span> on {fmtDate(deleteTarget.date)}. This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTransaction(deleteTarget.id)}
                className="py-3 rounded-xl text-white text-sm font-semibold"
                style={{ background: STATUS_META.debit.color }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSeedConfirm && (
        <Modal title="Load Demo Data?" onClose={() => setShowSeedConfirm(false)}>
          <div className="pb-2">
            <p className="text-sm text-slate-600 mb-4">
              This adds <span className="font-semibold">10 new parties</span> (5 purchase, 5 sale) and{" "}
              <span className="font-semibold">100 transactions</span> dated across this month, on top of whatever you already have. It won't modify or delete anything existing.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowSeedConfirm(false)}
                className="py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={seedDemoData}
                className="py-3 rounded-xl text-white text-sm font-semibold"
                style={{ background: "#215464" }}
              >
                Load Data
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingRestore && (
        <Modal title="Restore This Backup?" onClose={() => setPendingRestore(null)}>
          <div className="pb-2">
            <p className="text-sm text-slate-600 mb-4">
              This backup has <span className="font-semibold">{pendingRestore.customers?.length || 0} parties</span> and{" "}
              <span className="font-semibold">{pendingRestore.transactions?.length || 0} transactions</span>
              {pendingRestore.exportedAt ? ` from ${fmtDate(pendingRestore.exportedAt.slice(0, 10))}` : ""}. Restoring will{" "}
              <span className="font-semibold">replace</span> your current parties, transactions, and rates. This can't be undone — consider taking a fresh backup first if unsure.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPendingRestore(null)}
                className="py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="py-3 rounded-xl text-white text-sm font-semibold"
                style={{ background: STATUS_META.debit.color }}
              >
                Restore
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Floating Assistant button — hidden while any other dialog/sheet is open */}
      {shareSheet && (
        <ShareSheet title={shareSheet.title} text={shareSheet.text} onClose={() => setShareSheet(null)} />
      )}

      {!showAssistant && !dialogCustomer && !showAddCustomer && !deleteTarget && !invoiceTxn && !showSeedConfirm && !shareSheet && (
        <button
          onClick={() => { setShowAssistant(true); setAssistantView("chat"); }}
          className="absolute z-10 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
          style={{ right: 16, bottom: viewingParty ? 24 : 76, background: "#215464" }}
        >
          <MessageCircle size={24} />
        </button>
      )}

      {showAssistant && (
        <Modal
          title={
            <span className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-[#215464]" /> Assistant
            </span>
          }
          onClose={() => { setShowAssistant(false); setAssistantView("chat"); }}
          footer={
            assistantView === "chat" ? (
              <div className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }}
                  placeholder="Type or tap a quick action…"
                  enterKeyHint="send"
                  autoComplete="off"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
                />
                <button
                  onClick={() => sendChatMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-11 h-11 rounded-lg bg-[#215464] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
                >
                  {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
            ) : null
          }
        >
          {assistantView === "pickParty" ? (
            <div className="pb-4">
              <button onClick={() => setAssistantView("chat")} className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                <ArrowLeft size={14} /> Back
              </button>
              <div className="text-xs text-slate-400 mb-2">
                Pick a {FLOW_META[pickPartyFlow].noun.toLowerCase()} for {pickPartyThen === "money" ? "a money entry" : "a new entry"}:
              </div>
              <div className="flex flex-col gap-2">
                {customers.filter((c) => c.flow === pickPartyFlow).length === 0 && (
                  <div className="text-center text-slate-400 text-sm py-6">No {FLOW_META[pickPartyFlow].noun.toLowerCase()}s yet — add one from the Parties tab first.</div>
                )}
                {customers.filter((c) => c.flow === pickPartyFlow).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handlePickParty(c)}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between active:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800 text-sm">{c.name}</span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => openPartyPicker("purchase", "milk")} className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: FLOW_META.purchase.color + "1A", color: FLOW_META.purchase.color }}>
                  <Droplet size={14} /> Log Purchase
                </button>
                <button onClick={() => openPartyPicker("sale", "milk")} className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: FLOW_META.sale.color + "1A", color: FLOW_META.sale.color }}>
                  <ShoppingBag size={14} /> Log Sale
                </button>
                <button onClick={() => sendChatMessage("today's summary")} className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600">
                  <LayoutDashboard size={14} /> Today's Summary
                </button>
                <button onClick={() => sendChatMessage("outstanding dues")} className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600">
                  <Wallet size={14} /> Outstanding Dues
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {chatMessages.map((m, i) =>
                  m.role === "confirm" ? (
                    <DraftConfirmCard key={i} draft={m.draft} customers={customers} onPickCustomer={(id) => setChatMessages((msgs) => msgs.map((mm, ii) => (ii === i ? { ...mm, draft: { ...mm.draft, customerId: id } } : mm)))} onChange={(patch) => setChatMessages((msgs) => msgs.map((mm, ii) => (ii === i ? { ...mm, draft: { ...mm.draft, ...patch } } : mm)))} onConfirm={() => confirmDraft(m.draft)} />
                  ) : m.role === "statementPick" ? (
                    <div key={i} className="self-start w-full max-w-full bg-white border border-slate-200 rounded-2xl p-3.5">
                      <div className="text-xs text-slate-500 mb-2">Which one did you mean?</div>
                      <div className="flex flex-col gap-1.5">
                        {m.candidates.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => openPartyStatement(c, m.range)}
                            className="flex items-center justify-between text-left px-3 py-2 rounded-lg border border-slate-200 active:bg-slate-50"
                          >
                            <span className="text-sm font-medium text-slate-800">{c.name}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: FLOW_META[c.flow].color, background: FLOW_META[c.flow].color + "1A" }}>
                              {FLOW_META[c.flow].label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line ${m.role === "user" ? "self-end bg-[#215464] text-white rounded-br-sm" : "self-start bg-slate-100 text-slate-700 rounded-bl-sm"}`}>
                      {m.text}
                    </div>
                  )
                )}
                {chatLoading && (
                  <div className="self-start bg-slate-100 text-slate-400 px-3.5 py-2.5 rounded-2xl text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Thinking…
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ dashboard, transactions, customerById, srNoMap, onInvoice, onEdit, onDelete, exportCSV, imageBlob, pdfBlob, shareFile, shareTextBuilder, doShare, totalsOf }) {
  const { todayPurchase, todaySale, byStatus, days, topDebtors, outstanding, netToday } = dashboard;
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());

  const dateRows = useMemo(() => {
    return transactions
      .filter((t) => t.date >= dateFrom && t.date <= dateTo)
      .map((t) => ({ ...t, flow: customerById(t.customerId)?.flow || "purchase", customerName: customerById(t.customerId)?.name }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [transactions, dateFrom, dateTo, customerById]);

  const rangeLabel = dateFrom === dateTo ? fmtDate(dateFrom) : `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;
  const rangeTag = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;

  const exportDateCSV = () => exportCSV(dateRows, `milk_ledger_${rangeTag}.csv`, { totals: totalsOf(dateRows) });

  const shareDateImage = async () => {
    const blob = await imageBlob(dateRows, {
      title: "Milk Ledger — Transactions",
      subtitle: rangeLabel,
      showParty: true,
      totals: totalsOf(dateRows),
      flowColorHex: "#334155",
    });
    await shareFile(blob, `milk_ledger_${rangeTag}.jpg`, "Milk Ledger — Transactions");
  };

  const shareDatePdf = async () => {
    const blob = pdfBlob(dateRows, {
      title: "Milk Ledger - Transactions",
      subtitle: rangeLabel,
      showParty: true,
      totals: totalsOf(dateRows),
    });
    await shareFile(blob, `milk_ledger_${rangeTag}.pdf`, "Milk Ledger - Transactions");
  };

  const shareDateText = () => {
    const text = shareTextBuilder("Milk Ledger — Transactions", rangeLabel, totalsOf(dateRows));
    doShare("Milk Ledger — Transactions", text);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <StatCard label="Today's Purchase" value={`${todayPurchase.ltr} L`} sub={`₹${todayPurchase.amt} · ${todayPurchase.count} entries`} accent={FLOW_META.purchase.color} />
        <StatCard label="Today's Sale" value={`${todaySale.ltr} L`} sub={`₹${todaySale.amt} · ${todaySale.count} entries`} accent={FLOW_META.sale.color} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Today's Net (Sale − Purchase)</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rough margin indicator, not full P&amp;L</div>
        </div>
        <div className={`text-xl font-bold ${netToday >= 0 ? "text-[#1b7a5e]" : "text-[#b3391f]"}`}>
          {netToday >= 0 ? "+" : ""}₹{netToday}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last 7 Days (₹)</div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FLOW_META.purchase.color }} />Purchase</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FLOW_META.sale.color }} />Sale</span>
          </div>
        </div>
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer>
            <BarChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v, n) => [`₹${v}`, n === "purchase" ? "Purchase" : "Sale"]} />
              <Bar dataKey="purchase" fill={FLOW_META.purchase.color} radius={[4, 4, 0, 0]} />
              <Bar dataKey="sale" fill={FLOW_META.sale.color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div key={key} className="rounded-xl p-3" style={{ background: meta.bg }}>
            <div className="text-[11px] font-medium" style={{ color: meta.color }}>{meta.label}</div>
            <div className="text-[15px] font-bold mt-0.5" style={{ color: meta.color }}>₹{round2(byStatus[key] || 0)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Outstanding Dues</div>
          <div className="text-sm font-bold text-[#b3391f]">₹{round2(outstanding)}</div>
        </div>
        {topDebtors.length === 0 ? (
          <div className="text-xs text-slate-400">No dues outstanding. 🎉</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {topDebtors.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 flex items-center gap-1.5">
                  {d.name}
                  <span className="text-[10px] font-medium px-1.5 rounded" style={{ color: FLOW_META[d.flow].color, background: FLOW_META[d.flow].color + "1A" }}>
                    {FLOW_META[d.flow].label}
                  </span>
                </span>
                <span className="font-medium text-slate-800">₹{round2(d.amt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="hidden print:block mb-2">
          <div className="text-lg font-bold text-slate-800">Milk Ledger — Transactions</div>
          <div className="text-xs text-slate-500">{rangeLabel} · Generated {fmtDate(todayStr())}</div>
        </div>
        <div className="flex items-center justify-between mb-2 print:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Transactions</div>
          <div className="flex items-center gap-1">
            {[
              { label: "Today", from: todayStr(), to: todayStr() },
              { label: "7d", from: toISODate(new Date(Date.now() - 6 * 86400000)), to: todayStr() },
              { label: "Month", from: `${todayStr().slice(0, 7)}-01`, to: todayStr() },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => { setDateFrom(q.from); setDateTo(q.to); }}
                className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-500"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2 print:hidden">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <CalendarDays size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs outline-none bg-transparent w-full"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <CalendarDays size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs outline-none bg-transparent w-full"
            />
          </div>
        </div>
        {dateRows.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8 bg-white rounded-xl border border-slate-200">
            No transactions in this range.
          </div>
        ) : (
          <>
            <TxnTable rows={dateRows} srNoMap={srNoMap} showParty onInvoice={onInvoice} onEdit={onEdit} onDelete={onDelete} />
            <div className="text-[11px] text-slate-400 mt-2 text-center">Scroll sideways to see all columns →</div>
            <div className="grid grid-cols-2 gap-2 mt-3 print:hidden">
              <button onClick={exportDateCSV} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                <Download size={14} /> CSV
              </button>
              <button onClick={shareDatePdf} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                <Printer size={14} /> PDF
              </button>
              <button onClick={shareDateImage} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                <ImageIcon size={14} /> Share as Image
              </button>
              <button onClick={shareDateText} className="py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                <Share2 size={14} /> Share as Text
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const StatCard = ({ label, value, sub, accent }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
    <div className="text-[11px] font-medium text-slate-400">{label}</div>
    <div className="text-[20px] font-bold mt-0.5" style={{ color: accent || "#1e293b" }}>{value}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
  </div>
);

// ---------- Assistant draft confirmation card ----------
// Renders a parsed (from natural-language input) transaction so the user can
// fix it with taps instead of retyping, then save with one button.
function DraftConfirmCard({ draft, customers, onPickCustomer, onChange, onConfirm }) {
  const flowMeta = FLOW_META[draft.flow];
  const customer = customers.find((c) => c.id === draft.customerId);
  const amount =
    draft.kind === "money"
      ? round2(parseFloat(draft.amount) || 0)
      : draft.kind === "item"
      ? round2((parseFloat(draft.qty) || 0) * (parseFloat(draft.rate) || 0))
      : round2((parseFloat(draft.qty) || 0) * normalizeSampleWeight(draft.sampleWeight) * (parseFloat(draft.rate) || 0));
  const statusOptions = draft.kind === "money" ? ["credit", "debit"] : ["paid", "credit", "debit"];

  return (
    <div className="self-start w-full max-w-full bg-white border border-slate-200 rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: flowMeta.color, background: flowMeta.color + "1A" }}>
          {flowMeta.label}
        </span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
          {draft.kind === "money" ? "Money" : draft.kind === "item" ? "Sale Item" : "Milk"}
        </span>
      </div>

      {!customer ? (
        <div className="mb-3">
          <div className="text-xs text-slate-500 mb-1.5">
            {draft.customerNameGuess ? `Which party matches "${draft.customerNameGuess}"?` : "Which party is this for?"}
          </div>
          {draft.candidates && draft.candidates.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {draft.candidates.map((c) => (
                <button key={c.id} onClick={() => onPickCustomer(c.id)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50">
                  {c.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-600">No match found — add this party from the Parties tab first, then try again.</div>
          )}
        </div>
      ) : (
        <div className="text-sm font-semibold text-slate-800 mb-2">{customer.name}</div>
      )}

      <div className="text-xs text-slate-500 mb-2">
        {fmtDate(draft.date)}
        {draft.kind === "milk" && ` · ${draft.shift} · ${draft.category} · ${draft.type}`}
        {draft.kind === "item" && ` · ${draft.itemKey === "other" ? draft.itemName || "Other" : SALE_ITEMS.find((i) => i.key === draft.itemKey)?.label}`}
      </div>

      {draft.kind !== "money" ? (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            inputMode="decimal"
            value={draft.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
            placeholder="Qty"
            className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none"
          />
          <input
            type="number"
            inputMode="decimal"
            value={draft.rate}
            onChange={(e) => onChange({ rate: e.target.value })}
            placeholder="Rate"
            className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none"
          />
        </div>
      ) : (
        <input
          type="number"
          inputMode="decimal"
          value={draft.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          placeholder="Amount"
          className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none mb-2"
        />
      )}

      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 mb-3">
        <span className="text-xs text-slate-500">Amount</span>
        <span className="text-sm font-bold text-slate-800">₹{amount}</span>
      </div>

      <div className={`grid gap-1.5 mb-3`} style={{ gridTemplateColumns: `repeat(${statusOptions.length}, minmax(0,1fr))` }}>
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => onChange({ status: s })}
            className={`py-2 rounded-lg text-xs font-semibold ${draft.status === s ? "text-white" : "bg-slate-100 text-slate-500"}`}
            style={draft.status === s ? { background: STATUS_META[s].color } : {}}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={!customer}
        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: flowMeta.color }}
      >
        Confirm &amp; Save
      </button>
    </div>
  );
}

// ---------- Shared transaction table ----------
// Used by History, Dashboard's date view, and a party's Statement.
// Money transactions (kind === "money") show dashes for the milk-only columns.
function TxnTable({ rows, srNoMap, showParty, onInvoice, onEdit, onDelete, previousBalance, totals }) {
  const hasStatementRows = previousBalance != null;
  if (rows.length === 0 && !hasStatementRows) {
    return <div className="text-center text-slate-400 text-sm py-10 bg-white rounded-xl border border-slate-200">No transactions.</div>;
  }
  const headers = showParty
    ? ["Sr No", "Date / Time", "Party", "Shift", "Item", "Type", "Qty", "Rate", "Amount", "Status", "Credit", "Debit", "Note", "Action"]
    : ["Sr No", "Date / Time", "Shift", "Item", "Type", "Qty", "Rate", "Amount", "Status", "Credit", "Debit", "Note", "Action"];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className={`text-[12px] border-collapse ${showParty ? "min-w-[900px]" : "min-w-[800px]"}`}>
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-left">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previousBalance != null && !showParty && (
            <tr className="bg-slate-50/70 border-b border-slate-100">
              <td colSpan={7} className="px-3 py-2 text-slate-500 font-medium whitespace-nowrap">Previous Balance</td>
              <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">₹{previousBalance}</td>
              <td colSpan={5}></td>
            </tr>
          )}
          {rows.map((t) => {
            const meta = STATUS_META[t.status];
            const flowMeta = FLOW_META[t.flow] || FLOW_META.purchase;
            const isMoney = t.kind === "money";
            const isItem = t.kind === "item";
            return (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{srNoMap[t.id]}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="text-slate-700">{fmtDate(t.date)}</div>
                  <div className="text-slate-400 text-[11px]">{fmtTime(t.createdAt)}</div>
                </td>
                {showParty && (
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-medium text-slate-800">{t.customerName || "Unknown"}</div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ color: flowMeta.color, background: flowMeta.color + "1A" }}
                    >
                      {flowMeta.label}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{isMoney ? "—" : t.shift || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {isMoney ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Money</span>
                  ) : isItem ? (
                    t.itemName
                  ) : (
                    t.category
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{isMoney || isItem ? "—" : t.type}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{isMoney ? "—" : t.qty}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{isMoney ? "—" : `₹${t.rate}`}</td>
                <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">₹{round2(t.amount)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: STATUS_META.credit.color }}>
                  {t.status === "credit" ? `₹${round2(t.amount)}` : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: STATUS_META.debit.color }}>
                  {t.status === "debit" ? `₹${round2(t.amount)}` : "—"}
                </td>
                <td className="px-3 py-2.5 max-w-[140px] truncate text-slate-500" title={t.note}>{t.note || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onInvoice(t)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 active:bg-slate-200" title="Invoice">
                      <Receipt size={14} />
                    </button>
                    <button onClick={() => onEdit(t)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 active:bg-slate-200" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(t)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-70"
                      style={{ background: STATUS_META.debit.bg, color: STATUS_META.debit.color }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {totals && !showParty && (
            <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
              <td colSpan={5} className="px-3 py-2.5 text-slate-600 whitespace-nowrap">TOTAL</td>
              <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{totals.qty}</td>
              <td></td>
              <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">₹{totals.amount}</td>
              <td></td>
              <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: STATUS_META.credit.color }}>₹{totals.credit}</td>
              <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: STATUS_META.debit.color }}>₹{totals.debit}</td>
              <td></td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="text-[10px] font-medium text-slate-400 leading-tight">Balance</div>
                <div className="font-bold text-[13px] leading-tight" style={{ color: totals.flowColor }}>₹{totals.balance}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Modal shell ----------
// Header and footer are pinned; only the middle scrolls. This guarantees every
// field (including the very first one, Date) is always reachable no matter
// how tall the form is or whether the on-screen keyboard is open.
function Modal({ title, children, footer, onClose }) {
  return (
    <div className="absolute inset-0 bg-black/40 flex items-end z-20" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-slate-100">
          <div className="text-[16px] font-semibold text-slate-800">{title}</div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <X size={14} className="text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
        {footer && <div className="px-5 pt-3 pb-5 shrink-0 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Share fallback sheet ----------
// The Web Share API is often blocked inside sandboxed iframes (like this
// artifact preview), so navigator.share may silently be unavailable. This
// gives working alternatives that don't need that permission: WhatsApp and
// email both open via plain URLs, and Copy has a manual-select textarea as
// an always-works last resort.
function ShareSheet({ title, text, onClose }) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      return;
    } catch {
      /* fall through to manual-select fallback */
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* selection is still visible for the user to copy manually */
      }
    }
  };

  const openWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  const openEmail = () => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`, "_blank");

  return (
    <Modal title="Share" onClose={onClose}>
      <div className="pb-4">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={openWhatsApp} className="py-3 rounded-xl text-white text-sm font-semibold" style={{ background: "#25D366" }}>
            WhatsApp
          </button>
          <button onClick={openEmail} className="py-3 rounded-xl bg-slate-600 text-white text-sm font-semibold">
            Email
          </button>
        </div>
        <button onClick={copyText} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold mb-3">
          {copied ? "Copied ✓" : "Copy Text"}
        </button>
        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          onFocus={(e) => e.target.select()}
          className="w-full h-32 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-500 outline-none resize-none"
        />
        <div className="text-[11px] text-slate-400 mt-2">
          If Copy doesn't work on your browser, tap inside the box above to select the text, then copy it manually.
        </div>
      </div>
    </Modal>
  );
}

// ---------- Invoice / receipt view ----------
function InvoiceView({ txn, customer, srNo, onClose }) {
  const flowMeta = FLOW_META[txn.flow] || FLOW_META.purchase;
  const meta = STATUS_META[txn.status];
  const isMoney = txn.kind === "money";
  const isItem = txn.kind === "item";

  const shareText = [
    `Milk Ledger · ${flowMeta.label} ${isMoney ? "Payment" : "Invoice"} #${srNo}`,
    `${flowMeta.noun}: ${customer?.name || "Unknown"}`,
    `Date: ${fmtDate(txn.date)} ${fmtTime(txn.createdAt)}`,
    !isMoney && !isItem ? `Item: ${txn.category} · ${txn.type}` : null,
    !isMoney && !isItem ? `Qty: ${txn.qty} ltr · Sample Wt: ${txn.sampleWeightRaw}g · Rate: ₹${txn.rate}/ltr` : null,
    isItem ? `Item: ${txn.itemName}` : null,
    isItem ? `Qty: ${txn.qty} · Rate: ₹${txn.rate}` : null,
    `Amount: ₹${round2(txn.amount)}`,
    `Status: ${meta.label}`,
    txn.note ? `Note: ${txn.note}` : null,
  ].filter(Boolean).join("\n");

  const [showShareSheet, setShowShareSheet] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Milk Ledger Invoice", text: shareText });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
        // fall through to the fallback sheet below
      }
    }
    setShowShareSheet(true);
  };

  return (
    <div className="min-h-[700px] bg-[#F2F3F1] flex flex-col items-center py-6 px-4 font-[system-ui]">
      <div className="w-full print:hidden flex items-center justify-between mb-4 gap-2" style={{ maxWidth: 420 }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold"
          >
            <Share2 size={15} /> Share
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#215464] text-white text-sm font-semibold"
          >
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      <div className="w-full bg-white rounded-2xl border border-slate-200 p-6" style={{ maxWidth: 420 }}>
        <div className="flex items-center gap-2 mb-1">
          <Droplet size={18} className="text-[#215464]" />
          <div className="text-[17px] font-bold text-slate-800">Milk Ledger</div>
        </div>
        <div className="text-xs text-slate-400 mb-5">{flowMeta.label} {isMoney ? "Payment" : "Invoice"} · Sr No #{srNo}</div>

        <div className="flex justify-between text-sm mb-4 pb-4 border-b border-dashed border-slate-200">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">{flowMeta.noun}</div>
            <div className="font-semibold text-slate-800">{customer?.name || "Unknown"}</div>
            {customer?.phone && <div className="text-slate-400 text-xs">{customer.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Date &amp; Time</div>
            <div className="font-semibold text-slate-800">{fmtDate(txn.date)}</div>
            <div className="text-slate-400 text-xs">{fmtTime(txn.createdAt)}{txn.shift ? ` · ${txn.shift}` : ""}</div>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <tbody>
            {isMoney && <Row label="Type" value="Money Transaction" />}
            {isItem && <Row label="Item" value={txn.itemName} />}
            {isItem && <Row label="Quantity" value={txn.qty} />}
            {isItem && <Row label="Rate" value={`₹${txn.rate}`} />}
            {!isMoney && !isItem && <Row label="Item" value={txn.category} />}
            {!isMoney && !isItem && <Row label="Type" value={txn.type} />}
            {!isMoney && !isItem && <Row label="Quantity" value={`${txn.qty} ltr`} />}
            {!isMoney && !isItem && <Row label="Sample Weight" value={`${txn.sampleWeightRaw} g (${txn.sampleWeightKg.toFixed(3)} kg)`} />}
            {!isMoney && !isItem && <Row label="Rate" value={`₹${txn.rate} / ltr basis`} />}
          </tbody>
        </table>

        <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between" style={{ background: flowMeta.color + "14" }}>
          <span className="text-sm font-medium text-slate-500">Total Amount</span>
          <span className="text-xl font-bold" style={{ color: flowMeta.color }}>₹{round2(txn.amount)}</span>
        </div>

        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-500">Payment Status</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}
          </span>
        </div>

        {txn.note && (
          <div className="text-xs text-slate-400 mt-3 pt-3 border-t border-dashed border-slate-200 italic">
            Note: {txn.note}
          </div>
        )}

        <div className="text-center text-[11px] text-slate-300 mt-6">Generated from Milk Ledger · Not a tax invoice</div>
      </div>

      {showShareSheet && (
        <ShareSheet title="Milk Ledger Invoice" text={shareText} onClose={() => setShowShareSheet(false)} />
      )}
    </div>
  );
}

const Row = ({ label, value }) => (
  <tr className="border-b border-slate-50 last:border-0">
    <td className="py-1.5 text-slate-400 w-1/2">{label}</td>
    <td className="py-1.5 text-slate-800 font-medium text-right">{value}</td>
  </tr>
);
// ---------- Entry dialog ----------
function EntryDialog({ customer, defaultRate, rateMatrix, existing, onClose, onSave }) {
  const flowMeta = FLOW_META[customer.flow];
  const isEdit = !!existing;
  const [date, setDate] = useState(existing?.date || todayStr());
  const [shift, setShift] = useState(existing?.shift || "Morning");
  const [category, setCategory] = useState(existing?.category || "Fresh");
  const [type, setType] = useState(existing?.type || "Buffalo");
  const [qty, setQty] = useState(existing ? String(existing.qty) : "");
  const [sampleWeight, setSampleWeight] = useState(existing ? existing.sampleWeightRaw : "");
  const [rate, setRate] = useState(existing ? String(existing.rate) : String(rateMatrix?.[existing?.category || "Fresh"]?.[existing?.type || "Buffalo"] ?? defaultRate));
  const [note, setNote] = useState(existing?.note || "");

  const suggestRate = (cat, ty) => rateMatrix?.[cat]?.[ty] ?? defaultRate;
  const selectCategory = (cat) => { setCategory(cat); setRate(String(suggestRate(cat, type))); };
  const selectType = (ty) => { setType(ty); setRate(String(suggestRate(category, ty))); };

  const normWeight = normalizeSampleWeight(sampleWeight);
  const qtyNum = parseFloat(qty) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amount = round2(qtyNum * normWeight * rateNum);
  const canSave = qtyNum > 0 && normWeight > 0 && rateNum > 0;

  const buildTxn = (status) => ({
    id: existing?.id || uid(),
    customerId: customer.id,
    date,
    shift,
    category,
    type,
    qty: qtyNum,
    sampleWeightRaw: sampleWeight,
    sampleWeightKg: normWeight,
    rate: rateNum,
    amount,
    note: note.trim(),
    status,
    createdAt: existing?.createdAt || Date.now(),
    ...(isEdit ? { updatedAt: Date.now() } : {}),
  });

  const footer = (
    <div className="grid grid-cols-3 gap-2">
      <button
        disabled={!canSave}
        onClick={() => onSave(buildTxn("paid"))}
        className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: STATUS_META.paid.color }}
      >
        {isEdit ? "Update" : "Save"} Paid
      </button>
      <button
        disabled={!canSave}
        onClick={() => onSave(buildTxn("credit"))}
        className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: STATUS_META.credit.color }}
      >
        Credit
      </button>
      <button
        disabled={!canSave}
        onClick={() => onSave(buildTxn("debit"))}
        className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: STATUS_META.debit.color }}
      >
        Udhaar
      </button>
    </div>
  );

  return (
    <Modal
      title={
        <span className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: flowMeta.color, background: flowMeta.color + "1A" }}
          >
            {flowMeta.label}
          </span>
          {customer.name}
          {isEdit && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Editing</span>}
        </span>
      }
      onClose={onClose}
      footer={footer}
    >
      <div className="pb-4">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            enterKeyHint="next"
            className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
          />
        </Field>

        <Field label="Shift">
          <PillGroup options={SHIFT_OPTIONS} value={shift} onChange={setShift} activeColor={flowMeta.color} />
        </Field>

        <Field label="Category">
          <PillGroup options={CATEGORY_OPTIONS} value={category} onChange={selectCategory} activeColor={flowMeta.color} />
        </Field>

        <Field label="Type">
          <PillGroup options={TYPE_OPTIONS} value={type} onChange={selectType} columns={2} activeColor={flowMeta.color} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty (ltr)">
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0.0"
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Sample Wt (g)" hint={sampleWeight ? `= ${normWeight.toFixed(3)} kg` : undefined}>
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              value={sampleWeight}
              onChange={(e) => setSampleWeight(e.target.value)}
              placeholder="e.g. 240"
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
            />
          </Field>
        </div>

        <Field label="Rate (₹) — editable">
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="next"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
          />
        </Field>

        <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between" style={{ background: flowMeta.color + "14" }}>
          <span className="text-sm font-medium text-slate-500">Amount</span>
          <span className="text-xl font-bold" style={{ color: flowMeta.color }}>₹{amount}</span>
        </div>

        <Field label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            enterKeyHint="done"
            autoComplete="off"
            className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Money dialog ----------
// A lighter-weight entry for pure payments/adjustments: just date, amount, note.
// Only Credit / Debit are valid outcomes — there's no "Paid" state for a bare
// money movement since it's already a settlement in itself.
function MoneyDialog({ customer, existing, onClose, onSave, onSetOpeningBalance }) {
  const flowMeta = FLOW_META[customer.flow];
  const isEdit = !!existing;
  const [mode, setMode] = useState("transaction"); // "transaction" | "balance"
  const [date, setDate] = useState(existing?.date || todayStr());
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [note, setNote] = useState(existing?.note || "");
  const [balanceInput, setBalanceInput] = useState(String(customer.openingBalance || 0));

  const amountNum = parseFloat(amount) || 0;
  const canSave = amountNum > 0;
  const canSaveBalance = balanceInput.trim() !== "" && !isNaN(parseFloat(balanceInput));

  const buildTxn = (status) => ({
    id: existing?.id || uid(),
    customerId: customer.id,
    kind: "money",
    date,
    amount: round2(amountNum),
    note: note.trim(),
    status,
    createdAt: existing?.createdAt || Date.now(),
    ...(isEdit ? { updatedAt: Date.now() } : {}),
  });

  const footer =
    mode === "balance" ? (
      <button
        disabled={!canSaveBalance}
        onClick={() => { onSetOpeningBalance(customer.id, parseFloat(balanceInput)); onClose(); }}
        className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: flowMeta.color }}
      >
        Set Previous Balance
      </button>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!canSave}
          onClick={() => onSave(buildTxn("credit"))}
          className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: STATUS_META.credit.color }}
        >
          {isEdit ? "Update" : "Save"} Credit
        </button>
        <button
          disabled={!canSave}
          onClick={() => onSave(buildTxn("debit"))}
          className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: STATUS_META.debit.color }}
        >
          {isEdit ? "Update" : "Save"} Debit
        </button>
      </div>
    );

  return (
    <Modal
      title={
        <span className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: flowMeta.color, background: flowMeta.color + "1A" }}
          >
            {flowMeta.label}
          </span>
          {customer.name} · Money
          {isEdit && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Editing</span>}
        </span>
      }
      onClose={onClose}
      footer={footer}
    >
      <div className="pb-4">
        {!isEdit && onSetOpeningBalance && (
          <Field label="This entry is">
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "transaction", label: "Money Transaction" },
                { key: "balance", label: "Previous Balance" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border ${
                    mode === opt.key ? "text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                  style={mode === opt.key ? { background: flowMeta.color, borderColor: flowMeta.color } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {mode === "balance" ? (
          <Field label="Previous Balance (₹)" hint="Sets the party's opening balance directly — this replaces any existing value and isn't a listed transaction.">
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
            />
          </Field>
        ) : (
          <>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                enterKeyHint="next"
                className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
              />
            </Field>

            <Field label="Amount (₹)">
              <input
                type="number"
                inputMode="decimal"
                enterKeyHint="next"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
              />
            </Field>

            <Field label="Note (optional)">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Cash received, advance, adjustment…"
                enterKeyHint="done"
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------- Sales dialog (item-based, for the Sale flow) ----------
function SalesDialog({ customer, defaultRates, existing, onClose, onSave }) {
  const flowMeta = FLOW_META[customer.flow];
  const isEdit = !!existing;
  const [date, setDate] = useState(existing?.date || todayStr());
  const [shift, setShift] = useState(existing?.shift || "Morning");
  const [itemKey, setItemKey] = useState(existing?.itemKey || SALE_ITEMS[0].key);
  const [customName, setCustomName] = useState(existing?.itemKey === "other" ? (existing?.itemName || "") : "");
  const [qty, setQty] = useState(existing ? String(existing.qty) : "");
  const [rate, setRate] = useState(existing ? String(existing.rate) : String(defaultRates[SALE_ITEMS[0].key] ?? ""));
  const [note, setNote] = useState(existing?.note || "");

  const selectItem = (key) => {
    setItemKey(key);
    if (key !== "other") {
      setRate(String(defaultRates[key] ?? 0));
    } else {
      setRate("");
    }
  };

  const currentItem = SALE_ITEMS.find((i) => i.key === itemKey);
  const itemLabel = itemKey === "other" ? (customName.trim() || "Other") : currentItem?.label;

  const qtyNum = parseFloat(qty) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amount = round2(qtyNum * rateNum);
  const canSave = qtyNum > 0 && rateNum > 0 && (itemKey !== "other" || customName.trim());

  const buildTxn = (status) => ({
    id: existing?.id || uid(),
    customerId: customer.id,
    kind: "item",
    date,
    shift,
    itemKey,
    itemName: itemLabel,
    qty: qtyNum,
    rate: rateNum,
    amount,
    note: note.trim(),
    status,
    createdAt: existing?.createdAt || Date.now(),
    ...(isEdit ? { updatedAt: Date.now() } : {}),
  });

  const footer = (
    <div className="grid grid-cols-3 gap-2">
      <button
        disabled={!canSave}
        onClick={() => onSave(buildTxn("paid"))}
        className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: STATUS_META.paid.color }}
      >
        {isEdit ? "Update" : "Save"} Paid
      </button>
      <button
        disabled={!canSave}
        onClick={() => onSave(buildTxn("credit"))}
        className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: STATUS_META.credit.color }}
      >
        Credit
      </button>
      <button
        disabled={!canSave}
        onClick={() => onSave(buildTxn("debit"))}
        className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
        style={{ background: STATUS_META.debit.color }}
      >
        Udhaar
      </button>
    </div>
  );

  return (
    <Modal
      title={
        <span className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: flowMeta.color, background: flowMeta.color + "1A" }}
          >
            {flowMeta.label}
          </span>
          {customer.name}
          {isEdit && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Editing</span>}
        </span>
      }
      onClose={onClose}
      footer={footer}
    >
      <div className="pb-4">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            enterKeyHint="next"
            className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
          />
        </Field>

        <Field label="Shift">
          <PillGroup options={SALE_SHIFT_OPTIONS} value={shift} onChange={setShift} activeColor={flowMeta.color} />
        </Field>

        <Field label="Item">
          <div className="grid grid-cols-3 gap-2">
            {SALE_ITEMS.map((item) => {
              const active = itemKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectItem(item.key)}
                  className={`py-2.5 px-1 rounded-xl text-xs font-medium border text-center leading-tight ${
                    active ? "text-white" : "bg-white border-slate-200 text-slate-600 active:bg-slate-50"
                  }`}
                  style={active ? { background: flowMeta.color, borderColor: flowMeta.color } : {}}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </Field>

        {itemKey === "other" && (
          <Field label="Item Name">
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Paneer"
              enterKeyHint="next"
              autoComplete="off"
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty">
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0.0"
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Rate (₹) — editable">
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="next"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
            />
          </Field>
        </div>

        <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between" style={{ background: flowMeta.color + "14" }}>
          <span className="text-sm font-medium text-slate-500">Amount</span>
          <span className="text-xl font-bold" style={{ color: flowMeta.color }}>₹{amount}</span>
        </div>

        <Field label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            enterKeyHint="done"
            autoComplete="off"
            className="w-full border border-slate-200 rounded-lg px-3 py-3 text-base outline-none focus:border-slate-400"
          />
        </Field>
      </div>
    </Modal>
  );
}
