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

    console.log(
      "🔍 AI (step check):",
      response.data.choices?.[0]?.message?.content?.trim()
    );

    return (
      response.data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, we couldn’t get a response."
    );
  } catch (error) {
    console.error("OpenAI error:", error.response?.data || error.message);
    return "An error occurred while contacting AI. But we’re still running!";
  }
}
module.exports = { getAIResponse };
