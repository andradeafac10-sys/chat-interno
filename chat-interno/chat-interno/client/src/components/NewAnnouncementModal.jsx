import React, { useEffect, useRef, useState } from "react";
import { X, Search, Megaphone, Image as ImageIcon, Bold, Italic } from "lucide-react";
import { api } from "../api";

const EMOJIS_RAPIDOS = ["📢", "⚠️", "✅", "🎉", "❗", "📌", "🙏", "🔥"];

export default function NewAnnouncementModal({ onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all"); // all | users | groups
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [filter, setFilter] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Carrega as pessoas e os grupos só quando realmente precisa (audiência
  // direcionada) — não faz sentido buscar isso se o comunicado é pra "todos".
  useEffect(() => {
    if (audience === "users" && users.length === 0) {
      api.get("/users/manage").then(({ data }) => setUsers(data.users)).catch(() => {});
    }
    if (audience === "groups" && groups.length === 0) {
      api.get("/conversations").then(({ data }) => {
        setGroups(data.conversations.filter((c) => c.type === "group"));
      }).catch(() => {});
    }
  }, [audience]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleUser = (id) =>
    setUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleGroup = (id) =>
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Envolve o texto selecionado no campo com marcador (negrito/itálico),
  // igual ao campo de mensagem do chat.
  const wrapSelection = (marker) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd) || "texto";
    const novo = value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd);
    setMessage(novo);
    requestAnimationFrame(() => {
      el.focus();
      const pos = selectionStart + marker.length + selected.length + marker.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const inserirEmoji = (emoji) => {
    const el = textareaRef.current;
    const pos = el ? el.selectionStart : message.length;
    const novo = message.slice(0, pos) + emoji + message.slice(pos);
    setMessage(novo);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + emoji.length, pos + emoji.length);
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const podeEnviar =
    message.trim().length > 0 &&
    !sending &&
    (audience !== "users" || userIds.length > 0) &&
    (audience !== "groups" || groupIds.length > 0);

  const enviar = async () => {
    if (!podeEnviar) return;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("message", message.trim());
      form.append("audience", audience);
      if (audience === "users") form.append("userIds", JSON.stringify(userIds));
      if (audience === "groups") form.append("groupIds", JSON.stringify(groupIds));
      if (image) form.append("image", image);

      await api.post("/announcements", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSent();
    } catch (err) {
      setError(err.response?.data?.error || "Não deu pra enviar o comunicado. Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(filter.toLowerCase()));
  const filteredGroups = groups.filter((g) => g.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    // Ao criar, o modal só fecha pelo X ou enviando — clicar fora não fecha,
    // pra ninguém perder o que já tinha escrito sem querer.
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-3">
      <div className="bg-white rounded-2xl w-[94vw] max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
            <Megaphone size={18} className="text-[#2563EB]" /> Novo comunicado
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={19} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mensagem</label>
          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => wrapSelection("*")}
              title="Negrito"
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("_")}
              title="Itálico"
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100"
            >
              <Italic size={14} />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            {EMOJIS_RAPIDOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => inserirEmoji(e)}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100 text-[15px]"
              >
                {e}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva o comunicado..."
            rows={5}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />

          <label className="text-xs font-medium text-slate-500 mt-4 mb-1.5 block">Imagem (opcional)</label>
          {imagePreview ? (
            <div className="relative w-fit">
              <img src={imagePreview} alt="Prévia" className="max-h-40 rounded-lg border border-slate-200" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <ImageIcon size={15} /> Anexar imagem
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />

          <label className="text-xs font-medium text-slate-500 mt-4 mb-1.5 block">Para quem</label>
          <div className="flex gap-2 mb-3">
            {[
              { id: "all", label: "Todos" },
              { id: "users", label: "Pessoas específicas" },
              { id: "groups", label: "Grupos" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setAudience(opt.id); setFilter(""); }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                  audience === opt.id
                    ? "bg-[#EFF4FF] border-[#2563EB] text-[#2563EB]"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {(audience === "users" || audience === "groups") && (
            <>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={audience === "users" ? "Buscar pessoa..." : "Buscar grupo..."}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
                {audience === "users" &&
                  (filteredUsers.length === 0 ? (
                    <div className="text-xs text-slate-400 px-3 py-2">Nenhuma pessoa encontrada.</div>
                  ) : (
                    filteredUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                        {u.name}
                      </label>
                    ))
                  ))}
                {audience === "groups" &&
                  (filteredGroups.length === 0 ? (
                    <div className="text-xs text-slate-400 px-3 py-2">Nenhum grupo encontrado.</div>
                  ) : (
                    filteredGroups.map((g) => (
                      <label key={g.groupId} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={groupIds.includes(g.groupId)} onChange={() => toggleGroup(g.groupId)} />
                        {g.title}
                      </label>
                    ))
                  ))}
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={enviar}
            disabled={!podeEnviar}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#2563EB" }}
          >
            {sending ? "Enviando..." : "Enviar comunicado"}
          </button>
        </div>
      </div>
    </div>
  );
}
