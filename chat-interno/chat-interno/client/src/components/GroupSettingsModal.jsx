import React, { useEffect, useRef, useState } from "react";
import { X, Users, Camera, ShieldCheck } from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";

export default function GroupSettingsModal({ groupId, onClose, onUpdated }) {
  const { user: currentUser } = useAuth();
  const [group, setGroup] = useState(null);
  const [operators, setOperators] = useState([]);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([api.get(`/groups/${groupId}`), api.get("/users/manage")]).then(([g, ops]) => {
      setGroup(g.data.group);
      setName(g.data.group.name);
      setMemberIds(g.data.group.memberIds);
      setOperators(ops.data.users.filter((u) => u.id !== currentUser.id));
    });
  }, [groupId, currentUser.id]);

  const toggle = (id) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post(`/groups/${groupId}/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setGroup((prev) => ({ ...prev, avatarUrl: data.group.avatarUrl }));
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (name.trim() && name.trim() !== group.name) {
        await api.patch(`/groups/${groupId}`, { name: name.trim() });
      }
      const original = group.memberIds;
      const add = memberIds.filter((id) => !original.includes(id));
      const remove = original.filter((id) => !memberIds.includes(id));
      if (add.length || remove.length) {
        await api.patch(`/groups/${groupId}/members`, { add, remove });
      }
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  if (!group) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[380px] p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold text-base">Editar grupo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex flex-col items-center mb-5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-full flex items-center justify-center text-white overflow-hidden shrink-0"
            style={{ background: "#334155" }}
          >
            {group.avatarUrl ? (
              <img src={fileUrl(group.avatarUrl)} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              <Users size={24} />
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera size={18} color="white" />
            </div>
          </button>
          <span className="text-[11px] text-slate-400 mt-1.5">{uploadingAvatar ? "Enviando..." : "Trocar foto"}</span>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1 block">Nome do grupo</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Membros</label>
        <div className="flex flex-col gap-1 mb-5 max-h-48 overflow-y-auto">
          {operators.map((op) => (
            <label key={op.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={memberIds.includes(op.id)} onChange={() => toggle(op.id)} className="accent-[#25D366]" />
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ background: op.color }}>
                {op.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <span className="text-sm text-slate-700 flex items-center gap-1">
                {op.name}
                {op.role === "admin" && <ShieldCheck size={12} className="text-[#25D366]" />}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: "#25D366" }}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
