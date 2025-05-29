# Pasted File Rename for Obsidian

![Obsidian Version](https://img.shields.io/badge/Obsidian-1.0%2B-blue.svg) ![Release Date](https://img.shields.io/badge/Released-YYYY--MM--DD-green.svg) ![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)

**Automatically renames files dropped or pasted into your notes based on the active note's name, ensuring organized and contextually relevant attachment filenames.**

---

## Overview

The **Pasted File Rename** plugin for Obsidian is designed to streamline the process of adding local files (images, PDFs, etc.) to your notes. When you drag and drop a file into the editor, instead of using a generic name like "Pasted image 20231027100000.png" or the file's original arbitrary name, this plugin renames it to match the current note's name, appending a sequential number for uniqueness (e.g., `MyNote-1.png`, `MyNote-2.jpg`). This ensures your attachments are clearly associated with their context and easy to manage in your vault.

**Key Motivations:**

-   **Organized Attachments**: Keep your vault's attachment folder tidy and files easily identifiable.
-   **Contextual Naming**: Automatically name attachments based on the note they are added to, improving clarity.
-   **Simplified Workflow**: No need to manually rename pasted files after they are added.
-   **Respects Obsidian Settings**: Uses your configured attachment folder.

This plugin provides a focused tool for automating the renaming of pasted/dropped local files, making it particularly useful for users who frequently embed local media into their notes.

---

## Key Features

-   **Automatic Renaming on Drop**:
    -   Renames files dropped into an editor when an active note is open.
-   **Contextual Filename Generation**:
    -   New filenames are based on the active note's basename (e.g., if the note is `Meeting Notes.md`, files will be named `Meeting Notes-1.ext`, `Meeting Notes-2.ext`, etc.).
-   **Sequential Numbering**:
    -   Automatically appends a numeric suffix (`-1`, `-2`, etc.) to the filename.
    -   The suffix increments for each subsequently dropped file within the same operation or if a file with the same base name and suffix already exists.
-   **Attachment Folder Integration**:
    -   Respects Obsidian's attachment folder settings, placing renamed files in the location you've configured (e.g., vault root, specific subfolder, subfolder under current note's folder).
-   **Extension Filtering**:
    -   Only processes files with extensions specified in the plugin settings.
    -   Defaults to a wide range of common image, video, audio, and PDF types.
-   **Uniqueness Check**:
    -   Before saving, checks if a filename stem (e.g., `MyNote-1`) is already used by any file in the target attachment folder, regardless of extension, to ensure the numeric suffix is unique for that stem.
    -   Also verifies that the final proposed full path (e.g., `attachments/MyNote-1.png`) does not already exist.
-   **Markdown Link Insertion**:
    -   Automatically inserts a correctly formatted Markdown link for the newly renamed and saved file at the cursor position or replacing the selection.
-   **Local Files Only**:
    -   Designed to work with files dragged from your local file system. It does not process URLs or other non-file data dropped into the editor.
-   **User Settings UI**:
    -   Configure the list of allowed file extensions via the Obsidian settings panel.
-   **Notifications**:
    -   Provides on-screen notices for successful renaming/pasting or errors.

---

## How to Use

1.  **Ensure an active note is open**: This plugin requires an active `.md` file to determine the base name for renaming.
2.  **Drag and drop a file** (e.g., an image, PDF) from your computer directly into the Obsidian editor pane of the active note.
3.  If the file's extension is in the "Allowed extensions" list, the plugin will:
    -   Determine the correct attachment folder based on your Obsidian settings.
    -   Generate a new unique filename in the format `ActiveNoteName-N.extension`.
    -   Save the file to the attachment folder with the new name.
    -   Insert a Markdown link to the new file into your note.
4.  Notifications will indicate the outcome. For example, "Renamed and pasted: MyNote-1.png".

---

## Configuration Settings

Access these settings via **Obsidian Settings → Pasted File Rename**:

-   **Allowed extensions**:
    -   A comma-separated list of file extensions (without dots) that the plugin should process.
    -   Example: `jpg,png,mp4,pdf`
    -   These are case-insensitive.
    -   _Default_: `jpg,jpeg,png,gif,heic,webp,bmp,tiff,svg,mp4,webm,ogv,mov,mkv,mp3,wav,ogg,m4a,pdf`

---

## Technical Details & Architecture

-   **Language**: Developed with **TypeScript**.
-   **Obsidian API**:
    -   Utilizes core Obsidian API components such as `Plugin`, `Editor`, `MarkdownView`, `TFile`, `TFolder`, `Notice`, `normalizePath`, `Vault.createBinary()`, `FileManager.getAvailablePathForAttachment()`, `FileManager.generateMarkdownLink()`.
    -   Registers an event listener for `editor-drop` on the workspace.
-   **File Handling**:
    -   Uses Node.js `path` module for robust handling of file extensions and paths.
    -   Reads dropped files as `ArrayBuffer` to save them into the vault.
-   **Settings Management**:
    -   Loads and saves settings using `loadData()` and `saveData()`.
    -   Provides a `PluginSettingTab` for user configuration.
-   **Event Driven**: The core logic is triggered by the `editor-drop` event.

---

## Future Enhancements

Potential areas for future development could include:

-   **Customizable Naming Template**: Allow users to define their own filename patterns beyond `ActiveNoteName-N.extension`.
-   **Option to Disable Link Insertion**: Provide a setting to only rename and save the file without inserting a link.
-   **Context Menu Integration**: Allow renaming of existing attachments via a right-click context menu.
-   **Batch Processing**: A command to process files in a specific folder or across the vault (though this deviates from the current "pasted file" focus).

---

## License

This plugin is released under the **GNU General Public License v3.0**. Refer to the [LICENSE](LICENSE.md) file for details.

---
