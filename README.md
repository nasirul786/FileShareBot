# 🚀 Telegram File Store Bot

A high-performance, **database-less** Telegram bot built with `grammy` to store and share files securely. It features batch uploads (up to 50 files), 4-digit PIN protection, and AES-256 encrypted access links.

## ✨ Features

- **📂 Batch File Storage**: Admin can send up to 50 files (images, videos, documents) and generate a single link.
- **🔐 PIN Protection**: Secure your links with an optional 4-digit numerical code.
- **🔒 AES-256 Encryption**: Access links are fully encrypted, ensuring file IDs are never exposed directly.
- **✨ Hybrid Storage**: Uses a private channel as the backbone for storage, keeping user chats clean.
- **⚡ Zero Database**: Operates without a database. It stores user IDs in a simple `.txt` file and packs all link metadata natively in the URL.
- **💎 Premium UI**: Auto-deletes admin uploads to keep the view clean and updates status messages dynamically.

## 🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/nasirul786/FileShareBot.git
cd FileShareBot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
BOT_TOKEN=your_bot_token_from_botfather
CHANNEL_ID=your_private_channel_id (e.g. -1001234567)
SECRET_KEY=any_strong_secret_phrase
ADMIN_ID=your_numeric_telegram_id
```

### 4. Bot Setup
- Create a **Private Channel** and add your bot as an **Admin** with "Post Messages" permission.
- Get your `CHANNEL_ID` and add it to `.env`.

### 5. Running the bot
```bash
node bot.js
```

## 🎮 How to Use

### For Admins:
1. **Send Files**: Simply send the files you want to store (images, videos, documents).
2. **Generate Link**: Click the **"Upload"** or **"Upload with lock"** button in the bot's dynamic status message.
3. **Set PIN**: If you chose "Upload with lock", enter a 4-digit code.
4. **Share**: Copy the generated link and share it anywhere!

### For Users:
1. **Click Link**: Open the sharing link (`t.me/botname?start=...`).
2. **Enter PIN**: If the link is locked, the bot will ask for the 4-digit code.
3. **One-Strike Security**: If the user enters a wrong PIN, access is immediately denied.
4. **Receive Files**: Once verified, the bot copies all files directly to the user's chat.

## 📜 License
This project is open-source and free to use.

---
*Created with ❤️ by [Nasirul](https://github.com/nasirul786)*
