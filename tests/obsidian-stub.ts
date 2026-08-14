export class App {}
export class Editor {}
export class MarkdownView {}
export class Modal { contentEl: any; constructor(..._args: any[]) { this.contentEl = {}; } open() {} close() {} }
export class Notice { constructor(..._args: any[]) {} }
export class Plugin { app: any; addCommand() {} addRibbonIcon() {} addSettingTab() {} registerEditorExtension() {} registerMarkdownPostProcessor() {} loadData() {} saveData() {} }
export class PluginSettingTab { containerEl: any; constructor(..._args: any[]) { this.containerEl = {}; } }
export class Setting { constructor(..._args: any[]) {} addButton() { return this; } addDropdown() { return this; } addExtraButton() { return this; } addSlider() { return this; } addText() { return this; } setDesc() { return this; } setHeading() { return this; } setName() { return this; } }
export class TFile { constructor(public path = '') {} }
export function parseLinktext(linktext: string) {
	const hash = linktext.indexOf('#');
	return hash < 0 ? { path: linktext, subpath: '' } : { path: linktext.slice(0, hash), subpath: linktext.slice(hash) };
}
export function resolveSubpath(cache: any, subpath: string) { return cache.subpaths?.[subpath] ?? null; }
export const editorLivePreviewField = {};
export const Prec = { highest: (value: any) => value };
export const StateEffect = { define: () => ({ of: (value: any) => value, is: () => false }) };
export const StateField = { define: (value: any) => value };
export class WidgetType {}
export const Decoration: any = { none: {}, replace: () => ({ range: () => ({}) }), set: () => ({}) };
export const ViewPlugin = { fromClass: () => ({}) };
export class EditorView {}
export class ViewUpdate {}
