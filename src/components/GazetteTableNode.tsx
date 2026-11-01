import { Table } from "@tiptap/extension-table";
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Move, Maximize2, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GazetteTableFrame } from "@/components/GazetteTableFrame";
import { useGazetteGestures } from "@/hooks/use-gazette-gestures";
import { useI18n } from "@/lib/i18n";

function TableNode({ node, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const { lang } = useI18n();
  const fr = lang === "fr";
  const { surface, dragY, handlers } = useGazetteGestures({ node, editor, getPos, updateAttributes });
  return <NodeViewWrapper className="gazette-table-node">
    <div>
      {editor.isEditable && <div className="gazette-table-controls" contentEditable={false} role="toolbar" aria-label={fr ? "Modifier le tableau" : "Edit table"}>
        {([["move", Move, fr ? "Déplacer le tableau" : "Move table"], ["resize", Maximize2, fr ? "Redimensionner le tableau" : "Resize table"], ["rotate", RotateCw, fr ? "Tourner le tableau" : "Rotate table"]] as const).map(([mode, Icon, label]) => <Button key={mode} type="button" variant="secondary" size="icon" title={label} aria-label={label} className="gazette-image-touch" {...handlers(mode)}><Icon /></Button>)}
        <Button type="button" variant="secondary" size="icon" title={fr ? "Supprimer le tableau" : "Delete table"} aria-label={fr ? "Supprimer ce tableau" : "Delete this table"} onClick={deleteNode}><Trash2 /></Button>
      </div>}
      <div ref={surface} className={editor.isEditable ? "gazette-table-touch" : undefined} style={{ transform: `translateY(${dragY}px)`, position: "relative", zIndex: dragY ? 1 : undefined }} {...handlers("move", true)}><GazetteTableFrame attrs={node.attrs}><NodeViewContent<"table"> as="table" /></GazetteTableFrame></div>
    </div>
  </NodeViewWrapper>;
}

export const GazetteTable = Table.extend({
  addAttributes() { return { ...this.parent?.(), width: { default: 100 }, offset: { default: 0 }, rotation: { default: 0 } }; },
  addNodeView() { return ReactNodeViewRenderer(TableNode, { contentDOMElementTag: "tbody" }); },
}).configure({ resizable: false });