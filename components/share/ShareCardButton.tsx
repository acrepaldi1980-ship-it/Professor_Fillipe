"use client";

// "Compartilhar cartão": a visual card of a verse or of a learning for WhatsApp and Instagram (Prompt 2.7). Preview, share (with the image where the
// device allows it) or save the image. Everything is drawn on the device.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getReferral } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { renderCard, type CardOptions } from "@/lib/share/card";

export function ShareCardButton({ text, title, credit, className }: { text: string; title: string; credit?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [link, setLink] = useState(typeof window === "undefined" ? "" : window.location.origin);
  const [msg, setMsg] = useState<string | null>(null);
  const platform = getPlatform();

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    void (async () => {
      let l = window.location.origin;
      try { const r = await getReferral(); if (r.code) l = `${l}/?ind=${r.code}`; } catch { /* the card works without a code */ }
      setLink(l);
      const o: CardOptions = { text, title, credit, link: l };
      try { const b = await renderCard(o); setBlob(b); url = URL.createObjectURL(b); setSrc(url); } catch { setMsg(t("share.card.error")); }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [open, text, title, credit]);

  async function share() {
    if (!blob) return;
    const r = await platform.share.share({ title, text: `${title}\n${link}`, url: link, file: { name: "cartao-professor-filipe.png", blob } });
    setMsg(r === "copied" ? t("share.card.copied") : r === "unavailable" ? t("share.card.unavailable") : null);
  }
  async function save() { if (blob) { await platform.files.save("cartao-professor-filipe.png", blob); setMsg(t("share.card.saved")); } }

  return (
    <>
      <Button type="button" variant="ghost" className={className} onClick={() => { setOpen(true); setMsg(null); }}>{t("share.card.open")}</Button>
      {open && (
        <Modal title={t("share.card.title")} onClose={() => { setOpen(false); setBlob(null); setSrc(null); }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL: nothing to optimize */}
          {src ? <img src={src} alt={`${title}: ${text.slice(0, 120)}`} className="mx-auto max-h-[60dvh] w-auto rounded-control border border-line" data-testid="share-card" /> : <p role="status" className="text-sm text-muted">{t("word.loading")}</p>}
          <p className="mt-2 text-xs text-muted">{t("share.card.help")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" disabled={!blob} onClick={() => void share()}>{t("share.card.share")}</Button>
            <Button type="button" variant="ghost" disabled={!blob} onClick={() => void save()}>{t("share.card.save")}</Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setBlob(null); setSrc(null); }}>{t("study.verse.close")}</Button>
          </div>
          {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
        </Modal>
      )}
    </>
  );
}
