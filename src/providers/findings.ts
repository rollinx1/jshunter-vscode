import * as vscode from 'vscode';
import * as fs from 'fs';
import { Finding, Endpoint } from '../types';
import { getFileNameFromUrl, getPath } from '../utils';
import { StateService } from '../services';
import path from 'path';

export class FindingsProvider implements vscode.TreeDataProvider<FindingTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FindingTreeItem | undefined | null | void> = new vscode.EventEmitter<FindingTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FindingTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private stateService: StateService;
    private context: vscode.ExtensionContext
    constructor(stateService: StateService, context: vscode.ExtensionContext) {
        this.stateService = stateService;
        this.context = context;
        this.stateService.onSelectedEndpointChanged(() => this.refresh());
    }
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private getCategoryItems(): FindingTreeItem[] {
        const categories: FindingTreeItem[] = [];

        // Detectar qué categorías están presentes basándose en los tipos de findings
        const urlTypes = ['api-endpoint', 'full-url', 'path-only'];
        const gqlTypes = ['gql-query', 'gql-mutation', 'gql-subscription'];
        const domxssTypes = ['dom-eval', 'dom-write', 'dom-innerHTML', 'dom-postmessage', 'dom-domain'];
        const eventTypes = ['event-listener', 'event-onmessage', 'event-onhashchange', 'event-window-open', 'event-location'];
        const httpApiTypes = ['http-fetch', 'http-xhr', 'http-axios', 'http-jquery'];

        const findings = this.stateService.getFindings();

        // URLs
        const urlFindings = findings.filter(f => urlTypes.includes(f.type));

        const urlItem = new FindingTreeItem(
            `URLs (${urlFindings.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'categorySection',
            undefined,
            undefined,
            'urls'
        );
        urlItem.iconPath = new vscode.ThemeIcon('link', new vscode.ThemeColor('charts.blue'));
        categories.push(urlItem);

        // GraphQL
        const gqlFindings = findings.filter(f => gqlTypes.includes(f.type));
        const gqlItem = new FindingTreeItem(
            `GraphQL (${gqlFindings.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'categorySection',
            undefined,
            undefined,
            'gql'
        );
        gqlItem.iconPath = vscode.Uri.file(
            path.join(this.context.extensionPath, 'media', 'graphql.png')
        );
        categories.push(gqlItem);


        // DOM XSS
        const domxssFindings = findings.filter(f => domxssTypes.includes(f.type));
        const domxssItem = new FindingTreeItem(
            `DOM XSS (${domxssFindings.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'categorySection',
            undefined,
            undefined,
            'domxss'
        );
        domxssItem.iconPath = new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.red'));
        categories.push(domxssItem);


        // Events
        const eventFindings = findings.filter(f => eventTypes.includes(f.type));
        const eventItem = new FindingTreeItem(
            `Events (${eventFindings.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'categorySection',
            undefined,
            undefined,
            'events'
        );
        eventItem.iconPath = new vscode.ThemeIcon('bell-dot', new vscode.ThemeColor('charts.yellow'));
        categories.push(eventItem);


        // HTTP API
        const httpApiFindings = findings.filter(f => httpApiTypes.includes(f.type));
        const httpApiItem = new FindingTreeItem(
            `HTTP API (${httpApiFindings.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'categorySection',
            undefined,
            undefined,
            'httpapi'
        );
        httpApiItem.iconPath = new vscode.ThemeIcon('arrow-swap', new vscode.ThemeColor('charts.orange'));
        categories.push(httpApiItem);


        return categories;
    }

    getTreeItem(element: FindingTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FindingTreeItem): Thenable<FindingTreeItem[]> {
        const selectedEndpoint = this.stateService.getSelectedEndpoint();
        const findings = this.stateService.getFindings();

        if (!element) {
            // Root level
            if (!selectedEndpoint) {
                return Promise.resolve([
                    new FindingTreeItem(
                        'No endpoint selected',
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                ]);
            }

            if (findings.length === 0) {

                let noFindingsMessage = 'No findings found';
                if (!('type' in selectedEndpoint)) {
                    // Es un endpoint
                    try {
                        const url = new URL(selectedEndpoint.url);
                        const domain = url.hostname;
                        const path = url.pathname || '/';
                        noFindingsMessage = `No findings found for ${domain}${path}`;
                    } catch {
                        noFindingsMessage = `No findings found for selected endpoint`;
                    }
                }

                return Promise.resolve([
                    new FindingTreeItem(
                        noFindingsMessage,
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                ]);
            }

            // Crear secciones basadas en las categorías encontradas
            const categoryItems = this.getCategoryItems();
            if (selectedEndpoint) {
                const url = new URL(selectedEndpoint.url);
                const domain = url.hostname;
                const path = url.pathname || '/';
                const infoItem = new FindingTreeItem(
                    `Findings for ${domain}${path} (${findings.length} total)`,
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                );
                infoItem.iconPath = new vscode.ThemeIcon('info');
                return Promise.resolve([infoItem, ...categoryItems]);
            }

            return Promise.resolve(categoryItems);
        }

        if (element.type === 'categorySection') {
            // Mostrar tipos dentro de esta categoría
            return Promise.resolve(this.getTypeItems(element.category!));
        }

        if (element.type === 'findingType') {
            // Mostrar findings de este tipo
            return Promise.resolve(this.getFindingItems(element.findingType!));
        }

        return Promise.resolve([]);
    }

    private getTypeItems(category?: string): FindingTreeItem[] {
        // Filtrar findings por categoría si se especifica
        const findings = this.stateService.getFindings();
        let relevantFindings: Finding[] = [];

        if (category) {
            const categoryTypeMap = {
                'urls': ['api-endpoint', 'full-url', 'path-only'],
                'gql': ['gql-query', 'gql-mutation', 'gql-subscription'],
                'domxss': ['dom-eval', 'dom-write', 'dom-innerHTML', 'dom-postmessage', 'dom-domain'],
                'events': ['event-listener', 'event-onmessage', 'event-onhashchange', 'event-window-open', 'event-location'],
                'httpapi': ['http-fetch', 'http-xhr', 'http-axios', 'http-jquery']
            };

            const allowedTypes = categoryTypeMap[category as keyof typeof categoryTypeMap] || [];
            relevantFindings = findings.filter(f => allowedTypes.includes(f.type))
        }

        // Agrupar findings por tipo
        const typeMap = new Map<string, Finding[]>();

        relevantFindings.forEach(finding => {
            const type = finding.type;
            if (!typeMap.has(type)) {
                typeMap.set(type, []);
            }
            typeMap.get(type)!.push(finding);
        });

        // Ordenar los tipos por importancia (API endpoints primero)
        const sortedTypes = Array.from(typeMap.keys()).sort((a, b) => {
            const priority = this.getTypePriority(a) - this.getTypePriority(b);
            return priority !== 0 ? priority : a.localeCompare(b);
        });

        return sortedTypes.map(type => {
            const count = typeMap.get(type)!.length;
            const displayName = this.getTypeDisplayName(type);

            // Determine if this is a URL type for context menu
            const urlTypes = ['api-endpoint', 'full-url', 'path-only'];
            const contextValue = urlTypes.includes(type) ? 'urlFindingType' : 'findingType';

            const item = new FindingTreeItem(
                `${displayName} (${count})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'findingType',
                undefined,
                type
            );

            // Set context value for menu filtering
            item.contextValue = contextValue;

            return item;
        });
    }

    private getTypePriority(type: string): number {
        // Prioridad para mostrar tipos más importantes primero
        switch (type) {
            case 'api-endpoint': return 1;
            case 'full-url': return 2;
            case 'path-only': return 3;
            default: return 4;
        }
    }

    private getTypeDisplayName(type: string): string {
        switch (type) {
            // URLs
            case 'api-endpoint': return 'API Endpoints';
            case 'full-url': return 'URLs';
            case 'path-only': return 'Paths';

            // GraphQL
            case 'gql-query': return 'GQL Queries';
            case 'gql-mutation': return 'GQL Mutations';
            case 'gql-subscription': return 'GQL Subscriptions';

            // DOM XSS
            case 'dom-eval': return 'eval';
            case 'dom-write': return 'document.write';
            case 'dom-innerHTML': return 'innerHTML';
            case 'dom-postmessage': return 'postMessage';
            case 'dom-domain': return 'document.domain';

            // Events
            case 'event-listener': return 'Event Listeners';
            case 'event-onmessage': return 'Message Handlers';
            case 'event-onhashchange': return 'Hash Change Handlers';
            case 'event-window-open': return 'Window Open Calls';
            case 'event-location': return 'Location Manipulation';

            // HTTP API
            case 'http-fetch': return 'Fetch API Calls';
            case 'http-xhr': return 'XMLHttpRequest';
            case 'http-axios': return 'Axios Requests';
            case 'http-jquery': return 'jQuery AJAX';

            default: return type.charAt(0).toUpperCase() + type.slice(1);
        }
    }



    private getFindingItems(findingType: string): FindingTreeItem[] {
        const findings = this.stateService.getFindings();
        const findingsOfType = findings.filter(finding => finding.type === findingType);

        return findingsOfType.map(finding => {
            // Create main preview text (the finding value)
            let preview = finding.value;
            if (preview.length > 80) {
                preview = preview.substring(0, 77) + '...';
            }

            // Create file info for description (will appear in gray)
            let fileInfo = '';
            if (finding.expand?.js_file) {
                // Get meaningful filename from the JS file URL if possible
                const jsFileName = getFileNameFromUrl(finding.expand.js_file.url);
                fileInfo = jsFileName;
            }
            if (finding.line !== undefined) {
                fileInfo += fileInfo ? `:${finding.line}` : `L${finding.line}`;
            }

            // Determine context value based on finding type
            const urlTypes = ['api-endpoint', 'full-url', 'path-only'];
            const contextValue = urlTypes.includes(finding.type) ? 'urlFinding' : 'finding';

            const item = new FindingTreeItem(
                preview,
                vscode.TreeItemCollapsibleState.None,
                'finding',
                finding
            );

            // Set file info as description (appears in gray to the right)
            if (fileInfo) {
                item.description = fileInfo;
            }

            // Add command to navigate to the finding location
            item.command = {
                command: 'jshunter.goToFinding',
                title: 'Go to Finding',
                arguments: [finding]
            };
            // Set context value for menu filtering
            item.contextValue = contextValue;

            return item;
        });
    }




}

export class FindingTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'message' | 'findingType' | 'finding' | 'urlsSection' | 'categorySection' | 'info',
        public readonly finding?: Finding,
        public readonly findingType?: string,
        public readonly category?: string
    ) {
        super(label, collapsibleState);

        this.contextValue = type;
    }
}

