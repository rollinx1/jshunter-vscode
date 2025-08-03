"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode6 = __toESM(require("vscode"));

// src/services/api.ts
var API_CONFIG = {
  BASE_URL: "http://localhost:20450",
  TIMEOUT: 1e4,
  ENDPOINTS: {
    HEALTH: "/api/health",
    CONFIG: "/api/config",
    ENDPOINTS: "/api/collections/endpoints/records",
    JS_FILES: "/api/collections/js_files/records",
    FINDINGS: "/api/collections/findings/records"
  }
};
var ApiService = class _ApiService {
  static instance;
  baseUrl;
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }
  static getInstance() {
    if (!_ApiService.instance) {
      _ApiService.instance = new _ApiService();
    }
    return _ApiService.instance;
  }
  // --- Public methods to load data into the store ---
  async loadEndpoints() {
    let endpoints = [];
    const endpoint = `${API_CONFIG.ENDPOINTS.ENDPOINTS}?expand=js_files`;
    const result = await this.requestPagination(endpoint);
    if (result.success && result.data) {
      endpoints = result.data;
    }
    return {
      success: true,
      data: endpoints
    };
  }
  async loadLazyLoadedJavascriptFiles(js_files) {
    const jsFilesWithChunks = js_files.filter((js) => js.has_chunks);
    const ids = jsFilesWithChunks.map((js) => js.id);
    const chunks = this.chunkArray(ids, 30);
    let results = [];
    for (const chunk of chunks) {
      const filter = chunk.map((id) => `parent_id='${id}'`).join(" || ");
      const endpoint = `${API_CONFIG.ENDPOINTS.JS_FILES}?filter=(${filter})`;
      const result = await this.requestPagination(endpoint);
      if (result.success && result.data) {
        results = [...results, ...result.data];
      }
    }
    return {
      success: true,
      data: results
    };
  }
  async loadFindings(js_files) {
    const ids = js_files.map((js) => js.id);
    const chunks = this.chunkArray(ids, 30);
    let results = [];
    for (const chunk of chunks) {
      const filter = chunk.map((id) => `js_file='${id}'`).join(" || ");
      const endpoint = `${API_CONFIG.ENDPOINTS.FINDINGS}?filter=(${filter})&expand=js_file&sort=value`;
      const result = await this.requestPagination(endpoint);
      if (result.success && result.data) {
        results = [...results, ...result.data];
      }
    }
    return {
      success: true,
      data: results
    };
    ;
  }
  async loadConfig() {
    return this.request(API_CONFIG.ENDPOINTS.CONFIG);
  }
  async requestPagination(api) {
    let page = 1;
    const perPage = 500;
    let data = [];
    while (true) {
      const endpoint = `${api}&perPage=${perPage}&page=${page}`;
      const result = await this.request(endpoint);
      if (result.success && result.data) {
        data = [...data, ...result.data.items];
        if (result.data.totalPages === 0 || result.data.totalPages === page) break;
        page += 1;
      } else {
        break;
      }
    }
    return {
      success: true,
      data
    };
  }
  // Generic request method for API calls
  async request(endpoint, options) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
      });
      const data = await response.json();
      if (response.ok) {
        return {
          success: true,
          data,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      } else {
        return {
          success: false,
          error: data?.message || `HTTP ${response.status}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
};

// src/services/state.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// src/utils/urls.ts
function getEndpointDisplayName(rawUrl) {
  const url = new URL(rawUrl);
  let path5 = url.pathname;
  if (path5 === "/" || !path5) {
    return "/";
  }
  path5 = path5.replace(/\/+/g, "/");
  if (path5.endsWith("/")) {
    path5 = path5.slice(0, -1);
  }
  return path5;
}
function getDomainFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (e) {
    console.error("Invalid URL:", urlString);
  }
  return "";
}
function getFullPath(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
}

// src/utils/filesystem.ts
var import_url = require("url");
var path = __toESM(require("path"));
function getFileNameFromUrl(rawUrl) {
  try {
    const parsedURL = new import_url.URL(rawUrl);
    const fileName = path.basename(parsedURL.pathname);
    if (fileName.length > 100) {
      return fileName.substring(0, 100);
    }
    return fileName;
  } catch (error) {
    console.error(`Error parsing URL '${rawUrl}':`, error);
    return "file";
  }
}
function getPath(storage_dir, url, hash) {
  const parsedURL = new import_url.URL(url);
  const domain = parsedURL.hostname;
  const fileName = getFileNameFromUrl(url);
  return path.join(storage_dir, domain, hash, fileName);
}
function getSourcemapDir(storage_dir, file) {
  let domain;
  try {
    const url = new import_url.URL(file.url);
    domain = url.hostname;
  } catch (e) {
    domain = "unknown";
  }
  return path.join(storage_dir, domain, file.hash, "original");
}

// src/services/state.ts
var StateService = class _StateService {
  static _instance;
  _state;
  apiService;
  checkInterval = null;
  // Emitters to notify other parts of the extension about changes
  _onEndpointsChanged = new vscode.EventEmitter();
  onEndpointsChanged = this._onEndpointsChanged.event;
  _onSelectedEndpointChanged = new vscode.EventEmitter();
  onSelectedEndpointChanged = this._onSelectedEndpointChanged.event;
  _onFindingsChanged = new vscode.EventEmitter();
  onFindingsChanged = this._onFindingsChanged.event;
  _onSelectedFileChanged = new vscode.EventEmitter();
  onSelectedFileChanged = this._onSelectedFileChanged.event;
  constructor() {
    this.apiService = ApiService.getInstance();
    this._state = {
      endpoints: [],
      selectedEndpoint: null,
      findings: [],
      sourcemaps: [],
      sourceDir: null,
      javascriptFiles: [],
      selectedFile: null,
      config: null
    };
  }
  // The method to get the single instance of the store
  static getInstance() {
    if (!_StateService._instance) {
      _StateService._instance = new _StateService();
    }
    return _StateService._instance;
  }
  async startEndpointsMonitoring() {
    const configCall = await this.apiService.loadConfig();
    if (configCall.success && configCall.data) {
      this._state.config = {
        ...configCall.data,
        storage_dir: import_path.default.join(configCall.data.storage_dir, "files")
      };
    }
    const endpointsCall = await this.apiService.loadEndpoints();
    if (endpointsCall.success && endpointsCall.data) {
      this.setEndpoints(endpointsCall.data);
    }
    this.checkInterval = setInterval(async () => {
      const endpointsCall2 = await this.apiService.loadEndpoints();
      if (endpointsCall2.success && endpointsCall2.data) {
        this.setEndpoints(endpointsCall2.data);
      }
    }, 3e4);
  }
  // --- Getters for current state ---
  getState() {
    return this._state;
  }
  // --- Setters to update state and notify listeners ---
  setEndpoints(endpoints) {
    this._state.endpoints = endpoints;
    this._onEndpointsChanged.fire(this._state.endpoints);
  }
  async setSelectedEndpoint(endpoint) {
    this._state.selectedEndpoint = endpoint;
    if (this._state.selectedEndpoint === null) {
      this.setFindings([]);
      this.setSourcemaps([]);
      this.setJavascriptFiles([]);
    }
    if (endpoint !== null) {
      if (endpoint.expand && endpoint.expand.js_files) {
        const endpointJs = endpoint.expand.js_files;
        const lazyLoadedJs = await this.apiService.loadLazyLoadedJavascriptFiles(endpointJs);
        if (lazyLoadedJs.success && lazyLoadedJs.data) {
          this.setJavascriptFiles([...endpointJs, ...lazyLoadedJs.data]);
        } else {
          this.setJavascriptFiles([...endpointJs]);
        }
      }
      const findings = await this.apiService.loadFindings(this._state.javascriptFiles);
      if (findings.success && findings.data) {
        this.setFindings(findings.data);
      }
    }
    this._onSelectedEndpointChanged.fire(this._state.selectedEndpoint);
  }
  setFindings(findings) {
    this._state.findings = findings;
    this._onFindingsChanged.fire(this._state.findings);
  }
  setSourcemaps(sourcemaps) {
    this._state.sourcemaps = sourcemaps;
  }
  setSourceDir(dir) {
    this._state.sourceDir = dir;
  }
  setJavascriptFiles(files) {
    this._state.javascriptFiles = files;
  }
  setSelectedFile(file) {
    this._state.selectedFile = file;
    if (file !== null && this._state.config) {
      const sourceDir = getSourcemapDir(this._state.config.storage_dir, file);
      if (sourceDir && fs.existsSync(sourceDir)) {
        try {
          this.setSourceDir(sourceDir);
          const entries = fs.readdirSync(sourceDir);
          this.setSourcemaps(entries);
        } catch (error) {
          console.error(`Error reading sourcemap directory: ${error}`);
        }
        ;
      }
    }
    this._onSelectedFileChanged.fire(this._state.selectedFile);
  }
  getSelectedEndpoint() {
    return this._state.selectedEndpoint;
  }
  getJsFilesForSelectedEndpoint() {
    return this._state.javascriptFiles;
  }
  getSelectedFile() {
    return this._state.selectedFile;
  }
  getSourcemaps() {
    return this._state.sourcemaps;
  }
  getFindings() {
    return this._state.findings;
  }
  getConfig() {
    return this._state.config;
  }
  getSourceDir() {
    return this._state.sourceDir;
  }
};

// src/providers/endpoints.ts
var vscode2 = __toESM(require("vscode"));
var EndpointsProvider = class {
  _onDidChangeTreeData = new vscode2.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  stateService;
  constructor(stateService) {
    this.stateService = stateService;
    this.stateService.onEndpointsChanged(() => this.refresh());
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (element) {
      if (element.type === "domain" && element.endpoints) {
        return Promise.resolve(
          element.endpoints.map((endpoint) => new EndpointTreeItem(
            getEndpointDisplayName(endpoint.url),
            vscode2.TreeItemCollapsibleState.None,
            "endpoint",
            endpoint
          ))
        );
      }
      return Promise.resolve([]);
    } else {
      const endpoints = this.stateService.getState().endpoints;
      if (!endpoints || endpoints.length === 0) {
        return Promise.resolve([]);
      }
      const endpointsByDomain = endpoints.reduce((acc, endpoint) => {
        const domain = getDomainFromUrl(endpoint.url);
        if (!acc[domain]) {
          acc[domain] = [];
        }
        acc[domain].push(endpoint);
        return acc;
      }, {});
      return Promise.resolve(
        Object.keys(endpointsByDomain).map((domain) => new EndpointTreeItem(
          domain,
          vscode2.TreeItemCollapsibleState.Collapsed,
          "domain",
          void 0,
          endpointsByDomain[domain]
          // Pass the endpoints for this domain
        ))
      );
    }
  }
};
var EndpointTreeItem = class extends vscode2.TreeItem {
  constructor(label, collapsibleState, type, endpoint, endpoints) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.type = type;
    this.endpoint = endpoint;
    this.endpoints = endpoints;
    this.contextValue = this.type;
    if (this.type === "endpoint") {
      this.command = {
        command: "jshunter.setSelectedEndpoint",
        title: "Select Endpoint",
        arguments: [this.endpoint]
      };
      this.iconPath = new vscode2.ThemeIcon("link");
    } else {
      this.iconPath = new vscode2.ThemeIcon("globe", new vscode2.ThemeColor("charts.blue"));
    }
  }
};
var EndpointsCommands = class {
  endpointsProvider;
  stateService;
  constructor(endpointsProvider, stateService) {
    this.stateService = stateService;
    this.endpointsProvider = endpointsProvider;
  }
  registerCommands(context) {
    const setSelectedEndpoint = vscode2.commands.registerCommand(
      "jshunter.setSelectedEndpoint",
      this.setSelectedEndpoint.bind(this)
    );
    context.subscriptions.push(setSelectedEndpoint);
  }
  setSelectedEndpoint(endpoint) {
    this.stateService?.setSelectedEndpoint(endpoint);
  }
};

// src/providers/content.ts
var vscode3 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));
var ContentProvider = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  treeView = null;
  stateService;
  constructor(stateService) {
    this.stateService = stateService;
    this.stateService.onSelectedEndpointChanged(() => this.refresh());
  }
  refresh() {
    this.updateTreeViewTitle();
    this._onDidChangeTreeData.fire();
  }
  // Método para establecer la referencia al tree view
  setTreeView(treeView) {
    this.treeView = treeView;
  }
  // Actualizar el título del tree view dinámicamente
  updateTreeViewTitle() {
    if (this.treeView) {
      const selectedEndpoint = this.stateService.getSelectedEndpoint();
      if (selectedEndpoint) {
        const endpointPath = getFullPath(selectedEndpoint.url);
        const domain = getDomainFromUrl(selectedEndpoint.url);
        this.treeView.title = `Content: ${domain}${endpointPath}`;
      } else {
        this.treeView.title = "Content: No Endpoint Selected";
      }
    }
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!element) {
      const selectedEndpoint = this.stateService.getSelectedEndpoint();
      if (!selectedEndpoint) {
        return Promise.resolve([
          new ContentTreeItem(
            "No endpoint selected",
            vscode3.TreeItemCollapsibleState.None,
            "message"
          )
        ]);
      }
      return this.getDomainItems();
    }
    if (element.type === "domain") {
      return this.getFilesForDomain(element.domain);
    }
    return Promise.resolve([]);
  }
  async getDomainItems() {
    const selectedEndpoint = this.stateService.getSelectedEndpoint();
    if (!selectedEndpoint) {
      return [];
    }
    const domainMap = /* @__PURE__ */ new Map();
    const endpointDomain = getDomainFromUrl(selectedEndpoint.url);
    if (!domainMap.has(endpointDomain)) {
      domainMap.set(endpointDomain, { htmlFiles: [], jsFiles: [] });
    }
    domainMap.get(endpointDomain).htmlFiles.push(selectedEndpoint);
    if (selectedEndpoint.mobile_hash) {
      const mobileVersion = { ...selectedEndpoint, isMobileVersion: true };
      domainMap.get(endpointDomain).htmlFiles.push(mobileVersion);
    }
    const jsFiles = this.stateService.getJsFilesForSelectedEndpoint();
    if (jsFiles.length > 0) {
      for (const jsFile of jsFiles) {
        const jsDomain = getDomainFromUrl(jsFile.url);
        if (!domainMap.has(jsDomain)) {
          domainMap.set(jsDomain, { htmlFiles: [], jsFiles: [] });
        }
        domainMap.get(jsDomain).jsFiles.push(jsFile);
      }
    }
    return Array.from(domainMap.keys()).map((domain) => {
      const data = domainMap.get(domain);
      let filesInThisDomain = data.jsFiles.length;
      const endpointDomain2 = getDomainFromUrl(selectedEndpoint.url);
      if (domain === endpointDomain2) {
        const htmlCount = selectedEndpoint.mobile_hash ? 2 : 1;
        filesInThisDomain += htmlCount;
      }
      return new ContentTreeItem(
        `${domain} (${filesInThisDomain} files)`,
        vscode3.TreeItemCollapsibleState.Collapsed,
        "domain",
        selectedEndpoint || void 0,
        void 0,
        void 0,
        domain
      );
    });
  }
  async getFilesForDomain(domain) {
    const selectedEndpoint = this.stateService.getSelectedEndpoint();
    if (!selectedEndpoint) {
      return [];
    }
    const items = [];
    const endpointDomain = getDomainFromUrl(selectedEndpoint.url);
    if (endpointDomain === domain) {
      items.push(new ContentTreeItem(
        `${getFullPath(selectedEndpoint.url)} (Desktop)`,
        vscode3.TreeItemCollapsibleState.None,
        "htmlFile",
        selectedEndpoint,
        void 0,
        {
          command: "jshunter.openFile",
          title: "Open Desktop HTML File",
          arguments: [selectedEndpoint, false]
          // false = desktop
        },
        void 0,
        "desktop"
      ));
      if (selectedEndpoint.mobile_hash) {
        items.push(new ContentTreeItem(
          `${getFullPath(selectedEndpoint.url)} (Mobile)`,
          vscode3.TreeItemCollapsibleState.None,
          "htmlFile",
          selectedEndpoint,
          void 0,
          {
            command: "jshunter.openFile",
            title: "Open Mobile HTML File",
            arguments: [selectedEndpoint, true]
            // true = mobile
          },
          void 0,
          "mobile"
        ));
      }
    }
    const jsFiles = this.stateService.getJsFilesForSelectedEndpoint();
    if (jsFiles.length) {
      for (const jsFile of jsFiles) {
        const jsDomain = getDomainFromUrl(jsFile.url);
        if (jsDomain === domain) {
          if (jsFile.type === "chunk") {
            items.push(new ContentTreeItem(
              `${getFullPath(jsFile.url)} (chunk)`,
              vscode3.TreeItemCollapsibleState.None,
              "jsChunk",
              selectedEndpoint,
              jsFile,
              {
                command: "jshunter.openFile",
                title: "Open JS Chunk",
                arguments: [jsFile]
              }
            ));
          } else {
            items.push(new ContentTreeItem(
              getFullPath(jsFile.url),
              vscode3.TreeItemCollapsibleState.None,
              "jsFile",
              selectedEndpoint,
              jsFile,
              {
                command: "jshunter.openFile",
                title: "Open JS File",
                arguments: [jsFile]
              }
            ));
          }
        }
      }
    }
    return items;
  }
};
var ContentTreeItem = class extends vscode3.TreeItem {
  constructor(label, collapsibleState, type, endpoint, jsFile, command, domain, version) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.type = type;
    this.endpoint = endpoint;
    this.jsFile = jsFile;
    this.command = command;
    this.domain = domain;
    this.version = version;
    this.tooltip = this.getTooltip();
    this.contextValue = type;
    if (type === "htmlFile") {
      this.resourceUri = vscode3.Uri.parse(`file:///dummy.html`);
    } else if (type === "jsFile") {
      this.resourceUri = vscode3.Uri.parse(`file:///dummy.js`);
    } else if (type === "jsChunk") {
      this.resourceUri = vscode3.Uri.parse(`file:///dummy.test.js`);
    } else if (type === "domain") {
      this.iconPath = new vscode3.ThemeIcon("globe", new vscode3.ThemeColor("charts.orange"));
    } else if (type === "message") {
      this.iconPath = new vscode3.ThemeIcon("info");
    } else if (type === "error") {
      this.iconPath = new vscode3.ThemeIcon("error");
    }
  }
  getTooltip() {
    switch (this.type) {
      case "domain":
        return `Domain: ${this.domain}`;
      case "htmlFile":
        const versionText = this.version ? ` (${this.version})` : "";
        return `HTML File${versionText}: ${this.endpoint?.url}`;
      case "jsFile":
        return `JS File: ${this.jsFile?.url}
Type: ${this.jsFile?.type}`;
      case "jsChunk":
        return `JS Chunk: ${this.jsFile?.url}
Type: ${this.jsFile?.type}`;
      case "error":
        return `Error: ${this.label}`;
      case "message":
        return this.label;
      default:
        return this.label;
    }
  }
};
var ContentCommands = class {
  stateService;
  constructor(stateService) {
    this.stateService = stateService;
  }
  registerCommands(context) {
    const openFileCommand = vscode3.commands.registerCommand(
      "jshunter.openFile",
      (file) => {
        this.openFile(file);
      }
    );
    context.subscriptions.push(openFileCommand);
  }
  async openFile(file) {
    try {
      if (!this.stateService) return;
      const config = this.stateService.getConfig();
      if (config === null) return;
      const filePath = getPath(config.storage_dir, file.url, file.hash);
      if (!fs2.existsSync(filePath)) {
        vscode3.window.showErrorMessage(`File not found: ${filePath}`);
        return;
      }
      this.stateService.setSelectedFile(file);
      const document = await vscode3.workspace.openTextDocument(filePath);
      await vscode3.window.showTextDocument(document);
    } catch (error) {
      vscode3.window.showErrorMessage(`Error opening file: ${error}`);
    }
  }
};

