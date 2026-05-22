# Project Overview

Paper Writer manages each paper as a filesystem-backed project under `papers/`.

Each project contains the source paper files plus metadata in `project.json`. Projects may use LaTeX templates and structured paper assets, but the workspace is not limited to final manuscript files. Every project now also has a root-level `docs/` folder intended for supporting material such as research ideas, outlines, meeting notes, scratch drafts, and other free-form planning documents.

The preview layer resolves Markdown image links and LaTeX `\includegraphics{...}` references through the project blob API, so user-created folders such as `fig/`, `figures/`, `images/`, or `img/` can display inside the editor preview instead of resolving relative to the browser page URL. These image folders are supported when present, but `fig/` is no longer created automatically.

The backend exposes file-tree and file-editing APIs over the project root, so files placed under `docs/` and other user-created folders are handled by the same browse, create, upload, copy, move, rename, and delete flows as other project files. Text-like files in `docs/` can be edited directly; images in `fig/` can be selected for preview. In the editor file tree, users can right-click blank/root space or a folder to create new files/folders, and can right-click files or folders for copy paths, copy, cut, paste, and delete actions, or drag files and folders into another folder or the explicit project-root drop target to move them.


The AI assistant is organized around three conversation modes: Chat for read-only discussion, Agent for reviewable paper-edit proposals, and Tools for multi-step tool execution. Code-related AI operations are no longer exposed as a separate conversation scope; when needed, they are handled as controlled `code/` directory tools inside Tools mode.