export class FindingsCommands {
    private findingsProvider?: FindingsProvider;
    private stateSerivce?: StateService;
    constructor(findingsProvider: FindingsProvider, stateService: StateService) {
        this.findingsProvider = findingsProvider;
        this.stateSerivce = stateService;
    }


    registerCommands(context: vscode.ExtensionContext): void {
        /*      const copyUrlCommand = vscode.commands.registerCommand(
                 'jshunter.copyUrl',
                 this.copyUrl.bind(this)
             );
     
             const copyAllUrlsCommand = vscode.commands.registerCommand(
                 'jshunter.copyAllUrls',
                 this.copyAllUrls.bind(this)
             );
     
             const copyAllUrlsOfTypeCommand = vscode.commands.registerCommand(
                 'jshunter.copyAllUrlsOfType',
                 this.copyAllUrlsOfType.bind(this)
             );
      */
        const goToFindingCommand = vscode.commands.registerCommand(
            'jshunter.goToFinding',
            this.goToFinding.bind(this)
        );

        context.subscriptions.push(goToFindingCommand);
    }

    private async copyUrl(item: FindingTreeItem): Promise<void> {
        if (!item.finding) {
            vscode.window.showErrorMessage('No URL to copy');
            return;
        }

        try {
            await vscode.env.clipboard.writeText(item.finding.value);
            vscode.window.showInformationMessage(`URL copied: ${item.finding.value}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy URL: ${error}`);
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


    private async goToFinding(finding: Finding): Promise<void> {
        if (!finding.expand?.js_file || !this.stateSerivce) {
            vscode.window.showErrorMessage('No JavaScript file associated with this finding');
            return;
        }

        try {
            const config = this.stateSerivce.getConfig();
            if (!config) return;
            // Construct file path
            const filePath = getPath(config.storage_dir, finding.expand.js_file.url, finding.expand.js_file.hash);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`File not found: ${filePath}`);
                return;
            }

            // Open the actual file but show a helpful status message
            const document = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(document, {
                preview: false
            });

            // Navigate to the specific line and column
            if (finding.line !== undefined) {
                const line = Math.max(0, finding.line - 1); // VSCode uses 0-based line numbers
                const column = finding.column ? Math.max(0, finding.column - 1) : 0;

                const position = new vscode.Position(line, column);
                const range = new vscode.Range(position, position);

                // Set cursor position and reveal the line
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error opening file: ${error}`);
        }
    }


} 