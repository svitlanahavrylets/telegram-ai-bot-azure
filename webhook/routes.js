const express = require("express");
const router = express.Router();
const bot = require("../bot");

router.get("/", async (req, res) => {
  try {
    const me = await bot.telegram.getMe();
    res.send(`🤖 Бот активний як @${me.username}`);
  } catch {
    res.status(500).send("Бот недоступний");
  }
});

router.post("/webhook", (req, res) => {
  bot.handleUpdate(req.body, res);
});

module.exports = router;
