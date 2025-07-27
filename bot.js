const { Telegraf, session, Markup } = require("telegraf");
const { getAIResponse } = require("./utils/openai");
const { sendDataToGoogleSheets } = require("./utils/google");
const dotenv = require("dotenv");
const { getServiceContent } = require("./utils/services");
const { getWorkingStatus, isWorkingHours } = require("./utils/schedule");

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
bot.use(session());

process.on("unhandledRejection", (reason) =>
  console.error("Unhandled Rejection:", reason)
);
process.on("uncaughtException", (err) =>
  console.error("Uncaught Exception:", err)
);

console.log("Starting bot...");

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

  if (isWorking) {
    await ctx.reply(
      "Якщо ви обрали необхідне з переліку або якщо у вас виникли додаткові питання — завітайте або телефонуйте:\n📍 Київ, вул. Ушинського, 4\n📞 +380930000000"
    );
  } else {
    ctx.session.step = "collect_name";

    await ctx.reply(
      "Наразі майстер не працює. Дайте відповідь на кілька питань, щоб ми могли зв’язатися з вами пізніше.",
      {
        reply_markup: { remove_keyboard: true },
      }
    );
    await ctx.reply("(1/3) Як можна до вас звертатися?");
  }
}

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session;

  if (!session.step || session.step === "start") {
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

    const isValid = aiReply.toLowerCase() === "так";

    if (!isValid) {
      session.problemAttempts++;

      if (session.problemAttempts === 1) {
        return ctx.reply(
          "🤨 Гм... Це звучить не зовсім як технічна проблема. Можливо, спробуєте ще раз описати, що саме не працює або що вас цікавить?"
        );
      } else {
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

module.exports = bot;
