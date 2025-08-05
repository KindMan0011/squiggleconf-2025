/**
 * DevTools panel script
 * This runs in the context of the panel UI
 */

// Connect to the background page
const port = chrome.runtime.connect({
  name: "panel"
});

// Tell the background page that panel is open
port.postMessage({
  action: "panel-init",
  tabId: chrome.devtools.inspectedWindow.tabId
});

// Track all requests
let allRequests = [];
let requestsById = {};

// DOM elements
const totalRequestsEl = document.getElementById('total-requests');
const totalSizeEl = document.getElementById('total-size');
const avgLoadTimeEl = document.getElementById('avg-load-time');
const statusCodesEl = document.getElementById('status-codes');
const requestsTableEl = document.getElementById('requests-body');
const requestDetailsEl = document.getElementById('request-details');
const filterTypeEl = document.getElementById('filter-type');
const clearBtnEl = document.getElementById('clear-btn');
const exportBtnEl = document.getElementById('export-btn');

// Initialize the panel
function initPanel() {
  // Listen for messages from the background page
  port.onMessage.addListener((message) => {
    if (message.action === 'network-request') {
      addRequest(message.request);
    }
  });
  
  // Set up event listeners
  filterTypeEl.addEventListener('change', updateRequestsTable);
  clearBtnEl.addEventListener('click', clearData);
  exportBtnEl.addEventListener('click', exportData);
  
  // Ask for any existing data
  port.postMessage({
    action: "get-existing-data",
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

// Add a request to the UI
function addRequest(request) {
  // Add to our data stores
  allRequests.push(request);
  requestsById[request.id] = request;
  
  // Update the metrics
  updateMetrics();
  
  // Update the table (respecting filters)
  updateRequestsTable();
}

// Update the metrics display
function updateMetrics() {
  // Total requests
  totalRequestsEl.textContent = allRequests.length;
  
  // Total size
  const totalSize = allRequests.reduce((sum, req) => sum + (req.size || 0), 0);
  totalSizeEl.textContent = formatSize(totalSize);
  
  // Average load time
  const totalTime = allRequests.reduce((sum, req) => sum + (req.time || 0), 0);
  const avgTime = allRequests.length ? (totalTime / allRequests.length).toFixed(2) : 0;
  avgLoadTimeEl.textContent = `${avgTime} ms`;
  
  // Status codes distribution
  const statusCodes = {};
  allRequests.forEach(req => {
    const status = req.status || 0;
    statusCodes[status] = (statusCodes[status] || 0) + 1;
  });
  
  let statusText = '';
  Object.entries(statusCodes).sort().forEach(([code, count]) => {
    statusText += `${code}: ${count} `;
  });
  statusCodesEl.textContent = statusText || '-';
  
  // If we had a chart, we'd update it here
  // updateChart();
}

// Update the requests table based on current filter
function updateRequestsTable() {
  const filterType = filterTypeEl.value;
  
  // Clear the table
  requestsTableEl.innerHTML = '';
  
  // Filter requests if needed
  let filteredRequests = allRequests;
  if (filterType !== 'all') {
    filteredRequests = allRequests.filter(req => req.type === filterType);
  }
  
  // Add rows for filtered requests
  filteredRequests.forEach(request => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td title="${request.url}">${truncateUrl(request.url)}</td>
      <td>${request.type || 'unknown'}</td>
      <td>${request.method}</td>
      <td>${request.status}</td>
      <td>${formatSize(request.size)}</td>
      <td>${request.time.toFixed(2)} ms</td>
    `;
    
    // Set up click handler to show details
    row.addEventListener('click', () => showRequestDetails(request.id));
    
    // Add the row
    requestsTableEl.appendChild(row);
  });
}

// Show details for a specific request
function showRequestDetails(requestId) {
  const request = requestsById[requestId];
  if (!request) return;
  
  requestDetailsEl.classList.remove('hidden');
  
  // Get the details container
  const detailsContainer = requestDetailsEl.querySelector('.details-container');
  
  // Fill it with request details
  detailsContainer.innerHTML = `
    <div class="detail-group">
      <h3>General</h3>
      <div class="detail-item">
        <span class="detail-label">URL:</span>
        <span class="detail-value">${request.url}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Method:</span>
        <span class="detail-value">${request.method}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${request.status} ${request.statusText || ''}</span>
      </div>
    </div>
    
    <div class="detail-group">
      <h3>Timing</h3>
      <div class="detail-item">
        <span class="detail-label">Total Time:</span>
        <span class="detail-value">${request.time.toFixed(2)} ms</span>
      </div>
      <!-- We would add more timing details here in a real extension -->
    </div>
    
    <div class="detail-group">
      <h3>Headers</h3>
      <div class="headers-container">
        ${formatHeaders(request.requestHeaders, 'Request Headers')}
        ${formatHeaders(request.responseHeaders, 'Response Headers')}
      </div>
    </div>
  `;
}

// Format headers for display
function formatHeaders(headers, title) {
  if (!headers || headers.length === 0) {
    return `<div class="headers-section">
      <h4>${title}</h4>
      <p>No headers available</p>
    </div>`;
  }
  
  let html = `<div class="headers-section">
    <h4>${title}</h4>
    <div class="headers-list">`;
    
  headers.forEach(header => {
    html += `<div class="header-item">
      <span class="header-name">${header.name}:</span>
      <span class="header-value">${header.value}</span>
    </div>`;
  });
  
  html += `</div></div>`;
  return html;
}

// Clear all data
function clearData() {
  allRequests = [];
  requestsById = {};
  
  // Update UI
  updateMetrics();
  updateRequestsTable();
  requestDetailsEl.classList.add('hidden');
  
  // Tell background page to clear data
  port.postMessage({
    action: "clear-data",
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

// Export data as JSON
function exportData() {
  const dataStr = JSON.stringify(allRequests, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `network-insights-export-${new Date().toISOString()}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

// Helper: Format byte size to human-readable
function formatSize(bytes) {
  if (bytes === 0 || bytes === undefined) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// Helper: Truncate URL for display
function truncateUrl(url) {
  const maxLength = 50;
  if (url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    if (domain.length + 3 >= maxLength) {
      return domain.substring(0, maxLength - 3) + '...';
    }
    
    const availableChars = maxLength - domain.length - 3;
    const truncatedPath = path.length > availableChars
      ? path.substring(0, availableChars) + '...'
      : path;
      
    return domain + truncatedPath;
  } catch (e) {
    // Fallback for invalid URLs
    return url.substring(0, maxLength - 3) + '...';
  }
}

// Initialize the panel
initPanel();
