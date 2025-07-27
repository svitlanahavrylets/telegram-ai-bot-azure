const axios = require("axios");

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

module.exports = { sendDataToGoogleSheets };
