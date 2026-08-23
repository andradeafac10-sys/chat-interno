import React, { useEffect, useState } from "react";
import { X, Megaphone, Users as UsersIcon, User, ShieldCheck } from "lucide-react";
import { api } from "../api";

export default function NewAnnouncementModal({ onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audience, setAudience] = useState("all"); // all | users | groups
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/users/manage").then(({ data }) => setUsers(data.users)).catch(() => {});
    api.get("/conversations").then(({ data }) => {
      setGroups(data.conversations.filter((c) => c.type === "group"));
    }).catch(() => {});
  }, []);

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Só é possível anexar uma imagem (foto) no comunicado.");
      e.target.value = "";
      return;
    }
    setError("");
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (audience === "users" && userIds.length === 0) return setError("Escolha pelo menos uma pessoa.");
    if (audience === "groups" && groupIds.length === 0) return setError("Escolha pelo menos um grupo.");

    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("message", message.trim());
      form.append("audience", audience);
      if (audience === "users") form.append("userIds", JSON.stringify(userIds));
      if (audience === "groups") form.append("groupIds", JSON.stringify(groupIds));
      if (image) form.append("image", image);
      await api.post("/announcements", form, { headers: { "Content-Type": "multipart/form-data" } });
      onSent();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível enviar o comunicado.");
    } finally {
      setSending(false);
    }
  };

  const tabs = [
    { id: "all", label: "Todos", icon: Megaphone },
    { id: "users", label: "Pessoas", icon: User },
    { id: "groups", label: "Grupos", icon: UsersIcon },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-[420px] max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base flex items-center gap-2">
            <Megaphone size={18} className="text-[#25D366]" /> Novo comunicado
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Quem vai receber</label>
          <div className="flex gap-1.5 mb-3">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setAudience(t.id); setError(""); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-lg py-2 border"
                  style={{
                    background: audience === t.id ? "#25D366" : "#fff",
                    color: audience === t.id ? "#fff" : "#64748B",
                    borderColor: audience === t.id ? "#25D366" : "#E2E8F0",
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          {audience === "users" && (
            <div className="border border-slate-200 rounded-lg p-2 mb-3 max-h-40 overflow-y-auto flex flex-col gap-1">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => toggle(userIds, setUserIds, u.id)} className="accent-[#25D366]" />
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ background: u.color }}>
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <span className="text-[13px] text-slate-700 flex items-center gap-1">
                    {u.name}
                    {u.role === "admin" && <ShieldCheck size={11} className="text-[#25D366]" />}
                  </span>
                </label>
              ))}
              {users.length === 0 && <span className="text-xs text-slate-400 px-1.5">Carregando pessoas...</span>}
            </div>
          )}

          {audience === "groups" && (
            <div className="border border-slate-200 rounded-lg p-2 mb-3 max-h-40 overflow-y-auto flex flex-col gap-1">
              {groups.map((g) => (
                <label key={g.groupId} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={groupIds.includes(g.groupId)} onChange={() => toggle(groupIds, setGroupIds, g.groupId)} className="accent-[#25D366]" />
                  <UsersIcon size={14} className="text-slate-400" />
                  <span className="text-[13px] text-slate-700">{g.title}</span>
                </label>
              ))}
              {groups.length === 0 && <span className="text-xs text-slate-400 px-1.5">Nenhum grupo encontrado.</span>}
            </div>
          )}

          <label className="text-xs font-medium text-slate-500 mb-1 block">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
            placeholder="Escreva o comunicado..."
            required
          />

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Imagem (opcional)</label>
          {imagePreview ? (
            <div className="relative mb-3">
              <img src={imagePreview} alt="Prévia" className="w-full h-32 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => { setImage(null); setImagePreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={handleImage} className="w-full text-xs text-slate-500 mb-3" />
          )}

          {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#25D366" }}
          >
            {sending ? "Enviando..." : "Enviar comunicado"}
          </button>
        </form>
      </div>
    </div>
  );
}
