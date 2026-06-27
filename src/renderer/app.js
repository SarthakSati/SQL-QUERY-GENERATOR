const api = window.easySql;

const state = {
  connected: false,
  databases: [],
  selectedDatabase: "",
  schemaStatus: "Connect in Settings, then choose a database.",
  ollamaUrl: "http://localhost:11434",
  models: [],
  selectedModel: "",
  userRequest: "",
  sqlPreview: "",
  originalGeneratedSql: "",
  classification: "",
  result: null,
  history: [],
  loading: "",
  message: null,
  showSettings: true,
  showHistory: false,
  modelsLoadedFor: ""
};

const app = document.getElementById("app");

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function render() {
  const dbText = state.selectedDatabase ? `📁 ${state.selectedDatabase}` : "📁 No Database";
  const modelText = state.selectedModel ? `🤖 ${state.selectedModel}` : "🤖 No Model";
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <img class="brand-icon" src="../assets/easy-sql-icon.svg" alt="Easy-SQL" />
          <div>
            <h1>Easy-SQL</h1>
            <div class="subtle">${dbText} &nbsp;|&nbsp; ${modelText}</div>
          </div>
        </div>
        <div class="top-actions">
          <span class="connection-dot ${state.connected ? "online" : ""}" title="${state.connected ? "Connected to MySQL" : "Disconnected"}"></span>
          <button id="settingsButton" class="ghost-button">⚙️ Settings</button>
          <button id="historyButton" class="ghost-button">🕒 History</button>
        </div>
      </header>
      <main class="workspace">
        <aside class="database-rail">${renderDatabase()}</aside>
        <section class="results-zone">${renderResults()}</section>
        <aside class="query-zone">${renderEditor()}</aside>
      </main>
      ${state.showSettings ? renderSettings() : ""}
      ${state.showHistory ? renderHistoryDrawer() : ""}
    </div>
  `;
  bindEvents();
}

function renderDatabase() {
  const options = state.databases.map((database) => `<option value="${escapeHtml(database)}" ${database === state.selectedDatabase ? "selected" : ""}>🗄️ ${escapeHtml(database)}</option>`).join("");
  return `
    <section class="surface full-height">
      <div class="section-title">
        <h2>Database</h2>
        <button id="refreshDatabases" class="icon-button" title="Refresh databases" ${!state.connected || state.loading ? "disabled" : ""}>↻</button>
      </div>
      <label>Active Connection
        <select id="databaseSelect" ${!state.connected ? "disabled" : ""}>
          <option value="">Choose Database</option>
          ${options}
        </select>
      </label>
      <div class="notice">${escapeHtml(state.schemaStatus)}</div>
      <div class="rail-meta">
        <div>Status: ${state.connected ? "Connected" : "Disconnected"}</div>
        <div>Schema: ${state.selectedDatabase ? "Active Schema Loaded" : "No Active Schema"}</div>
      </div>
    </section>
  `;
}

function renderEditor() {
  const classification = state.classification === "READ_QUERY"
    ? `<span id="classificationLabel" class="classification read">👁️ Read Query</span>`
    : state.classification === "WRITE_OR_STRUCTURE_QUERY"
      ? `<span id="classificationLabel" class="classification write">⚠️ Write/Structure Query</span>`
      : `<span id="classificationLabel" class="classification">Not classified</span>`;

  const generateBtnText = state.loading === "generate" ? "✨ Generating..." : "✨ Generate SQL";
  const runBtnText = state.loading === "run" ? "⚡ Running..." : "⚡ Run Query";

  return `
    <section class="surface full-height editor-surface">
      <label>Prompt / Request
        <textarea id="userRequest" class="request-box" placeholder="e.g., Show me all customers from Delhi.">${escapeHtml(state.userRequest)}</textarea>
      </label>
      <div class="button-row">
        <button id="generateSql" ${!canGenerate() || state.loading ? "disabled" : ""}>${generateBtnText}</button>
        <button id="clearSql" class="secondary">🧹 Clear</button>
      </div>
      <label>SQL Editor
        <textarea id="sqlPreview" class="sql-editor" spellcheck="false" placeholder="Generated or handwritten SQL will appear here.">${escapeHtml(state.sqlPreview)}</textarea>
      </label>
      <div class="run-row">
        ${classification}
        <button id="runSql" ${state.loading ? "disabled" : ""}>${runBtnText}</button>
      </div>
      ${renderMessageFor("query")}
    </section>
  `;
}

function renderResults() {
  if (!state.result) {
    return `
      <section class="surface full-height results-empty">
        <div>
          <h2 style="font-size: 24px; margin-bottom: 12px;">📊</h2>
          <h2>Query Results</h2>
          <p>Run a select query to view rows, or write queries to inspect affected records, database warnings, or connection errors.</p>
        </div>
      </section>
    `;
  }

  if (state.result.kind === "rows") {
    const headers = state.result.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
    const rows = state.result.rows.map((row) => `
      <tr>${state.result.columns.map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`).join("")}</tr>
    `).join("");
    const warning = state.result.selectWithoutLimit
      ? `<div class="notice warn">⚠️ This read query has no LIMIT. Showing up to ${state.result.displayLimit} rows.</div>`
      : "";
    return `
      <section class="surface full-height results-surface">
        <div class="section-title">
          <div>
            <h2 style="color: var(--ink-bright)">Results</h2>
            <p class="subtle">🟢 ${state.result.rowCount} row(s) returned</p>
          </div>
          <button id="exportCsv" class="secondary">📥 Export CSV</button>
        </div>
        ${warning}
        <div class="results-wrap">
          <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
        </div>
      </section>
    `;
  }

  return `
    <section class="surface full-height results-surface">
      <div class="section-title">
        <h2 style="color: var(--ink-bright)">Results</h2>
      </div>
      <div class="notice ok">✔️ ${escapeHtml(state.result.message)}</div>
      <div class="rail-meta" style="margin-top: 16px; border-top: none; padding-top: 0;">
        <div>Affected rows: <strong>${state.result.affectedRows}</strong></div>
        <div>Warnings: <strong>${state.result.warningStatus}</strong></div>
      </div>
    </section>
  `;
}

