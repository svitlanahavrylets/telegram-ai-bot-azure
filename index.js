import axios from "axios";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { Telegraf, session, Markup } from "telegraf";
import systemPrompt from "./prompt.js";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(session());

function isWorkingHours() {
  const now = dayjs();
  const hour = now.hour();
  return hour >= 10 && hour < 18;
}

async function getWorkingStatus() {
  try {
    const response = await axios.get(
      "https://hook.eu2.make.com/5s4seh193zi2jw95lht18hrxggipbp4r"
    );

    const data = response.data;
    const manualOverride = data.manualOverride === "true";
    const isOpen = data.isOpen === "true";

    if (manualOverride) return true;
    return isOpen;
  } catch (err) {
    console.error("Не вдалося отримати графік:", err);
    return true;
  }
}

async function sendDataToGoogleSheets(data) {
  try {
    await axios.post(
      "https://hook.eu2.make.com/08ktt9547kxpdk4lng9rcd4bdmbtmahg",
      data
    );
    console.log("Дані успішно надіслані:", data);
  } catch (error) {
    console.error("Помилка відправки в Google Таблицю:", error);
  }
}

// Старт
bot.start(async (ctx) => {
  ctx.session = { step: 1, data: {} };
  await ctx.reply(
    "Привіт! Я — ваш помічник майстра з ремонту ноутбуків. Як вас звати?"
  );
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session;

  switch (session?.step) {
    case 1:
      session.data.name = text;
      session.step = 2;
      await ctx.reply("Дякую! Вкажіть, будь ласка, модель ноутбука.");
      break;

    case 2:
      session.data.model = text;
      session.step = 3;
      await ctx.reply("Скільки років вашому ноутбуку?");
      break;

    case 3:
      session.data.age = text;
      session.step = 4;
      await ctx.reply("Яка саме проблема або що ви хочете зробити?");
      break;

    case 4:
      session.data.problem = text;

      const aiReply = await getAIResponse(
        `Клієнт описав проблему: ${text}. Дай коротку дружню відповідь.`
      );
      await ctx.reply(aiReply);

      const workingStatus = await getWorkingStatus();

      if (workingStatus) {
        await ctx.reply(
          `Дякую за інформацію. Ми зараз працюємо, ви можете завітати особисто за адресою або зателефонувати:\n` +
            `📍 Київ, вул. Ушинського, 4\n` +
            `📞 +380930000000`
        );

        await sendDataToGoogleSheets(session.data);
        ctx.session = null;

        const servicesKeyboard = Markup.keyboard([
          ["🛠️ Технічне обслуговування"],
          ["💻 Операційна система"],
          ["🛒 Купівля / Продаж ноутбуків та комплектуючих"],
        ]).resize();

        await ctx.reply("Оберіть послугу:", servicesKeyboard);
      } else {
        session.step = 5;
        await ctx.reply(
          "Наразі ми не працюємо. Будь ласка, залиште свій номер телефону, щоб ми могли передзвонити у робочий час."
        );
      }
      break;

    case 5:
      session.data.phone = text;
      await ctx.reply("Дякую! Ми зв’яжемося з вами у робочий час.");

      await sendDataToGoogleSheets(session.data);
      ctx.session = null;
      break;

    default:
      await ctx.reply("Щоб почати, надішліть /start.");
  }
});

bot.hears("🛠️ Технічне обслуговування", async (ctx) => {
  const content = await getServiceContent("Технічне_обслуговування");
  await ctx.reply(content);
});

bot.hears("💻 Операційна система", async (ctx) => {
  const content = await getServiceContent("Операційна_система");
  await ctx.reply(content);
});

bot.hears("🛒 Купівля / Продаж ноутбуків та комплектуючих", async (ctx) => {
  const content = await getServiceContent("Купівля_Продаж");
  await ctx.reply(content);
});

console.log("Using model:", process.env.DEEPINFRA_MODEL);
console.log("Using API key:", process.env.DEEPINFRA_API_KEY ? "YES" : "NO");

async function getAIResponse(userInput) {
  try {
    const response = await axios.post(
      "https://api.deepinfra.com/v1/inference/meta-llama/Meta-Llama-3-8B-Instruct",
      {
        input: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userInput}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
        stop: ["<|eot_id|>"],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return (
      response.data.results?.[0]?.generated_text?.trim() ||
      "Вибачте, не вдалося отримати відповідь."
    );
  } catch (error) {
    console.error("DeepInfra error:", error.response?.data || error.message);
    return "Сталася помилка при зверненні до AI. Але ми продовжуємо працювати!";
  }
}

bot.launch();
