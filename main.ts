import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	Notice,
	normalizePath,
	FrontMatterCache,
} from "obsidian";
import * as path from "path"; // Using Node.js path module for robust extension handling

// Settings interface
interface PastedFileRenameSettings {
	allowedExtensions: string;
}

// Default settings: Common image, video, audio, and PDF types
const DEFAULT_SETTINGS: PastedFileRenameSettings = {
	allowedExtensions:
		"jpg,jpeg,png,gif,heic,webp,bmp,tiff,svg,mp4,webm,ogv,mov,mkv,mp3,wav,ogg,m4a,pdf",
};

export default class PastedFileRenamePlugin extends Plugin {
	settings: PastedFileRenameSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new PastedFileRenameSettingTab(this.app, this));

		// Register the editor-drop event
		this.registerEvent(
			this.app.workspace.on("editor-drop", this.handleEditorDrop)
		);

		console.log("Pasted File Rename plugin loaded.");
	}

	onunload() {
		console.log("Pasted File Rename plugin unloaded.");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Helper to get the Set of allowed extensions from settings string
	private getAllowedExtensionsSet(): Set<string> {
		return new Set(
			this.settings.allowedExtensions
				.toLowerCase()
				.split(",")
				.map((ext) => ext.trim())
				.filter((ext) => ext.length > 0)
		);
	}

	// Helper to determine the target attachment folder path, respecting Obsidian's settings
	private async getAttachmentFolderPath(
		currentOpenFile: TFile
	): Promise<string> {
		// This uses Obsidian's internal logic to determine the correct attachment path/folder.
		// It creates the folder if it doesn't exist.
		const dummyFileNameForPathResolution = `dummy-file-for-path-finding-${Date.now()}.tmp`;
		const fullDummyPath =
			await this.app.fileManager.getAvailablePathForAttachment(
				dummyFileNameForPathResolution,
				currentOpenFile.path
			);

		let folderPath = path.dirname(fullDummyPath);

		// path.dirname might return '.' for root if the path was just 'filename.ext'
		if (folderPath === ".") {
			folderPath = ""; // Use empty string to represent vault root, which normalizePath handles
		}
		return normalizePath(folderPath);
	}

	// Helper to check if a stem (filename without extension) is already used by any file in a specific folder
	private async isStemUsedInFolder(
		stem: string,
		folderPath: string
	): Promise<boolean> {
		const normalizedFolderPath = normalizePath(folderPath);
		const targetFolder =
			this.app.vault.getAbstractFileByPath(normalizedFolderPath);

		if (targetFolder instanceof TFolder) {
			// Check children of the specified folder
			for (const child of targetFolder.children) {
				if (child instanceof TFile && child.basename === stem) {
					return true; // Stem is used
				}
			}
		} else if (
			normalizedFolderPath === "" ||
			normalizedFolderPath === "/"
		) {
			// This case handles the vault root if targetFolder is not a TFolder (e.g. if path is empty for root)
			// Or if getAbstractFileByPath returns null for the root path string.
			const root = this.app.vault.getRoot();
			for (const child of root.children) {
				// Ensure we only check files directly in the root
				if (
					child instanceof TFile &&
					child.basename === stem &&
					child.parent?.isRoot()
				) {
					return true;
				}
			}
		}
		return false; // Stem is not used, or folder is not a valid TFolder (should be handled by getAttachmentFolderPath)
	}

	private handleEditorDrop = async (
		event: DragEvent,
		editor: Editor,
		view: MarkdownView
	) => {
		if (!event.dataTransfer) return;

		const activeFile = view.file; // TFile representing the currently active file in the editor

		// 1. & 2. 활성화된 파일이 없으면 아무 일도 수행하지 않음 & 로컬 파일에 대해서만 수행
		if (!activeFile) {
			// This plugin is designed to work when there's an active file.
			// If a user drops a file into an empty editor tab (no file backing it),
			// activeFile will be null. In this case, we do nothing and let Obsidian handle it.
			return;
		}

		const droppedItems = Array.from(event.dataTransfer.items);
		const droppedFiles: File[] = [];

		for (const item of droppedItems) {
			// 4. 반드시 로컬 파일에 대해서만 수행 (item.kind === 'file')
			//    http로 시작하는 링크 등은 item.kind === 'string' and item.type === 'text/uri-list' or 'text/html'
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) {
					droppedFiles.push(file);
				}
			}
		}

		if (droppedFiles.length === 0) {
			// No actual files were dropped (e.g., it was a URL or text snippet)
			return;
		}

		const allowedExtensions = this.getAllowedExtensionsSet();
		const processableFiles = droppedFiles.filter((file) => {
			const fileExtensionWithDot = path.extname(file.name); // e.g., ".png"
			if (!fileExtensionWithDot) return false; // No extension
			const fileExtension = fileExtensionWithDot
				.substring(1)
				.toLowerCase(); // e.g., "png"
			return allowedExtensions.has(fileExtension);
		});

		if (processableFiles.length === 0) {
			// No files matched the allowed extensions
			return;
		}

		// If we have processable files, prevent Obsidian's default drop handling.
		event.preventDefault();
		event.stopPropagation();

		// 1. 붙여넣는 파일의 위치는 반드시 "Obsidian 기본 설정값을 존중"
		const attachmentTargetFolder = await this.getAttachmentFolderPath(
			activeFile
		);
		const activeFileBasename = activeFile.basename; // Active file's name without extension

		const createdMarkdownLinks: string[] = [];
		let currentNamingSuffix = 1; // This will be the number like in "activeFile-1", "activeFile-2"

		for (const droppedFile of processableFiles) {
			const originalFileExtensionWithDot = path.extname(droppedFile.name); // e.g., ".png"

			let newUniqueFileBaseName: string; // e.g., "activeFile-1"
			let newFullFileNameInVault: string; // e.g., "activeFile-1.png"
			let targetPathInVault: string; // Full vault path, e.g., "attachments/activeFile-1.png"

			// 3. 확장자를 제외하고 이름 중복 여부 확인하여 저장 (및 순차적 넘버링)
			// Loop to find a unique numeric suffix for the base name
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const candidateStem = `${activeFileBasename}-${currentNamingSuffix}`;

				// Check if this stem (e.g., "activeFile-1") is used by any file in the target folder
				if (
					!(await this.isStemUsedInFolder(
						candidateStem,
						attachmentTargetFolder
					))
				) {
					// Stem is unique. Now form the full path and double-check it doesn't exist
					// (unlikely if stem is unique, but good for robustness).
					const candidateFileName =
						candidateStem + originalFileExtensionWithDot;
					const candidateFullPath = normalizePath(
						path.join(attachmentTargetFolder, candidateFileName)
					);

					if (
						!this.app.vault.getAbstractFileByPath(candidateFullPath)
					) {
						newUniqueFileBaseName = candidateStem;
						newFullFileNameInVault = candidateFileName;
						targetPathInVault = candidateFullPath;
						break; // Found a unique name and path
					}
				}
				currentNamingSuffix++; // Increment suffix and try again
			}

			try {
				const fileData = await droppedFile.arrayBuffer();
				const createdTFile = await this.app.vault.createBinary(
					targetPathInVault,
					fileData
				);

				// Generate a Markdown link to the newly created file
				const markdownLink = this.app.fileManager.generateMarkdownLink(
					createdTFile,
					activeFile.path
				);
				createdMarkdownLinks.push(markdownLink);
				new Notice(
					`Renamed and pasted: ${newFullFileNameInVault}`,
					4000
				);
			} catch (error) {
				console.error(
					`Pasted File Rename: Error processing file ${droppedFile.name}:`,
					error
				);
				new Notice(
					`Error renaming/pasting ${droppedFile.name}. Check console.`,
					5000
				);
			}
			// Increment the suffix for the *next* file in this batch, as per requirement:
			// "image-png는 activeFile-k.png ... 다음에 저장되는 파일인 image.jpg는 activeFile-{k+1}.jpg가 되는 것이다."
			currentNamingSuffix++;
		}

		if (createdMarkdownLinks.length > 0) {
			editor.replaceSelection(createdMarkdownLinks.join("\n"));
		}
	};
}

class PastedFileRenameSettingTab extends PluginSettingTab {
	plugin: PastedFileRenamePlugin;

	constructor(app: App, plugin: PastedFileRenamePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Pasted File Rename Settings" });

		new Setting(containerEl)
			.setName("Allowed extensions")
			.setDesc(
				"Comma-separated list of extensions (without dots) to process. Example: jpg,png,mp4,pdf. These are case-insensitive."
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.allowedExtensions)
					.setValue(this.plugin.settings.allowedExtensions)
					.onChange(async (value) => {
						this.plugin.settings.allowedExtensions = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("p", {
			text: "Default: jpg,jpeg,png,gif,heic,webp,bmp,tiff,svg,mp4,webm,ogv,mov,mkv,mp3,wav,ogg,m4a,pdf",
		});
	}
}
