/**
 * Background script for the Network Insights extension
 * This manages network data and communication between DevTools and content
 */

// Keep track of connections and tabs
const connections = {};
const tabData = {};

// Handle connections from devtools or panel pages
chrome.runtime.onConnect.addListener(port => {
  const portName = port.name;
  
  if (portName === 'devtools-page') {
    // Handle initial setup message from devtools
    port.onMessage.addListener((message, sender) => {
      if (message.action === 'init') {
        const tabId = message.tabId;
        
        // Keep track of connection for this tab
        connections[tabId] = port;
        
        // Initialize data for this tab if needed
        if (!tabData[tabId]) {
          tabData[tabId] = {
            requests: [],
            nextRequestId: 1,
            isCapturing: true
          };
        }
        
        // Clean up when port disconnects
        port.onDisconnect.addListener(() => {
          delete connections[tabId];
        });
      } else if (message.action === 'panel-shown') {
        const tabId = message.tabId;
        if (tabData[tabId]) {
          tabData[tabId].isCapturing = true;
        }
      } else if (message.action === 'panel-hidden') {
        const tabId = message.tabId;
        if (tabData[tabId]) {
          tabData[tabId].isCapturing = false;
        }
      }
    });
  } else if (portName === 'panel') {
    // Handle messages from panel UI
    port.onMessage.addListener((message, sender) => {
      if (message.action === 'get-existing-data') {
        const tabId = message.tabId;
        if (tabData[tabId] && tabData[tabId].requests) {
          // Send existing requests to the panel
          tabData[tabId].requests.forEach(request => {
            port.postMessage({
              action: 'network-request',
              request
            });
          });
        }
      } else if (message.action === 'clear-data') {
        const tabId = message.tabId;
        if (tabData[tabId]) {
          tabData[tabId].requests = [];
          tabData[tabId].nextRequestId = 1;
        }
      }
    });
    
    // Clean up when panel disconnects
    port.onDisconnect.addListener(() => {
      // No specific cleanup needed here
    });
  }
});

// Listen for web requests
chrome.webRequest.onCompleted.addListener(
  details => {
    const tabId = details.tabId;
    
    // Skip if it's not associated with a tab or we're not tracking this tab
    if (tabId < 0 || !tabData[tabId] || !tabData[tabId].isCapturing) {
      return;
    }
    
    // Process request
    processRequest(tabId, details);
  },
  { urls: ["<all_urls>"] }
);

// Process and store information about a completed request
function processRequest(tabId, details) {
  const url = details.url;
  const method = details.method;
  const type = getRequestType(details.type, url);
  const status = details.statusCode;
  const size = details.responseSize || 0;
  const time = details.timeStamp - details.timeStamp; // This would be calculated properly in a real extension
  
  // Create request object
  const request = {
    id: tabData[tabId].nextRequestId++,
    url,
    method,
    type,
    status,
    statusText: getStatusText(status),
    size,
    time,
    timeStamp: details.timeStamp,
    requestHeaders: [], // Would be populated in a real extension
    responseHeaders: [] // Would be populated in a real extension
  };
  
  // Store the request
  tabData[tabId].requests.push(request);
  
  // Send to devtools if connected
  if (connections[tabId]) {
    connections[tabId].postMessage({
      action: 'network-request',
      request
    });
  }
}

// Helper: Determine the request type based on content type and URL
function getRequestType(webRequestType, url) {
  // Map webRequest types to our own categories
  switch (webRequestType) {
    case 'xmlhttprequest':
      return 'xhr';
    case 'script':
      return 'js';
    case 'stylesheet':
      return 'css';
    case 'image':
      return 'img';
    case 'font':
      return 'font';
    case 'main_frame':
      return 'html';
    case 'sub_frame':
      return 'iframe';
    default:
      // Try to determine type from URL extension
      const extension = url.split('.').pop().split('?')[0].toLowerCase();
      switch (extension) {
        case 'js':
          return 'js';
        case 'css':
          return 'css';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg':
          return 'img';
        case 'woff':
        case 'woff2':
        case 'ttf':
        case 'otf':
        case 'eot':
          return 'font';
        case 'html':
        case 'htm':
          return 'html';
        case 'json':
          return 'xhr';
        default:
          return 'other';
      }
  }
}

// Helper: Get HTTP status text
function getStatusText(status) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  
  return statusTexts[status] || '';
}
