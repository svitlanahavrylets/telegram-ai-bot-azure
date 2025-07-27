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
  console.log(`✅ Server is listening on port ${PORT}`);

  const domain = process.env.WEBHOOK_URL;
  if (!domain) {
    return console.error(
      "❗ Please specify WEBHOOK_URL in .env or Azure App Settings"
    );
  }

  const webhookUrl = `${domain}/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log("📌 Webhook has been set to:", webhookUrl);
});
