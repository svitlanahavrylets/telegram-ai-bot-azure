const routes = require("./webhook/routes");
const express = require("express");
const dotenv = require("dotenv");
const bot = require("./bot");

dotenv.config();

const app = express();
app.use(express.json());
app.use("/", routes);

const PORT = process.env.PORT || 7000;
app.listen(PORT, async () => {
  console.log(`✅ Сервер слухає порт ${PORT}`);

  const domain = process.env.WEBHOOK_URL;
  if (!domain) {
    return console.error("❗ Вкажи WEBHOOK_URL у .env або Azure App Settings");
  }

  const webhookUrl = `${domain}/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log("📌 Webhook встановлено на:", webhookUrl);
});
