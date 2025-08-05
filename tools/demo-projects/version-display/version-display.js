// A simple component to display tool versions in a web interface

class ToolVersionDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.versions = [];
  }

  static get observedAttributes() {
    return ['data-theme'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'data-theme') {
      this.render();
    }
  }

  set data(versions) {
    this.versions = versions;
    this.render();
  }

  connectedCallback() {
    this.render();
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
  }

  handleClick(event) {
    const action = event.target.dataset.action;
    if (action === 'refresh') {
      this.dispatchEvent(new CustomEvent('refresh-versions'));
    }
  }

  render() {
    const theme = this.getAttribute('data-theme') || 'light';
    
    const style = `
      :host {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .container {
        border: 1px solid ${theme === 'dark' ? '#555' : '#ddd'};
        border-radius: 8px;
        overflow: hidden;
        background: ${theme === 'dark' ? '#222' : '#fff'};
        color: ${theme === 'dark' ? '#eee' : '#333'};
      }
      .header {
        background: ${theme === 'dark' ? '#333' : '#f5f5f5'};
        padding: 12px 16px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .refresh-button {
        background: ${theme === 'dark' ? '#555' : '#e0e0e0'};
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        color: inherit;
      }
      .refresh-button:hover {
        background: ${theme === 'dark' ? '#666' : '#d0d0d0'};
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 8px 16px;
        text-align: left;
        border-bottom: 1px solid ${theme === 'dark' ? '#444' : '#eee'};
      }
      th {
        font-weight: normal;
        color: ${theme === 'dark' ? '#aaa' : '#666'};
      }
      .status {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;
      }
      .available {
        background-color: #4caf50;
      }
      .unavailable {
        background-color: #f44336;
      }
      .empty-state {
        padding: 24px;
        text-align: center;
        color: ${theme === 'dark' ? '#888' : '#999'};
      }
    `;
    
    let tableContent = '';
    
    if (this.versions.length === 0) {
      tableContent = `
        <div class="empty-state">
          No version information available.
          Click refresh to check tool versions.
        </div>
      `;
    } else {
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${this.versions.map(tool => `
              <tr>
                <td>${tool.name}</td>
                <td>${tool.version || 'N/A'}</td>
                <td>
                  <span class="status ${tool.available ? 'available' : 'unavailable'}"></span>
                  ${tool.available ? 'Available' : 'Not available'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="container">
        <div class="header">
          <span>Tool Versions</span>
          <button class="refresh-button" data-action="refresh">Refresh</button>
        </div>
        ${tableContent}
      </div>
    `;
  }
}

customElements.define('tool-version-display', ToolVersionDisplay);

// Export for module usage
export { ToolVersionDisplay };
