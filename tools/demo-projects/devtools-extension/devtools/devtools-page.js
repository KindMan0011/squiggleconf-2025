/**
 * DevTools page script - registers the DevTools panel
 * This script runs in the context of the DevTools
 */

// Create a connection to the background page
const backgroundPageConnection = chrome.runtime.connect({
  name: "devtools-page"
});

// Inform the background page when a new DevTools window is opened
backgroundPageConnection.postMessage({
  action: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

// Create a DevTools panel
chrome.devtools.panels.create(
  "Network Insights",           // Panel title
  "/icons/icon16.png",          // Panel icon
  "/devtools/panel.html",       // Panel HTML page
  (panel) => {
    // Panel created callback
    console.log("Network Insights panel created");
    
    // Listen for panel showing/hiding events
    panel.onShown.addListener((panelWindow) => {
      backgroundPageConnection.postMessage({
        action: 'panel-shown',
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    });
    
    panel.onHidden.addListener(() => {
      backgroundPageConnection.postMessage({
        action: 'panel-hidden',
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    });
  }
);

// Add a sidebar pane to the Network panel
chrome.devtools.panels.network.createSidebarPane(
  "Request Metrics",
  (sidebar) => {
    // Update sidebar content when shown
    sidebar.onShown.addListener(() => {
      sidebar.setObject({ message: "Select a request to see metrics" });
    });
    
    // Respond to network request selection
    chrome.devtools.network.onRequestFinished.addListener(
      (request) => {
        // Only update if the sidebar is visible
        sidebar.setObject({
          url: request.request.url,
          method: request.request.method,
          status: request.response.status,
          statusText: request.response.statusText,
          timing: request.time,
          size: request.response.bodySize,
          type: request.response.content.mimeType,
          // Add more metrics as needed
        });
      }
    );
  }
);
