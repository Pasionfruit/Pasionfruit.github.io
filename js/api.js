// API Configuration
const CONFIG = {
  // Base URL for Google Sheets API
  baseUrl: "https://script.google.com/macros/s/AKfycbxTMCxr-agTpxD-gqs5OGiCOujtIIuxMtwEu08ms_KTM8u3ZAWCDEl8vRCUCDtEjH7g/exec",
  
  // Sheet endpoints
  endpoints: {
    goals: "Goals",
    food: "Food", 
    money: "Money",
    travel: "Travel"
  }
};

// API Functions
class SheetsAPI {
  static async fetchData(sheet, options = {}) {
    try {
      const url = `${CONFIG.baseUrl}?sheet=${sheet}`;
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching ${sheet} data:`, error);
      throw error;
    }
  }

  static async postData(sheet, data) {
    try {
      const url = `${CONFIG.baseUrl}?sheet=${sheet}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error(`Error posting to ${sheet}:`, error);
      throw error;
    }
  }

  static async getAllData() {
    try {
      const [goalsData, foodData, moneyData, travelData] = await Promise.all([
        this.fetchData(CONFIG.endpoints.goals),
        this.fetchData(CONFIG.endpoints.food),
        this.fetchData(CONFIG.endpoints.money),
        this.fetchData(CONFIG.endpoints.travel)
      ]);

      return {
        goals: goalsData,
        food: foodData,
        money: moneyData,
        travel: travelData
      };
    } catch (error) {
      console.error("Error loading all data:", error);
      throw error;
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, SheetsAPI };
}
