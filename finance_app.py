import sys
import os
import random
import requests
from datetime import datetime, timedelta
from firebase_admin import credentials, firestore
import firebase_admin
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QLabel, QLineEdit, QComboBox, QTableWidget, 
                             QTableWidgetItem, QHeaderView, QFrame, QDateEdit, QTabWidget,
                             QMessageBox, QProgressBar, QInputDialog, QGraphicsDropShadowEffect, QCheckBox)
from PySide6.QtCore import Qt, QDate, QSize, QPropertyAnimation, QEasingCurve
from PySide6.QtGui import QFont, QIcon, QColor, QPalette, QBrush, QLinearGradient
from qt_material import apply_stylesheet

# --- FIREBASE SETUP ---
KEY_PATH = "serviceAccountKey.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()

class PremiumCard(QFrame):
    def __init__(self, title, value, color="#ffffff", parent=None):
        super().__init__(parent)
        self.setFrameShape(QFrame.NoFrame)
        self.setMinimumHeight(120)
        self.setStyleSheet(f"""
            PremiumCard {{
                background-color: #2b2b3b;
                border-radius: 15px;
                border: 1px solid #3d3d4d;
            }}
            PremiumCard:hover {{
                background-color: #323245;
                border: 1px solid {color};
            }}
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 15, 20, 15)
        
        self.t_lbl = QLabel(title)
        self.t_lbl.setFont(QFont("Outfit", 11))
        self.t_lbl.setStyleSheet("color: #88889a; border: none; background: transparent;")
        
        self.v_lbl = QLabel(value)
        self.v_lbl.setFont(QFont("Outfit", 20, QFont.Bold))
        self.v_lbl.setStyleSheet(f"color: {color}; border: none; background: transparent;")
        
        layout.addWidget(self.t_lbl)
        layout.addWidget(self.v_lbl)
        
        # Shadow Effect
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(20)
        shadow.setXOffset(0)
        shadow.setYOffset(4)
        shadow.setColor(QColor(0, 0, 0, 80))
        self.setGraphicsEffect(shadow)

class BudgetApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("WhatDouBuy | Premium Finans Yönetimi")
        self.setMinimumSize(1000, 800)
        
        # Initialize Attributes BEFORE setup_ui
        self.usd_rate = 1.0
        self.asset_list = []
        self.all_transactions = []
        self.recurring_list = []
        
        self.setup_ui()
        self.load_data()
        self.update_usd_rate()

    def setup_ui(self):
        central_widget = QWidget()
        central_widget.setStyleSheet("background-color: #1a1a26;")
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(25, 25, 25, 25)
        main_layout.setSpacing(20)

        # Header Section
        header_layout = QHBoxLayout()
        
        title_vbox = QVBoxLayout()
        header = QLabel("💎 WhatDouBuy")
        header.setFont(QFont("Outfit", 26, QFont.Bold))
        header.setStyleSheet("color: #ffffff; border: none;")
        
        sub_header = QLabel("Akıllı Finansal Portföy Yönetimi")
        sub_header.setFont(QFont("Outfit", 10))
        sub_header.setStyleSheet("color: #666677; border: none;")
        
        title_vbox.addWidget(header)
        title_vbox.addWidget(sub_header)
        header_layout.addLayout(title_vbox)
        header_layout.addStretch()
        
        self.sync_btn = QPushButton("🔄 Senkronize Et")
        self.sync_btn.setFixedSize(160, 45)
        self.sync_btn.setCursor(Qt.PointingHandCursor)
        self.sync_btn.setObjectName("primary_btn")
        self.sync_btn.clicked.connect(self.load_data)
        header_layout.addWidget(self.sync_btn)
        
        main_layout.addLayout(header_layout)
        
        # Global Button Style
        self.setStyleSheet(self.styleSheet() + """
            QPushButton {
                background-color: #3498db;
                border-radius: 8px;
                padding: 8px 15px;
                color: white;
                font-weight: bold;
                border-bottom: 3px solid #2471a3;
            }
            QPushButton:hover {
                background-color: #5dade2;
            }
            QPushButton:pressed {
                border-bottom: 1px solid #2471a3;
                background-color: #2980b9;
                margin-top: 2px;
            }
            QTableWidget QPushButton {
                padding: 2px 5px;
                font-size: 12px;
                min-height: 24px;
            }
            QPushButton#danger_btn {
                background-color: #e74c3c;
                border-bottom: 3px solid #c0392b;
            }
            QPushButton#danger_btn:hover { background-color: #ec7063; }
            QPushButton#success_btn {
                background-color: #2ecc71;
                border-bottom: 3px solid #27ae60;
            }
            QPushButton#success_btn:hover { background-color: #58d68d; }
            QPushButton#action_btn {
                background-color: #9b59b6;
                border-bottom: 3px solid #8e44ad;
            }
        """)

        # Dashboard Summary
        summary_layout = QHBoxLayout()
        summary_layout.setSpacing(15)
        
        self.card_balance = PremiumCard("Net Portföy Değeri", "0.00 TL", "#ffffff")
        self.card_income = PremiumCard("Toplam Gelir", "0.00 TL", "#2ecc71")
        self.card_expense = PremiumCard("Toplam Gider", "0.00 TL", "#e74c3c")
        
        summary_layout.addWidget(self.card_balance)
        summary_layout.addWidget(self.card_income)
        summary_layout.addWidget(self.card_expense)
        main_layout.addLayout(summary_layout)

        # Tabs Setup
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet("""
            QTabWidget::pane { 
                border: 1px solid #2d2d3d; 
                border-radius: 12px; 
                background: #1e1e2e; 
                margin-top: -1px;
            }
            QTabBar::tab {
                background: transparent;
                padding: 12px 25px;
                color: #88889a;
                font-weight: bold;
                border-bottom: 2px solid transparent;
            }
            QTabBar::tab:selected {
                color: #ffffff;
                border-bottom: 3px solid #3498db;
                background: #2d2d3d;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
        """)
        main_layout.addWidget(self.tabs)

        self.setup_transactions_tab()
        self.setup_assets_tab()
        self.setup_transfer_tab()
        self.setup_recurring_tab()
        self.setup_reports_tab()

    def style_table(self, table):
        table.setFrameShape(QFrame.NoFrame)
        table.setShowGrid(False)
        table.setAlternatingRowColors(True)
        table.setStyleSheet("""
            QTableWidget {
                background-color: transparent;
                color: #e0e0e0;
                gridline-color: transparent;
                border: none;
            }
            QTableWidget::item {
                padding: 10px;
                background-color: transparent;
            }
            QTableWidget::item:selected {
                background-color: #3d3d4d;
                color: #ffffff;
            }
            QHeaderView::section {
                background-color: #2b2b3b;
                color: #88889a;
                padding: 8px;
                border: none;
                font-weight: bold;
                font-size: 11px;
                text-transform: uppercase;
            }
        """)
        table.horizontalHeader().setStretchLastSection(True)
        table.verticalHeader().setVisible(False)
        table.verticalHeader().setDefaultSectionSize(45)
        table.setSelectionBehavior(QTableWidget.SelectRows)
        table.setSelectionMode(QTableWidget.SingleSelection)

    def setup_transactions_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(15, 15, 15, 15)
        
        # Form
        form_frame = QFrame()
        form_frame.setStyleSheet("background-color: #2b2b3b; border-radius: 12px;")
        form_layout = QHBoxLayout(form_frame)
        form_layout.setContentsMargins(12, 12, 12, 12)
        
        self.desc_input = QLineEdit()
        self.desc_input.setPlaceholderText("Açıklama...")
        self.desc_input.setMinimumHeight(38)
        
        self.amount_input = QLineEdit()
        self.amount_input.setPlaceholderText("Miktar (TL)")
        
        self.type_input = QComboBox()
        self.type_input.addItems(["Gider", "Gelir"])
        
        self.asset_input = QComboBox()
        self.asset_input.setPlaceholderText("Varlık")
        
        self.cat_input = QComboBox()
        self.cat_input.addItems(["Mutfak", "Maaş", "Eğlence", "Fatura", "Giyim", "Ulaşım", "Ek Gelir", "Diğer"])
        
        self.date_input = QDateEdit(QDate.currentDate())
        self.date_input.setCalendarPopup(True)
        
        self.exclude_balance_cb = QCheckBox("Hesap Bakiyesine Etki Etmesin")
        
        add_btn = QPushButton("Ekle")
        add_btn.setMinimumHeight(38)
        add_btn.setStyleSheet("background-color: #3498db; color: white; font-weight: bold;")
        add_btn.clicked.connect(self.add_transaction)
        
        form_layout.addWidget(self.desc_input)
        form_layout.addWidget(self.amount_input)
        form_layout.addWidget(self.type_input)
        form_layout.addWidget(self.asset_input)
        form_layout.addWidget(self.cat_input)
        form_layout.addWidget(self.date_input)
        form_layout.addWidget(self.exclude_balance_cb)
        form_layout.addWidget(add_btn)
        
        layout.addWidget(form_frame)

        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["Tarih", "Açıklama", "Varlık", "Kategori", "Tür", "Fiyat"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.style_table(self.table)
        layout.addWidget(self.table)
        
        self.tabs.addTab(tab, "İşlemler")

    def setup_assets_tab(self):
        tab = QWidget()
        main_layout = QVBoxLayout(tab)
        main_layout.setContentsMargins(15, 15, 15, 15)
        
        # Horizontal Splitter for side-by-side tables
        h_layout = QHBoxLayout()
        h_layout.setSpacing(20)
        
        # --- LEFT SIDE: ASSETS ---
        assets_group = QFrame()
        assets_group.setStyleSheet("background-color: #2b2b3b; border-radius: 15px; border: none;")
        assets_layout = QVBoxLayout(assets_group)
        
        title_assets = QLabel("🏦 KASALAR VE HESAPLAR")
        title_assets.setFont(QFont("Outfit", 11, QFont.Bold))
        title_assets.setStyleSheet("color: #3498db; margin-bottom: 5px;")
        assets_layout.addWidget(title_assets)
        
        asset_form = QVBoxLayout()
        asset_form_h = QHBoxLayout()
        self.asset_name_input = QLineEdit()
        self.asset_name_input.setPlaceholderText("Hesap Adı")
        self.asset_balance_input = QLineEdit()
        self.asset_balance_input.setPlaceholderText("Miktar")
        self.asset_currency_input = QComboBox()
        self.asset_currency_input.addItems(["TL", "USD"])
        
        asset_form_h.addWidget(self.asset_name_input)
        asset_form_h.addWidget(self.asset_balance_input)
        asset_form_h.addWidget(self.asset_currency_input)
        
        asset_add_btn = QPushButton("➕ VARLIK EKLE")
        asset_add_btn.setMinimumHeight(45)
        asset_add_btn.setCursor(Qt.PointingHandCursor)
        asset_add_btn.setStyleSheet("""
            QPushButton {
                background-color: #2ecc71;
                border-radius: 10px;
                color: white;
                font-weight: bold;
                font-size: 14px;
                border-bottom: 4px solid #27ae60;
            }
            QPushButton:hover { background-color: #58d68d; }
            QPushButton:pressed { border-bottom: 2px solid #27ae60; margin-top: 2px; }
        """)
        asset_add_btn.clicked.connect(self.add_asset)
        
        asset_form.addLayout(asset_form_h)
        asset_form.addWidget(asset_add_btn)
        assets_layout.addLayout(asset_form)

        self.asset_table = QTableWidget(0, 4)
        self.asset_table.setHorizontalHeaderLabels(["Ad", "Bakiye", "Birim", "İşlem"])
        self.asset_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.style_table(self.asset_table)
        assets_layout.addWidget(self.asset_table)
        
        h_layout.addWidget(assets_group, 1)

        # --- RIGHT SIDE: DEBTS ---
        debt_group = QFrame()
        debt_group.setStyleSheet("background-color: #2b2b3b; border-radius: 15px; border: none;")
        debt_layout = QVBoxLayout(debt_group)
        
        title_debts = QLabel("💳 ALACAKLAR VE BORÇLAR")
        title_debts.setFont(QFont("Outfit", 11, QFont.Bold))
        title_debts.setStyleSheet("color: #f39c12; margin-bottom: 5px;")
        debt_layout.addWidget(title_debts)
        
        debt_form = QVBoxLayout()
        debt_form_h = QHBoxLayout()
        self.debt_name_input = QLineEdit()
        self.debt_name_input.setPlaceholderText("Kişi/Kurum")
        self.debt_amount_input = QLineEdit()
        self.debt_amount_input.setPlaceholderText("Miktar")
        self.debt_type_input = QComboBox()
        self.debt_type_input.addItems(["Alacak", "Borç"])
        
        debt_form_h.addWidget(self.debt_name_input)
        debt_form_h.addWidget(self.debt_amount_input)
        debt_form_h.addWidget(self.debt_type_input)
        
        debt_add_btn = QPushButton("➕ KAYIT EKLE")
        debt_add_btn.setMinimumHeight(45)
        debt_add_btn.setCursor(Qt.PointingHandCursor)
        debt_add_btn.setStyleSheet("""
            QPushButton {
                background-color: #f39c12;
                border-radius: 10px;
                color: white;
                font-weight: bold;
                font-size: 14px;
                border-bottom: 4px solid #d35400;
            }
            QPushButton:hover { background-color: #f5b041; }
            QPushButton:pressed { border-bottom: 2px solid #d35400; margin-top: 2px; }
        """)
        debt_add_btn.clicked.connect(self.add_debt)
        
        debt_form.addLayout(debt_form_h)
        debt_form.addWidget(debt_add_btn)
        debt_layout.addLayout(debt_form)

        self.debt_table = QTableWidget(0, 4)
        self.debt_table.setHorizontalHeaderLabels(["İsim", "Miktar", "Tür", "İşlemler"])
        self.debt_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.style_table(self.debt_table)
        debt_layout.addWidget(self.debt_table)
        
        h_layout.addWidget(debt_group, 1)
        
        main_layout.addLayout(h_layout)

        # Footer Info
        footer = QHBoxLayout()
        footer.setContentsMargins(10, 5, 10, 5)
        self.assets_total_lbl = QLabel("Net Varlık: 0.00 TL")
        self.assets_total_lbl.setFont(QFont("Outfit", 13, QFont.Bold))
        self.assets_total_lbl.setStyleSheet("color: #2ecc71;")
        
        self.usd_rate_lbl = QLabel("USD Kuru: --")
        self.usd_rate_lbl.setStyleSheet("color: #88889a;")
        
        footer.addWidget(self.assets_total_lbl)
        footer.addStretch()
        footer.addWidget(self.usd_rate_lbl)
        main_layout.addLayout(footer)
        
        self.tabs.addTab(tab, "Varlıklarım ve Borçlar")
        self.load_assets()
        self.load_debts()

    def setup_transfer_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(15, 15, 15, 15)

        form_frame = QFrame()
        form_frame.setStyleSheet("background-color: #2b2b3b; border-radius: 12px;")
        form_layout = QHBoxLayout(form_frame)
        form_layout.setContentsMargins(12, 12, 12, 12)

        self.transfer_from = QComboBox()
        self.transfer_from.setPlaceholderText("Gönderen Hesap")
        
        self.transfer_to = QComboBox()
        self.transfer_to.setPlaceholderText("Alan Hesap")

        self.transfer_amount = QLineEdit()
        self.transfer_amount.setPlaceholderText("Miktar")

        transfer_btn = QPushButton("Transfer Et")
        transfer_btn.setStyleSheet("background-color: #3498db; color: white; font-weight: bold;")
        transfer_btn.clicked.connect(self.process_transfer)

        form_layout.addWidget(QLabel("Gönderen:"))
        form_layout.addWidget(self.transfer_from)
        form_layout.addWidget(QLabel("Alan:"))
        form_layout.addWidget(self.transfer_to)
        form_layout.addWidget(self.transfer_amount)
        form_layout.addWidget(transfer_btn)

        layout.addWidget(form_frame)
        layout.addStretch()

        self.tabs.addTab(tab, "Para Transferi")

    def process_transfer(self):
        from_id = self.transfer_from.currentData()
        to_id = self.transfer_to.currentData()
        amt_text = self.transfer_amount.text()

        if not from_id or not to_id or not amt_text:
            QMessageBox.warning(self, "Uyarı", "Lütfen tüm alanları doldurun.")
            return

        if from_id == to_id:
            QMessageBox.warning(self, "Uyarı", "Aynı hesaba transfer yapılamaz.")
            return

        try:
            amt = float(amt_text.replace(",", "."))
            if amt <= 0: return

            transaction = db.transaction()
            from_ref = db.collection("varliklar").document(from_id)
            to_ref = db.collection("varliklar").document(to_id)

            @firestore.transactional
            def p_trans(trx, f_ref, t_ref, v):
                f_snap = f_ref.get(transaction=trx)
                t_snap = t_ref.get(transaction=trx)
                f_cur = f_snap.get("bakiye") if f_snap.exists else 0
                t_cur = t_snap.get("bakiye") if t_snap.exists else 0

                trx.update(f_ref, {"bakiye": f_cur - v})
                trx.update(t_ref, {"bakiye": t_cur + v})

            p_trans(transaction, from_ref, to_ref, amt)
            self.transfer_amount.clear()
            self.load_assets()
            QMessageBox.information(self, "Başarılı", "Transfer gerçekleştirildi.")
        except Exception as e:
            QMessageBox.critical(self, "Hata", str(e))

    def setup_recurring_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(15,15,15,15)
        
        form_frame = QFrame()
        form_frame.setStyleSheet("background-color: #2b2b3b; border-radius: 12px;")
        form_layout = QHBoxLayout(form_frame)
        
        self.rec_desc = QLineEdit()
        self.rec_desc.setPlaceholderText("Sabit Ödeme Adı")
        self.rec_amount = QLineEdit()
        self.rec_amount.setPlaceholderText("Miktar")
        self.rec_type = QComboBox()
        self.rec_type.addItems(["Gider", "Gelir"])
        self.rec_cat = QComboBox()
        self.rec_cat.addItems(["Mutfak", "Maaş", "Eğlence", "Fatura", "Giyim", "Ulaşım", "Ek Gelir", "Diğer"])
        rec_add_btn = QPushButton("+ Sabit Tanımla")
        rec_add_btn.setStyleSheet("background-color: #9b59b6; color: white; font-weight: bold;")
        rec_add_btn.clicked.connect(self.add_recurring)
        
        form_layout.addWidget(self.rec_desc)
        form_layout.addWidget(self.rec_amount)
        form_layout.addWidget(self.rec_type)
        form_layout.addWidget(self.rec_cat)
        form_layout.addWidget(rec_add_btn)
        
        layout.addWidget(form_frame)

        self.rec_table = QTableWidget(0, 4)
        self.rec_table.setHorizontalHeaderLabels(["Açıklama", "Kategori", "Tür", "Miktar"])
        self.rec_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.style_table(self.rec_table)
        layout.addWidget(self.rec_table)
        
        apply_btn = QPushButton("⚡ Seçili İşlemi Şimdi Onayla")
        apply_btn.setMinimumHeight(42)
        apply_btn.setStyleSheet("background-color: #34495e; color: white; font-weight: bold; border-radius: 8px;")
        apply_btn.clicked.connect(self.apply_recurring_transaction)
        layout.addWidget(apply_btn)
        
        self.tabs.addTab(tab, "Sabit Kalemler")
        self.load_recurring()

    def setup_reports_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(15,15,15,15)
        
        self.report_label = QLabel("Analizler burada listelenecek.")
        self.report_label.setAlignment(Qt.AlignCenter)
        self.report_label.setFont(QFont("Outfit", 14))
        self.report_label.setStyleSheet("color: #666;")
        layout.addWidget(self.report_label)
        self.tabs.addTab(tab, "Raporlar")

    def update_usd_rate(self):
        try:
            r = requests.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=5)
            self.usd_rate = r.json()["rates"]["TRY"]
            self.usd_rate_lbl.setText(f"Döviz: <b>1 USD = {self.usd_rate:.2f} TL</b>")
            self.calculate_total_assets()
        except:
            self.usd_rate_lbl.setText("Döviz Kuru Bilgisi Alınamadı")

    def add_asset(self):
        nm = self.asset_name_input.text()
        bl = self.asset_balance_input.text()
        curr = self.asset_currency_input.currentText()
        if not nm or not bl: return
        try:
            val = float(bl.replace(",", "."))
            db.collection("varliklar").add({"ad": nm, "bakiye": val, "birim": curr})
            self.asset_name_input.clear(); self.asset_balance_input.clear()
            self.load_assets()
        except: pass

    def load_assets(self):
        try:
            docs = db.collection("varliklar").stream()
            self.asset_table.setRowCount(0); self.asset_list = []
            self.asset_input.clear()
            if hasattr(self, 'transfer_from'):
                self.transfer_from.clear()
                self.transfer_to.clear()
            for doc in docs:
                d = doc.to_dict(); d['id'] = doc.id
                self.asset_list.append(d)
                self.asset_input.addItem(d['ad'], d['id'])
                if hasattr(self, 'transfer_from'):
                    self.transfer_from.addItem(d['ad'], d['id'])
                    self.transfer_to.addItem(d['ad'], d['id'])
                
                row = self.asset_table.rowCount()
                self.asset_table.insertRow(row)
                self.asset_table.setItem(row, 0, QTableWidgetItem(d['ad']))
                self.asset_table.setItem(row, 1, QTableWidgetItem(f"{d['bakiye']:,.2f}"))
                self.asset_table.setItem(row, 2, QTableWidgetItem(d['birim']))
                
                # Center button in cell with clean container
                btn_widget = QWidget()
                btn_widget.setStyleSheet("background: transparent; border: none;")
                btn_layout = QHBoxLayout(btn_widget)
                del_btn = QPushButton("🗑️")
                del_btn.setFixedSize(45, 32)
                del_btn.setObjectName("danger_btn")
                del_btn.clicked.connect(lambda ch, i=d['id']: self.delete_asset(i))
                btn_layout.addWidget(del_btn)
                btn_layout.setContentsMargins(0, 0, 0, 0)
                btn_layout.setSpacing(0)
                btn_layout.setAlignment(Qt.AlignCenter)
                self.asset_table.setCellWidget(row, 3, btn_widget)
            self.calculate_total_assets()
        except: pass

    def delete_asset(self, i):
        if QMessageBox.question(self, "Onay", "Varlığı sil?") == QMessageBox.Yes:
            db.collection("varliklar").document(i).delete(); self.load_assets()

    def calculate_total_assets(self):
        try:
            tl = sum(a['bakiye'] * (self.usd_rate if a['birim'] == 'USD' else 1) for a in self.asset_list)
            debts = db.collection("borclar").stream()
            for d in debts:
                x = d.to_dict()
                tl += x.get('miktar', 0) if x.get('tip') == 'Alacak' else -x.get('miktar', 0)
            self.assets_total_lbl.setText(f"Net Portföy: {tl:,.2f} TL")
            self.card_balance.v_lbl.setText(f"{tl:,.2f} TL")
        except Exception as e: print(f"Calc error: {e}")

    def add_debt(self):
        nm = self.debt_name_input.text()
        am = self.debt_amount_input.text()
        tp = self.debt_type_input.currentText()
        if not nm or not am: return
        try:
            val = float(am.replace(",", "."))
            db.collection("borclar").add({"isim": nm, "miktar": val, "tip": tp})
            self.debt_name_input.clear(); self.debt_amount_input.clear()
            self.load_debts()
        except: pass

    def load_debts(self):
        try:
            docs = db.collection("borclar").stream()
            self.debt_table.setRowCount(0)
            for doc in docs:
                d = doc.to_dict(); r = self.debt_table.rowCount()
                self.debt_table.insertRow(r)
                self.debt_table.setItem(r, 0, QTableWidgetItem(d['isim']))
                self.debt_table.setItem(r, 1, QTableWidgetItem(f"{d['miktar']:,.2f}"))
                self.debt_table.setItem(r, 2, QTableWidgetItem(d['tip']))
                
                box = QWidget(); l = QHBoxLayout(box); l.setContentsMargins(0,0,0,0); l.setSpacing(8)
                box.setStyleSheet("background: transparent; border: none;")
                
                upd = QPushButton("✏️"); upd.setFixedSize(40, 32)
                upd.clicked.connect(lambda ch, i=doc.id, v=d['miktar']: self.update_debt(i, v))
                
                del_b = QPushButton("🗑️"); del_b.setObjectName("danger_btn"); del_b.setFixedSize(40, 32)
                del_b.clicked.connect(lambda ch, i=doc.id: self.delete_debt(i))
                
                l.addStretch()
                l.addWidget(upd)
                l.addWidget(del_b)
                l.addStretch()
                l.setAlignment(Qt.AlignCenter)
                self.debt_table.setCellWidget(r, 3, box)
            self.calculate_total_assets()
        except: pass

    def update_debt(self, i, v):
        x, ok = QInputDialog.getDouble(self, "Güncelle", "Değişim (+/-):", 0, -1000000, 1000000, 2)
        if ok:
            nv = v + x
            if nv <= 0: db.collection("borclar").document(i).delete()
            else: db.collection("borclar").document(i).update({"miktar": nv})
            self.load_debts()

    def delete_debt(self, i):
        if QMessageBox.question(self, "Sil?", "Emin misiniz?") == QMessageBox.Yes:
            db.collection("borclar").document(i).delete(); self.load_debts()

    def add_transaction(self):
        ds = self.desc_input.text(); am = self.amount_input.text(); tp = self.type_input.currentText()
        as_id = self.asset_input.currentData(); as_nm = self.asset_input.currentText()
        if not as_id or not ds or not am: return
        exclude_bal = self.exclude_balance_cb.isChecked()
        try:
            val = float(am.replace(",", "."))
            dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            data = {"açıklama": ds, "fiyat": abs(val), "varlık_id": as_id, "varlık_adı": as_nm, 
                    "kategori": self.cat_input.currentText(), "tür": tp, "tarih": dt, "created_at": firestore.SERVER_TIMESTAMP,
                    "bakiye_etkilemez": exclude_bal}
            
            if exclude_bal:
                db.collection("harcamalar").add(data)
            else:
                transaction = db.transaction()
                asset_ref = db.collection("varliklar").document(as_id)
                @firestore.transactional
                def update_bal(trx, ref, v, t):
                    snap = ref.get(transaction=trx)
                    cur = snap.get("bakiye") if snap.exists else 0
                    trx.update(ref, {"bakiye": cur + (v if t == "Gelir" else -v)})
                
                update_bal(transaction, asset_ref, val, tp)
                db.collection("harcamalar").add(data)
            
            self.desc_input.clear(); self.amount_input.clear()
            self.exclude_balance_cb.setChecked(False)
            self.load_data(); self.load_assets()
        except Exception as e: QMessageBox.critical(self, "Hata", str(e))

    def add_recurring(self):
        ds = self.rec_desc.text(); am = self.rec_amount.text(); tp = self.rec_type.currentText()
        if not ds or not am: return
        try:
            val = float(am.replace(",", "."))
            db.collection("sabit_islemler").add({"açıklama": ds, "fiyat": val, "kategori": self.rec_cat.currentText(), "tür": tp})
            self.rec_desc.clear(); self.rec_amount.clear(); self.load_recurring()
        except: pass

    def load_recurring(self):
        try:
            docs = db.collection("sabit_islemler").stream()
            self.rec_table.setRowCount(0); self.recurring_list = []
            for doc in docs:
                d = doc.to_dict(); d['id'] = doc.id; self.recurring_list.append(d)
                r = self.rec_table.rowCount(); self.rec_table.insertRow(r)
                col = QColor("#2ecc71") if d['tür'] == "Gelir" else QColor("#e74c3c")
                items = [QTableWidgetItem(d['açıklama']), QTableWidgetItem(d['kategori']), QTableWidgetItem(d['tür']), QTableWidgetItem(f"{d['fiyat']:.2f} TL")]
                for i, item in enumerate(items):
                    if i >= 2: item.setForeground(col)
                    self.rec_table.setItem(r, i, item)
        except: pass

    def apply_recurring_transaction(self):
        r = self.rec_table.currentRow()
        if r < 0: return
        rec = self.recurring_list[r]
        try:
            db.collection("harcamalar").add({"açıklama": rec['açıklama'], "fiyat": rec['fiyat'], "kategori": rec['kategori'], 
                                            "tür": rec['tür'], "tarih": datetime.now(), "created_at": firestore.SERVER_TIMESTAMP})
            self.load_data()
        except: pass

    def load_data(self):
        try:
            docs = db.collection("harcamalar").order_by("tarih", direction=firestore.Query.DESCENDING).stream()
            self.table.setRowCount(0); inc = 0; exp = 0
            for doc in docs:
                d = doc.to_dict(); f = d.get('fiyat', 0); t = d.get('tür', 'Gider')
                if t == 'Gelir': inc += f
                else: exp += f
                row = self.table.rowCount(); self.table.insertRow(row)
                dt_str = d.get('tarih').strftime("%d.%m.%Y") if hasattr(d.get('tarih'), 'strftime') else "---"
                col = QColor("#2ecc71") if t == "Gelir" else QColor("#e74c3c")
                items = [QTableWidgetItem(dt_str), QTableWidgetItem(d.get('açıklama')), QTableWidgetItem(d.get('varlık_adı', '?')),
                         QTableWidgetItem(d.get('kategori')), QTableWidgetItem(t), QTableWidgetItem(f"{f:.2f} TL")]
                for i, item in enumerate(items):
                    if i >= 4: item.setForeground(col)
                    self.table.setItem(row, i, item)
            self.card_income.v_lbl.setText(f"{inc:,.2f} TL")
            self.card_expense.v_lbl.setText(f"{exp:,.2f} TL")
        except Exception as e: print(e)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    apply_stylesheet(app, theme='dark_teal.xml')
    window = BudgetApp()
    window.show()
    sys.exit(app.exec())
