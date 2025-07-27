# 💻 Your Laptop Assistant – AI Telegram Bot

Your Laptop Assistant is an AI-powered assistant for a laptop repair technician. This Telegram bot consults clients, helps diagnose technical issues, provides optimal suggestions, and collects user requests for later follow-up.

## 🚀 Key Features

- Receives user messages via Telegram
- Determines the request category using AI (OpenAI GPT)
- Sends collected data to a Google Sheet via API
- Implements a multi-step conversational flow with AI-based validation
- Offers three main service categories:
  - Technical Maintenance
  - Operating System
  - Laptop & Components Buy/Sell
- Automatically respects business hours (with manual override support)
- Uses Webhook logic (ready for deployment on Railway, Render, or Azure)

## 📦 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/svitlanahavrylets/telegram-ai-bot-azure.git
   cd telegram-ai-bot-azure
   ```

2. Install dependencies:

npm install

3. Create a .env file with the following variables:

TELEGRAM_TOKEN=your_bot_token
WEBHOOK_URL=https://your-domain.com
OPENAI_API_KEY=your_openai_api_key

4. Run the bot locally:

npm run dev

## 🤖 Usage

- Open Telegram and search for the bot:@your_ai_assistant_and_helper_bot
- Choose a service category or type your question — the bot will detect the topic
- Answer follow-up questions to proceed
- User data will be stored in a Google Sheet for the technician to follow up
- If the technician is offline, the bot will collect and submit a contact form

## ☁️ Deployment

The bot uses Webhook-based logic and is ready for deployment on:

- Render
- Railway
- Azure App Service
- Or any server with HTTPS support

## 🛡️ Security

- Never commit .env files to a public repository
- Use .gitignore to exclude sensitive files
- For OpenAI usage, set rate limits or use dedicated API keys per project

## 📄 License

This project is licensed under the MIT License — feel free to use and adapt it ✨
