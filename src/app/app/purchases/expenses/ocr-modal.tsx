"use client";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/kit";
import { OcrPanel } from "@/components/ocr-panel";

export function OcrModal({ open, banks, suppliers, categories }: { open: boolean; banks: any[]; suppliers: any[]; categories: any[] }) {
  const router = useRouter();
  const close = () => router.push("/app/purchases/expenses");
  return (
    <Modal open={open} onClose={close} title="Scan a receipt" wide>
      <OcrPanel banks={banks} suppliers={suppliers} categories={categories} onDone={close} />
    </Modal>
  );
}
