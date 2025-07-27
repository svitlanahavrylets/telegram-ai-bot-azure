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
    "Hello! I'm your laptop repair assistant. Please choose an option:",
    Markup.keyboard([
      ["🛠️ Technical Maintenance"],
      ["💻 Operating System"],
      ["🛒 Buying / Selling Laptops and Parts"],
    ]).resize()
  );
});

bot.hears("🛠️ Technical Maintenance", async (ctx) => {
  ctx.session.selectedCategory = "Technical_Maintenance";
  const content = await getServiceContent("Technical_Maintenance");
  await ctx.reply(content);
  await askForNextStep(ctx);
});

bot.hears("💻 Operating System", async (ctx) => {
  ctx.session.selectedCategory = "Operating_System";
  const content = await getServiceContent("Operating_System");
  await ctx.reply(content);
  await askForNextStep(ctx);
});

bot.hears("🛒 Buying / Selling Laptops and Parts", async (ctx) => {
  ctx.session.selectedCategory = "Buying_Selling";
  const content = await getServiceContent("Buying_Selling");
  await ctx.reply(content);
  await askForNextStep(ctx);
});

async function askForNextStep(ctx) {
  if (ctx.session?.step && ctx.session.step !== "start") {
    return ctx.reply("Please complete the current form first 🙏");
  }

  const { manualOverride, isOpen } = await getWorkingStatus();
  const isWithinWorkingHours = isWorkingHours();

  const isWorking = manualOverride ? isOpen : isWithinWorkingHours;

  if (isWorking) {
    await ctx.reply(
      "If you have chosen a service or have further questions — feel free to visit us or call:\n📍 Kyiv, Ushynskoho St. 4\n📞 +380930000000"
    );
  } else {
    ctx.session.step = "collect_name";

    await ctx.reply(
      "The technician is currently unavailable. Please answer a few questions so we can get back to you later.",
      {
        reply_markup: { remove_keyboard: true },
      }
    );
    await ctx.reply("(1/3) How should we address you?");
  }
}

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session;

  if (!session.step || session.step === "start") {
    const aiCategory = await getAIResponse(
      `The client wrote: "${text}". Which of the three categories does it most relate to: "Technical Maintenance", "Operating System", or "Purchase / Sale"? Reply with only one of these names.`
    );
    const normalized = aiCategory.toLowerCase();
    if (normalized.includes("technical"))
      return bot.emit("hears", ctx, "🛠️ Technical Maintenance");
    if (normalized.includes("operating"))
      return bot.emit("hears", ctx, "💻 Operating System");
    if (normalized.includes("purchase") || normalized.includes("sale"))
      return bot.emit("hears", ctx, "🛒 Purchase / Sale of laptops and parts");
    return ctx.reply("Please use the buttons below or clarify your request.");
  }

  // Step-by-step data collection logic
  if (session.step === "collect_name") {
    session.data.name = text.trim();
    session.step = "collect_phone";
    return ctx.reply("(2/3) Please enter your phone number:");
  }

  if (session.step === "collect_phone") {
    session.data.phone = text.trim();
    session.step = "collect_problem";
    session.problemAttempts = 0;
    return ctx.reply(
      "(3/3) Please describe the issue with your laptop that needs to be solved:"
    );
  }

  if (session.step === "collect_problem") {
    if (!session.problemAttempts) session.problemAttempts = 0;
    session.tempProblem = text.trim();

    // AI checks for relevance and adequacy
    const aiReply = await getAIResponse(
      `The client wrote: "${session.tempProblem}". Does this look like a valid request related to laptop repair, maintenance, or buying/selling components?
Even if the description is short or has mistakes/mixed language, but the meaning is clear — reply "Yes".
If it's just random characters or nonsense (e.g., "asdfasdf", "qwerty"), reply "No".
Reply with only: "Yes" or "No".`
    );

    const isValid = aiReply.toLowerCase() === "yes";

    if (!isValid) {
      session.problemAttempts++;

      if (session.problemAttempts === 1) {
        return ctx.reply(
          "🤨 Hmm... That doesn’t really sound like a technical issue. Could you please try again and describe what’s not working or what exactly you need help with?"
        );
      } else {
        session.data.problem = session.tempProblem;
        await sendDataToGoogleSheets(session.data);
        ctx.session = null;
        return ctx.reply(
          "Well, I guess that’s exactly what the technician will get 🤷‍♂️ He’ll contact you during our next working hours. We’re usually available daily from 10:00 to 18:00."
        );
      }
    }
    // If the AI confirms the problem is valid
    const aiCheckDetails = await getAIResponse(
      `The client described the issue as: "${session.tempProblem}". Does this look like a valid technical request, even if it's brief?
Examples like "reinstall Windows", "clean the laptop", or "doesn't turn on" are considered sufficient.
Reply only: "Yes" or "No".`
    );

    if (aiCheckDetails.toLowerCase().includes("No")) {
      session.problemAttempts++;
      if (session.problemAttempts < 2) {
        return ctx.reply(
          "This description doesn't really help us understand the issue. Could you please provide more details or describe the symptoms more specifically? Please try again."
        );
      } else {
        session.data.problem = session.tempProblem;
        await sendDataToGoogleSheets(session.data);
        ctx.session = null;
        return ctx.reply(
          "Thank you! We’ll get in touch with you during our next working hours. We usually work daily from 10:00 to 18:00."
        );
      }
    } else {
      session.data.problem = session.tempProblem;
      await sendDataToGoogleSheets(session.data);

      await ctx.reply(
        "Thank you! We’ll get in touch with you during our next working hours. We usually work daily from 10:00 to 18:00."
      );

      ctx.session = null;
    }
  }
});

module.exports = bot;
