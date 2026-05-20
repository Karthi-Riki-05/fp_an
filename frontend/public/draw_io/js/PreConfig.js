/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// Overrides of global vars need to be pre-loaded
window.DRAWIO_PUBLIC_BUILD = true;
// EXPORT_URL: routes to the jgraph/export-server container via Next.js proxy.
// When the export server is not running the proxy returns 503 and over-ride.js
// falls back to the browser print dialog automatically.
window.EXPORT_URL = "/api/export-proxy";
window.PLANT_URL = "/api/plantuml-disabled";
// ValueFlowSoft branding
window.VFS_APP_NAME = "ValueFlowSoft";
window.VFS_DEFAULT_FILENAME = "valuechart-flow";
window.DRAWIO_BASE_URL = null; // Replace with path to base of deployment, e.g. https://www.example.com/folder
window.DRAWIO_VIEWER_URL = null; // Replace your path to the viewer js, e.g. https://www.example.com/js/viewer.min.js
window.DRAWIO_LIGHTBOX_URL = null; // Replace with your lightbox URL, eg. https://www.example.com
window.DRAW_MATH_URL = "math4/es5";
window.SAVE_URL = window.location.origin + "/api/flows";
window.DRAWIO_CONFIG = {
  ui: "sketch",
  allowAi: false,
  enableAi: false,
  disableAi: true,
  enabledLibraries: true,
  disablePlugins: true,
  defaultFonts: ["Inter", "Roboto"],
  plugins: [],
  settings: {
    v: "2026",
    theme: "atlas",
  },
  // 2. உங்களின் தனிப்பட்ட API Keys (இங்கே உங்கள் கீயை உள்ளிடவும்)
  gptApiKey: "sk-your-openai-key",
  // "geminiApiKey": "your-gemini-key",
  // "claudeApiKey": "your-claude-key",
  // "myCustomApiKey": "your-internal-api-key", // கஸ்டம் மாடலுக்காக

  // 3. AI செயல்பாடுகளுக்கான பிராம்ப்ட் (System Prompts)
  aiGlobals: {
    gptApiKey: "sk-your-openai-key",
    // "geminiApiKey": "your-gemini-key",
    // "claudeApiKey": "your-claude-key",
    myCustomApiKey: "your-internal-api-key",
    create:
      "You are a diagram expert. Generate ONLY the <mxGraphModel> content for draw.io. DO NOT include <mxfile>, <diagram>, or any other wrappers. Start directly with <mxGraphModel> and end with </mxGraphModel>.",
    update:
      "You are a helpful assistant that helps with the following draw.io diagram and returns an updated draw.io diagram XML if needed.",
    assist:
      "You are a helpful assistant that creates XML for draw.io diagrams or helps with the draw.io diagram editor.",
  },

  // 4. அனைத்து மாடல்களையும் பட்டியலிடுதல்
  aiModels: [
    // OpenAI Models
    { name: "GPT-4o", model: "gpt-4o", config: "gpt" },
    { name: "GPT-3.5 Turbo", model: "gpt-3.5-turbo", config: "gpt" },

    // Google Gemini Models
    // { "name": "Gemini 1.5 Pro", "model": "gemini-1.5-pro", "config": "gemini" },
    // { "name": "Gemini 1.5 Flash", "model": "gemini-1.5-flash", "config": "gemini" },

    // // Anthropic Claude Models
    // { "name": "Claude 3.5 Sonnet", "model": "claude-3-5-sonnet-20240620", "config": "claude" },
  ],
  showStartScreen: false,
  settingsName: "drawio-config",
  version: "1.0",
  // 5. ஒவ்வொரு மாடலும் எப்படி வேலை செய்ய வேண்டும் என்ற நுணுக்கங்கள் (Endpoints & Headers)
  aiConfigs: {
    gpt: {
      apiKey: "gptApiKey",
      endpoint: "/api/openai",
      requestHeaders: { Authorization: "Bearer {apiKey}" },
      request: {
        model: "{model}",
        messages: [
          { role: "system", content: "{action}" },
          { role: "user", content: "{prompt}" },
        ],
      },
      responsePath: "$.content",
    },
    // "gemini": {
    //     "apiKey": "geminiApiKey",
    //     "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    //     "requestHeaders": { "X-Goog-Api-Key": "{apiKey}" },
    //     "request": {
    //         "system_instruction": { "parts": [{ "text": "{action}" }] },
    //         "contents": [{ "parts": [{ "text": "{prompt}" }] }]
    //     },
    //     "responsePath": "$.candidates[0].content.parts[0].text"
    // },
    // "claude": {
    //     "apiKey": "claudeApiKey",
    //     "endpoint": "https://api.anthropic.com/v1/messages",
    //     "requestHeaders": {
    //         "X-API-Key": "{apiKey}",
    //         "Anthropic-Version": "2023-06-01",
    //         "Anthropic-Dangerous-Direct-Browser-Access": "true"
    //     },
    //     "request": {
    //         "max_tokens": 4096,
    //         "model": "{model}",
    //         "messages": [
    //             { "role": "user", "content": "{prompt}" }
    //         ]
    //     },
    //     "responsePath": "$.content[0].text"
    // },
  },
}; // Replace with your custom draw.io configurations. For more details, https://www.drawio.com/doc/faq/configure-diagram-editor
urlParams["sync"] = "manual";
urlParams["sketch"] = "1";

console.log(window.DRAWIO_CONFIG);
