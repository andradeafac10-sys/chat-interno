import React, { useEffect, useRef, useState } from "react";
import { X, Users, Camera, ShieldCheck, Paperclip, Trash2, Download, File as FileIcon, Image as ImageIcon } from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import ImageViewer from "./ImageViewer";

const fmtSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function GroupSettingsModal({ groupId, isAdm, onClose, onUpdated }) {
  const { user: currentUser } = useAuth();
  const [group, setGroup] = useState(null);
  const [operators, setOperators] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const fileInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const load = () => {
    const requests = [api.get(`/groups/${groupId}`)];
    if (isAdm) requests.push(api.get("/users/manage"));
    Promise.all(requests).then(([g, ops]) => {
      setGroup(g.data.group);
      setName(g.data.group.name);
      setDescription(g.data.group.description || "");
      setMemberIds(g.data.group.memberIds);
      if (ops) setOperators(ops.data.users.filter((u) => u.id !== currentUser.id));
    });
  };

  useEffect(() => { load(); }, [groupId]);

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

  const handleAttachmentPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", file.type.startsWith("image/") ? "image" : "file");
    try {
      await api.post(`/groups/${groupId}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      load();
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const removeAttachment = async (attId) => {
    await api.delete(`/groups/${groupId}/attachments/${attId}`);
    load();
  };

  const save = async () => {
    setSaving(true);
    try {
      if ((name.trim() && name.trim() !== group.name) || description !== (group.description || "")) {
        await api.patch(`/groups/${groupId}`, { name: name.trim(), description });
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[380px] max-w-full h-full bg-white shadow-2xl overflow-y-auto">
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          <h3 className="text-slate-800 font-semibold text-base">Informações do grupo</h3>
        </div>

        <div className="p-5">
          <div className="flex flex-col items-center mb-5">
            <button
              onClick={() => isAdm && fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white overflow-hidden shrink-0"
              style={{ background: "#334155", cursor: isAdm ? "pointer" : "default" }}
            >
              {group.avatarUrl ? (
                <img src={fileUrl(group.avatarUrl)} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <Users size={28} />
              )}
              {isAdm && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera size={20} color="white" />
                </div>
              )}
            </button>
            {isAdm && (
              <>
                <span className="text-[11px] text-slate-400 mt-1.5">{uploadingAvatar ? "Enviando..." : "Trocar foto"}</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
              </>
            )}
          </div>

          <label className="text-xs font-medium text-slate-500 mb-1 block">Nome do grupo</label>
          {isAdm ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          ) : (
            <div className="text-sm text-slate-800 mb-4">{group.name}</div>
          )}

          <label className="text-xs font-medium text-slate-500 mb-1 block">Descrição</label>
          {isAdm ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Do que se trata esse grupo..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
            />
          ) : (
            <div className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{group.description || "Sem descrição."}</div>
          )}

          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-500 block">Arquivos e fotos</label>
            {isAdm && (
              <button onClick={() => attachmentInputRef.current?.click()} className="text-[11px] text-[#25D366] font-medium flex items-center gap-1">
                <Paperclip size={12} /> {uploadingAttachment ? "Enviando..." : "Adicionar"}
              </button>
            )}
            {isAdm && <input ref={attachmentInputRef} type="file" className="hidden" onChange={handleAttachmentPick} />}
          </div>
          <div className="flex flex-col gap-1 mb-5 max-h-52 overflow-y-auto">
            {(group.attachments || []).map((att) => (
              <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                {att.kind === "image" ? (
                  <button onClick={() => setViewingImage({ url: att.file_url, name: att.file_name })} className="shrink-0">
                    <img src={fileUrl(att.file_url)} alt={att.file_name} className="w-9 h-9 rounded object-cover cursor-zoom-in" />
                  </button>
                ) : (
                  <FileIcon size={14} className="text-slate-400 shrink-0" />
                )}
                <span className="text-[12px] text-slate-700 truncate flex-1">{att.file_name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtSize(att.file_size)}</span>
                <a href={fileUrl(att.file_url)} download={att.file_name} className="text-slate-400 hover:text-[#25D366] shrink-0"><Download size={13} /></a>
                {isAdm && (
                  <button onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
            {(group.attachments || []).length === 0 && <span className="text-xs text-slate-400">Nenhum arquivo ainda.</span>}
          </div>

          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            {isAdm ? "Membros" : `Membros (${group.memberIds.length})`}
          </label>
          {isAdm ? (
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
          ) : (
            <div className="text-xs text-slate-400 mb-5">Só o ADM pode ver e editar a lista completa de membros.</div>
          )}

          {isAdm && (
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "#25D366" }}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          )}
        </div>
      </div>

      <ImageViewer image={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
}
