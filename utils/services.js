const axios = require("axios");

async function getServiceContent(columnName) {
  try {
    const response = await axios.get(
      "https://hook.eu2.make.com/5s4seh193zi2jw95lht18hrxggipbp4r"
    );
    return response.data[columnName] || "No data available at the moment.";
  } catch (error) {
    console.error("Failed to retrieve services:", error);
    return "An error occurred while loading services.";
  }
}

module.exports = { getServiceContent };
