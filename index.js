// import axios from "axios";
// import dotenv from "dotenv";
// import dayjs from "dayjs";
// import { Telegraf, session, Markup } from "telegraf";
// import systemPrompt from "./prompt.js";

const axios = require("axios");
const dotenv = require("dotenv");
const dayjs = require("dayjs");
const { Telegraf, session, Markup } = require("telegraf");
const systemPrompt = require("./prompt.js");

dotenv.config();

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(session());

console.log("Starting bot...");

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

    const manualOverride = String(data.manualOverride).toLowerCase() === "true";
    const isOpen = String(data.isOpen).toLowerCase() === "true";

    return { manualOverride, isOpen };
  } catch (err) {
    console.error("Не вдалося отримати графік:", err);
    // У разі помилки — вважаємо що майстер працює, аби не втратити клієнта
    return { manualOverride: false, isOpen: true };
  }
}

async function getServiceContent(columnName) {
  try {
    const response = await axios.get(
      "https://hook.eu2.make.com/5s4seh193zi2jw95lht18hrxggipbp4r"
    );
    return response.data[columnName] || "Наразі немає даних.";
  } catch (error) {
    console.error("Помилка при отриманні послуг:", error);
    return "Сталася помилка при завантаженні послуг.";
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

bot.start(async (ctx) => {
  ctx.session = { step: "start", data: {} };
  await ctx.reply(
    "Привіт! Я — помічник майстра з ремонту ноутбуків. Оберіть необхідну опцію:",
    Markup.keyboard([
      ["🛠️ Технічне обслуговування"],
      ["💻 Операційна система"],
      ["🛒 Купівля / Продаж ноутбуків та комплектуючих"],
    ]).resize()
  );
});

bot.hears("🛠️ Технічне обслуговування", async (ctx) => {
  ctx.session.selectedCategory = "Технічне_обслуговування";
  const content = await getServiceContent("Технічне_обслуговування");
  await ctx.reply(content);
  await askForNextStep(ctx);
});

bot.hears("💻 Операційна система", async (ctx) => {
  ctx.session.selectedCategory = "Операційна_система";
  const content = await getServiceContent("Операційна_система");
  await ctx.reply(content);
  await askForNextStep(ctx);
});

bot.hears("🛒 Купівля / Продаж ноутбуків та комплектуючих", async (ctx) => {
  ctx.session.selectedCategory = "Купівля_Продаж";
  const content = await getServiceContent("Купівля_Продаж");
  await ctx.reply(content);
  await askForNextStep(ctx);
});

async function askForNextStep(ctx) {
  if (ctx.session?.step && ctx.session.step !== "start") {
    return ctx.reply("Спершу завершіть поточне опитування 🙏");
  }

  const { manualOverride, isOpen } = await getWorkingStatus();
  const isWithinWorkingHours = isWorkingHours();

  const isWorking = manualOverride ? isOpen : isWithinWorkingHours;

  console.log("manualOverride:", manualOverride);
  console.log("isOpen:", isOpen);
  console.log("isWithinWorkingHours:", isWithinWorkingHours);
  console.log("→ isWorking:", isWorking);

  if (isWorking) {
    await ctx.reply(
      "Якщо ви обрали необхідне з переліку або якщо у вас виникли додаткові питання — завітайте або телефонуйте:\n📍 Київ, вул. Ушинського, 4\n📞 +380930000000"
    );
  } else {
    ctx.session.step = "collect_name";
    await ctx.reply("Починаємо опитування!", {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.reply(
      "Наразі майстер не працює. Дайте відповідь на кілька питань, щоб ми могли зв’язатися з вами пізніше."
    );
    await ctx.reply("(1/3) Як можна до вас звертатися?");
  }
}

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session;

  if (!session.step || session.step === "start") {
    // AI порада щодо категорії (твій існуючий код)
    const aiCategory = await getAIResponse(
      `Клієнт написав: "${text}". Яку з трьох категорій це найбільше стосується: "Технічне обслуговування", "Операційна система" чи "Купівля / Продаж"? Відповідай лише однією з цих назв.`
    );
    const normalized = aiCategory.toLowerCase();
    if (normalized.includes("технічне"))
      return bot.emit("hears", ctx, "🛠️ Технічне обслуговування");
    if (normalized.includes("операційна"))
      return bot.emit("hears", ctx, "💻 Операційна система");
    if (normalized.includes("купівля") || normalized.includes("продаж"))
      return bot.emit(
        "hears",
        ctx,
        "🛒 Купівля / Продаж ноутбуків та комплектуючих"
      );
    return ctx.reply(
      "Будь ласка, скористайтесь кнопками нижче або уточніть ваш запит."
    );
  }

  // Логіка поетапного збору даних
  if (session.step === "collect_name") {
    session.data.name = text.trim();
    session.step = "collect_phone";
    return ctx.reply("(2/3) Будь ласка, залиште свій номер телефону:");
  }

  if (session.step === "collect_phone") {
    session.data.phone = text.trim();
    session.step = "collect_problem";
    session.problemAttempts = 0;
    return ctx.reply(
      "(3/3) Опишіть проблему з ноутбуком, яку потрібно вирішити:"
    );
  }

  if (session.step === "collect_problem") {
    if (!session.problemAttempts) session.problemAttempts = 0;
    session.tempProblem = text.trim();

    // AI перевіряє на адекватність і відповідність тематиці
    const aiReply = await getAIResponse(
      `Клієнт написав: "${session.tempProblem}". Чи це схоже на реальний запит, пов'язаний із ремонтом, обслуговуванням або покупкою/продажем ноутбука чи комплектуючих?
  Навіть якщо опис короткий або містить помилки/суржик, але суть зрозуміла — відповідай "Так". 
  Якщо це просто набір випадкових слів або щось безглузде (наприклад, "х*й", "лорпорп"), відповідай "Ні". 
  Відповідь лише: "Так" або "Ні".`
    );

    const isValid = aiReply.toLowerCase().includes("так");

    if (!isValid) {
      session.problemAttempts++;

      if (session.problemAttempts === 1) {
        return ctx.reply(
          "🤨 Гм... Це звучить не зовсім як технічна проблема. Можливо, спробуєте ще раз описати, що саме не працює або що вас цікавить?"
        );
      } else {
        // Зберігаємо навіть дурницю, але чесно кажемо
        session.data.problem = session.tempProblem;
        await sendDataToGoogleSheets(session.data);
        ctx.session = null;
        return ctx.reply(
          "Ну що ж, прийдеться майстру так і передати 🤷‍♂️ Він зв’яжеться з вами у найближчий робочий час. Зазвичай ми працюємо щодня з 10:00 до 18:00."
        );
      }
    }

    // Якщо все ок — друга перевірка: чи достатньо інформативно?
    const aiCheckDetails = await getAIResponse(
      `Клієнт описав проблему: ${session.tempProblem}. Чи це виглядає як адекватний технічний запит, навіть якщо короткий?
  Наприклад, "переустановити windows", "почистити ноутбук", "не вмикається" — це достатньо.
  Відповідай лише: "Так" або "Ні".`
    );

    if (aiCheckDetails.toLowerCase().includes("ні")) {
      session.problemAttempts++;
      if (session.problemAttempts < 2) {
        return ctx.reply(
          "Такий опис проблеми не дуже допоможе нам вирішити проблему. Можливо, опишіть детальніше або конкретизуйте симптоми? Спробуйте ще раз."
        );
      } else {
        session.data.problem = session.tempProblem;
        await sendDataToGoogleSheets(session.data);
        ctx.session = null;
        return ctx.reply(
          "Дякуємо! Ми зв’яжемося з вами у найближчий робочий час. Зазвичай ми працюємо щодня з 10:00 до 18:00."
        );
      }
    } else {
      session.data.problem = session.tempProblem;
      await sendDataToGoogleSheets(session.data);

      await ctx.reply(
        "Дякуємо! Ми зв’яжемося з вами у найближчий робочий час. Зазвичай ми працюємо щодня з 10:00 до 18:00."
      );
      await ctx.reply("Натисніть кнопку нижче, щоб повернутись до меню.", {
        reply_markup: {
          keyboard: [["🔙 Головне меню"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      ctx.session = null;
    }
  }
});

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

console.log("Using API key:", process.env.DEEPINFRA_API_KEY ? "YES" : "NO");

bot.launch();

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Бот працює 👍");
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Express сервер слухає порт ${PORT}`);
});