// src/providers/findings.ts
var vscode4 = __toESM(require("vscode"));
var fs3 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
var FindingsProvider = class {
  _onDidChangeTreeData = new vscode4.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  stateService;
  context;
  constructor(stateService, context) {
    this.stateService = stateService;
    this.context = context;
    this.stateService.onSelectedEndpointChanged(() => this.refresh());
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getCategoryItems() {
    const categories = [];
    const urlTypes = ["api-endpoint", "full-url", "path-only"];
    const gqlTypes = ["gql-query", "gql-mutation", "gql-subscription"];
    const domxssTypes = ["dom-eval", "dom-write", "dom-innerHTML", "dom-postmessage", "dom-domain"];
    const eventTypes = ["event-listener", "event-onmessage", "event-onhashchange", "event-window-open", "event-location"];
    const httpApiTypes = ["http-fetch", "http-xhr", "http-axios", "http-jquery"];
    const findings = this.stateService.getFindings();
    const urlFindings = findings.filter((f) => urlTypes.includes(f.type));
    const urlItem = new FindingTreeItem(
      `URLs (${urlFindings.length})`,
      vscode4.TreeItemCollapsibleState.Collapsed,
      "categorySection",
      void 0,
      void 0,
      "urls"
    );
    urlItem.iconPath = new vscode4.ThemeIcon("link", new vscode4.ThemeColor("charts.blue"));
    categories.push(urlItem);
    const gqlFindings = findings.filter((f) => gqlTypes.includes(f.type));
    const gqlItem = new FindingTreeItem(
      `GraphQL (${gqlFindings.length})`,
      vscode4.TreeItemCollapsibleState.Collapsed,
      "categorySection",
      void 0,
      void 0,
      "gql"
    );
    gqlItem.iconPath = vscode4.Uri.file(
      import_path2.default.join(this.context.extensionPath, "media", "graphql.png")
    );
    categories.push(gqlItem);
    const domxssFindings = findings.filter((f) => domxssTypes.includes(f.type));
    const domxssItem = new FindingTreeItem(
      `DOM XSS (${domxssFindings.length})`,
      vscode4.TreeItemCollapsibleState.Collapsed,
      "categorySection",
      void 0,
      void 0,
      "domxss"
    );
    domxssItem.iconPath = new vscode4.ThemeIcon("bug", new vscode4.ThemeColor("charts.red"));
    categories.push(domxssItem);
    const eventFindings = findings.filter((f) => eventTypes.includes(f.type));
    const eventItem = new FindingTreeItem(
      `Events (${eventFindings.length})`,
      vscode4.TreeItemCollapsibleState.Collapsed,
      "categorySection",
      void 0,
      void 0,
      "events"
    );
    eventItem.iconPath = new vscode4.ThemeIcon("bell-dot", new vscode4.ThemeColor("charts.yellow"));
    categories.push(eventItem);
    const httpApiFindings = findings.filter((f) => httpApiTypes.includes(f.type));
    const httpApiItem = new FindingTreeItem(
      `HTTP API (${httpApiFindings.length})`,
      vscode4.TreeItemCollapsibleState.Collapsed,
      "categorySection",
      void 0,
      void 0,
      "httpapi"
    );
    httpApiItem.iconPath = new vscode4.ThemeIcon("arrow-swap", new vscode4.ThemeColor("charts.orange"));
    categories.push(httpApiItem);
    return categories;
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    const selectedEndpoint = this.stateService.getSelectedEndpoint();
    const findings = this.stateService.getFindings();
    if (!element) {
      if (!selectedEndpoint) {
        return Promise.resolve([
          new FindingTreeItem(
            "No endpoint selected",
            vscode4.TreeItemCollapsibleState.None,
            "message"
          )
        ]);
      }
      if (findings.length === 0) {
        let noFindingsMessage = "No findings found";
        if (!("type" in selectedEndpoint)) {
          try {
            const url = new URL(selectedEndpoint.url);
            const domain = url.hostname;
            const path5 = url.pathname || "/";
            noFindingsMessage = `No findings found for ${domain}${path5}`;
          } catch {
            noFindingsMessage = `No findings found for selected endpoint`;
          }
        }
        return Promise.resolve([
          new FindingTreeItem(
            noFindingsMessage,
            vscode4.TreeItemCollapsibleState.None,
            "message"
          )
        ]);
      }
      const categoryItems = this.getCategoryItems();
      if (selectedEndpoint) {
        const url = new URL(selectedEndpoint.url);
        const domain = url.hostname;
        const path5 = url.pathname || "/";
        const infoItem = new FindingTreeItem(
          `Findings for ${domain}${path5} (${findings.length} total)`,
          vscode4.TreeItemCollapsibleState.None,
          "info"
        );
        infoItem.iconPath = new vscode4.ThemeIcon("info");
        return Promise.resolve([infoItem, ...categoryItems]);
      }
      return Promise.resolve(categoryItems);
    }
    if (element.type === "categorySection") {
      return Promise.resolve(this.getTypeItems(element.category));
    }
    if (element.type === "findingType") {
      return Promise.resolve(this.getFindingItems(element.findingType));
    }
    return Promise.resolve([]);
  }
  getTypeItems(category) {
    const findings = this.stateService.getFindings();
    let relevantFindings = [];
    if (category) {
      const categoryTypeMap = {
        "urls": ["api-endpoint", "full-url", "path-only"],
        "gql": ["gql-query", "gql-mutation", "gql-subscription"],
        "domxss": ["dom-eval", "dom-write", "dom-innerHTML", "dom-postmessage", "dom-domain"],
        "events": ["event-listener", "event-onmessage", "event-onhashchange", "event-window-open", "event-location"],
        "httpapi": ["http-fetch", "http-xhr", "http-axios", "http-jquery"]
      };
      const allowedTypes = categoryTypeMap[category] || [];
      relevantFindings = findings.filter((f) => allowedTypes.includes(f.type));
    }
    const typeMap = /* @__PURE__ */ new Map();
    relevantFindings.forEach((finding) => {
      const type = finding.type;
      if (!typeMap.has(type)) {
        typeMap.set(type, []);
      }
      typeMap.get(type).push(finding);
    });
    const sortedTypes = Array.from(typeMap.keys()).sort((a, b) => {
      const priority = this.getTypePriority(a) - this.getTypePriority(b);
      return priority !== 0 ? priority : a.localeCompare(b);
    });
    return sortedTypes.map((type) => {
      const count = typeMap.get(type).length;
      const displayName = this.getTypeDisplayName(type);
      const urlTypes = ["api-endpoint", "full-url", "path-only"];
      const contextValue = urlTypes.includes(type) ? "urlFindingType" : "findingType";
      const item = new FindingTreeItem(
        `${displayName} (${count})`,
        vscode4.TreeItemCollapsibleState.Collapsed,
        "findingType",
        void 0,
        type
      );
      item.contextValue = contextValue;
      return item;
    });
  }
  getTypePriority(type) {
    switch (type) {
      case "api-endpoint":
        return 1;
      case "full-url":
        return 2;
      case "path-only":
        return 3;
      default:
        return 4;
    }
  }
  getTypeDisplayName(type) {
    switch (type) {
      // URLs
      case "api-endpoint":
        return "API Endpoints";
      case "full-url":
        return "URLs";
      case "path-only":
        return "Paths";
      // GraphQL
      case "gql-query":
        return "GQL Queries";
      case "gql-mutation":
        return "GQL Mutations";
      case "gql-subscription":
        return "GQL Subscriptions";
      // DOM XSS
      case "dom-eval":
        return "eval";
      case "dom-write":
        return "document.write";
      case "dom-innerHTML":
        return "innerHTML";
      case "dom-postmessage":
        return "postMessage";
      case "dom-domain":
        return "document.domain";
      // Events
      case "event-listener":
        return "Event Listeners";
      case "event-onmessage":
        return "Message Handlers";
      case "event-onhashchange":
        return "Hash Change Handlers";
      case "event-window-open":
        return "Window Open Calls";
      case "event-location":
        return "Location Manipulation";
      // HTTP API
      case "http-fetch":
        return "Fetch API Calls";
      case "http-xhr":
        return "XMLHttpRequest";
      case "http-axios":
        return "Axios Requests";
      case "http-jquery":
        return "jQuery AJAX";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  getFindingItems(findingType) {
    const findings = this.stateService.getFindings();
    const findingsOfType = findings.filter((finding) => finding.type === findingType);
    return findingsOfType.map((finding) => {
      let preview = finding.value;
      if (preview.length > 80) {
        preview = preview.substring(0, 77) + "...";
      }
      let fileInfo = "";
      if (finding.expand?.js_file) {
        const jsFileName = getFileNameFromUrl(finding.expand.js_file.url);
        fileInfo = jsFileName;
      }
      if (finding.line !== void 0) {
        fileInfo += fileInfo ? `:${finding.line}` : `L${finding.line}`;
      }
      const urlTypes = ["api-endpoint", "full-url", "path-only"];
      const contextValue = urlTypes.includes(finding.type) ? "urlFinding" : "finding";
      const item = new FindingTreeItem(
        preview,
        vscode4.TreeItemCollapsibleState.None,
        "finding",
        finding
      );
      if (fileInfo) {
        item.description = fileInfo;
      }
      item.command = {
        command: "jshunter.goToFinding",
        title: "Go to Finding",
        arguments: [finding]
      };
      item.contextValue = contextValue;
      return item;
    });
  }
};
var FindingTreeItem = class extends vscode4.TreeItem {
  constructor(label, collapsibleState, type, finding, findingType, category) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.type = type;
    this.finding = finding;
    this.findingType = findingType;
    this.category = category;
    this.contextValue = type;
  }
};
var FindingsCommands = class {
  findingsProvider;
  stateSerivce;
  constructor(findingsProvider, stateService) {
    this.findingsProvider = findingsProvider;
    this.stateSerivce = stateService;
  }
  registerCommands(context) {
    const goToFindingCommand = vscode4.commands.registerCommand(
      "jshunter.goToFinding",
      this.goToFinding.bind(this)
    );
    context.subscriptions.push(goToFindingCommand);
  }
  async copyUrl(item) {
    if (!item.finding) {
      vscode4.window.showErrorMessage("No URL to copy");
      return;
    }
    try {
      await vscode4.env.clipboard.writeText(item.finding.value);
      vscode4.window.showInformationMessage(`URL copied: ${item.finding.value}`);
    } catch (error) {
      vscode4.window.showErrorMessage(`Failed to copy URL: ${error}`);
    }
  }
  /*  private async copyAllUrls(): Promise<void> {
          if (!this.findingsProvider || !this.stateSerivce) {
              vscode.window.showErrorMessage('Findings provider not available');
              return;
          }
  
          try {
              const findings = this.stateSerivce.getFindings();
  
              if (findings.length === 0) {
                  vscode.window.showWarningMessage('No URLs found to copy');
                  return;
              }
  
              const urls = findings.map(finding => finding.value);
              const urlsText = urls.join('\n');
  
              await vscode.env.clipboard.writeText(urlsText);
              vscode.window.showInformationMessage(`Copied ${urls.length} URLs to clipboard`);
          } catch (error) {
              vscode.window.showErrorMessage(`Failed to copy URLs: ${error}`);
          }
      }
  
      private async copyAllUrlsOfType(item: FindingTreeItem): Promise<void> {
          if (!item.findingType || !this.findingsProvider) {
              vscode.window.showErrorMessage('No type specified or provider not available');
              return;
          }
  
          try {
              const findings = this.stateSerivce.getFindings();
  
              // Obtener todos los findings del tipo específico
              const findingsOfType = findings.filter(finding => finding.type === item.findingType);
  
              if (findingsOfType.length === 0) {
                  vscode.window.showWarningMessage(`No URLs found for type: ${item.findingType}`);
                  return;
              }
  
              const urls = findingsOfType.map(finding => finding.value);
              const urlsText = urls.join('\n');
  
              await vscode.env.clipboard.writeText(urlsText);
              vscode.window.showInformationMessage(`Copied ${urls.length} URLs of type "${item.findingType}" to clipboard`);
          } catch (error) {
              vscode.window.showErrorMessage(`Failed to copy URLs: ${error}`);
          }
      } */
  async goToFinding(finding) {
    if (!finding.expand?.js_file || !this.stateSerivce) {
      vscode4.window.showErrorMessage("No JavaScript file associated with this finding");
      return;
    }
    try {
      const config = this.stateSerivce.getConfig();
      if (!config) return;
      const filePath = getPath(config.storage_dir, finding.expand.js_file.url, finding.expand.js_file.hash);
      if (!fs3.existsSync(filePath)) {
        vscode4.window.showErrorMessage(`File not found: ${filePath}`);
        return;
      }
      const document = await vscode4.workspace.openTextDocument(filePath);
      const editor = await vscode4.window.showTextDocument(document, {
        preview: false
      });
      if (finding.line !== void 0) {
        const line = Math.max(0, finding.line - 1);
        const column = finding.column ? Math.max(0, finding.column - 1) : 0;
        const position = new vscode4.Position(line, column);
        const range = new vscode4.Range(position, position);
        editor.selection = new vscode4.Selection(position, position);
        editor.revealRange(range, vscode4.TextEditorRevealType.InCenterIfOutsideViewport);
      }
    } catch (error) {
      vscode4.window.showErrorMessage(`Error opening file: ${error}`);
    }
  }
};

// src/providers/sourcemaps.ts
var vscode5 = __toESM(require("vscode"));
var path4 = __toESM(require("path"));
var fs4 = __toESM(require("fs"));
var SourcemapsProvider = class {
  _onDidChangeTreeData = new vscode5.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  treeView = null;
  stateService;
  constructor(stateService) {
    this.stateService = stateService;
    this.stateService.onSelectedFileChanged(() => this.refresh());
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  setTreeView(treeView) {
    this.treeView = treeView;
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!element) {
      const currentFile = this.stateService.getSelectedFile();
      const sourcemaps = this.stateService.getSourcemaps();
      if (!currentFile) {
        return Promise.resolve([
          new SourcemapTreeItem(
            "No file selected",
            vscode5.TreeItemCollapsibleState.None,
            "message"
          )
        ]);
      }
      if (sourcemaps.length === 0) {
        return Promise.resolve([
          new SourcemapTreeItem(
            "No source maps found",
            vscode5.TreeItemCollapsibleState.None,
            "message"
          )
        ]);
      }
      return Promise.resolve(sourcemaps.map((fileName) => {
        const sourceDir = this.stateService.getSourceDir() || "";
        const fullPath = path4.join(sourceDir, fileName);
        const isDirectory = fs4.statSync(fullPath).isDirectory();
        let command;
        if (!isDirectory) {
          command = {
            command: "jshunter.openSourcemapFile",
            title: "Open Sourcemap File",
            arguments: [fileName, currentFile]
          };
        }
        const item = new SourcemapTreeItem(
          fileName,
          isDirectory ? vscode5.TreeItemCollapsibleState.Collapsed : vscode5.TreeItemCollapsibleState.None,
          isDirectory ? "directory" : "sourcemap",
          fileName,
          command
        );
        if (isDirectory) {
          item.iconPath = new vscode5.ThemeIcon("folder");
        } else if (fileName.endsWith(".js")) {
          item.resourceUri = vscode5.Uri.file(`virtual/path/${fileName}`);
        } else if (fileName.endsWith(".map")) {
          item.iconPath = new vscode5.ThemeIcon("file-binary");
        } else {
          item.resourceUri = vscode5.Uri.file(`virtual/path/${fileName}`);
        }
        return item;
      }));
    }
    if (element.type === "directory" && element.fileName) {
      const currentFile = this.stateService.getSelectedFile();
      const sourceDir = this.stateService.getSourceDir() || "";
      const directoryPath = path4.join(sourceDir, element.fileName);
      try {
        const files = fs4.readdirSync(directoryPath);
        return Promise.resolve(files.map((fileName) => {
          const fullPath = path4.join(directoryPath, fileName);
          const isDirectory = fs4.statSync(fullPath).isDirectory();
          let command;
          if (!isDirectory) {
            command = {
              command: "jshunter.openSourcemapFile",
              title: "Open Sourcemap File",
              arguments: [path4.join(element.fileName, fileName), currentFile]
            };
          }
          const item = new SourcemapTreeItem(
            fileName,
            isDirectory ? vscode5.TreeItemCollapsibleState.Collapsed : vscode5.TreeItemCollapsibleState.None,
            isDirectory ? "directory" : "sourcemap",
            path4.join(element.fileName, fileName),
            command
          );
          if (isDirectory) {
            item.iconPath = new vscode5.ThemeIcon("folder");
          } else if (fileName.endsWith(".js")) {
            item.resourceUri = vscode5.Uri.file(`virtual/path/${fileName}`);
          } else if (fileName.endsWith(".map")) {
            item.iconPath = new vscode5.ThemeIcon("file-binary");
          } else {
            item.resourceUri = vscode5.Uri.file(`virtual/path/${fileName}`);
          }
          return item;
        }));
      } catch (error) {
        console.error(`Error reading directory ${directoryPath}:`, error);
        return Promise.resolve([
          new SourcemapTreeItem(
            "Error reading directory",
            vscode5.TreeItemCollapsibleState.None,
            "message"
          )
        ]);
      }
    }
    return Promise.resolve([]);
  }
};
var SourcemapTreeItem = class extends vscode5.TreeItem {
  constructor(label, collapsibleState, type, fileName, command) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.type = type;
    this.fileName = fileName;
    this.command = command;
    this.contextValue = type;
    if (type === "message") {
      this.iconPath = new vscode5.ThemeIcon("info");
    }
  }
};
var SourcemapCommands = class {
  stateService;
  constructor(stateService) {
    this.stateService = stateService;
  }
  async openSourcemapFile(fileName, file) {
    try {
      const config = this.stateService.getConfig();
      if (!config || !config.storage_dir) {
        vscode5.window.showErrorMessage("Failed to get config");
        return;
      }
      const storageDir = config.storage_dir;
      const url = new URL(file.url);
      const domain = url.hostname;
      const sourcemapDir = path4.join(storageDir, "files", domain, file.hash, "original");
      const filePath = path4.join(sourcemapDir, fileName);
      if (!fs4.existsSync(filePath)) {
        vscode5.window.showErrorMessage(`File not found: ${filePath}`);
        return;
      }
      const document = await vscode5.workspace.openTextDocument(filePath);
      await vscode5.window.showTextDocument(document);
    } catch (error) {
      vscode5.window.showErrorMessage(`Error opening sourcemap file: ${error}`);
    }
  }
  registerCommands(context) {
    const openSourcemapCommand = vscode5.commands.registerCommand(
      "jshunter.openSourcemapFile",
      this.openSourcemapFile.bind(this)
    );
    context.subscriptions.push(openSourcemapCommand);
  }
};

// src/extension.ts
function activate(context) {
  const stateService = StateService.getInstance();
  const endpointsProvider = new EndpointsProvider(stateService);
  const contentProvider = new ContentProvider(stateService);
  const findingsProvider = new FindingsProvider(stateService, context);
  const sourcemapProvider = new SourcemapsProvider(stateService);
  stateService.startEndpointsMonitoring();
  const endpointsCommands = new EndpointsCommands(endpointsProvider, stateService);
  const findingCommands = new FindingsCommands(findingsProvider, stateService);
  const contentCommands = new ContentCommands(stateService);
  const sourceCommands = new SourcemapCommands(stateService);
  endpointsCommands.registerCommands(context);
  findingCommands.registerCommands(context);
  contentCommands.registerCommands(context);
  sourceCommands.registerCommands(context);
  const endpointsView = vscode6.window.createTreeView("jshunter.endpointsView", {
    treeDataProvider: endpointsProvider,
    showCollapseAll: true
  });
  const contentView = vscode6.window.createTreeView("jshunter.contentView", {
    treeDataProvider: contentProvider,
    showCollapseAll: true
  });
  const findingsView = vscode6.window.createTreeView("jshunter.findingsView", {
    treeDataProvider: findingsProvider,
    showCollapseAll: true
  });
  const sourceView = vscode6.window.createTreeView("jshunter.sourceView", {
    treeDataProvider: sourcemapProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(endpointsView, contentView, findingsView, sourceView);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
