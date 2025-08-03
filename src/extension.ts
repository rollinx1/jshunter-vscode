// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { StateService } from './services';
import { EndpointsProvider, ContentProvider, EndpointsCommands, FindingsProvider, FindingsCommands, ContentCommands, SourcemapsProvider, SourcemapCommands } from './providers';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const stateService = StateService.getInstance();
	const endpointsProvider = new EndpointsProvider(stateService);
	const contentProvider = new ContentProvider(stateService);
	const findingsProvider = new FindingsProvider(stateService, context);
	const sourcemapProvider = new SourcemapsProvider(stateService);

	//stateService.startBackendHealthMonitoring();
	stateService.startEndpointsMonitoring();

	const endpointsCommands = new EndpointsCommands(endpointsProvider, stateService);
	const findingCommands = new FindingsCommands(findingsProvider, stateService);
	const contentCommands = new ContentCommands(stateService);
	const sourceCommands = new SourcemapCommands(stateService);

	endpointsCommands.registerCommands(context);
	findingCommands.registerCommands(context);
	contentCommands.registerCommands(context);
	sourceCommands.registerCommands(context);

	const endpointsView = vscode.window.createTreeView('jshunter.endpointsView', {
		treeDataProvider: endpointsProvider,
		showCollapseAll: true
	});
	const contentView = vscode.window.createTreeView('jshunter.contentView', {
		treeDataProvider: contentProvider,
		showCollapseAll: true
	});
	const findingsView = vscode.window.createTreeView('jshunter.findingsView', {
		treeDataProvider: findingsProvider,
		showCollapseAll: true
	});
	const sourceView = vscode.window.createTreeView('jshunter.sourceView', {
		treeDataProvider: sourcemapProvider,
		showCollapseAll: true
	});

	context.subscriptions.push(endpointsView, contentView, findingsView, sourceView);

}

// This method is called when your extension is deactivated
export function deactivate() { }
