const axios = require("axios");
const dayjs = require("dayjs");

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
    console.error("Failed to fetch working schedule:", err);
    // In case of error — assuming technician is available to avoid losing a client.
    return { manualOverride: false, isOpen: true };
  }
}
module.exports = { isWorkingHours, getWorkingStatus };
