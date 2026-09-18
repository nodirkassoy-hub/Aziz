import { handler, bad } from "@/lib/api";
import { all, get, insert, run, runInTransaction } from "@/lib/db";
import { audit } from "@/lib/auth";
import { postDraft, postEntry, postDraft as _pd, unpostEntry, assertPeriodOpen, draftEntry } from "@/lib/postings";
import { today } from "@/lib/dates";

export const POST = handler(async ({ user, body }) => {
  const cid = user.companyId;
  const action = body.action;

  const linesIn = (body.lines ?? []).map((l: any) => ({
    accountId: +l.account_id, debit: Math.round(+l.debit || 0), credit: Math.round(+l.credit || 0), memo: l.memo || null,
  })).filter((l: any) => l.debit || l.credit);
  if (!linesIn.length && action !== "delete") bad("Add debit/credit lines.");

  if (action === "create") {
    return runInTransaction(() => {
      const date = body.date || today();
      assertPeriodOpen(cid, date, user.role);
      const totalD = linesIn.reduce((s: number, l: any) => s + l.debit, 0), totalC = linesIn.reduce((s: number, l: any) => s + l.credit, 0);
      const lines = all<any>(`SELECT id FROM accounts WHERE company_id=? AND id IN (${linesIn.map(() => "?").join(",")})`, cid, ...linesIn.map((l: any) => l.accountId));
      if (lines.length !== linesIn.length) bad("One of the selected accounts does not belong to this company.");
      if (body.status === "posted") {
        const je = postEntry({ companyId: cid, date, description: body.description || "Manual journal entry", ref: body.ref || null, sourceKind: "manual", userId: user.id, lines: linesIn });
        audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "journal_entry", entityId: je, summary: `JE #${je} posted — ${body.description ?? ""} (${(totalD / 100).toLocaleString("en-US")})` });
        return { id: je, message: "Journal entry posted. Debits = Credits ✓" };
      }
      if (totalD !== totalC) bad(`Unbalanced entry — debit ${totalD / 100} vs credit ${totalC / 100}. Draft saved? No: fix totals before posting.`);
      const id = draftEntry({ companyId: cid, date, description: body.description || "Manual journal entry", ref: body.ref || undefined, sourceKind: "manual", userId: user.id, lines: linesIn });
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "created", entityKind: "journal_entry", entityId: id, summary: `Draft journal entry created — ${body.description ?? ""}` });
      return { id, message: "Draft journal entry saved." };
    });
  }
  if (action === "update") {
    const e = get<any>(`SELECT * FROM journal_entries WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Entry not found.");
    if (e.status === "posted") bad("Posted manual entries cannot be edited. Unpost first, edit, then re-post.");
    assertPeriodOpen(cid, body.date ?? e.date, user.role);
    return runInTransaction(() => {
      run(`UPDATE journal_entries SET date=?, description=?, ref=? WHERE id=?`, body.date ?? e.date, body.description ?? e.description, body.ref ?? e.ref, e.id);
      run(`DELETE FROM journal_lines WHERE entry_id=?`, e.id);
      for (const l of linesIn) insert(`INSERT INTO journal_lines (entry_id, company_id, account_id, debit, credit, memo) VALUES (?,?,?,?,?,?)`, e.id, cid, l.accountId, l.debit, l.credit, l.memo);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "edited", entityKind: "journal_entry", entityId: e.id, summary: `Draft entry #${e.id} edited` });
      return { message: "Draft updated." };
    });
  }
  if (action === "post") {
    const no = postDraft(+body.id, user.role);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "journal_entry", entityId: +body.id, summary: `Draft posted as ${no}` });
    return { message: `${no} posted.`, no };
  }
  if (action === "unpost") {
    unpostEntry(+body.id, user.role);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "unposted", entityKind: "journal_entry", entityId: +body.id, summary: `Entry #${body.id} returned to draft` });
    return { message: "Entry moved back to draft." };
  }
  if (action === "reverse") {
    const e = get<any>(`SELECT * FROM journal_entries WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Entry not found.");
    if (e.status !== "posted") bad("Only posted entries can be reversed.");
    if (e.reversed_by) bad("Already reversed.");
    return runInTransaction(() => {
      const lines = all<any>(`SELECT * FROM journal_lines WHERE entry_id=?`, e.id).map(l => ({ accountId: l.account_id, debit: l.credit, credit: l.debit, memo: `Reverse of ${e.entry_no}` }));
      const revId = postEntry({ companyId: cid, date: body.date || today(), description: `Reversal of ${e.entry_no}${body.note ? ` — ${body.note}` : ""}`, ref: e.entry_no ?? e.ref ?? undefined, sourceKind: "manual", sourceId: e.id, userId: user.id, lines });
      run(`UPDATE journal_entries SET reversed_by=? WHERE id=?`, revId, e.id);
      audit({ companyId: cid, userId: user.id, userName: user.name, action: "posted", entityKind: "journal_entry", entityId: revId, summary: `Reversal posted for ${e.entry_no}` });
      return { id: revId, message: "Reversing entry posted — original stays intact for audit." };
    });
  }
  if (action === "delete") {
    const e = get<any>(`SELECT * FROM journal_entries WHERE id=? AND company_id=?`, body.id, cid) ?? bad("Entry not found.");
    if (e.status === "posted") bad("Posted entries cannot be deleted — reverse them to keep an auditable trail.");
    if (e.source_kind !== "manual") bad("Entries generated by documents are managed from the document.");
    run(`DELETE FROM journal_lines WHERE entry_id=?`, e.id);
    run(`DELETE FROM journal_entries WHERE id=?`, e.id);
    audit({ companyId: cid, userId: user.id, userName: user.name, action: "deleted", entityKind: "journal_entry", entityId: e.id, summary: `Draft entry #${e.id} deleted` });
    return { message: "Draft deleted." };
  }
  bad("Unknown action.");
}, { perm: "post", area: "accounting" });
