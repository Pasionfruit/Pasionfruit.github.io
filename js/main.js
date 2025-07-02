// Main Application Logic
console.log("Dashboard loaded successfully!");

// UI Helper Functions
class UIHelpers {
  static createTable(data) {
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

  static renderData(containerId, data) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = this.createTable(data);
    }
  }

  static showLoading(show = true) {
    const loading = document.getElementById('loading');
    const dataContainer = document.getElementById('dataContainer');
    const errorMessage = document.getElementById('errorMessage');
    
    if (show) {
      if (loading) loading.style.display = 'block';
      if (dataContainer) dataContainer.style.display = 'none';
      if (errorMessage) errorMessage.style.display = 'none';
    } else {
      if (loading) loading.style.display = 'none';
      if (dataContainer) dataContainer.style.display = 'block';
    }
  }

  static showError() {
    const loading = document.getElementById('loading');
    const dataContainer = document.getElementById('dataContainer');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loading) loading.style.display = 'none';
    if (dataContainer) dataContainer.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'block';
  }
}

// Navigation Functions
function navigateTo(page) {
  window.location.href = page;
}

function goBack() {
  window.history.back();
}

// Form Handling
function handleFormSubmit(event, sheet = 'goals') {
  event.preventDefault();

  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  // Show loading state
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = 'Saving...';
  submitButton.disabled = true;

  // Post data
  SheetsAPI.postData(sheet, data)
    .then(response => {
      console.log("Success:", response);
      
      // Show success message
      alert('Data saved successfully!');
      
      // Reset form
      event.target.reset();
      
      // Reload data if on a data display page
      if (typeof loadPageData === 'function') {
        loadPageData();
      }
    })
    .catch(error => {
      console.error("Error:", error);
      alert('Error saving data. Please try again.');
    })
    .finally(() => {
      // Reset button
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing dashboard...");
  
  // Show data container immediately for main page
  UIHelpers.showLoading(false);
});
