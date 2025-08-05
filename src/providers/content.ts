import * as vscode from 'vscode';
import * as fs from 'fs';
import { Endpoint, JavascriptFile } from '../types';
import { getDomainFromUrl, getFullPath } from '../utils/urls';
import { StateService } from '../services/state';
import { SourcemapsProvider } from './sourcemaps';
import { getPath } from '../utils';

export class ContentProvider implements vscode.TreeDataProvider<ContentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContentTreeItem | undefined | null | void> = new vscode.EventEmitter<ContentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private treeView: vscode.TreeView<ContentTreeItem> | null = null;
    private stateService: StateService;

    constructor(stateService: StateService) {
        this.stateService = stateService;
        this.stateService.onSelectedEndpointChanged(() => this.refresh());
    }
    refresh(): void {

        this.updateTreeViewTitle();
        this._onDidChangeTreeData.fire();
    }

    // Método para establecer la referencia al tree view
    setTreeView(treeView: vscode.TreeView<ContentTreeItem>): void {
        this.treeView = treeView;
    }

    // Actualizar el título del tree view dinámicamente
    private updateTreeViewTitle(): void {
        if (this.treeView) {
            const selectedEndpoint = this.stateService.getSelectedEndpoint()
            if (selectedEndpoint) {
                const endpointPath = getFullPath(selectedEndpoint.url);
                const domain = getDomainFromUrl(selectedEndpoint.url);
                this.treeView.title = `Content: ${domain}${endpointPath}`;
            } else {
                this.treeView.title = 'Content: No Endpoint Selected';
            }
        }
    }

    getTreeItem(element: ContentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ContentTreeItem): Thenable<ContentTreeItem[]> {
        if (!element) {
            const selectedEndpoint = this.stateService.getSelectedEndpoint();

            // Root level - mostrar dominios
            if (!selectedEndpoint) {
                return Promise.resolve([
                    new ContentTreeItem(
                        'No endpoint selected',
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                ]);
            }

            return this.getDomainItems();
        }

        if (element.type === 'domain') {
            // Mostrar archivos de este dominio
            return this.getFilesForDomain(element.domain!);
        }



        return Promise.resolve([]);
    }

    private async getDomainItems(): Promise<ContentTreeItem[]> {
        const selectedEndpoint = this.stateService.getSelectedEndpoint();

        if (!selectedEndpoint) {
            return [];
        }

        // Agrupar archivos por dominio
        const domainMap = new Map<string, { htmlFiles: Endpoint[], jsFiles: JavascriptFile[] }>();

        // Agregar el HTML del endpoint seleccionado (tanto desktop como mobile si existe)
        const endpointDomain = getDomainFromUrl(selectedEndpoint.url);
        if (!domainMap.has(endpointDomain)) {
            domainMap.set(endpointDomain, { htmlFiles: [], jsFiles: [] });
        }

        // Always add desktop version
        domainMap.get(endpointDomain)!.htmlFiles.push(selectedEndpoint);

        // Add mobile version if it exists (mobile_hash is present)
        if (selectedEndpoint.mobile_hash) {
            // Create a virtual mobile version for display
            const mobileVersion = { ...selectedEndpoint, isMobileVersion: true };
            domainMap.get(endpointDomain)!.htmlFiles.push(mobileVersion as any);
        }

        const jsFiles = this.stateService.getJsFilesForSelectedEndpoint();

        if (jsFiles.length > 0) {
            // Add main JS files to domain map
            for (const jsFile of jsFiles) {
                const jsDomain = getDomainFromUrl(jsFile.url);
                if (!domainMap.has(jsDomain)) {
                    domainMap.set(jsDomain, { htmlFiles: [], jsFiles: [] });
                }

                domainMap.get(jsDomain)!.jsFiles.push(jsFile);
            }
        }


        // Crear items de dominio
        return Array.from(domainMap.keys()).map(domain => {
            const data = domainMap.get(domain)!;

            // Calculate files correctly for each domain
            let filesInThisDomain = data.jsFiles.length;

            // Only count HTML files if they belong to this domain
            const endpointDomain = getDomainFromUrl(selectedEndpoint!.url);
            if (domain === endpointDomain) {
                // Add HTML files count for this domain only
                const htmlCount = selectedEndpoint!.mobile_hash ? 2 : 1;
                filesInThisDomain += htmlCount;
            }

            return new ContentTreeItem(
                `${domain} (${filesInThisDomain} files)`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'domain',
                selectedEndpoint || undefined,
                undefined,
                undefined,
                domain
            );
        });
    }

    private async getFilesForDomain(domain: string): Promise<ContentTreeItem[]> {
        const selectedEndpoint = this.stateService.getSelectedEndpoint();

        if (!selectedEndpoint) {
            return [];
        }

        const items: ContentTreeItem[] = [];

        // Agregar HTML files de este dominio (desktop y mobile si existe)
        const endpointDomain = getDomainFromUrl(selectedEndpoint.url);
        if (endpointDomain === domain) {
            // Desktop version
            items.push(new ContentTreeItem(
                `${getFullPath(selectedEndpoint.url)}`,
                vscode.TreeItemCollapsibleState.None,
                'htmlFile',
                selectedEndpoint,
                undefined,
                {
                    command: 'jshunter.openFile',
                    title: 'Open Desktop HTML File',
                    arguments: [selectedEndpoint, false] // false = desktop
                },
                undefined,
                'desktop'
            ));

            // Mobile version if it exists
            if (selectedEndpoint.mobile_hash) {
                items.push(new ContentTreeItem(
                    `${getFullPath(selectedEndpoint.url)} (Mobile)`,
                    vscode.TreeItemCollapsibleState.None,
                    'htmlFile',
                    selectedEndpoint,
                    undefined,
                    {
                        command: 'jshunter.openFile',
                        title: 'Open Mobile HTML File',
                        arguments: [selectedEndpoint, true] // true = mobile
                    },
                    undefined,
                    'mobile'
                ));
            }
        }

        const jsFiles = this.stateService.getJsFilesForSelectedEndpoint();

        // Agregar archivos JS de este dominio
        if (jsFiles.length) {
            for (const jsFile of jsFiles) {
                const jsDomain = getDomainFromUrl(jsFile.url);
                if (jsDomain === domain) {
                    if (jsFile.type === "chunk") {
                        items.push(new ContentTreeItem(
                            `${getFullPath(jsFile.url)} (chunk)`,
                            vscode.TreeItemCollapsibleState.None,
                            'jsChunk',
                            selectedEndpoint,
                            jsFile,
                            {
                                command: 'jshunter.openFile',
                                title: 'Open JS Chunk',
                                arguments: [jsFile]
                            }
                        ));
                    } else {
                        items.push(new ContentTreeItem(
                            getFullPath(jsFile.url),
                            vscode.TreeItemCollapsibleState.None,
                            'jsFile',
                            selectedEndpoint,
                            jsFile,
                            {
                                command: 'jshunter.openFile',
                                title: 'Open JS File',
                                arguments: [jsFile]
                            }
                        ));
                    }
                }

            }
        }

        return items;
    }

}

