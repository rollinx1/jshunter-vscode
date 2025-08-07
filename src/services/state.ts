import * as vscode from 'vscode';
import * as fs from 'fs';
import { Config, Endpoint, Finding, JavascriptFile, Sourcemap } from '../types';
import { ApiService } from './api';
import path from 'path';
import { getSourcemapDir } from '../utils';

// 1. Define the shape of our application's state
interface AppState {
    endpoints: Endpoint[];
    selectedEndpoint: Endpoint | null;
    findings: Finding[];
    sourcemaps: Sourcemap[];
    sourceDir: string | null;
    javascriptFiles: JavascriptFile[];
    selectedFile: JavascriptFile | Endpoint | null;
    config: Config | null;
}
const initialState = {
    endpoints: [],
    selectedEndpoint: null,
    findings: [],
    sourcemaps: [],
    sourceDir: null,
    javascriptFiles: [],
    selectedFile: null,
    config: null
};
// 2. Create the Store class as a Singleton
export class StateService {
    private static _instance: StateService;
    private _state: AppState;
    private apiService: ApiService;
    private checkInterval: NodeJS.Timeout | null = null;

    // Emitters to notify other parts of the extension about changes
    private readonly _onEndpointsChanged = new vscode.EventEmitter<Endpoint[]>();
    public readonly onEndpointsChanged = this._onEndpointsChanged.event;

    private readonly _onSelectedEndpointChanged = new vscode.EventEmitter<Endpoint | null>();
    public readonly onSelectedEndpointChanged = this._onSelectedEndpointChanged.event;

    private readonly _onSourcesChanged = new vscode.EventEmitter<Sourcemap[]>();
    public readonly onSourcesChanged = this._onSourcesChanged.event;

    private readonly _onFindinsChanged = new vscode.EventEmitter<Finding[]>();
    public readonly onFindingsChanged = this._onFindinsChanged.event;

    private constructor() {
        this.apiService = ApiService.getInstance();
        this._state = initialState;
    }


    // The method to get the single instance of the store
    public static getInstance(): StateService {
        if (!StateService._instance) {
            StateService._instance = new StateService();
        }
        return StateService._instance;
    }

    async startEndpointsMonitoring(): Promise<void> {
        // Hacer el primer check inmediatamente
        const configCall = await this.apiService.loadConfig();
        if (configCall.success && configCall.data) {
            this._state.config = {
                ...configCall.data,
                storage_dir: path.join(configCall.data.storage_dir, "files")
            };
        }


        const endpointsCall = await this.apiService.loadEndpoints();
        if (endpointsCall.success && endpointsCall.data) {
            this.setEndpoints(endpointsCall.data);
        }


        // Configurar el intervalo cada 30 segundos
        this.checkInterval = setInterval(async () => {
            const endpointsCall = await this.apiService.loadEndpoints();
            if (endpointsCall.success && endpointsCall.data) {
                if (endpointsCall.data.length === 0) {
                    this.clearState();
                }
                this.setEndpoints(endpointsCall.data);
            } else {
                this.clearState();
            }
        }, 30000);
    }

    public clearState() {
        this.setSelectedEndpoint(null);
        this.setSelectedFile(null);
        this.setFindings([])
        this.setSourcemaps([]);
    }

    // --- Getters for current state ---
    public getState(): AppState {
        return this._state;
    }

    // --- Setters to update state and notify listeners ---
    public setEndpoints(endpoints: Endpoint[]): void {
        this._state.endpoints = endpoints;
        this._onEndpointsChanged.fire(this._state.endpoints);
    }

    public async setSelectedEndpoint(endpoint: Endpoint | null): Promise<void> {

        // When the endpoint changes, clear the related data
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
                    this.setJavascriptFiles([...endpointJs, ...lazyLoadedJs.data])
                } else {
                    this.setJavascriptFiles([...endpointJs]);
                }
            }
            const jsFiles = this.getJsFilesForSelectedEndpoint().sort((a, b) => a.url.localeCompare(b.url))
            this.setJavascriptFiles(jsFiles)
            const findings = await this.apiService.loadFindings(this._state.javascriptFiles);
            if (findings.success && findings.data) {
                this.setFindings(findings.data)
            }
        }

        this._onSelectedEndpointChanged.fire(this._state.selectedEndpoint);

    }

    public setFindings(findings: Finding[]): void {
        this._state.findings = findings;
        this._onFindinsChanged.fire(this._state.findings)
    }

    public setSourcemaps(sourcemaps: Sourcemap[]): void {
        this._state.sourcemaps = sourcemaps;
        this._onSourcesChanged.fire(this._state.sourcemaps)
    }

    public setSourceDir(dir: string | null): void {
        this._state.sourceDir = dir;
    }
    public setJavascriptFiles(files: JavascriptFile[]): void {
        this._state.javascriptFiles = files;
    }
    public setSelectedFile(file: JavascriptFile | Endpoint | null): void {
        this._state.selectedFile = file;
        if (file !== null && this._state.config) {
            const sourceDir = getSourcemapDir(this._state.config.storage_dir, file)
            if (sourceDir && fs.existsSync(sourceDir)) {
                try {
                    this.setSourceDir(sourceDir)
                    const entries = fs.readdirSync(sourceDir);
                    this.setSourcemaps(entries);
                } catch (error) {
                    console.error(`Error reading sourcemap directory: ${error}`);
                };
            }
        }
    }

    public getSelectedEndpoint(): Endpoint | null {
        return this._state.selectedEndpoint;
    }
    public getJsFilesForSelectedEndpoint(): JavascriptFile[] {
        return this._state.javascriptFiles;
    }
    public getSelectedFile(): JavascriptFile | Endpoint | null {
        return this._state.selectedFile;
    }
    public getSourcemaps(): Sourcemap[] {
        return this._state.sourcemaps;
    }
    public getFindings(): Finding[] {
        return this._state.findings;
    }
    public getConfig(): Config | null {
        return this._state.config;
    }
    public getSourceDir(): string | null {
        return this._state.sourceDir;
    }
}
