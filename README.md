# Personal Finance Management Suite

WhatDouBuy is a comprehensive finance management application consisting of a Python desktop/backend component and a modern Next.js mobile application (powered by Capacitor).

## 🚀 Features

- **Asset Management:** Track your assets in multiple currencies (TRY, USD).
- **Real-time Conversion:** Automatic USD to TRY conversion using live exchange rates.
- **Transaction History:** Record and categorize your income and expenses.
- **Debt Tracking:** Manage your debts and receivables with due dates.
- **Native Mobile Experience:** Built with Next.js and Capacitor for a premium native feel.
- **Cross-Platform:** Python-based administration tools and React-based mobile UI.

## 🛠 Tech Stack

- **Mobile:** Next.js (React), Lucide Icons, Capacitor (for Android).
- **Styling:** Vanilla CSS with a premium dark-mode design system.
- **Database:** Firebase Firestore for real-time data sync.
- **Backend/Tools:** Python (Firebase Admin SDK).

## 📁 Project Structure

- `/mobile`: Next.js web app and Android project files.
- `finance_app.py`: Main Python logic for data management.
- `add_expenses.py`: Utility script for bulk adding transactions.

## ⚙️ Setup

### Mobile App
1. Navigate to `/mobile`
2. Run `npm install`
3. Start development: `npm run dev`
4. Build for Android: `npm run build && npx cap sync android`

### Python Tools
1. Install dependencies: `pip install firebase-admin`
2. Ensure `serviceAccountKey.json` is present in the root (excluded from Git).
3. Run `python finance_app.py`

## 🔒 Security Note
Sensitve files like `serviceAccountKey.json` and internal Firebase environment variables are ignored in this repository. Ensure you provide your own configuration to run the project.

---
Developed with ❤️ for financial freedom.
