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
    tableHTML += '<th>Actions</th>';
    tableHTML += '</tr></thead>';
    
    // Create data rows
    tableHTML += '<tbody>';
    data.forEach((row, index) => {
      tableHTML += `<tr data-row-index="${index}">`;
      headers.forEach(header => {
        const cellValue = row[header] || '';
        tableHTML += `<td data-field="${header}">${cellValue}</td>`;
      });
      tableHTML += `<td><button class="edit-btn" onclick="editRow(${index})">Edit</button></td>`;
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

// Row editing functionality
let originalRowData = {};

function editRow(rowIndex) {
  const row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
  if (!row) return;

  // Store original data
  originalRowData[rowIndex] = {};
  const cells = row.querySelectorAll('td[data-field]');
  
  cells.forEach(cell => {
    const field = cell.getAttribute('data-field');
    const value = cell.textContent.trim();
    originalRowData[rowIndex][field] = value;
    
    // Convert cell to input field
    const input = createInputForField(field, value);
    cell.innerHTML = '';
    cell.appendChild(input);
  });

  // Replace edit button with save/cancel buttons
  const actionCell = row.querySelector('td:last-child');
  actionCell.innerHTML = `
    <button class="save-btn" onclick="saveRow(${rowIndex})">Save</button>
    <button class="cancel-btn" onclick="cancelEdit(${rowIndex})">Cancel</button>
  `;
}

function createInputForField(field, value) {
  let input;
  
  if (field === 'meal_type') {
    input = document.createElement('select');
    input.innerHTML = `
      <option value="">Select Meal Type</option>
      <option value="Breakfast">Breakfast</option>
      <option value="Lunch">Lunch</option>
      <option value="Dinner">Dinner</option>
      <option value="Snack">Snack</option>
    `;
    input.value = value;
  } else if (field === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    input.value = value;
  } else if (field === 'calories') {
    input = document.createElement('input');
    input.type = 'number';
    input.value = value;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = value;
  }
  
  input.style.width = '100%';
  input.style.padding = '0.25rem';
  input.style.border = '1px solid #ddd';
  input.style.borderRadius = '4px';
  
  return input;
}

function saveRow(rowIndex) {
  const row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
  if (!row) return;

  // Collect updated data
  const updatedData = {};
  const cells = row.querySelectorAll('td[data-field]');
  
  cells.forEach(cell => {
    const field = cell.getAttribute('data-field');
    const input = cell.querySelector('input, select');
    updatedData[field] = input.value;
  });

  // Show loading on save button
  const saveBtn = row.querySelector('.save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  // Update data via API (you'll need to implement this in your SheetsAPI)
  // For now, we'll just update the display
  cells.forEach(cell => {
    const field = cell.getAttribute('data-field');
    cell.textContent = updatedData[field];
  });

  // Reset action buttons
  const actionCell = row.querySelector('td:last-child');
  actionCell.innerHTML = `<button class="edit-btn" onclick="editRow(${rowIndex})">Edit</button>`;

  // Clean up original data
  delete originalRowData[rowIndex];
  
  console.log('Row updated:', updatedData);
  alert('Row updated successfully!');
}

function cancelEdit(rowIndex) {
  const row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
  if (!row) return;

  // Restore original data
  const cells = row.querySelectorAll('td[data-field]');
  cells.forEach(cell => {
    const field = cell.getAttribute('data-field');
    cell.textContent = originalRowData[rowIndex][field];
  });

  // Reset action buttons
  const actionCell = row.querySelector('td:last-child');
  actionCell.innerHTML = `<button class="edit-btn" onclick="editRow(${rowIndex})">Edit</button>`;

  // Clean up original data
  delete originalRowData[rowIndex];
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded, initializing dashboard...");
  
  // Show data container immediately for main page
  UIHelpers.showLoading(false);
});
