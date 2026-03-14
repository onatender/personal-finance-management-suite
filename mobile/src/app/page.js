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
  const [confirmDelete, setConfirmDelete] = useState(null); // { col, id, name }
  
  // Data State
  const [assets, setAssets] = useState([]);
  const [debts, setDebts] = useState([]);
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
    kategori: 'Mutfak',
    varlık: ''
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

    const unsubTx = onSnapshot(query(collection(db, "harcamalar"), orderBy("tarih", "desc"), limit(50)), (snap) => {
      setTransactions(snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          açıklama: d.açıklama || d.description || "İsimsiz",
          fiyat: parseFloat(d.fiyat || d.price || 0),
          kategori: d.kategori || d.category || "Genel",
          tür: d.tür || d.type || "Gider",
          tarih: d.tarih
        };
      }));
    });

    return () => { unsubAssets(); unsubDebts(); unsubTx(); };
  }, []);

  // Standardize 'TL' to 'TRY' in database
  useEffect(() => {
    assets.forEach(async (a) => {
      if (a.birim === "TL") {
        try {
          await updateDoc(doc(db, "varliklar", a.id), { birim: "TRY" });
        } catch (err) { console.error("Standardization error:", err); }
      }
    });
  }, [assets]);

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
    
    const netWorth = totalTRY + totalAlacak - totalBorc;

    setStats({
      balance: netWorth.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      income: inc.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      expense: exp.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      totalAssets: totalTRY.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      totalDebts: totalBorc.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      totalReceivables: totalAlacak.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
    });

    if (assets.length > 0 && !newTx.varlık) {
      setNewTx(prev => ({ ...prev, varlık: assets[0].ad }));
    }
  }, [assets, transactions, debts, usdRate]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.açıklama || !newTx.fiyat) return;

    try {
      await addDoc(collection(db, "harcamalar"), {
        ...newTx,
        fiyat: parseFloat(newTx.fiyat),
        tarih: serverTimestamp()
      });
      
      // Update asset balance
      const asset = assets.find(a => a.ad === newTx.varlık);
      if (asset) {
        const diff = newTx.tür === 'Gelir' ? parseFloat(newTx.fiyat) : -parseFloat(newTx.fiyat);
        await updateDoc(doc(db, "varliklar", asset.id), {
          bakiye: parseFloat(asset.bakiye || 0) + diff
        });
      }

      setNewTx({ açıklama: '', fiyat: '', tür: 'Gider', kategori: 'Mutfak', varlık: assets[0]?.ad || '' });
      setIsAddModalOpen(false);
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

  const handleEditItem = async (e) => {
    e.preventDefault();
    const { col, id, ...data } = editingItem;
    try {
      await updateDoc(doc(db, col, id), {
        ...data,
        // Convert numbers if necessary
        ...(data.fiyat !== undefined && { fiyat: parseFloat(data.fiyat) }),
        ...(data.bakiye !== undefined && { bakiye: parseFloat(data.bakiye) }),
        ...(data.miktar !== undefined && { miktar: parseFloat(data.miktar) })
      });
      setEditingItem(null);
    } catch (err) { alert("Hata: " + err.message); }
  };

  const deleteItem = async (col, id) => {
    const item = [...assets, ...transactions, ...debts].find(x => x.id === id);
    setConfirmDelete({ col, id, name: item?.ad || item?.açıklama || item?.isim || 'bu öğe' });
    setMenuOpenId(null);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, confirmDelete.col, confirmDelete.id));
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
                <button className="btn-text" onClick={() => setIsAssetModalOpen(true)}>+ YENİ HESAP</button>
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
                    />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Transaction Modal */}
        {isAddModalOpen && (
          <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Yeni İşlem Ekle</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
              
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
                    {["Mutfak", "Maaş", "Eğlence", "Fatura", "Giyim", "Ulaşım", "Ek Gelir", "Diğer"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Ödeme Yöntemi / Varlık</label>
                  <select className="form-select" value={newTx.varlık} onChange={e => setNewTx({...newTx, varlık: e.target.value})}>
                    {assets.map(a => <option key={a.id}>{a.ad}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>KAYDET</button>
              </form>
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

        {/* Edit Modal */}
        {editingItem && (
          <div className="modal-overlay" onClick={() => setEditingItem(null)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                <h3 style={{fontSize:'20px', fontWeight:900}}>Düzenle</h3>
                <button onClick={() => setEditingItem(null)} className="glass icon-circle" style={{width:'36px', height:'36px'}}><X size={20} color="var(--text-dim)"/></button>
              </div>
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
                      {["Mutfak", "Maaş", "Eğlence", "Fatura", "Giyim", "Ulaşım", "Ek Gelir", "Diğer"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div className="input-group">
                  <label>Miktar / Bakiye</label>
                  <input className="form-input" type="number" 
                    value={editingItem.fiyat ?? editingItem.bakiye ?? editingItem.miktar} 
                    onChange={e => {
                      const val = e.target.value;
                      if (editingItem.fiyat !== undefined) setEditingItem({...editingItem, fiyat: val});
                      else if (editingItem.bakiye !== undefined) setEditingItem({...editingItem, bakiye: val});
                      else if (editingItem.miktar !== undefined) setEditingItem({...editingItem, miktar: val});
                    }} 
                  />
                </div>
                <button type="submit" className="btn-primary" style={{marginTop:'8px'}}>GÜNCELLE</button>
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
  return (
    <div style={{position:'relative'}}>
      <div className="list-item" onClick={onToggleMenu}>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <div className="icon-circle" style={{
            background: tx.tür==='Gelir' ? 'rgba(16,185,129,0.1)' : 'rgba(255,77,77,0.1)',
            color: tx.tür==='Gelir' ? 'var(--success)' : 'var(--danger)'
          }}>
            {tx.tür==='Gelir' ? <ArrowUpCircle size={22}/> : <ArrowDownCircle size={22}/>}
          </div>
          <div>
            <h4 style={{fontSize:'15px', fontWeight:700}}>{tx.açıklama}</h4>
            <p style={{fontSize:'11px', color:'var(--text-dim)', fontWeight:600}}>{tx.kategori} • {tx.tarih ? new Date(tx.tarih.seconds*1000).toLocaleDateString("tr-TR") : '...'}</p>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <span style={{fontSize:'16px', fontWeight:900, color: tx.tür==='Gelir' ? 'var(--success)' : 'white'}}>
            {tx.tür==='Gelir' ? '+' : '-'}₺{parseFloat(tx.fiyat || 0).toLocaleString("tr-TR")}
          </span>
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

function DebtItem({ debt, onToggleMenu, menuOpen, onEdit, onDelete }) {
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
          <button className="menu-item" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit2 size={16}/> Düzenle</button>
          <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={16}/> Sil</button>
        </div>
      )}
    </div>
  );
}
