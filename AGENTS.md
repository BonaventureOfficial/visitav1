# Architecture rules
- Appearance is managed by a shared provider using semantic CSS tokens and origin-local persistence, so every page and notification switches consistently.
- Text and photo publications use a separate owner-protected posts collection with composite keyset pagination and batched metadata/photo URLs; video ranking and playback remain independent.
- Publication photos are stored in an owner-scoped private bucket, and deleting a post requires explicit typed confirmation in the UI.