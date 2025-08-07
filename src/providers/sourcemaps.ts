import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JavascriptFile, Endpoint } from '../types';
import { StateService } from '../services';

export class SourcemapsProvider implements vscode.TreeDataProvider<SourcemapTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SourcemapTreeItem | undefined | null | void> = new vscode.EventEmitter<SourcemapTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SourcemapTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private treeView: vscode.TreeView<SourcemapTreeItem> | null = null;
    private stateService: StateService;

    constructor(stateService: StateService) {
        this.stateService = stateService;
        this.stateService.onSourcesChanged(() => this.refresh());
    }
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }


    setTreeView(treeView: vscode.TreeView<SourcemapTreeItem>): void {
        this.treeView = treeView;
    }


    getTreeItem(element: SourcemapTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SourcemapTreeItem): Thenable<SourcemapTreeItem[]> {
        if (!element) {
            const currentFile = this.stateService.getSelectedFile();
            const sourcemaps = this.stateService.getSourcemaps();
            if (!currentFile) {
                return Promise.resolve([
                    new SourcemapTreeItem(
                        'No file selected',
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                ]);
            }

            if (sourcemaps.length === 0) {
                return Promise.resolve([
                    new SourcemapTreeItem(
                        'No source maps found',
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                ]);
            }

            // Mostrar archivos y directorios de sourcemap
            return Promise.resolve(sourcemaps.map(fileName => {
                // Determinar si es archivo o directorio
                const sourceDir = this.stateService.getSourceDir() || ''
                const fullPath = path.join(sourceDir, fileName);
                const isDirectory = fs.statSync(fullPath).isDirectory();

                let command;
                if (!isDirectory) {
                    command = {
                        command: 'jshunter.openSourcemapFile',
                        title: 'Open Sourcemap File',
                        arguments: [fileName, currentFile]
                    };
                }

                const item = new SourcemapTreeItem(
                    fileName,
                    isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    isDirectory ? 'directory' : 'sourcemap',
                    fileName,
                    command
                );

                // Configurar icono según el tipo
                if (isDirectory) {
                    item.iconPath = new vscode.ThemeIcon('folder');
                } else if (fileName.endsWith('.js')) {
                    item.resourceUri = vscode.Uri.file(`virtual/path/${fileName}`);
                } else if (fileName.endsWith('.map')) {
                    item.iconPath = new vscode.ThemeIcon('file-binary');
                } else {
                    item.resourceUri = vscode.Uri.file(`virtual/path/${fileName}`);
                }

                return item;
            }));
        }

        // Expandir directorio
        if (element.type === 'directory' && element.fileName) {
            const currentFile = this.stateService.getSelectedFile();
            const sourceDir = this.stateService.getSourceDir() || ''
            const directoryPath = path.join(sourceDir, element.fileName);

            try {
                const files = fs.readdirSync(directoryPath);

                return Promise.resolve(files.map(fileName => {
                    const fullPath = path.join(directoryPath, fileName);
                    const isDirectory = fs.statSync(fullPath).isDirectory();

                    let command;
                    if (!isDirectory) {
                        command = {
                            command: 'jshunter.openSourcemapFile',
                            title: 'Open Sourcemap File',
                            arguments: [path.join(element.fileName!, fileName), currentFile]
                        };
                    }

                    const item = new SourcemapTreeItem(
                        fileName,
                        isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        isDirectory ? 'directory' : 'sourcemap',
                        path.join(element.fileName!, fileName),
                        command
                    );

                    // Configurar icono según el tipo
                    if (isDirectory) {
                        item.iconPath = new vscode.ThemeIcon('folder');
                    } else if (fileName.endsWith('.js')) {
                        item.resourceUri = vscode.Uri.file(`virtual/path/${fileName}`);
                    } else if (fileName.endsWith('.map')) {
                        item.iconPath = new vscode.ThemeIcon('file-binary');
                    } else {
                        item.resourceUri = vscode.Uri.file(`virtual/path/${fileName}`);
                    }

                    return item;
                }));
            } catch (error) {
                console.error(`Error reading directory ${directoryPath}:`, error);
                return Promise.resolve([
                    new SourcemapTreeItem(
                        'Error reading directory',
                        vscode.TreeItemCollapsibleState.None,
                        'message'
                    )
                ]);
            }
        }

        return Promise.resolve([]);
    }
}

export class SourcemapTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'message' | 'sourcemap' | 'directory',
        public readonly fileName?: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);

        this.contextValue = type;

        if (type === 'message') {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}


export class SourcemapCommands {
    private stateService: StateService;

    constructor(stateService: StateService) {
        this.stateService = stateService;
    }

    async openSourcemapFile(fileName: string, file: JavascriptFile): Promise<void> {
        try {
            const config = this.stateService.getConfig();
            if (!config || !config.storage_dir) {
                vscode.window.showErrorMessage('Failed to get config');
                return;
            }

            const storageDir = config.storage_dir;

            const url = new URL(file.url);
            const domain = url.hostname;

            const sourcemapDir = path.join(storageDir, 'files', domain, file.hash, "original");
            const filePath = path.join(sourcemapDir, fileName);

            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`File not found: ${filePath}`);
                return;
            }

            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening sourcemap file: ${error}`);
        }
    }
    registerCommands(context: vscode.ExtensionContext): void {
        const openSourcemapCommand = vscode.commands.registerCommand(
            'jshunter.openSourcemapFile',
            this.openSourcemapFile.bind(this)
        );
        context.subscriptions.push(openSourcemapCommand);
    }
} 