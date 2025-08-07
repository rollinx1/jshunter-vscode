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
        const endpoints = this.stateService.getState().endpoints;
        if (!endpoints || endpoints.length === 0) {
            return Promise.resolve([
                new EndpointTreeItem(
                    'No endpoints Found',
                    vscode.TreeItemCollapsibleState.None,
                    'message'
                )
            ]);
        }
        if (!element) {
            // Root: group by domain
            const endpointsByDomain = endpoints.reduce((acc, endpoint) => {
                const domain = getDomainFromUrl(endpoint.url);
                if (!acc[domain]) acc[domain] = [];
                acc[domain].push(endpoint);
                return acc;
            }, {} as { [key: string]: Endpoint[] });

            return Promise.resolve(
                Object.keys(endpointsByDomain).map(domain =>
                    new EndpointTreeItem(
                        domain,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'domain',
                        undefined,
                        undefined,
                        endpointsByDomain[domain]
                    )
                )
            );
        }
        if (element.type === 'domain' && element.domainEndpoints) {
            // Group by URL under domain
            const endpointsByUrl = element.domainEndpoints.reduce((acc, endpoint) => {
                if (!acc[endpoint.url]) acc[endpoint.url] = [];
                acc[endpoint.url].push(endpoint);
                return acc;
            }, {} as { [key: string]: Endpoint[] });

            return Promise.resolve(
                Object.keys(endpointsByUrl).map(url =>
                    new EndpointTreeItem(
                        getEndpointDisplayName(url),
                        vscode.TreeItemCollapsibleState.Collapsed,
                        'url',
                        undefined,
                        url,
                        undefined, // <-- Fix: set domainEndpoints to undefined
                        endpointsByUrl[url] // <-- Fix: set urlEndpoints here
                    )
                )
            );
        }

        if (element.type === 'url' && element.urlEndpoints) {
            // Show each occurrence (with timestamp) under URL
            return Promise.resolve(
                element.urlEndpoints.map(endpoint => {
                    // Only show the timestamp as the label
                    return new EndpointTreeItem(
                        '',
                        vscode.TreeItemCollapsibleState.None,
                        'endpoint',
                        endpoint,
                        undefined,
                        undefined,
                        undefined
                    );
                })
            );
        }
        return Promise.resolve([]);
    }
}

export class EndpointTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'message' | 'domain' | 'url' | 'endpoint',
        public readonly endpoint?: Endpoint,
        public readonly url?: string,
        public readonly domainEndpoints?: Endpoint[],
        public readonly urlEndpoints?: Endpoint[]
    ) {
        super(label, collapsibleState);
        this.contextValue = this.type;
        switch (this.type) {
            case 'domain': {
                this.iconPath = new vscode.ThemeIcon('globe', new vscode.ThemeColor('charts.blue'));
                break;
            }
            case 'endpoint': {
                if (endpoint) {
                    this.command = {
                        command: 'jshunter.setSelectedEndpoint',
                        title: 'Select Endpoint',
                        arguments: [this.endpoint]
                    };
                    this.iconPath = new vscode.ThemeIcon('arrow-small-right');
                    // Only show the timestamp as faded description
                    this.description = `Found at ${endpoint.created_at}`;
                }
                break;
            }
            case 'url': {
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            }
            case 'message': {
                this.iconPath = new vscode.ThemeIcon('info');
                break;
            }
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