export class ContentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'message' | 'htmlFile' | 'jsFile' | 'domain' | 'error' | 'jsChunk',
        public readonly endpoint?: Endpoint,
        public readonly jsFile?: JavascriptFile,
        public readonly command?: vscode.Command,
        public readonly domain?: string,
        public readonly version?: 'desktop' | 'mobile'
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.contextValue = type;

        // Configurar iconos
        if (type === 'htmlFile') {
            // Usar icono nativo de VSCode para archivos HTML
            this.resourceUri = vscode.Uri.parse(`file:///dummy.html`);
        } else if (type === 'jsFile') {
            // Usar icono nativo de VSCode para archivos JS (yellow)
            this.resourceUri = vscode.Uri.parse(`file:///dummy.js`);
        } else if (type === 'jsChunk') {
            // Usar icono de test para chunks (orange)
            this.resourceUri = vscode.Uri.parse(`file:///dummy.test.js`);
        } else if (type === 'domain') {
            // Usar icono de globo para dominios
            this.iconPath = new vscode.ThemeIcon('globe', new vscode.ThemeColor('charts.orange'));
        } else if (type === 'message') {
            this.iconPath = new vscode.ThemeIcon('info');
        } else if (type === 'error') {
            this.iconPath = new vscode.ThemeIcon('error');
        }
    }

    private getTooltip(): string {
        switch (this.type) {
            case 'domain':
                return `Domain: ${this.domain}`;
            case 'htmlFile':
                const versionText = this.version ? ` (${this.version})` : '';
                return `HTML File${versionText}: ${this.endpoint?.url}`;
            case 'jsFile':
                return `JS File: ${this.jsFile?.url}\nType: ${this.jsFile?.type}`;
            case 'jsChunk':
                return `JS Chunk: ${this.jsFile?.url}\nType: ${this.jsFile?.type}`;
            case 'error':
                return `Error: ${this.label}`;
            case 'message':
                return this.label;
            default:
                return this.label;
        }
    }
}

export class ContentCommands {
    private stateService?: StateService;

    constructor(stateService: StateService) {
        this.stateService = stateService;
    }


    registerCommands(context: vscode.ExtensionContext): void {
        const openFileCommand = vscode.commands.registerCommand(
            'jshunter.openFile',
            (file: JavascriptFile | Endpoint) => {
                this.openFile(file);
            }
        );

        context.subscriptions.push(openFileCommand);
    }

    private async openFile(file: JavascriptFile | Endpoint): Promise<void> {
        try {
            if (!this.stateService) return;

            const config = this.stateService.getConfig();
            if (config === null) return;

            const filePath = getPath(config.storage_dir, file.url, file.hash);

            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`File not found: ${filePath}`);
                return;
            }

            this.stateService.setSelectedFile(file);
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);


        } catch (error) {
            vscode.window.showErrorMessage(`Error opening file: ${error}`);
        }
    }

}