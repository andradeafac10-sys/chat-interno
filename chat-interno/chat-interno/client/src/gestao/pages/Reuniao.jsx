import { Video } from 'lucide-react';
import PageHeader from '../PageHeader';

// Espaço reservado — a funcionalidade de Reunião ainda não foi construída.
export default function Reuniao() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={Video} title="Reunião" subtitle="Em construção" />
      <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ background: '#F7F9FB' }}>
        <Video size={32} className="text-slate-300" />
        <p className="text-[13px] text-slate-400 font-medium">Reunião</p>
        <p className="text-[12px] text-slate-300">Em construção — ainda não faz nada.</p>
      </div>
    </div>
  );
}
