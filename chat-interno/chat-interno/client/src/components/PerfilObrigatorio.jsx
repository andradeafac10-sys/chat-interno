import React, { useEffect, useState } from "react";
import { ShieldCheck, Camera } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// Tela que bloqueia o sistema todo dia 11 do mês até a pessoa atualizar
// nome, sobrenome e senha. Não tem botão de fechar.
export default function PerfilObrigatorio() {
  const { user, updateUser, logout } = useAuth();
  const [due, setDue] = useState(false);
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    const checar = () => {
      api.get("/perfil/status").then(({ data }) => {
        if (cancelado) return;
        if (data.due) {
          setDue((antes) => {
            if (!antes) { setNome(""); setSobrenome(""); }
            return true;
          });
        }
      }).catch(() => {});
    };
    checar();
    const intervalo = setInterval(checar, 60 * 1000);
    const aoVoltar = () => { if (document.visibilityState === "visible") checar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { cancelado = true; clearInterval(intervalo); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !due) return null;

  const salvar = async (e) => {
    e.preventDefault();
    setErro("");
    if (!nome.trim() || !sobrenome.trim()) return setErro("Preencha nome e sobrenome.");
    if (senha.length < 6) return setErro("A nova senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmar) return setErro("A confirmação da senha não confere.");
    setSalvando(true);
    try {
      const { data } = await api.post("/perfil/atualizar", { nome, sobrenome, newPassword: senha });
      let avatar = data.user.avatar_url;
      if (foto) {
        try {
          const form = new FormData();
          form.append("file", foto);
          const r = await api.post("/auth/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
          avatar = r.data.avatar_url;
        } catch {}
      }
      updateUser({ name: data.user.name, avatar_url: avatar });
      setFoto(null); setFotoPreview("");
      setSenha("");
      setConfirmar("");
      setDue(false);
    } catch (err) {
      setErro(err.response?.data?.error || "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const campo = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(30, 10, 70, 0.92)" }}>
      <form onSubmit={salvar} className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-1" style={{ color: "#5B21B6" }}>
          <ShieldCheck size={20} />
          <h2 className="text-[17px] font-semibold">Atualize seu cadastro</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 mb-4">
          Digite seu nome e sobrenome e crie uma nova senha, diferente da que você usa hoje. A foto é opcional. Depois disso o sistema é liberado.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <label className="w-14 h-14 rounded-full bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center overflow-hidden cursor-pointer shrink-0">
            {fotoPreview ? <img src={fotoPreview} alt="" className="w-full h-full object-cover" /> : <Camera size={22} />}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFoto(f); setFotoPreview(URL.createObjectURL(f)); }
            }} />
          </label>
          <div className="text-[12px]"><b className="text-[#7C3AED] block text-[13px]">Adicionar foto</b><span className="text-slate-400">Opcional</span></div>
        </div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome" className={campo + " mb-3"} autoFocus />
        <label className="text-xs font-medium text-slate-500 mb-1 block">Sobrenome</label>
        <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Digite seu sobrenome" className={campo + " mb-3"} />
        <label className="text-xs font-medium text-slate-500 mb-1 block">Nova senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo + " mb-3"} autoComplete="new-password" />
        <label className="text-xs font-medium text-slate-500 mb-1 block">Confirmar nova senha</label>
        <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={campo + " mb-3"} autoComplete="new-password" />

        {erro && <p className="text-xs text-red-500 mb-3">{erro}</p>}

        <button type="submit" disabled={salvando} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#7C3AED" }}>
          {salvando ? "Salvando..." : "Salvar e liberar o sistema"}
        </button>
        <button type="button" onClick={logout} className="w-full text-[12px] text-slate-400 mt-3 hover:text-slate-600">Sair</button>
      </form>
    </div>
  );
}
