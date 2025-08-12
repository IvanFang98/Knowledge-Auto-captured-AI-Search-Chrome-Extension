# Privacy Policy

Effective date: 2025-08-12

## 1) Overview
This extension helps you capture article-like web pages and search your saved content with AI. This extension is designed to be local-first and privacy‑preserving. This policy explains what data this extension collects, how it is used, how it’s stored, and your choices.

## 2) Data Collected
- **Website Content (Yes)**
  - What: Page title, URL, timestamp, and extracted text from pages you capture (manually or via auto‑capture heuristics).
  - Why: To build your private knowledge base and enable semantic search and Q&A.
- **Web History (Limited)**
  - What: URL, title, and timestamp only for pages that are captured. This extension does not collect or store a full browsing history.
- This extension does **not** collect: personally identifiable information (PII), authentication/credentials, financial, health, or personal communications; keystrokes/clicks; location.

## 3) How Data Is Used
- Provide core features: capture, organize, and search your saved content.
- Generate text embeddings and answers for semantic search/Q&A.
- Show non‑marketing notifications (e.g., capture success, duplicate detected, usage cap reached).

## 4) Data Storage and Retention
- Local-first: Your library and embeddings are stored on your device in Chrome storage and IndexedDB.
- Retention: Data persists locally until you delete items, clear data in Settings, or uninstall the extension.

## 5) Processing via AI Proxy (Optional/Configurable)
- To compute embeddings and generate responses, this extension may send necessary text snippets to a Vertex AI proxy (default proxy or a custom proxy URL you provide).
- API responses are treated as data, not code. This extension does not execute remote code.
- Default proxy: Enforces allowlisting by extension ID and aims to avoid logging content. Minimal operational metadata (e.g., status, latency) may be logged for reliability.
- Custom proxy (BYO): If you supply your own Cloud Run proxy, requests go to your Google Cloud project under your terms. This extension does not receive or control that data.

## 6) Data Sharing and Selling
- This extension does not sell user data.
- This extension does not share user data with third parties for advertising or analytics.
- Data may be transmitted to the configured proxy solely to perform embeddings/generation requested by you.

## 7) Permissions Rationale
- `activeTab`: Capture the currently active page only when you invoke capture.
- `tabs`: Identify the active tab, react to tab updates for auto‑capture heuristics, and communicate with content scripts/UI.
- `sidePanel`/`action`: Provide the in‑browser UI for your library, search, and settings.
- `storage`: Save your captured items, settings, and usage counters locally.
- `scripting`: Inject packaged content scripts to extract page text and display minimal on‑page notices.
- `notifications`: Inform you about capture outcomes, duplicates, caps, and exports.
- Host permission (`https://notebooklm.google.com/*`): Only to assist user‑initiated export to NotebookLM upon your request.

## 8) Security
- Transport security: Proxy calls use HTTPS.
- Least privilege: Minimal permissions and scope to fulfill the single purpose.
- Abuse protection: Server allowlisting/rate limits on the default proxy; no remote code execution.
- Logging: This extension avoids logging page content. Operational logs may include non‑content metadata for reliability.

## 9) Children’s Privacy
- This extension is not directed to children under 13. Do not use if you are under the minimum age of digital consent in your region.

## 10) Your Choices
- Capture control: Use settings to toggle auto‑capture and reminders.
- Data control: Dele on the free tier or provide your own Vertex AI proxy URL so processing runs on your cloud.
- Uninstall: Removes locaete individual items or clear all data from Settings.
- Proxy choice: Continully stored data from the browser profile (subject to Chrome behavior).

## 11) Policy Changes
This extension may update this policy to reflect product, technical, or legal changes. The “Effective date” above will be updated. Continued use after updates constitutes acceptance.

## 12) Contact
For privacy questions or requests, contact: ivanfang98@gmail.com


