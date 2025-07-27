const axios = require("axios");
const systemPrompt = require("../prompt.js");

async function getAIResponse(userInput) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return (
      response.data.choices?.[0]?.message?.content?.trim() ||
      "Вибачте, не вдалося отримати відповідь."
    );
  } catch (error) {
    console.error("OpenAI error:", error.response?.data || error.message);
    return "Сталася помилка при зверненні до AI. Але ми продовжуємо працювати!";
  }
}
module.exports = { getAIResponse };
