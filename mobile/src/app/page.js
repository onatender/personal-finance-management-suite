'use client';

import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Plus, 
  CreditCard, 
  History, 
  Settings,
  TrendingDown,
  TrendingUp,
  LayoutGrid,
  ChevronRight,
  Trash2,
  Edit2,
  MoreVertical,
  X,
  CreditCard as CardIcon
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

export default function UnifiedApp() {
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isDebtPayModalOpen, setIsDebtPayModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { col, id, name }
  
  // Data State
  const [assets, setAssets] = useState([]);
  const [debts, setDebts] = useState([]);
  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [usdRate, setUsdRate] = useState(0);
  const [stats, setStats] = useState({ 
    balance: '0.00', 
    income: '0.00', 
    expense: '0.00',
    totalAssets: '0.00',
    totalDebts: '0.00',
    totalReceivables: '0.00'
  });

  // Add Transaction Form State
  const [newTx, setNewTx] = useState({
    açıklama: '',
    fiyat: '',
    tür: 'Gider',
    kategori: 'Market',
    varlık: '',
    detaylar: [],
    bakiyeEtkilemez: false
  });

  const [newAsset, setNewAsset] = useState({
    ad: '',
    bakiye: '',
    birim: 'TRY'
  });

  const [newDebt, setNewDebt] = useState({
    isim: '',
    miktar: '',
    tip: 'Borç',
    vade: ''
  });

  const [newCard, setNewCard] = useState({
    ad: '',
    kod: '', // e.g. "VISA-1234"
    limit: '',
    güncelBorç: ''
  });

  const [payDebtState, setPayDebtState] = useState({
    debtId: '',
    debtName: '',
    debtType: '', // 'Borç' or 'Alacak'
    amount: '',
    varlık: ''
  });

  const [transferState, setTransferState] = useState({
    from: '',
    to: '',
    amount: ''
  });

  useEffect(() => {
    setIsClient(true);
    // Currency API
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(res => res.json())
      .then(data => setUsdRate(data.rates.TRY))
      .catch(() => setUsdRate(32.5)); // Fallback

    const unsubAssets = onSnapshot(query(collection(db, "varliklar")), (snap) => {
      setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDebts = onSnapshot(query(collection(db, "borclar")), (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCards = onSnapshot(query(collection(db, "kredi_kartlari")), (snap) => {
      setCards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTx = onSnapshot(query(collection(db, "harcamalar"), orderBy("tarih", "desc"), limit(50)), (snap) => {
      setTransactions(snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          açıklama: d.açıklama || d.description || "İsimsiz",
          fiyat: parseFloat(d.fiyat || d.price || 0),
          kategori: d.kategori || d.category || "Genel",
          tür: d.tür || d.type || "Gider",
          varlık: d.varlık || d.asset || "",
          detaylar: d.detaylar || [],
          tarih: d.tarih
        };
      }));
    });

    return () => { unsubAssets(); unsubDebts(); unsubCards(); unsubTx(); };
  }, []);

  // Standardize 'TL' to 'TRY' and 'Mutfak' to 'Market' in database
  useEffect(() => {
    assets.forEach(async (a) => {
      if (a.birim === "TL") {
        try {
          await updateDoc(doc(db, "varliklar", a.id), { birim: "TRY" });
        } catch (err) { console.error("Standardization error:", err); }
      }
    });
    transactions.forEach(async (t) => {
      if (t.kategori === "Mutfak") {
        try {
          await updateDoc(doc(db, "harcamalar", t.id), { kategori: "Market" });
        } catch (err) { console.error("Migration error:", err); }
      }
    });
  }, [assets, transactions]);

  useEffect(() => {
    let totalTRY = 0;
    assets.forEach(a => {
      const val = parseFloat(a.bakiye || 0);
      totalTRY += (a.birim === "USD") ? val * (usdRate || 1) : val;
    });

    const inc = transactions.filter(t => t.tür === 'Gelir').reduce((s, t) => s + t.fiyat, 0);
    const exp = transactions.filter(t => t.tür === 'Gider').reduce((s, t) => s + t.fiyat, 0);
    const totalBorc = debts.filter(d => d.tip === 'Borç').reduce((s, d) => s + parseFloat(d.miktar || 0), 0);
    const totalAlacak = debts.filter(d => d.tip === 'Alacak').reduce((s, d) => s + parseFloat(d.miktar || 0), 0);
    const totalCardDebt = cards.reduce((s, c) => s + parseFloat(c.güncelBorç || 0), 0);
    
    const combinedDebt = totalBorc + totalCardDebt;
    const netWorth = totalTRY + totalAlacak - combinedDebt;

    setStats({
      balance: netWorth.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      income: inc.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      expense: exp.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      totalAssets: totalTRY.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      totalDebts: combinedDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      totalReceivables: totalAlacak.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
    });

    if (assets.length > 0 && !newTx.varlık) {
      setNewTx(prev => ({ ...prev, varlık: assets[0].ad }));
    }
  }, [assets, transactions, debts, cards, usdRate]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.açıklama || !newTx.fiyat) return;

    try {
      await addDoc(collection(db, "harcamalar"), {
        açıklama: newTx.açıklama,
        fiyat: parseFloat(newTx.fiyat),
        tür: newTx.tür,
        kategori: newTx.kategori,
        varlık: newTx.varlık,
        detaylar: newTx.detaylar || [],
        bakiye_etkilemez: newTx.bakiyeEtkilemez,
        tarih: serverTimestamp()
      });
      
      if (!newTx.bakiyeEtkilemez) {
        // Update asset balance OR Credit Card debt
        const asset = assets.find(a => a.ad === newTx.varlık);
        const card = cards.find(c => c.ad === newTx.varlık);

        if (asset) {
          const diff = newTx.tür === 'Gelir' ? parseFloat(newTx.fiyat) : -parseFloat(newTx.fiyat);
          await updateDoc(doc(db, "varliklar", asset.id), {
            bakiye: parseFloat(asset.bakiye || 0) + diff
          });
        } else if (card) {
          // Expense on credit card increases debt, Income (e.g. payment) decreases it
          const diff = newTx.tür === 'Gider' ? parseFloat(newTx.fiyat) : -parseFloat(newTx.fiyat);
          await updateDoc(doc(db, "kredi_kartlari", card.id), {
            güncelBorç: parseFloat(card.güncelBorç || 0) + diff
          });
        }
      }

      setNewTx({ açıklama: '', fiyat: '', tür: 'Gider', kategori: 'Market', varlık: assets[0]?.ad || cards[0]?.ad || '', detaylar: [], bakiyeEtkilemez: false });
      setIsAddModalOpen(false);
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCard.ad || !newCard.limit) return;
    try {
      await addDoc(collection(db, "kredi_kartlari"), {
        ...newCard,
        limit: parseFloat(newCard.limit),
        güncelBorç: parseFloat(newCard.güncelBorç || 0)
      });
      setNewCard({ ad: '', kod: '', limit: '', güncelBorç: '' });
      setIsCardModalOpen(false);
    } catch (err) { alert("Hata: " + err.message); }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferState.from || !transferState.to || !transferState.amount) return;
    if (transferState.from === transferState.to) {
      alert("Aynı hesaba transfer yapılamaz.");
      return;
    }
    
    try {
      const amt = parseFloat(transferState.amount);
      const fromAsset = assets.find(a => a.ad === transferState.from);
      const toAsset = assets.find(a => a.ad === transferState.to);
      
      if (fromAsset) {
        await updateDoc(doc(db, "varliklar", fromAsset.id), { bakiye: parseFloat(fromAsset.bakiye || 0) - amt });
      }
      if (toAsset) {
        await updateDoc(doc(db, "varliklar", toAsset.id), { bakiye: parseFloat(toAsset.bakiye || 0) + amt });
      }
      
      setIsTransferModalOpen(false);
      setTransferState({ from: '', to: '', amount: '' });
      alert("Transfer başarılı!");
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.ad || !newAsset.bakiye) return;
    try {
      await addDoc(collection(db, "varliklar"), {
        ...newAsset,
        bakiye: parseFloat(newAsset.bakiye)
      });
      setNewAsset({ ad: '', bakiye: '', birim: 'TRY' });
      setIsAssetModalOpen(false);
    } catch (err) { alert("Hata: " + err.message); }
  };

  const handleAddDebt = async (e) => {
    e.preventDefault();
    if (!newDebt.isim || !newDebt.miktar) return;
    try {
      await addDoc(collection(db, "borclar"), {
        ...newDebt,
        miktar: parseFloat(newDebt.miktar)
      });
      setNewDebt({ isim: '', miktar: '', tip: 'Borç', vade: '' });
      setIsDebtModalOpen(false);
    } catch (err) { alert("Hata: " + err.message); }
  };

  const handlePayDebt = async (e) => {
    e.preventDefault();
    if (!payDebtState.amount || !payDebtState.varlık) return;

    try {
      const amount = parseFloat(payDebtState.amount);
      const debt = debts.find(d => d.id === payDebtState.debtId);
      const isBorc = debt?.tip === 'Borç';
      
      // 1. Update Debt amount
      const newDebtMiktar = parseFloat(debt.miktar || 0) - amount;
      if (newDebtMiktar <= 0) {
        await deleteDoc(doc(db, "borclar", debt.id));
      } else {
        await updateDoc(doc(db, "borclar", debt.id), { miktar: newDebtMiktar });
      }

      // 2. Register a transaction
      await addDoc(collection(db, "harcamalar"), {
        açıklama: `${debt.isim} - ${isBorc ? 'Borç Ödemesi' : 'Alacak Tahsili'}`,
        fiyat: amount,
        tür: isBorc ? 'Gider' : 'Gelir',
        kategori: 'Diğer',
        varlık: payDebtState.varlık,
        tarih: serverTimestamp()
      });

      // 3. Update account balance
      const asset = assets.find(a => a.ad === payDebtState.varlık);
      const card = cards.find(c => c.ad === payDebtState.varlık);

      if (asset) {
        const diff = isBorc ? -amount : amount;
        await updateDoc(doc(db, "varliklar", asset.id), {
          bakiye: parseFloat(asset.bakiye || 0) + diff
        });
      } else if (card) {
        // If it's a debt payment using credit card (indirectly increasing card debt)
        // Or if it's receiving money to credit card (decreasing card debt)
        const diff = isBorc ? amount : -amount;
        await updateDoc(doc(db, "kredi_kartlari", card.id), {
          güncelBorç: parseFloat(card.güncelBorç || 0) + diff
        });
      }

      setIsDebtPayModalOpen(false);
      setPayDebtState({ debtId: '', debtName: '', amount: '', varlık: '' });
    } catch (err) { alert("Hata: " + err.message); }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    const { col, id, ...data } = editingItem;
    const originalItem = [...assets, ...transactions, ...debts, ...cards].find(x => x.id === id);

    try {
      if (col === 'harcamalar' && originalItem) {
        const oldFiyat = parseFloat(originalItem.fiyat || 0);
        const newFiyat = parseFloat(data.fiyat || 0);
        const oldVarlikName = originalItem.varlık || originalItem.asset || "";
        const newVarlikName = data.varlık;
        
        const oldIsExpense = originalItem.tür === 'Gider';
        const newIsExpense = (data.tür || originalItem.tür) === 'Gider';

        // 1. Revert old balance
        const oldAccount = assets.find(a => a.ad === oldVarlikName) || cards.find(c => c.ad === oldVarlikName);
        if (oldAccount) {
          const isCard = cards.some(c => c.id === oldAccount.id);
          const revertDiff = oldIsExpense ? oldFiyat : -oldFiyat; 
          
          if (isCard) {
            await updateDoc(doc(db, "kredi_kartlari", oldAccount.id), {
              güncelBorç: parseFloat(oldAccount.güncelBorç || 0) - revertDiff
            });
          } else {
            const currentBakiye = parseFloat(oldAccount.bakiye || 0);
            await updateDoc(doc(db, "varliklar", oldAccount.id), {
              bakiye: currentBakiye + revertDiff
            });
          }
        }

        // 2. Apply new balance
        const targetVarlikName = newVarlikName || oldVarlikName;
        const newAccount = assets.find(a => a.ad === targetVarlikName) || cards.find(c => c.ad === targetVarlikName);
        
        if (newAccount) {
          const isCard = cards.some(c => c.id === newAccount.id);
          const applyDiff = newIsExpense ? newFiyat : -newFiyat;
          
          let baseBalance;
          if (newAccount.ad === oldVarlikName) {
            // Re-fetch logic (local sync): account for reversion just performed
            const revertDiff = oldIsExpense ? oldFiyat : -oldFiyat;
            baseBalance = isCard 
              ? parseFloat(newAccount.güncelBorç || 0) - revertDiff
              : parseFloat(newAccount.bakiye || 0) + revertDiff;
          } else {
            baseBalance = isCard ? parseFloat(newAccount.güncelBorç || 0) : parseFloat(newAccount.bakiye || 0);
          }

          if (isCard) {
            await updateDoc(doc(db, "kredi_kartlari", newAccount.id), {
              güncelBorç: baseBalance + applyDiff
            });
          } else {
            await updateDoc(doc(db, "varliklar", newAccount.id), {
              bakiye: baseBalance - applyDiff
            });
          }
        }
      }

      await updateDoc(doc(db, col, id), {
        ...data,
        ...(data.fiyat !== undefined && { fiyat: parseFloat(data.fiyat) }),
        ...(data.bakiye !== undefined && { bakiye: parseFloat(data.bakiye) }),
        ...(data.miktar !== undefined && { miktar: parseFloat(data.miktar) }),
        ...(data.güncelBorç !== undefined && { güncelBorç: parseFloat(data.güncelBorç) }),
        ...(data.limit !== undefined && { limit: parseFloat(data.limit) })
      });
      setEditingItem(null);
    } catch (err) { 
      console.error(err);
      alert("Hata: " + err.message); 
    }
  };

  const deleteItem = async (col, id) => {
    const item = [...assets, ...transactions, ...debts, ...cards].find(x => x.id === id);
    setConfirmDelete({ col, id, name: item?.ad || item?.açıklama || item?.isim || 'bu öğe' });
    setMenuOpenId(null);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      const { col, id } = confirmDelete;
      const originalItem = [...assets, ...transactions, ...debts, ...cards].find(x => x.id === id);

      // Revert balances if deleting a transaction
      if (col === 'harcamalar' && originalItem) {
        const amount = parseFloat(originalItem.fiyat || 0);
        const varlikName = originalItem.varlık || originalItem.asset;
        const isExpense = originalItem.tür === 'Gider';
        
        const account = assets.find(a => a.ad === varlikName) || cards.find(c => c.ad === varlikName);
        if (account) {
          const isCard = cards.some(c => c.id === account.id);
          const revertDiff = isExpense ? amount : -amount;
          
          if (isCard) {
            await updateDoc(doc(db, "kredi_kartlari", account.id), {
              güncelBorç: parseFloat(account.güncelBorç || 0) - revertDiff
            });
          } else {
            await updateDoc(doc(db, "varliklar", account.id), {
              bakiye: parseFloat(account.bakiye || 0) + revertDiff
            });
          }
        }
      }

      await deleteDoc(doc(db, col, id));
      setConfirmDelete(null);
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  if (!isClient) return null;

  return (
    <div className="app-wrapper" onClick={() => setMenuOpenId(null)}>
      
      {/* Sidebar for Desktop */}
      <aside className="sidebar">
        <h1 style={{fontSize:'24px', fontWeight:900}}>Finansçım</h1>
        <nav className="flex-col gap-4">
          <SidebarItem active={activeTab==='home'} onClick={()=>setActiveTab('home')} icon={<LayoutGrid/>} label="Ana Panel"/>
          <SidebarItem active={activeTab==='wallet'} onClick={()=>setActiveTab('wallet')} icon={<CardIcon/>} label="Varlıklar"/>
          <SidebarItem active={activeTab==='history'} onClick={()=>setActiveTab('history')} icon={<History/>} label="İşlemler"/>
          <SidebarItem active={activeTab==='debts'} onClick={()=>setActiveTab('debts')} icon={<TrendingDown/>} label="Borçlar"/>
        </nav>
      </aside>

      <main className="main-content">
        <div className="scroll-area">
          <header style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px', paddingTop:'16px'}}>
            <div>
              <h1 style={{fontSize:'26px', fontWeight:900, lineHeight:'1.2'}}>Finansçım</h1>
              <p style={{fontSize:'10px', color:'var(--text-dim)', fontWeight:800, letterSpacing:'1px', marginTop:'2px'}}>
                {activeTab === 'home' ? 'ÖZET' : activeTab === 'wallet' ? 'VARLIKLARIM' : activeTab === 'history' ? 'GEÇMİŞ' : 'BORÇLAR'}
              </p>
            </div>
            <button className="glass icon-circle" style={{marginTop:'4px'}}><Settings size={20} color="var(--text-dim)"/></button>
          </header>

          {activeTab === 'home' && (
            <div className="animate-slide-up dashboard-grid">
              <div className="balance-section">
                <div className="balance-card glass">
                  <p style={{color:'var(--text-dim)', fontSize:'14px', fontWeight:600}}>Net Portföy</p>
                  <h2 style={{fontSize:'36px', fontWeight:900, marginTop:'8px'}}>₺{stats.balance}</h2>
                  <div style={{marginTop:'20px'}}><span className="btn-text" style={{fontSize:'10px'}}>1 USD = {usdRate?.toFixed(2)} TL</span></div>
                  <div style={{position:'absolute', right:'-20px', bottom:'-20px', opacity:0.03}}><Wallet size={160}/></div>
                </div>

                <div className="stats-grid" style={{marginTop:'16px'}}>
                  <div className="glass stat-box">
                    <div className="icon-circle" style={{color:'var(--success)'}}><TrendingUp size={20}/></div>
                    <div className="flex-col">
                      <span style={{fontSize:'9px', fontWeight:800, color:'var(--text-dim)'}}>GELİR</span>
                      <span style={{fontSize:'16px', fontWeight:900, color:'var(--success)'}}>₺{stats.income}</span>
                    </div>
                  </div>
                  <div className="glass stat-box">
                    <div className="icon-circle" style={{color:'var(--danger)'}}><TrendingDown size={20}/></div>
                    <div className="flex-col">
                      <span style={{fontSize:'9px', fontWeight:800, color:'var(--text-dim)'}}>GİDER</span>
                      <span style={{fontSize:'16px', fontWeight:900, color:'var(--danger)'}}>₺{stats.expense}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="recent-section" style={{marginTop:'40px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                  <h3 style={{fontSize:'18px', fontWeight:900}}>SON İŞLEMLER</h3>
                  <button className="btn-text" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('history')}>TÜMÜ</button>
                </div>
                <div className="transactions-list">
                  {transactions.slice(0,6).map(tx => (
                    <TransactionItem 
                      key={tx.id} 
                      tx={tx} 
                      menuOpen={menuOpenId === tx.id}
                      onToggleMenu={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === tx.id ? null : tx.id) }} 
                      onEdit={() => setEditingItem({ col: 'harcamalar', ...tx })}
                      onDelete={() => deleteItem('harcamalar', tx.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="animate-slide-up">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                <h3 style={{fontSize:'18px', fontWeight:900}}>VARLIKLARIM</h3>
                <div style={{display:'flex', gap:'8px'}}>
                  <button className="btn-text" onClick={() => setIsTransferModalOpen(true)}>🔄 TRANSFER</button>
                  <button className="btn-text" onClick={() => setIsAssetModalOpen(true)}>+ YENİ HESAP</button>
                </div>
              </div>
              <div className="glass" style={{padding:'24px', marginBottom:'24px', background: 'linear-gradient(145deg, #1e1e2d 0%, #111119 100%)'}}>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px', marginBottom:'20px'}}>
                  <div>
                    <p style={{color:'var(--text-dim)', fontSize:'9px', fontWeight:800, textTransform:'uppercase'}}>Varlık</p>
                    <h3 style={{fontSize:'15px', fontWeight:900, color:'var(--primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>₺{stats.totalAssets.split(',')[0]}</h3>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <p style={{color:'var(--text-dim)', fontSize:'9px', fontWeight:800, textTransform:'uppercase'}}>Alacak</p>
                    <h3 style={{fontSize:'15px', fontWeight:900, color:'var(--success)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>₺{stats.totalReceivables.split(',')[0]}</h3>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{color:'var(--text-dim)', fontSize:'9px', fontWeight:800, textTransform:'uppercase'}}>Borç</p>
                    <h3 style={{fontSize:'15px', fontWeight:900, color:'var(--danger)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>₺{stats.totalDebts.split(',')[0]}</h3>
                  </div>
                </div>
                <div style={{height:'1px', background:'var(--border)', margin:'16px 0'}}></div>
                <div className="flex justify-between items-center">
                  <p style={{fontSize:'14px', fontWeight:700}}>Net Durum</p>
                  <p style={{fontSize:'20px', fontWeight:900}}>₺{stats.balance}</p>
                </div>
              </div>
              
              <div className="list-grid">
                {assets.map(a => (
                  <AssetItem 
                    key={a.id} 
                    asset={a} 
                    menuOpen={menuOpenId === a.id}
                    onToggleMenu={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === a.id ? null : a.id) }}
                    onEdit={() => setEditingItem({ col: 'varliklar', ...a })}
                    onDelete={() => deleteItem('varliklar', a.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-slide-up list-grid">
              {transactions.map(tx => (
                <TransactionItem 
                  key={tx.id} 
                  tx={tx} 
                  menuOpen={menuOpenId === tx.id}
                  onToggleMenu={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === tx.id ? null : tx.id) }} 
                  onEdit={() => setEditingItem({ col: 'harcamalar', ...tx })}
                  onDelete={() => deleteItem('harcamalar', tx.id)}
                />
              ))}
            </div>
          )}

          {activeTab === 'debts' && (
            <div className="animate-slide-up">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                <h3 style={{fontSize:'18px', fontWeight:900}}>KREDİ KARTLARIM</h3>
                <button className="btn-text" onClick={() => setIsCardModalOpen(true)}>+ YENİ KART</button>
              </div>
              <div className="list-grid" style={{marginBottom:'32px'}}>
                {cards.map(c => (
                  <CardItem 
                    key={c.id} 
                    card={c} 
                    menuOpen={menuOpenId === c.id}
                    onToggleMenu={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === c.id ? null : c.id) }}
                    onEdit={() => setEditingItem({ col: 'kredi_kartlari', ...c })}
                    onDelete={() => deleteItem('kredi_kartlari', c.id)}
                  />
                ))}
              </div>

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                <h3 style={{fontSize:'18px', fontWeight:900}}>BORÇ / ALACAK</h3>
                <button className="btn-text" onClick={() => setIsDebtModalOpen(true)}>+ YENİ KAYIT</button>
              </div>
              <div className="list-grid">
                {debts.map(d => (
                    <DebtItem 
                      key={d.id} 
                      debt={d} 
                      menuOpen={menuOpenId === d.id}
                      onToggleMenu={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === d.id ? null : d.id) }}
                      onEdit={() => setEditingItem({ col: 'borclar', ...d })}
                      onDelete={() => deleteItem('borclar', d.id)}
                      onPay={() => {
                        setPayDebtState({ 
                          debtId: d.id, 
                          debtName: d.isim, 
                          debtType: d.tip, 
                          amount: d.miktar.toString(), 
                          varlık: assets[0]?.ad || '' 
                        });
                        setIsDebtPayModalOpen(true);
                      }}
                    />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Transaction Modal */}
        {isAddModalOpen && (
          <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
            <div className="modal-content animate-slide-up" style={{maxHeight:'90vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexShrink:0}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Yeni İşlem Ekle</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              
              <div style={{overflowY:'auto', paddingRight:'4px'}}>
                <form onSubmit={handleAddTransaction} className="flex-col gap-4">
                <div className="input-group">
                  <label>Açıklama</label>
                  <input className="form-input" placeholder="Market, Maaş, vb." value={newTx.açıklama} onChange={e => setNewTx({...newTx, açıklama: e.target.value})} required />
                </div>
                <div className="flex gap-3">
                  <div className="input-group flex-1">
                    <label>Miktar</label>
                    <input className="form-input" type="number" placeholder="0.00" value={newTx.fiyat} onChange={e => setNewTx({...newTx, fiyat: e.target.value})} required />
                  </div>
                  <div className="input-group flex-1">
                    <label>Tür</label>
                    <select className="form-select" value={newTx.tür} onChange={e => setNewTx({...newTx, tür: e.target.value})}>
                      <option>Gider</option>
                      <option>Gelir</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>Kategori</label>
                  <select className="form-select" value={newTx.kategori} onChange={e => setNewTx({...newTx, kategori: e.target.value})}>
                    {["Market", "Maaş", "Eğlence", "Fatura", "Giyim", "Ulaşım", "Ek Gelir", "Diğer"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Sub-items for Market */}
                {(newTx.kategori === 'Market') && (
                  <div className="glass" style={{padding:'16px', marginBottom:'16px', borderStyle:'dashed', borderColor:'var(--primary)'}}>
                    <label style={{fontSize:'10px', fontWeight:800, color:'var(--primary)', marginBottom:'12px', display:'block', textTransform:'uppercase'}}>Harcama Detayları</label>
                    <div className="flex-col gap-3">
                      {[
                        {id:'meyve', label:'Meyve/Sebze'},
                        {id:'aburcubur', label:'Abur Cubur'},
                        {id:'icecek', label:'İçecek'},
                        {id:'et', label:'Et/Süt/Şarküteri'},
                        {id:'temizlik', label:'Temizlik/Kişisel Bakım'},
                        {id:'diger_gida', label:'Diğer Gıda'},
                        {id:'diger', label:'Diğer'}
                      ].map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                          <span style={{fontSize:'12px', flex:1}}>{item.label}</span>
                          <input 
                            className="form-input" 
                            style={{width:'100px', padding:'8px 12px'}} 
                            type="number" 
                            placeholder="0.00"
                            value={newTx.detaylar?.find(d => d.id === item.id)?.miktar || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const currentDetaylar = [...(newTx.detaylar || [])];
                              const index = currentDetaylar.findIndex(d => d.id === item.id);
                              if (index > -1) {
                                if (val === '') currentDetaylar.splice(index, 1);
                                else currentDetaylar[index].miktar = val;
                              } else if (val !== '') {
                                currentDetaylar.push({ id: item.id, isim: item.label, miktar: val });
                              }
                              
                              // Auto-calculate total price if details are being filled
                              const total = currentDetaylar.reduce((sum, d) => sum + parseFloat(d.miktar || 0), 0);
                              setNewTx({
                                ...newTx, 
                                detaylar: currentDetaylar,
                                fiyat: total > 0 ? total.toString() : newTx.fiyat
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="input-group">
                  <label>Ödeme Yöntemi / Varlık</label>
                  <select className="form-select" value={newTx.varlık} onChange={e => setNewTx({...newTx, varlık: e.target.value})}>
                    <optgroup label="Hesaplar/Varlıklar">
                      {assets.map(a => <option key={a.id} value={a.ad}>{a.ad}</option>)}
                    </optgroup>
                    <optgroup label="Kredi Kartları">
                      {cards.map(c => <option key={c.id} value={c.ad}>{c.ad}</option>)}
                    </optgroup>
                  </select>
                </div>
                
                <div style={{display:'flex', alignItems:'center', gap:'8px', marginTop:'4px'}}>
                  <input type="checkbox" id="bakiyeEtkilemez" checked={newTx.bakiyeEtkilemez} onChange={e => setNewTx({...newTx, bakiyeEtkilemez: e.target.checked})} style={{width:'16px', height:'16px'}} />
                  <label htmlFor="bakiyeEtkilemez" style={{marginBottom:0, fontSize:'14px', color:'var(--text-dim)', fontWeight:600}}>Hesap Bakiyesine Etki Etmesin</label>
                </div>

                <button type="submit" className="btn-primary" style={{marginTop:'8px', marginBottom:'24px'}}>KAYDET</button>
              </form>
            </div>
          </div>
        </div>
        )}

        {/* Add Asset Modal */}
        {isAssetModalOpen && (
          <div className="modal-overlay" onClick={() => setIsAssetModalOpen(false)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Yeni Hesap/Varlık</h3>
                <button onClick={() => setIsAssetModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              <form onSubmit={handleAddAsset} className="flex-col gap-4">
                <div className="input-group">
                  <label>Hesap Adı</label>
                  <input className="form-input" placeholder="Ziraat, Nakit, vb." value={newAsset.ad} onChange={e => setNewAsset({...newAsset, ad: e.target.value})} required />
                </div>
                <div className="flex gap-3">
                  <div className="input-group flex-1">
                    <label>Bakiye</label>
                    <input className="form-input" type="number" placeholder="0.00" value={newAsset.bakiye} onChange={e => setNewAsset({...newAsset, bakiye: e.target.value})} required />
                  </div>
                  <div className="input-group flex-1">
                    <label>Birim</label>
                    <select className="form-select" value={newAsset.birim} onChange={e => setNewAsset({...newAsset, birim: e.target.value})}>
                      <option>TRY</option>
                      <option>USD</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>KAYDET</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Debt Modal */}
        {isDebtModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDebtModalOpen(false)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Yeni Borç veya Alacak</h3>
                <button onClick={() => setIsDebtModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              <form onSubmit={handleAddDebt} className="flex-col gap-4">
                <div className="input-group">
                  <label>Kişi / Kurum Adı</label>
                  <input className="form-input" placeholder="Ahmet, Banka, vb." value={newDebt.isim} onChange={e => setNewDebt({...newDebt, isim: e.target.value})} required />
                </div>
                <div className="flex gap-3">
                  <div className="input-group flex-1">
                    <label>Miktar (TRY)</label>
                    <input className="form-input" type="number" placeholder="0.00" value={newDebt.miktar} onChange={e => setNewDebt({...newDebt, miktar: e.target.value})} required />
                  </div>
                  <div className="input-group flex-1">
                    <label>Tür</label>
                    <select className="form-select" value={newDebt.tip} onChange={e => setNewDebt({...newDebt, tip: e.target.value})}>
                      <option>Borç</option>
                      <option>Alacak</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>Vade / Not (Opsiyonel)</label>
                  <input className="form-input" placeholder="Ay sonu, 15 Temmuz vb." value={newDebt.vade} onChange={e => setNewDebt({...newDebt, vade: e.target.value})} />
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>KAYDET</button>
              </form>
            </div>
          </div>
        )}

        {/* Add Credit Card Modal */}
        {isCardModalOpen && (
          <div className="modal-overlay" onClick={() => setIsCardModalOpen(false)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Yeni Kredi Kartı</h3>
                <button onClick={() => setIsCardModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              <form onSubmit={handleAddCard} className="flex-col gap-4">
                <div className="input-group">
                  <label>Kart Adı</label>
                  <input className="form-input" placeholder="Bonus, Axess vb." value={newCard.ad} onChange={e => setNewCard({...newCard, ad: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Kart No (Son 4 hane vb.)</label>
                  <input className="form-input" placeholder="VISA-4242" value={newCard.kod} onChange={e => setNewCard({...newCard, kod: e.target.value})} />
                </div>
                <div className="flex gap-3">
                  <div className="input-group flex-1">
                    <label>Limit (TRY)</label>
                    <input className="form-input" type="number" placeholder="0.00" value={newCard.limit} onChange={e => setNewCard({...newCard, limit: e.target.value})} required />
                  </div>
                  <div className="input-group flex-1">
                    <label>Güncel Borç (TRY)</label>
                    <input className="form-input" type="number" placeholder="0.00" value={newCard.güncelBorç} onChange={e => setNewCard({...newCard, güncelBorç: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>KAYDET</button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="modal-overlay" onClick={() => setEditingItem(null)}>
            <div className="modal-content animate-slide-up" style={{maxHeight:'90vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px', flexShrink:0}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Düzenle</h3>
                <button onClick={() => setEditingItem(null)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              
              <div style={{overflowY:'auto', paddingRight:'4px'}}>
                <form onSubmit={handleEditItem} className="flex-col gap-4">
                  {editingItem.ad !== undefined && (
                    <div className="input-group">
                      <label>Ad</label>
                      <input className="form-input" value={editingItem.ad} onChange={e => setEditingItem({...editingItem, ad: e.target.value})} />
                    </div>
                  )}
                  {editingItem.açıklama !== undefined && (
                    <div className="input-group">
                      <label>Açıklama</label>
                      <input className="form-input" value={editingItem.açıklama} onChange={e => setEditingItem({...editingItem, açıklama: e.target.value})} />
                    </div>
                  )}
                  {editingItem.isim !== undefined && (
                    <div className="input-group">
                      <label>İsim</label>
                      <input className="form-input" value={editingItem.isim} onChange={e => setEditingItem({...editingItem, isim: e.target.value})} />
                    </div>
                  )}
                  {editingItem.tür !== undefined && (
                    <div className="input-group">
                      <label>Tür</label>
                      <select className="form-select" value={editingItem.tür} onChange={e => setEditingItem({...editingItem, tür: e.target.value})}>
                        <option>Gider</option>
                        <option>Gelir</option>
                      </select>
                    </div>
                  )}
                  {editingItem.tip !== undefined && (
                    <div className="input-group">
                      <label>Tür</label>
                      <select className="form-select" value={editingItem.tip} onChange={e => setEditingItem({...editingItem, tip: e.target.value})}>
                        <option>Borç</option>
                        <option>Alacak</option>
                      </select>
                    </div>
                  )}
                  {editingItem.kategori !== undefined && (
                    <div className="input-group">
                      <label>Kategori</label>
                      <select className="form-select" value={editingItem.kategori} onChange={e => setEditingItem({...editingItem, kategori: e.target.value})}>
                        {["Market", "Maaş", "Eğlence", "Fatura", "Giyim", "Ulaşım", "Ek Gelir", "Diğer"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  {editingItem.varlık !== undefined && (
                    <div className="input-group">
                      <label>Ödeme Yöntemi / Varlık</label>
                      <select className="form-select" value={editingItem.varlık} onChange={e => setEditingItem({...editingItem, varlık: e.target.value})}>
                        <optgroup label="Hesaplar/Varlıklar">
                          {assets.map(a => <option key={a.id} value={a.ad}>{a.ad}</option>)}
                        </optgroup>
                        <optgroup label="Kredi Kartları">
                          {cards.map(c => <option key={c.id} value={c.ad}>{c.ad}</option>)}
                        </optgroup>
                      </select>
                    </div>
                  )}
                  <div className="input-group">
                    <label>Miktar / Bakiye / Borç / Limit</label>
                    <input className="form-input" type="number" 
                      value={editingItem.fiyat ?? editingItem.bakiye ?? editingItem.miktar ?? editingItem.güncelBorç ?? editingItem.limit} 
                      onChange={e => {
                        const val = e.target.value;
                        if (editingItem.fiyat !== undefined) setEditingItem({...editingItem, fiyat: val});
                        else if (editingItem.bakiye !== undefined) setEditingItem({...editingItem, bakiye: val});
                        else if (editingItem.miktar !== undefined) setEditingItem({...editingItem, miktar: val});
                        else if (editingItem.güncelBorç !== undefined) setEditingItem({...editingItem, güncelBorç: val});
                        else if (editingItem.limit !== undefined) setEditingItem({...editingItem, limit: val});
                      }} 
                    />
                  </div>
                  {(editingItem.kategori === 'Market') && (
                    <div className="glass" style={{padding:'16px', marginBottom:'16px', borderStyle:'dashed', borderColor:'var(--primary)'}}>
                      <label style={{fontSize:'10px', fontWeight:800, color:'var(--primary)', marginBottom:'12px', display:'block', textTransform:'uppercase'}}>Harcama Detayları</label>
                      <div className="flex-col gap-3">
                        {[
                          {id:'meyve', label:'Meyve/Sebze'},
                          {id:'aburcubur', label:'Abur Cubur'},
                          {id:'icecek', label:'İçecek'},
                          {id:'et', label:'Et/Süt/Şarküteri'},
                          {id:'temizlik', label:'Temizlik/Kişisel Bakım'},
                          {id:'diger_gida', label:'Diğer Gıda'},
                          {id:'diger', label:'Diğer'}
                        ].map(item => (
                          <div key={item.id} className="flex items-center gap-3">
                            <span style={{fontSize:'12px', flex:1}}>{item.label}</span>
                            <input 
                              className="form-input" 
                              style={{width:'100px', padding:'8px 12px'}} 
                              type="number" 
                              placeholder="0.00"
                              value={editingItem.detaylar?.find(d => d.id === item.id)?.miktar || ''}
                              onChange={e => {
                                const val = e.target.value;
                                const currentDetaylar = [...(editingItem.detaylar || [])];
                                const index = currentDetaylar.findIndex(d => d.id === item.id);
                                if (index > -1) {
                                  if (val === '') currentDetaylar.splice(index, 1);
                                  else currentDetaylar[index].miktar = val;
                                } else if (val !== '') {
                                  currentDetaylar.push({ id: item.id, isim: item.label, miktar: val });
                                }
                                
                                const total = currentDetaylar.reduce((sum, d) => sum + parseFloat(d.miktar || 0), 0);
                                setEditingItem({
                                  ...editingItem, 
                                  detaylar: currentDetaylar,
                                  fiyat: total > 0 ? total.toString() : editingItem.fiyat
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="submit" className="btn-primary" style={{marginTop:'8px', marginBottom:'24px'}}>GÜNCELLE</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {isDebtPayModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDebtPayModalOpen(false)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>
                  {payDebtState.debtType === 'Borç' ? 'Borç Öde' : 'Alacak Tahsil Et'}: {payDebtState.debtName}
                </h3>
                <button onClick={() => setIsDebtPayModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              <form onSubmit={handlePayDebt} className="flex-col gap-4">
                <div className="input-group">
                  <label>{payDebtState.debtType === 'Borç' ? 'Ödenecek Miktar' : 'Tahsil Edilecek Miktar'}</label>
                  <input className="form-input" type="number" placeholder="0.00" value={payDebtState.amount} onChange={e => setPayDebtState({...payDebtState, amount: e.target.value})} required />
                </div>
                <div className="input-group">
                  <label>Ödeme Hesabı</label>
                  <select className="form-select" value={payDebtState.varlık} onChange={e => setPayDebtState({...payDebtState, varlık: e.target.value})} required>
                    <option value="">Seçiniz</option>
                    <optgroup label="Hesaplar/Varlıklar">
                      {assets.map(a => <option key={a.id} value={a.ad}>{a.ad}</option>)}
                    </optgroup>
                    <optgroup label="Kredi Kartları">
                      {cards.map(c => <option key={c.id} value={c.ad}>{c.ad}</option>)}
                    </optgroup>
                  </select>
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>
                  {payDebtState.debtType === 'Borç' ? 'ÖDEMEYİ TAMAMLA' : 'TAHSİLATI TAMAMLA'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Modal */}
        {isTransferModalOpen && (
          <div className="modal-overlay" onClick={() => setIsTransferModalOpen(false)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Hesaplar Arası Transfer</h3>
                <button onClick={() => setIsTransferModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              <form onSubmit={handleTransfer} className="flex-col gap-4">
                <div className="input-group">
                  <label>Gönderen Hesap</label>
                  <select className="form-select" value={transferState.from} onChange={e => setTransferState({...transferState, from: e.target.value})} required>
                    <option value="">Seçiniz</option>
                    {assets.map(a => <option key={a.id} value={a.ad}>{a.ad}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Alan Hesap</label>
                  <select className="form-select" value={transferState.to} onChange={e => setTransferState({...transferState, to: e.target.value})} required>
                    <option value="">Seçiniz</option>
                    {assets.map(a => <option key={a.id} value={a.ad}>{a.ad}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Miktar (TRY)</label>
                  <input className="form-input" type="number" placeholder="0.00" value={transferState.amount} onChange={e => setTransferState({...transferState, amount: e.target.value})} required />
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>TRANSFER ET</button>
              </form>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)} style={{zIndex: 2000}}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{borderRadius:'32px 32px 0 0'}}>
              <div style={{textAlign:'center', padding:'20px 0'}}>
                <div className="icon-circle" style={{width:'64px', height:'64px', margin:'0 auto 20px', background:'rgba(255,77,77,0.1)', color:'var(--danger)'}}>
                  <Trash2 size={32}/>
                </div>
                <h3 style={{fontSize:'20px', fontWeight:900, marginBottom:'12px'}}>Emin misiniz?</h3>
                <p style={{color:'var(--text-dim)', fontSize:'14px', marginBottom:'32px'}}>
                  <strong>"{confirmDelete.name}"</strong> silinecek. Bu işlem geri alınamaz.
                </p>
                <div className="flex-col gap-3">
                  <button className="btn-primary" style={{background:'var(--danger)', boxShadow:'0 10px 20px rgba(255,77,77,0.3)'}} onClick={executeDelete}>EVET, SİL</button>
                  <button className="btn-text" style={{padding:'16px', fontSize:'14px', background:'transparent', border:'none', color:'var(--text-dim)'}} onClick={() => setConfirmDelete(null)}>VAZGEÇ</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Nav */}
        <nav className="bottom-nav">
          <NavItem icon={<LayoutGrid size={24}/>} label="Özet" active={activeTab==='home'} onClick={() => setActiveTab('home')} />
          <NavItem icon={<CardIcon size={24}/>} label="Varlık" active={activeTab==='wallet'} onClick={() => setActiveTab('wallet')} />
          <div className="fab-container">
            <button className="fab" onClick={() => setIsAddModalOpen(true)}><Plus size={32}/></button>
          </div>
          <NavItem icon={<History size={24}/>} label="İşlem" active={activeTab==='history'} onClick={() => setActiveTab('history')} />
          <NavItem icon={<TrendingDown size={24}/>} label="Borç" active={activeTab==='debts'} onClick={() => setActiveTab('debts')} />
        </nav>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {icon} <span>{label}</span>
    </button>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button style={{
      display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderRadius:'12px', border:'none',
      background: active ? 'rgba(79, 135, 255, 0.1)' : 'transparent',
      color: active ? 'var(--primary)' : 'var(--text-dim)',
      fontWeight: 700, textAlign:'left', width:'100%', cursor:'pointer'
    }} onClick={onClick}>
      {icon} {label}
    </button>
  );
}

function TransactionItem({ tx, onToggleMenu, menuOpen, onEdit, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{position:'relative', marginBottom: '16px'}}>
      <div 
        className="list-item" 
        onClick={() => setIsExpanded(!isExpanded)} 
        style={{
          alignItems: 'flex-start', 
          padding: '16px',
          borderRadius: isExpanded && tx.detaylar?.length > 0 ? '24px 24px 0 0' : '24px',
          borderBottom: isExpanded && tx.detaylar?.length > 0 ? 'none' : '1px solid var(--border)',
          marginBottom: isExpanded && tx.detaylar?.length > 0 ? '0' : '12px',
          transition: 'all 0.2s ease',
          background: 'var(--surface)'
        }}
      >
        <div style={{display:'flex', alignItems:'flex-start', gap:'16px', flex: 1}}>
          <div className="icon-circle" style={{
            background: tx.tür==='Gelir' ? 'rgba(16,185,129,0.1)' : 'rgba(255,77,77,0.1)',
            color: tx.tür==='Gelir' ? 'var(--success)' : 'var(--danger)',
            marginTop: '2px',
            flexShrink: 0
          }}>
            {tx.tür==='Gelir' ? <ArrowUpCircle size={22}/> : <ArrowDownCircle size={22}/>}
          </div>
          <div className="flex-col" style={{gap:'4px', overflow: 'hidden'}}>
            <h4 style={{fontSize:'16px', fontWeight:900, lineHeight:'1.2', wordBreak: 'break-word'}}>{tx.açıklama}</h4>
            <div className="flex-col" style={{gap:'2px'}}>
               <p style={{fontSize:'10px', color:'var(--text-dim)', fontWeight:800}}>Kategori: {tx.kategori}</p>
               <p style={{fontSize:'10px', color:'var(--primary)', fontWeight:800}}>Hesap: {tx.varlık || '...'}</p>
               <p style={{fontSize:'10px', color:'var(--text-dim)', fontWeight:600}}>Tarih: {tx.tarih ? new Date(tx.tarih.seconds*1000).toLocaleDateString("tr-TR") : '...'}</p>
            </div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'4px', marginLeft: '12px', flexShrink: 0, marginTop: '2px'}}>
          <span style={{fontSize:'16px', fontWeight:900, color: tx.tür==='Gelir' ? 'var(--success)' : 'white', whiteSpace: 'nowrap'}}>
            {tx.tür==='Gelir' ? '+' : '-'}₺{parseFloat(tx.fiyat || 0).toLocaleString("tr-TR")}
          </span>
          <button 
            className="glass icon-circle" 
            style={{width:'32px', height:'32px', border:'none', background:'transparent'}}
            onClick={(e) => { e.stopPropagation(); onToggleMenu(e); }}
          >
            <MoreVertical size={16} color="var(--text-dim)"/>
          </button>
        </div>
      </div>
      
      {/* Detail row - Toggleable and Merged */}
      {isExpanded && tx.detaylar && tx.detaylar.length > 0 && (
        <div style={{
          padding: '4px 16px 20px 54px',
          background: 'var(--surface)',
          borderRadius: '0 0 24px 24px',
          border: '1px solid var(--border)',
          borderTop: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '0',
          marginBottom: '12px'
        }}>
          {tx.detaylar.map(d => (
            <span key={d.id} style={{fontSize:'10px', color:'var(--text-dim)', background:'rgba(255,255,255,0.05)', padding:'4px 10px', borderRadius:'12px', fontWeight:600, border: '1px solid rgba(255,255,255,0.05)'}}>
              {d.isim}: ₺{parseFloat(d.miktar).toLocaleString("tr-TR")}
            </span>
          ))}
        </div>
      )}
      {menuOpen && (
        <div className="dropdown-menu">
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit2 size={16}/> Düzenle</button>
          <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={16}/> Sil</button>
        </div>
      )}
    </div>
  );
}

function AssetItem({ asset, onToggleMenu, menuOpen, onEdit, onDelete }) {
  return (
    <div style={{position:'relative'}}>
      <div className="list-item" onClick={onToggleMenu}>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <div className="icon-circle" style={{background:'rgba(79,135,255,0.1)', color:'var(--primary)'}}><CardIcon size={22}/></div>
          <div>
            <h4 style={{fontSize:'15px', fontWeight:700}}>{asset.ad}</h4>
            <p style={{fontSize:'11px', color:'var(--text-dim)', fontWeight:600}}>{asset.birim === 'TL' ? 'TRY' : asset.birim} Portföyü</p>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <span style={{fontSize:'18px', fontWeight:900}}>{asset.birim==='USD' ? '$' : '₺'}{parseFloat(asset.bakiye || 0).toLocaleString("tr-TR")}</span>
          <MoreVertical size={16} color="var(--text-dim)"/>
        </div>
      </div>
      {menuOpen && (
        <div className="dropdown-menu">
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit2 size={16}/> Düzenle</button>
          <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={16}/> Sil</button>
        </div>
      )}
    </div>
  );
}

function DebtItem({ debt, onToggleMenu, menuOpen, onEdit, onDelete, onPay }) {
  const isBorc = debt.tip === 'Borç';
  return (
    <div style={{position:'relative'}}>
      <div className="list-item" onClick={onToggleMenu}>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <div className="icon-circle" style={{
            background: isBorc ? 'rgba(255,77,77,0.1)' : 'rgba(16,185,129,0.1)',
            color: isBorc ? 'var(--danger)' : 'var(--success)'
          }}>
            {isBorc ? <TrendingDown size={20}/> : <TrendingUp size={20}/>}
          </div>
          <div>
            <h4 style={{fontSize:'15px', fontWeight:700}}>{debt.isim}</h4>
            <p style={{fontSize:'11px', color:'var(--text-dim)', fontWeight:600}}>{debt.tip} • {debt.vade || 'Vadesiz'}</p>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <span style={{fontSize:'17px', fontWeight:900, color: isBorc ? 'var(--danger)' : 'var(--success)'}}>₺{parseFloat(debt.miktar || 0).toLocaleString("tr-TR")}</span>
          <MoreVertical size={16} color="var(--text-dim)"/>
        </div>
      </div>
      {menuOpen && (
        <div className="dropdown-menu">
          <button className="menu-item" style={{color:'var(--success)'}} onClick={(e) => { e.stopPropagation(); onPay(); }}><Wallet size={16}/> Öde/Tahsil Et</button>
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit2 size={16}/> Düzenle</button>
          <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={16}/> Sil</button>
        </div>
      )}
    </div>
  );
}

function CardItem({ card, onToggleMenu, menuOpen, onEdit, onDelete }) {
  const percentUsed = Math.min(100, (parseFloat(card.güncelBorç || 0) / parseFloat(card.limit || 1)) * 100);
  return (
    <div style={{position:'relative'}}>
      <div className="list-item" onClick={onToggleMenu} style={{flexDirection:'column', alignItems:'stretch', gap:'12px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
            <div className="icon-circle" style={{background:'rgba(168,85,247,0.1)', color:'var(--secondary)'}}><CardIcon size={22}/></div>
            <div>
              <h4 style={{fontSize:'15px', fontWeight:700}}>{card.ad}</h4>
              <p style={{fontSize:'11px', color:'var(--text-dim)', fontWeight:600}}>{card.kod || 'Kredi Kartı'}</p>
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <span style={{fontSize:'17px', fontWeight:900, color: 'var(--danger)'}}>₺{parseFloat(card.güncelBorç || 0).toLocaleString("tr-TR")}</span>
            <MoreVertical size={16} color="var(--text-dim)"/>
          </div>
        </div>
        
        <div style={{marginTop:'4px'}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', fontWeight:800, color:'var(--text-dim)', marginBottom:'4px', textTransform:'uppercase'}}>
            <span>Kullanım</span>
            <span>Limit: ₺{parseFloat(card.limit || 0).toLocaleString("tr-TR")}</span>
          </div>
          <div style={{height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden'}}>
            <div style={{height:'100%', width:`${percentUsed}%`, background: percentUsed > 90 ? 'var(--danger)' : 'var(--secondary)', transition:'width 0.3s'}}></div>
          </div>
        </div>
      </div>
      {menuOpen && (
        <div className="dropdown-menu">
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit2 size={16}/> Düzenle</button>
          <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={16}/> Sil</button>
        </div>
      )}
    </div>
  );
}
