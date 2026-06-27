# Easy-SQL

Easy-SQL is a cross-platform Electron desktop app that connects to MySQL as the username and password entered on the login screen, reads only the databases visible to that MySQL user, sends schema context to a local or configurable Ollama server, and displays generated SQL in an editable preview before anything runs.

The SQL preview is the source of truth. If you edit, replace, or clear the generated SQL, the app classifies and executes exactly the SQL currently visible in the preview after the required approval flow.

## Modern UI & Aesthetic

Easy-SQL features a custom, state-of-the-art user interface built with:
- **Glassmorphism Design:** Semi-transparent cards, deep dark backdrop blurs, and clean glowing borders.
- **Tailored Space-Dark Palette:** Elegant linear-gradient dark tones accented by emerald greens and neon blues.
- **Custom Typography:** Integrated Google Fonts ("Plus Jakarta Sans" for controls and "JetBrains Mono" for the SQL editor).
- **Smooth Animations:** Dynamic slide-in settings and history drawers, plus responsive hover states on buttons and list items.
- **Custom Styled Scrollbars & Tables:** High-contrast alternating table rows with sticky gradient headers.

## Run From Source

```powershell
npm install
npm start
```

Electron and app runtime dependencies are installed in isolated `.runtime` folders during `npm install`. This avoids Windows file-lock issues if an editor or desktop shell is holding an old Electron binary in the root `node_modules` folder.

## Download And Run

Download `Easy-SQL.exe` from the GitHub Releases page, then run it directly on Windows.

Before using the app, make sure:

- MySQL Server is running, usually on `localhost:3306`.
- Ollama is running, usually on `http://localhost:11434`.
- At least one coding model is installed in Ollama.

In the app:

1. Open **Settings**.
2. Enter your MySQL host, port, username, and password.
3. Click **Connect**.
4. Choose a visible database from the left panel.
5. Choose an Ollama model in **Settings**.
6. Type a request in **Request**.
7. Click **Generate**.
8. Review or edit the SQL in **Query**.
9. Click **Run**.

## MySQL Setup

Run a local or reachable MySQL server and log in with a real MySQL account. Easy-SQL does not use a hidden root account or bypass permissions. The app uses the entered username and password for:

- `SHOW DATABASES`
- schema loading from `INFORMATION_SCHEMA`
- query execution

If MySQL rejects a query because that account lacks privileges, Easy-SQL shows a permission message. Grant access in MySQL if the user should be allowed to see a database or run a query.

## Ollama Setup

Install and start Ollama, then pull at least one coding-capable model:

```powershell
ollama pull qwen2.5-coder:3b
ollama pull codegemma:7b
```

The default Ollama URL is:

```text
http://localhost:11434
```

You can change it in the app. Easy-SQL fetches installed models from `/api/tags` and shows them in the model dropdown.

Recommended coding models: qwen2.5-coder:3b or greater, codegemma:7b or greater.

## How It Works

1. Log in with a MySQL host, port, username, and password.
2. Choose one of the databases visible to that MySQL user.
3. Easy-SQL loads columns, foreign keys, indexes, and table metadata from `INFORMATION_SCHEMA`.
4. The schema summary is stored in memory and as a temporary file in the system temp folder.
5. Choose an Ollama model.
6. Ask for a query in English.
7. Ollama generates one MySQL statement using the selected database schema.
8. The generated SQL appears in an editable preview.
9. Click Run only after reviewing or editing the SQL.

Schema temp files never include MySQL passwords. The current schema temp file is deleted when you switch databases and when the app quits.

## SQL Preview Editing

The preview editor is intentionally editable. Easy-SQL does not execute SQL immediately after generation, and it does not execute the original generated SQL if you changed it.

When Run is clicked:

- Empty preview shows: `Please enter or generate SQL before running.`
- Read queries (`SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`, read-only `WITH`) run after the normal Run click.
- Write, structure, permission, admin, and other non-read queries require an additional Yes/No confirmation.
- The app executes exactly the final SQL currently visible in the preview.

Multiple SQL statements are blocked by default. Run one statement at a time.

## Results And History

SELECT results are displayed in a table with headers and can be exported to CSV. Large result sets are displayed up to an app-side limit, and SELECT queries without `LIMIT` show a warning.

History is stored locally in Electron app data and includes:

- timestamp
- selected database
- selected model
- natural language request
- original generated SQL
- final SQL executed from the preview
- whether the SQL was manually edited
- execution status or error

History does not store passwords or query results.

## Security Notes

- MySQL credentials are kept in the main process memory only.
- Passwords are not saved to disk.
- The renderer cannot access credentials directly.
- Electron uses `contextBridge`, `ipcMain`, context isolation, and disabled `nodeIntegration`.
- Internal metadata queries use prepared parameters.
- User-generated or edited SQL is only executed after explicit user action and, for non-read queries, confirmation.
- MySQL remains the final authority for permissions.

## Development

```powershell
npm test
npm start
npm run package
npm run setup
```

Important files:

- `src/main/main.js` registers safe IPC handlers.
- `src/main/mysqlService.js` owns the active MySQL connection.
- `src/main/schemaService.js` loads and stores schema summaries.
- `src/main/ollamaService.js` fetches models and generates SQL.
- `src/main/queryClassifier.js` classifies the current preview SQL.
- `src/preload.js` exposes the limited renderer API.
- `src/renderer/app.js` implements the UI.
