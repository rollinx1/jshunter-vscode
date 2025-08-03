import * as vscode from 'vscode';
import { Endpoint } from '../types';
import { getDomainFromUrl, getEndpointDisplayName } from '../utils/urls';
import { StateService } from '../services/state';


export class EndpointsProvider implements vscode.TreeDataProvider<EndpointTreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<EndpointTreeItem | undefined | null | void> = new vscode.EventEmitter<EndpointTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<EndpointTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private stateService: StateService;

    constructor(stateService: StateService) {
        this.stateService = stateService;
        this.stateService.onEndpointsChanged(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: EndpointTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EndpointTreeItem): Thenable<EndpointTreeItem[]> {
        if (element) {
            // This is a domain item, return its endpoints
            if (element.type === 'domain' && element.endpoints) {
                return Promise.resolve(
                    element.endpoints.map(endpoint => new EndpointTreeItem(
                        getEndpointDisplayName(endpoint.url),
                        vscode.TreeItemCollapsibleState.None,
                        'endpoint',
                        endpoint
                    ))
                );
            }
            // Endpoints have no children
            return Promise.resolve([]);
        } else {
            // This is the root, return domains
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
            }, {} as { [key: string]: Endpoint[] });

            return Promise.resolve(
                Object.keys(endpointsByDomain).map(domain => new EndpointTreeItem(
                    domain,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'domain',
                    undefined,
                    endpointsByDomain[domain] // Pass the endpoints for this domain
                ))
            );
        }
    }
}

export class EndpointTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'domain' | 'endpoint',
        public readonly endpoint?: Endpoint,
        public readonly endpoints?: Endpoint[] // This property holds children for domain items
    ) {
        super(label, collapsibleState);
        this.contextValue = this.type;
        if (this.type === 'endpoint') {
            this.command = {
                command: 'jshunter.setSelectedEndpoint',
                title: 'Select Endpoint',
                arguments: [this.endpoint]
            };
            this.iconPath = new vscode.ThemeIcon('link');
        } else {
            this.iconPath = new vscode.ThemeIcon('globe', new vscode.ThemeColor('charts.blue'));
        }
    }
}

export class EndpointsCommands {
    private endpointsProvider?: EndpointsProvider;
    private stateService?: StateService;

    constructor(endpointsProvider: EndpointsProvider, stateService: StateService) {
        this.stateService = stateService;
        this.endpointsProvider = endpointsProvider;
    };

    registerCommands(context: vscode.ExtensionContext): void {
        const setSelectedEndpoint = vscode.commands.registerCommand(
            'jshunter.setSelectedEndpoint',
            this.setSelectedEndpoint.bind(this)
        );

        context.subscriptions.push(setSelectedEndpoint);
    }

    private setSelectedEndpoint(endpoint: Endpoint) {
        this.stateService?.setSelectedEndpoint(endpoint);
    }

} 