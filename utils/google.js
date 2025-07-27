const axios = require("axios");

async function sendDataToGoogleSheets(data) {
  try {
    await axios.post(
      "https://hook.eu2.make.com/08ktt9547kxpdk4lng9rcd4bdmbtmahg",
      data
    );
    console.log("Data sent successfully:", data);
  } catch (error) {
    console.error("Failed to send data to Google Sheet:", error);
  }
}

module.exports = { sendDataToGoogleSheets };
