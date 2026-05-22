# Function List

## Project Workspace

- Project creation and import create a root-level `docs/` folder for free-form notes, ideas, outlines, and draft documents.
- Existing projects receive `docs/` automatically the next time their file tree is opened. `fig/` is no longer created automatically; image folders only appear when imported or created by the user.
- The project file tree supports arbitrary files under `docs/`; users can create, upload, edit, rename, and delete those files through the existing project file APIs.
- The project file tree context menu can create new files and folders from blank/root space or inside an existing folder; file context menus do not show create actions. New files are created empty, opened immediately, and existing paths are not overwritten.
- The editor file tree supports VS Code-style context actions for files and folders: copy path, copy, cut, paste, and delete.
- Files and folders can be dragged from the editor file tree into another folder, or onto the explicit project-root drop target, to move them inside the same project.
- Markdown preview resolves project image references such as `![caption](fig/chart.png)` through the project blob API.
- LaTeX preview renders `\includegraphics{fig/chart}` and figure captions using project images, with extensionless image paths resolved by the backend.
- The editor file tree shows the complete project directory tree, including root files and folders such as `appendix/`, `tab/`, `img/`, `.sty`, `.bib`, `.tex`, and `.pdf` files.

## Project Management

- Projects can be listed, renamed, copied, archived, moved to trash, restored, and permanently deleted.
- Project listings include both the display name from `project.json.name` and the backing directory name.
- Project deletion is tolerant of missing or invalid `project.json` metadata and supports projects whose directory name differs from their project ID.

## AI Assistant

- New AI conversations support three modes only: Chat, Agent, and Tools.
- Chat mode is read-only discussion and does not receive file-writing or code-execution tools.
- Agent mode can inspect paper context and propose edits for user confirmation, but it does not directly write files or run code.
- Tools mode is the only AI conversation mode that can perform multi-step tool work, including controlled operations under the project `code/` directory.
- The previous standalone Code conversation scope has been removed from the new-conversation UI; code work is handled through Tools mode instead.
