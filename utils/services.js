const axios = require("axios");

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

module.exports = { getServiceContent };
