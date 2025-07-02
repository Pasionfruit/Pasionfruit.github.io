console.log("Script loaded.");
// Using the working googleusercontent.com URL format with sheet parameters
const baseUrl = "https://script.google.com/macros/s/AKfycbxTMCxr-agTpxD-gqs5OGiCOujtIIuxMtwEu08ms_KTM8u3ZAWCDEl8vRCUCDtEjH7g/exec?";

const goalsEndpoint = `${baseUrl}&sheet=Goals`;
const foodEndpoint = `${baseUrl}&sheet=Food`;
const moneyEndpoint = `${baseUrl}&sheet=Money`;
const travelEndpoint = `${baseUrl}&sheet=Travel`;

// Function to fetch data from the specified endpoint
async function fetchData(endpoint, options = {}) {
  try { 
    const response = await fetch(endpoint, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

// Function to create a table from data
function createTable(data) {
  if (!data || data.length === 0) {
    return '<div class="empty-state">No data available</div>';
  }

  const headers = Object.keys(data[0]);
  
  let tableHTML = '<table class="data-table">';
  
  // Create header row
  tableHTML += '<thead><tr>';
  headers.forEach(header => {
    tableHTML += `<th>${header}</th>`;
  });
  tableHTML += '</tr></thead>';
  
  // Create data rows
  tableHTML += '<tbody>';
  data.forEach(row => {
    tableHTML += '<tr>';
    headers.forEach(header => {
      const cellValue = row[header] || '';
      tableHTML += `<td>${cellValue}</td>`;
    });
    tableHTML += '</tr>';
  });
  tableHTML += '</tbody></table>';
  
  return tableHTML;
}

// Function to render data in the specified container
function renderData(containerId, data) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = createTable(data);
  }
}

// Function to show loading state
function showLoading(show = true) {
  const loading = document.getElementById('loading');
  const dataContainer = document.getElementById('dataContainer');
  const errorMessage = document.getElementById('errorMessage');
  
  if (show) {
    loading.style.display = 'block';
    dataContainer.style.display = 'none';
    errorMessage.style.display = 'none';
  } else {
    loading.style.display = 'none';
    dataContainer.style.display = 'block';
  }
}

// Function to show error state
function showError() {
  const loading = document.getElementById('loading');
  const dataContainer = document.getElementById('dataContainer');
  const errorMessage = document.getElementById('errorMessage');
  
  loading.style.display = 'none';
  dataContainer.style.display = 'none';
  errorMessage.style.display = 'block';
}

// Function to load all data
async function loadAllData() {
  showLoading(true);
  
  try {
    // Fetch all data concurrently
    const [goalsData, foodData, moneyData, travelData] = await Promise.all([
      fetchData(goalsEndpoint),
      fetchData(foodEndpoint),
      fetchData(moneyEndpoint),
      fetchData(travelEndpoint)
    ]);

    // Render each dataset
    renderData('goalsData', goalsData);
    renderData('foodData', foodData);
    renderData('moneyData', moneyData);
    renderData('travelData', travelData);
    
    showLoading(false);
    
    console.log("All data loaded successfully");
  } catch (error) {
    console.error("Error loading data:", error);
    showError();
  }
}

// Function to handle form submission
function handleFormSubmit(event) {
  event.preventDefault(); // Prevent the default form submission behavior

  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  // Send the data to the appropriate endpoint
  fetchData(goalsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then(response => response.text())
    .then(data => {
      console.log("Success:", data);
      // Reload data after successful submission
      loadAllData();
    })
    .catch(error => console.error("Error:", error));
}

// Load data when the page loads
document.addEventListener('DOMContentLoaded', function() {
  loadAllData();
});