function renderSettings() {
  const modelOptions = state.models.map((model) => {
    const label = model.recommended ? `⭐ ${model.name} (recommended)` : model.name;
    return `<option value="${escapeHtml(model.name)}" ${model.name === state.selectedModel ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");

  const connectBtnText = state.loading === "login" ? "🔌 Connecting..." : "🔌 Connect MySQL";

  return `
    <div class="overlay">
      <section class="drawer settings-drawer">
        <div class="drawer-header">
          <div>
            <h2>Settings</h2>
            <p>Connection and model configuration</p>
          </div>
          <button id="closeSettings" class="icon-button" title="Close settings">✕</button>
        </div>
        <form class="form-grid" id="loginForm">
          <h3>MySQL Server</h3>
          <div class="field-row">
            <label>Host<input id="mysqlHost" value="localhost" autocomplete="off" placeholder="localhost" /></label>
            <label>Port<input id="mysqlPort" type="number" value="3306" min="1" max="65535" placeholder="3306" /></label>
          </div>
          <label>Username<input id="mysqlUser" autocomplete="username" placeholder="root" /></label>
          <label>Password<input id="mysqlPassword" type="password" autocomplete="current-password" placeholder="••••••••" /></label>
          <button type="submit" ${state.loading ? "disabled" : ""}>${connectBtnText}</button>
          ${renderMessageFor("login")}
        </form>
        <div class="form-grid">
          <h3>Ollama AI</h3>
          <label>Ollama Endpoint URL<input id="ollamaUrl" value="${escapeHtml(state.ollamaUrl)}" placeholder="http://localhost:11434" /></label>
          <label>Model
            <select id="modelSelect" ${state.loading === "models" ? "disabled" : ""}>
              <option value="">${state.loading === "models" ? "Loading models..." : "Choose model"}</option>
              ${modelOptions}
            </select>
          </label>
          <div class="recommendation">💡 Recommended coding models: <strong>qwen2.5-coder:3b</strong> or greater, or <strong>codegemma:7b</strong>. Make sure Ollama service is running.</div>
          ${renderMessageFor("ollama")}
        </div>
      </section>
    </div>
  `;
}

function renderHistoryDrawer() {
  const items = state.history.slice(0, 30).map((item) => `
    <article class="history-item">
      <time>🕒 ${escapeHtml(new Date(item.timestamp).toLocaleString())}</time>
      <div>📂 <strong>${escapeHtml(item.selectedDatabase || "No DB")}</strong> | Status: <strong>${escapeHtml(item.status || "Completed")}</strong></div>
      <p>💡 ${escapeHtml(item.userRequest || "Direct SQL execution")}</p>
      <pre>${escapeHtml(item.finalSqlExecuted || item.originalGeneratedSql || "")}</pre>
      ${item.finalSqlExecuted && item.finalSqlExecuted !== item.originalGeneratedSql ? `<p class="subtle" style="color: var(--warn);">⚠️ Modified before execution</p>` : ""}
      <button class="copy-button secondary" data-copy-sql="${escapeHtmlAttr(item.finalSqlExecuted || item.originalGeneratedSql || "")}">📋 Copy SQL</button>
    </article>
  `).join("");

  return `
    <div class="overlay">
      <aside class="drawer history-drawer">
        <div class="drawer-header">
          <div>
            <h2>Query History</h2>
            <p>Recent requests and executed SQL</p>
          </div>
          <button id="closeHistory" class="icon-button" title="Close history">✕</button>
        </div>
        <div class="button-row">
          <button id="refreshHistory" class="secondary">🔄 Refresh</button>
          <button id="clearHistory" class="danger">🗑️ Clear History</button>
        </div>
        <div class="history-list">${items || '<div class="notice">No history logged yet.</div>'}</div>
      </aside>
    </div>
  `;
}

function bindEvents() {
  document.getElementById("settingsButton").addEventListener("click", () => {
    state.showSettings = true;
    render();
    refreshModelsIfNeeded();
  });
  document.getElementById("historyButton").addEventListener("click", async () => {
    state.showHistory = true;
    await loadHistory(false);
    render();
  });

  const closeSettings = document.getElementById("closeSettings");
  if (closeSettings) closeSettings.addEventListener("click", () => setState({ showSettings: false }));
  const closeHistory = document.getElementById("closeHistory");
  if (closeHistory) closeHistory.addEventListener("click", () => setState({ showHistory: false }));

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", connectMysql);

  const refreshButton = document.getElementById("refreshDatabases");
  if (refreshButton) refreshButton.addEventListener("click", refreshDatabases);

  document.getElementById("databaseSelect").addEventListener("change", selectDatabase);

  const modelSelect = document.getElementById("modelSelect");
  if (modelSelect) {
    modelSelect.addEventListener("change", (event) => {
      state.selectedModel = event.target.value;
      updateGenerateButton();
    });
  }

  const ollamaUrl = document.getElementById("ollamaUrl");
  if (ollamaUrl) {
    ollamaUrl.addEventListener("change", async (event) => {
      state.ollamaUrl = event.target.value;
      state.modelsLoadedFor = "";
      await refreshModelsIfNeeded();
    });
    ollamaUrl.addEventListener("input", (event) => {
      state.ollamaUrl = event.target.value;
    });
  }

  document.getElementById("userRequest").addEventListener("input", (event) => {
    state.userRequest = event.target.value;
    updateGenerateButton();
  });
  document.getElementById("sqlPreview").addEventListener("input", onSqlPreviewInput);
  document.getElementById("generateSql").addEventListener("click", generateSql);
  document.getElementById("runSql").addEventListener("click", runSql);
  document.getElementById("clearSql").addEventListener("click", () => setState({ sqlPreview: "", classification: "", result: null, message: null }));

  const refreshHistory = document.getElementById("refreshHistory");
  if (refreshHistory) refreshHistory.addEventListener("click", loadHistory);

  const clearHistory = document.getElementById("clearHistory");
  if (clearHistory) clearHistory.addEventListener("click", clearHistoryEntries);

  const exportButton = document.getElementById("exportCsv");
  if (exportButton) exportButton.addEventListener("click", exportCsv);

  document.querySelectorAll("[data-copy-sql]").forEach((button) => {
    button.addEventListener("click", () => navigator.clipboard.writeText(button.dataset.copySql || ""));
  });
}

async function connectMysql(event) {
  event.preventDefault();
  const payload = {
    host: document.getElementById("mysqlHost").value,
    port: document.getElementById("mysqlPort").value,
    user: document.getElementById("mysqlUser").value,
    password: document.getElementById("mysqlPassword").value
  };
  setState({ loading: "login", message: null });
  const response = await api.connectMysql(payload);
  if (response.ok) {
    setState({
      connected: true,
      databases: response.databases,
      selectedDatabase: "",
      schemaStatus: "Choose a visible database.",
      loading: "",
      message: { area: "login", type: "ok", text: "Connected to MySQL." }
    });
  } else {
    setState({ loading: "", message: { area: "login", type: "error", text: response.error } });
  }
}

async function refreshDatabases() {
  setState({ loading: "databases", message: null });
  const response = await api.listDatabases();
  setState(response.ok
    ? { databases: response.databases, loading: "", schemaStatus: "Database list refreshed." }
    : { loading: "", message: { area: "query", type: "error", text: response.error } });
}

async function selectDatabase(event) {
  const database = event.target.value;
  if (!database) return;
  setState({ loading: "schema", schemaStatus: "Loading schema...", selectedDatabase: database, sqlPreview: "", originalGeneratedSql: "", result: null });
  const response = await api.selectDatabase(database);
  if (response.ok) {
    setState({ loading: "", schemaStatus: `Loaded ${response.tableCount} table(s).` });
  } else {
    setState({ loading: "", schemaStatus: response.error, message: { area: "query", type: "error", text: response.error } });
  }
}

async function refreshModelsIfNeeded() {
  if (state.loading || state.modelsLoadedFor === state.ollamaUrl) return;
  state.loading = "models";
  render();
  const response = await api.listOllamaModels(state.ollamaUrl);
  if (response.ok) {
    const recommended = response.models.find((model) => model.recommended);
    setState({
      models: response.models,
      selectedModel: state.selectedModel || (recommended ? recommended.name : (response.models[0] && response.models[0].name) || ""),
      modelsLoadedFor: state.ollamaUrl,
      loading: "",
      message: null
    });
  } else {
    setState({
      models: [],
      selectedModel: "",
      modelsLoadedFor: "",
      loading: "",
      message: { area: "ollama", type: "error", text: response.error }
    });
  }
}

async function generateSql() {
  setState({ loading: "generate", message: null, result: null });
  const response = await api.generateSql({
    baseUrl: state.ollamaUrl,
    model: getEffectiveModel(),
    userRequest: state.userRequest
  });
  if (response.ok) {
    const history = await api.listHistory();
    setState({
      loading: "",
      sqlPreview: response.sql,
      originalGeneratedSql: response.sql,
      classification: response.classification,
      history: history.history || [],
      message: { area: "query", type: "ok", text: "SQL generated. Review or edit it before running." }
    });
  } else {
    setState({ loading: "", message: { area: "query", type: "error", text: response.error } });
  }
}

async function onSqlPreviewInput(event) {
  state.sqlPreview = event.target.value;
  const response = await api.classifySql(state.sqlPreview);
  if (response.ok) {
    state.classification = response.classification;
    updateClassificationLabel();
  }
}

async function runSql() {
  setState({ loading: "run", message: null, result: null });
  const response = await api.runSql({
    sql: state.sqlPreview,
    originalGeneratedSql: state.originalGeneratedSql,
    userRequest: state.userRequest,
    model: getEffectiveModel()
  });

  if (response.ok && response.cancelled) {
    await loadHistory(false);
    setState({ loading: "", message: { area: "query", type: "warn", text: "Query cancelled." } });
    return;
  }

  if (response.ok) {
    await loadHistory(false);
    setState({ loading: "", result: response, classification: response.classification, message: { area: "query", type: "ok", text: "Query completed." } });
  } else {
    await loadHistory(false);
    setState({ loading: "", classification: response.classification || state.classification, message: { area: "query", type: "error", text: response.error } });
  }
}

async function loadHistory(shouldRender = true) {
  const response = await api.listHistory();
  if (response.ok) {
    state.history = response.history || [];
    if (shouldRender) render();
  }
}

async function clearHistoryEntries() {
  const confirmed = window.confirm("Clear all saved history?");
  if (!confirmed) return;
  const response = await api.clearHistory();
  if (response.ok) {
    setState({ history: response.history || [] });
  }
}

function exportCsv() {
  if (!state.result || state.result.kind !== "rows") return;
  const csv = [
    state.result.columns.map(csvValue).join(","),
    ...state.result.rows.map((row) => state.result.columns.map((column) => csvValue(row[column])).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `easy-sql-results-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function canGenerate() {
  return Boolean(state.selectedDatabase && getEffectiveModel() && state.userRequest.trim());
}

function updateGenerateButton() {
  const button = document.getElementById("generateSql");
  if (button) button.disabled = !canGenerate() || Boolean(state.loading);
}

function updateClassificationLabel() {
  const label = document.getElementById("classificationLabel");
  if (!label) return;
  label.className = "classification";
  if (state.classification === "READ_QUERY") {
    label.classList.add("read");
    label.textContent = "Read query";
  } else if (state.classification === "WRITE_OR_STRUCTURE_QUERY") {
    label.classList.add("write");
    label.textContent = "Write or structure query";
  } else {
    label.textContent = "Not classified";
  }
}

function getEffectiveModel() {
  return state.selectedModel;
}

function renderMessageFor(area) {
  if (!state.message || state.message.area !== area) return "";
  return `<div class="notice ${state.message.type}">${escapeHtml(state.message.text)}</div>`;
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvValue(value) {
  const text = formatCell(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

async function init() {
  await loadHistory(false);
  render();
  await refreshModelsIfNeeded();
}

init();
