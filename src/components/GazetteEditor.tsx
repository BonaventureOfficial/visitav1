import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontFamily } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Undo2, Redo2, ImagePlus, Table2, List, ListOrdered, Quote, Plus, Minus, Trash2, Loader2, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GAZETTE_FONTS, INK_COLORS, PAPER_THEMES, cleanGazette, type GazetteNode, type PaperTheme } from "@/lib/gazette";
import { uploadPostImage, PHOTO_TYPES } from "@/lib/posts";
import { GazetteContent } from "@/components/GazetteContent";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const StoredImage = Image.extend({ addAttributes() { return { ...this.parent?.(), storagePath: { default: null } }; } });
const Limit = Extension.create({ name: "gazetteLimit", addProseMirrorPlugins() { return []; } });
export function GazetteEditor({ userId, disabled, theme, onTheme, onChange }: { userId: string; disabled: boolean; theme: PaperTheme; onTheme: (theme: PaperTheme) => void; onChange: (text: string, doc: GazetteNode | null) => void }) {
  const { lang } = useI18n(); const fr = lang === "fr";
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [tableOpen, setTableOpen] = useState(false);
  const [rows, setRows] = useState(3); const [columns, setColumns] = useState(3);
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }), TextStyle, Color, FontFamily, TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: false } }), StoredImage, Limit],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    editable: !disabled,
    editorProps: { attributes: { "aria-label": fr ? "Corps de la gazette" : "Gazette body", role: "textbox", "aria-multiline": "true", class: "gazette-prose min-h-80 outline-none" } },
    onUpdate: ({ editor: e }) => onChange(e.getText(), cleanGazette(e.getJSON())),
  });
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({ bold: e?.isActive("bold"), italic: e?.isActive("italic"), underline: e?.isActive("underline"), table: e?.isActive("table"), font: e?.getAttributes("textStyle").fontFamily ?? "Georgia", count: e?.getText().length ?? 0 }) });
  const tool = (label: string, icon: React.ReactNode, command: () => void, active = false) => <Button type="button" key={label} title={label} aria-label={label} aria-pressed={active} variant={active ? "secondary" : "ghost"} size="icon" disabled={disabled || !editor || uploading} onMouseDown={e => e.preventDefault()} onClick={command}>{icon}</Button>;
  return <div className="space-y-3">
    <div className="gazette-toolbar flex flex-wrap items-center gap-1 border-y border-border py-2" role="toolbar" aria-label={fr ? "Mise en forme" : "Formatting"}>
      <select aria-label={fr ? "Police" : "Font"} className="h-9 max-w-36 rounded-md border border-border bg-input px-2 text-sm" disabled={disabled || !editor} value={state?.font} onChange={e => editor?.chain().focus().setFontFamily(e.target.value).run()}>{GAZETTE_FONTS.map(font => <option key={font}>{font}</option>)}</select>
      <select aria-label={fr ? "Style de texte" : "Text style"} defaultValue="paragraph" className="h-9 max-w-32 rounded-md border border-border bg-input px-2 text-sm" disabled={disabled || !editor} onChange={e => { if (e.target.value === "paragraph") editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().toggleHeading({ level: Number(e.target.value) as 1 | 2 | 3 }).run(); }}><option value="paragraph">{fr ? "Paragraphe" : "Paragraph"}</option><option value="1">{fr ? "Grand titre" : "Headline"}</option><option value="2">{fr ? "Titre" : "Title"}</option><option value="3">{fr ? "Sous-titre" : "Subtitle"}</option></select>
      {tool(fr ? "Gras" : "Bold", <Bold />, () => { editor?.chain().focus().toggleBold().run(); }, state?.bold)}
      {tool(fr ? "Italique" : "Italic", <Italic />, () => { editor?.chain().focus().toggleItalic().run(); }, state?.italic)}
      {tool(fr ? "Souligner" : "Underline", <Underline />, () => { editor?.chain().focus().toggleUnderline().run(); }, state?.underline)}
      {tool(fr ? "Aligner à gauche" : "Align left", <AlignLeft />, () => { editor?.chain().focus().setTextAlign("left").run(); })}
      {tool(fr ? "Centrer" : "Center", <AlignCenter />, () => { editor?.chain().focus().setTextAlign("center").run(); })}
      {tool(fr ? "Aligner à droite" : "Align right", <AlignRight />, () => { editor?.chain().focus().setTextAlign("right").run(); })}
      {tool(fr ? "Liste" : "Bullet list", <List />, () => { editor?.chain().focus().toggleBulletList().run(); })}
      {tool(fr ? "Liste numérotée" : "Numbered list", <ListOrdered />, () => { editor?.chain().focus().toggleOrderedList().run(); })}
      {tool(fr ? "Citation" : "Quote", <Quote />, () => { editor?.chain().focus().toggleBlockquote().run(); })}
      {tool(fr ? "Insérer un tableau" : "Insert table", <Table2 />, () => setTableOpen(!tableOpen), state?.table)}
      {tool(fr ? "Insérer une photo" : "Insert photo", uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />, () => fileInput.current?.click())}
      {tool(fr ? "Annuler" : "Undo", <Undo2 />, () => { editor?.chain().focus().undo().run(); })}
      {tool(fr ? "Rétablir" : "Redo", <Redo2 />, () => { editor?.chain().focus().redo().run(); })}
      {tool(fr ? "Aperçu" : "Preview", preview ? <Pencil /> : <Eye />, () => setPreview(!preview), preview)}
    </div>
    {tableOpen && <div className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
      <label className="text-xs">{fr ? "Lignes" : "Rows"}<input aria-label={fr ? "Lignes" : "Rows"} type="number" min={1} max={10} value={rows} onChange={e => setRows(Math.min(10, Math.max(1, Number(e.target.value))))} className="ml-2 w-14 rounded border border-border bg-input p-2" /></label>
      <label className="text-xs">{fr ? "Colonnes" : "Columns"}<input aria-label={fr ? "Colonnes" : "Columns"} type="number" min={1} max={6} value={columns} onChange={e => setColumns(Math.min(6, Math.max(1, Number(e.target.value))))} className="ml-2 w-14 rounded border border-border bg-input p-2" /></label>
      <Button type="button" size="sm" disabled={disabled} onClick={() => { editor?.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: true }).run(); setTableOpen(false); }}><Plus />{fr ? "Insérer" : "Insert"}</Button>
    </div>}
    {state?.table && <div className="flex flex-wrap gap-1">
      {tool(fr ? "Ajouter une ligne" : "Add row", <Plus />, () => { editor?.chain().focus().addRowAfter().run(); })}
      {tool(fr ? "Ajouter une colonne" : "Add column", <Table2 />, () => { editor?.chain().focus().addColumnAfter().run(); })}
      {tool(fr ? "Retirer une ligne" : "Remove row", <Minus />, () => { editor?.chain().focus().deleteRow().run(); })}
      {tool(fr ? "Supprimer le tableau" : "Delete table", <Trash2 />, () => { editor?.chain().focus().deleteTable().run(); })}
    </div>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{fr ? "Fond" : "Paper"}</span>{PAPER_THEMES.map((paper, i) => <Button key={paper} type="button" size="icon" variant="ghost" disabled={disabled} className="h-7 w-7 p-0" aria-label={`${fr ? "Fond" : "Paper"} ${["blanc", "nuit", "menthe", "rose"][i]}`} title={paper} aria-pressed={theme === paper} onClick={() => onTheme(paper)}><span data-paper={paper} className={`gazette-swatch h-5 w-5 rounded-full border-2 ${theme === paper ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} /></Button>)}</div>
      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{fr ? "Encre" : "Ink"}</span>{INK_COLORS.map((color, i) => <Button key={color} type="button" size="icon" variant="ghost" disabled={disabled || !editor} className="h-7 w-7 p-0" aria-label={`${fr ? "Encre" : "Ink"} ${["noire", "rouge", "verte", "bleue", "or"][i]}`} title={color} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().setColor(color).run()}><span className={`gazette-ink-swatch ink-${i} h-5 w-5 rounded-full`} /></Button>)}</div>
    </div>
    <div className="gazette-panel" data-paper={theme}><div className="gazette-masthead mb-4 border-b-2 border-current pb-3">VISITA <span className="font-normal italic">Gazette</span></div>{preview ? <GazetteContent document={editor?.getJSON()} images={images} /> : <EditorContent editor={editor} />}</div>
    <div className="text-right text-xs text-muted-foreground" aria-live="polite">{state?.count ?? 0} / 5 000</div>
    <input ref={fileInput} type="file" className="sr-only" aria-label={fr ? "Photo dans la gazette" : "Gazette photo"} accept={PHOTO_TYPES.join(",")} disabled={disabled || uploading} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ""; if (!file || !editor) return;
      setUploading(true);
      try { const image = await uploadPostImage(userId, file); setImages(old => ({ ...old, [image.path]: image.url })); editor.chain().focus().insertContent({ type: "image", attrs: { src: image.url, storagePath: image.path, alt: file.name } }).run(); }
      catch (error) { toast.error(error instanceof Error ? error.message : (fr ? "Photo impossible" : "Could not insert photo")); }
      finally { setUploading(false); }
    }} />
  </div>;
}