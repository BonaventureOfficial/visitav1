# Architecture rules
- Appearance is managed by a shared provider using semantic CSS tokens and origin-local persistence, so every page and notification switches consistently.
- Gazettes use bounded allowlisted rich JSON, a Tiptap editor, and a safe React renderer with batched private-storage image URLs; legacy plain posts remain readable.
- Gazette titles live in rich-document attributes and image geometry is bounded and rendered with a shared rotation-aware frame, so GitHub-only updates need no schema change and adjacent text stays unobscured.
- Gazette tables use an editable tbody node view with separate gesture handles and shared measured rotation-aware rendering; geometry stays in sanitized rich JSON so published layouts match the editor without schema changes.
- Text and photo publications use a separate owner-protected posts collection with composite keyset pagination and batched metadata/photo URLs; video ranking and playback remain independent.
- Publication photos are stored in an owner-scoped private bucket, and deleting a post requires explicit typed confirmation in the UI.