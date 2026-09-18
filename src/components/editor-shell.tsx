"use client";
import { useState } from "react";
import { DocEditor, type EditorState } from "@/components/doc-editor";

export function DocEditorClient({ initial, parties, taxRates, accounts, company, canPost }: {
  initial: EditorState; parties: any[]; taxRates: any[]; accounts: any[]; company: any; canPost: boolean;
}) {
  const [state, setState] = useState<EditorState>(initial);
  return <DocEditor state={state} setState={setState} parties={parties} taxRates={taxRates} accounts={accounts} company={company} canPost={canPost} />;
}
