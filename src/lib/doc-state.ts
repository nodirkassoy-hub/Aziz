/** Shared doc-editor state model. Lives outside the client bundle so server
 *  code (editor-data) can construct initial states without crossing the
 *  RSC "use client" boundary. */
import { today, addDays } from "./dates";

export type EditorItem = { id?: number; description: string; qty: number; unit_price: number; discount_pct: number; tax_pct: number; tax_rate_id?: number | null; account_id?: number | null };
export type EditorState = {
  kind: string; docId?: number; status?: string;
  number?: string;
  party_id: number | ""; currency: string; fx_rate: number;
  date: string; due_date: string; notes: string; terms: string;
  items: EditorItem[];
};

export function makeNewState(kind: string, companyBase: string, termsDays: number, defaults?: { party_id?: number; items?: EditorItem[] }): EditorState {
  return {
    kind, party_id: defaults?.party_id ?? "", currency: companyBase, fx_rate: 1,
    date: today(), due_date: addDays(today(), termsDays), notes: "", terms: `Net ${termsDays}`,
    items: defaults?.items ?? [{ description: "", qty: 1, unit_price: 0, discount_pct: 0, tax_pct: 0 }],
  };
}
