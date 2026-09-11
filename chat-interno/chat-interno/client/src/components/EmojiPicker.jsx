import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Clock } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// Biblioteca de emojis por categoria. Cada um tem palavras-chave em português
// pra busca funcionar do jeito que a pessoa pensa ("coracao", "risada", "ok").
const CATEGORIAS = [
  {
    id: "rostos",
    icone: "😀",
    nome: "Rostos",
    emojis: [
      ["😀", "feliz sorriso"], ["😃", "feliz alegre"], ["😄", "feliz rindo"], ["😁", "sorriso dentes"],
      ["😆", "rindo muito"], ["😅", "rindo suor alivio"], ["🤣", "rolando de rir gargalhada"], ["😂", "chorando de rir"],
      ["🙂", "sorriso leve"], ["🙃", "de cabeca pra baixo ironia"], ["😉", "piscada"], ["😊", "feliz timido"],
      ["😇", "anjo santo"], ["🥰", "apaixonado amor"], ["😍", "olhos de coracao amor"], ["🤩", "estrela uau"],
      ["😘", "beijo"], ["😗", "beijo"], ["😚", "beijo"], ["😙", "beijo"],
      ["😋", "delicia gostoso lingua"], ["😛", "lingua"], ["😜", "lingua piscada"], ["🤪", "louco doido"],
      ["😝", "lingua"], ["🤑", "dinheiro rico"], ["🤗", "abraco"], ["🤭", "opa ops vergonha"],
      ["🤫", "silencio shh"], ["🤔", "pensando duvida"], ["🤐", "boca fechada calado"], ["🤨", "desconfiado"],
      ["😐", "neutro"], ["😑", "sem expressao"], ["😶", "sem boca calado"], ["😏", "malicioso"],
      ["😒", "chateado desgosto"], ["🙄", "revirando os olhos"], ["😬", "constrangido careta"], ["🤥", "mentira"],
      ["😌", "aliviado calmo"], ["😔", "triste pensativo"], ["😪", "sono cansado"], ["🤤", "babando"],
      ["😴", "dormindo sono"], ["😷", "mascara doente"], ["🤒", "doente febre"], ["🤕", "machucado"],
      ["🤢", "enjoado nojo"], ["🤮", "vomitando"], ["🤧", "espirro resfriado"], ["🥵", "calor quente"],
      ["🥶", "frio"], ["😵", "tonto"], ["🤯", "explodindo mente chocado"], ["🤠", "cowboy"],
      ["🥳", "festa comemorando"], ["😎", "oculos legal"], ["🤓", "nerd"], ["🧐", "monoculo analisando"],
      ["😕", "confuso"], ["😟", "preocupado"], ["🙁", "triste"], ["😮", "surpreso boca aberta"],
      ["😯", "surpreso"], ["😲", "chocado"], ["😳", "envergonhado corado"], ["🥺", "suplicante por favor"],
      ["😦", "assustado"], ["😧", "angustiado"], ["😨", "medo"], ["😰", "ansioso suor"],
      ["😥", "triste alivio"], ["😢", "chorando triste"], ["😭", "chorando muito"], ["😱", "grito medo"],
      ["😖", "frustrado"], ["😣", "perseverando"], ["😞", "decepcionado"], ["😓", "suor triste"],
      ["😩", "cansado exausto"], ["😫", "cansado"], ["🥱", "bocejo sono"], ["😤", "irritado bufando"],
      ["😡", "bravo raiva"], ["😠", "bravo"], ["🤬", "xingando palavrao"], ["😈", "diabo travesso"],
      ["💀", "caveira morto"], ["💩", "coco"], ["🤡", "palhaco"], ["👻", "fantasma"],
    ],
  },
  {
    id: "gestos",
    icone: "👋",
    nome: "Gestos e pessoas",
    emojis: [
      ["👋", "tchau ola aceno"], ["🤚", "mao"], ["✋", "mao parar"], ["🖐️", "mao dedos"],
      ["👌", "ok certo joia"], ["🤌", "italiano dedos"], ["🤏", "pouco pequeno"], ["✌️", "paz vitoria"],
      ["🤞", "dedos cruzados torcendo"], ["🤟", "amor rock"], ["🤘", "rock"], ["🤙", "me liga"],
      ["👈", "esquerda"], ["👉", "direita"], ["👆", "cima"], ["👇", "baixo"],
      ["👍", "joia positivo like bom"], ["👎", "negativo ruim dislike"], ["✊", "punho"], ["👊", "soco punho"],
      ["👏", "palmas aplausos parabens"], ["🙌", "maos pra cima comemorando"], ["👐", "maos abertas"], ["🤲", "maos"],
      ["🤝", "aperto de mao acordo negocio"], ["🙏", "obrigado por favor reza"], ["💪", "forca musculo"], ["🫡", "continencia sim senhor"],
      ["✍️", "escrevendo"], ["💅", "unha"], ["👀", "olhos olhando"], ["🧠", "cerebro"],
      ["👶", "bebe"], ["🧑", "pessoa"], ["👨", "homem"], ["👩", "mulher"],
      ["🧓", "idoso"], ["👮", "policia"], ["🕵️", "detetive"], ["👷", "obra trabalhador"],
      ["🤵", "terno"], ["👰", "noiva casamento"], ["🎅", "papai noel natal"], ["🦸", "heroi"],
      ["🚶", "andando"], ["🏃", "correndo"], ["💃", "dancando"], ["🕺", "dancando"],
    ],
  },
  {
    id: "animais",
    icone: "🐶",
    nome: "Animais e natureza",
    emojis: [
      ["🐶", "cachorro cao"], ["🐱", "gato"], ["🐭", "rato"], ["🐹", "hamster"],
      ["🐰", "coelho"], ["🦊", "raposa"], ["🐻", "urso"], ["🐼", "panda"],
      ["🐨", "coala"], ["🐯", "tigre"], ["🦁", "leao"], ["🐮", "vaca boi"],
      ["🐷", "porco"], ["🐸", "sapo"], ["🐵", "macaco"], ["🐔", "galinha"],
      ["🐧", "pinguim"], ["🐦", "passaro"], ["🦆", "pato"], ["🦅", "aguia"],
      ["🦉", "coruja"], ["🐺", "lobo"], ["🐗", "javali"], ["🐴", "cavalo"],
      ["🦄", "unicornio"], ["🐝", "abelha"], ["🐛", "lagarta"], ["🦋", "borboleta"],
      ["🐌", "caracol lento"], ["🐞", "joaninha"], ["🐢", "tartaruga"], ["🐍", "cobra"],
      ["🐙", "polvo"], ["🦀", "caranguejo"], ["🐠", "peixe"], ["🐬", "golfinho"],
      ["🐳", "baleia"], ["🦈", "tubarao"], ["🐊", "jacare"], ["🐘", "elefante"],
      ["🌵", "cacto"], ["🌲", "arvore"], ["🌴", "palmeira"], ["🌱", "muda planta"],
      ["🍀", "trevo sorte"], ["🌿", "folha"], ["🍁", "outono folha"], ["🌸", "flor"],
      ["🌻", "girassol"], ["🌹", "rosa flor"], ["🌺", "flor"], ["🌷", "tulipa"],
      ["🌞", "sol"], ["🌝", "lua"], ["⭐", "estrela"], ["🌟", "estrela brilho"],
      ["⚡", "raio energia"], ["🔥", "fogo bombando"], ["💧", "gota agua"], ["🌈", "arco iris"],
      ["☀️", "sol"], ["⛅", "nublado"], ["🌧️", "chuva"], ["❄️", "neve frio"],
    ],
  },
  {
    id: "comida",
    icone: "🍎",
    nome: "Comida e bebida",
    emojis: [
      ["🍎", "maca"], ["🍌", "banana"], ["🍇", "uva"], ["🍓", "morango"],
      ["🍉", "melancia"], ["🍊", "laranja"], ["🍍", "abacaxi"], ["🥭", "manga"],
      ["🥑", "abacate"], ["🍅", "tomate"], ["🥕", "cenoura"], ["🌽", "milho"],
      ["🍞", "pao"], ["🧀", "queijo"], ["🥚", "ovo"], ["🍔", "hamburguer"],
      ["🍟", "batata frita"], ["🍕", "pizza"], ["🌭", "cachorro quente"], ["🥪", "sanduiche"],
      ["🌮", "taco"], ["🍜", "macarrao"], ["🍣", "sushi"], ["🍗", "frango"],
      ["🥩", "carne"], ["🍿", "pipoca"], ["🍦", "sorvete"], ["🍰", "bolo"],
      ["🎂", "bolo aniversario"], ["🍫", "chocolate"], ["🍪", "biscoito"], ["🍩", "rosquinha"],
      ["☕", "cafe"], ["🍵", "cha"], ["🥤", "refrigerante"], ["🍺", "cerveja"],
      ["🍻", "cerveja brinde"], ["🍷", "vinho"], ["🥂", "brinde comemorar"], ["🍾", "champanhe comemorar"],
    ],
  },
  {
    id: "atividades",
    icone: "⚽",
    nome: "Atividades",
    emojis: [
      ["⚽", "futebol bola"], ["🏀", "basquete"], ["🏈", "futebol americano"], ["⚾", "beisebol"],
      ["🎾", "tenis"], ["🏐", "volei"], ["🎱", "sinuca"], ["🏓", "ping pong"],
      ["🏸", "badminton"], ["🥊", "boxe luta"], ["🏆", "trofeu vitoria campeao"], ["🥇", "ouro primeiro"],
      ["🥈", "prata segundo"], ["🥉", "bronze terceiro"], ["🏅", "medalha"], ["🎯", "alvo meta"],
      ["🎮", "videogame"], ["🎲", "dado"], ["🎰", "cassino sorte"], ["🎸", "guitarra"],
      ["🎹", "piano"], ["🎤", "microfone cantar"], ["🎧", "fone musica"], ["🎬", "filme cinema"],
      ["🎨", "arte pintura"], ["🎭", "teatro"], ["🎪", "circo"], ["🎉", "festa comemorar parabens"],
      ["🎊", "confete festa"], ["🎈", "balao"], ["🎁", "presente"], ["🎄", "natal"],
    ],
  },
  {
    id: "objetos",
    icone: "💡",
    nome: "Objetos e trabalho",
    emojis: [
      ["💡", "ideia lampada"], ["📱", "celular telefone"], ["💻", "notebook computador"], ["🖥️", "computador"],
      ["⌨️", "teclado"], ["🖨️", "impressora"], ["📷", "camera foto"], ["📹", "video camera"],
      ["📞", "telefone ligacao"], ["☎️", "telefone"], ["📧", "email"], ["📨", "email mensagem"],
      ["📁", "pasta arquivo"], ["📂", "pasta"], ["📄", "documento papel"], ["📃", "documento"],
      ["📊", "grafico barras resultado"], ["📈", "grafico subindo crescimento"], ["📉", "grafico caindo queda"], ["📋", "prancheta lista"],
      ["📌", "alfinete fixar importante"], ["📎", "clipe anexo"], ["✂️", "tesoura"], ["🖊️", "caneta"],
      ["✏️", "lapis escrever"], ["📝", "anotacao escrever nota"], ["📚", "livros estudo"], ["📖", "livro"],
      ["🔍", "lupa buscar procurar"], ["🔎", "lupa"], ["🔒", "cadeado fechado"], ["🔓", "cadeado aberto"],
      ["🔑", "chave"], ["🔨", "martelo"], ["🔧", "chave inglesa ferramenta"], ["⚙️", "engrenagem configuracao"],
      ["💰", "dinheiro saco"], ["💵", "dinheiro nota"], ["💳", "cartao credito"], ["🧾", "recibo nota fiscal"],
      ["⏰", "despertador alarme"], ["⏱️", "cronometro"], ["📅", "calendario data"], ["📆", "calendario"],
      ["🗓️", "calendario agenda"], ["🔔", "sino aviso notificacao"], ["🔕", "sino mudo silencio"], ["📢", "megafone aviso"],
      ["📣", "megafone anuncio"], ["🔗", "link corrente"], ["🏠", "casa"], ["🏢", "predio escritorio"],
      ["🏥", "hospital"], ["🏦", "banco"], ["🚗", "carro"], ["🚕", "taxi"],
      ["🚌", "onibus"], ["✈️", "aviao"], ["🚀", "foguete decolar"], ["⛽", "posto gasolina"],
    ],
  },
  {
    id: "simbolos",
    icone: "❤️",
    nome: "Símbolos",
    emojis: [
      ["❤️", "coracao vermelho amor"], ["🧡", "coracao laranja"], ["💛", "coracao amarelo"], ["💚", "coracao verde"],
      ["💙", "coracao azul"], ["💜", "coracao roxo"], ["🖤", "coracao preto"], ["🤍", "coracao branco"],
      ["💔", "coracao partido"], ["💕", "coracoes amor"], ["💖", "coracao brilhando"], ["💯", "cem nota maxima"],
      ["✅", "certo check ok feito concluido"], ["☑️", "marcado check"], ["✔️", "check certo"], ["❌", "errado x nao"],
      ["❎", "x errado"], ["⭕", "circulo certo"], ["🚫", "proibido"], ["⚠️", "atencao alerta cuidado"],
      ["❗", "exclamacao importante"], ["❓", "interrogacao duvida"], ["💬", "balao mensagem chat"], ["💭", "pensamento"],
      ["🔴", "bolinha vermelha"], ["🟠", "bolinha laranja"], ["🟡", "bolinha amarela"], ["🟢", "bolinha verde"],
      ["🔵", "bolinha azul"], ["⚫", "bolinha preta"], ["⚪", "bolinha branca"], ["🟣", "bolinha roxa"],
      ["➡️", "seta direita"], ["⬅️", "seta esquerda"], ["⬆️", "seta cima"], ["⬇️", "seta baixo"],
      ["🔝", "topo"], ["🆕", "novo"], ["🆗", "ok"], ["🔥", "fogo"],
      ["⏳", "ampulheta esperando"], ["⌛", "tempo acabando"], ["♻️", "reciclar"], ["✨", "brilho novo"],
    ],
  },
];

const CHAVE_RECENTES = "chatinterno_emojis_recentes";

export default function EmojiPicker({ onEscolher }) {
  const { colors } = useTheme();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("recentes");
  const [recentes, setRecentes] = useState([]);
  const listaRef = useRef(null);

  useEffect(() => {
    try {
      const salvos = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "[]");
      setRecentes(salvos);
      if (salvos.length === 0) setCategoriaAtiva("rostos");
    } catch {
      setCategoriaAtiva("rostos");
    }
  }, []);

  const escolher = (emoji) => {
    const novos = [emoji, ...recentes.filter((e) => e !== emoji)].slice(0, 16);
    setRecentes(novos);
    try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(novos)); } catch { /* sem problema */ }
    onEscolher(emoji);
  };

  // Busca olha as palavras-chave em português de todas as categorias
  const resultadosBusca = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 2) return null;
    const achados = [];
    CATEGORIAS.forEach((cat) => {
      cat.emojis.forEach(([emoji, palavras]) => {
        if (palavras.includes(termo) || palavras.split(" ").some((p) => p.startsWith(termo))) {
          achados.push(emoji);
        }
      });
    });
    return achados;
  }, [busca]);

  const irParaCategoria = (id) => {
    setCategoriaAtiva(id);
    setBusca("");
    const el = document.getElementById(`emoji-cat-${id}`);
    if (el && listaRef.current) {
      listaRef.current.scrollTop = el.offsetTop - listaRef.current.offsetTop;
    }
  };

  return (
    <div
      className="absolute bottom-full right-0 mb-2 w-[330px] rounded-xl shadow-lg border z-30 overflow-hidden"
      style={{ background: colors.panelBg, borderColor: colors.border }}
    >
      <div className="p-2 border-b" style={{ borderColor: colors.border }}>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textSecondary }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar emoji..."
            className="w-full rounded-md pl-7 pr-2 py-1.5 text-[12px] outline-none border"
            style={{ background: colors.chatBg, borderColor: colors.border, color: colors.textPrimary }}
          />
        </div>
      </div>

      {!resultadosBusca && (
        <div className="flex gap-0.5 px-1.5 py-1 border-b overflow-x-auto" style={{ borderColor: colors.border }}>
          {recentes.length > 0 && (
            <button
              onClick={() => irParaCategoria("recentes")}
              className="text-[15px] px-1.5 py-1 rounded-md shrink-0"
              style={{ background: categoriaAtiva === "recentes" ? colors.chatBg : "transparent" }}
              title="Usados recentemente"
            >
              <Clock size={15} style={{ color: colors.textSecondary }} />
            </button>
          )}
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => irParaCategoria(cat.id)}
              className="text-[15px] px-1.5 py-1 rounded-md shrink-0"
              style={{ background: categoriaAtiva === cat.id ? colors.chatBg : "transparent" }}
              title={cat.nome}
            >
              {cat.icone}
            </button>
          ))}
        </div>
      )}

      <div ref={listaRef} className="overflow-y-auto px-2 py-2" style={{ maxHeight: 230 }}>
        {resultadosBusca ? (
          resultadosBusca.length === 0 ? (
            <p className="text-[12px] text-center py-6" style={{ color: colors.textSecondary }}>Nenhum emoji encontrado.</p>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {resultadosBusca.map((e, i) => (
                <button key={`${e}-${i}`} onClick={() => escolher(e)} className="text-[21px] leading-none py-1 rounded hover:scale-125 transition-transform">
                  {e}
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {recentes.length > 0 && (
              <div id="emoji-cat-recentes" className="mb-2">
                <div className="text-[10.5px] mb-1" style={{ color: colors.textSecondary }}>Usados recentemente</div>
                <div className="grid grid-cols-8 gap-1">
                  {recentes.map((e, i) => (
                    <button key={`${e}-${i}`} onClick={() => escolher(e)} className="text-[21px] leading-none py-1 rounded hover:scale-125 transition-transform">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {CATEGORIAS.map((cat) => (
              <div key={cat.id} id={`emoji-cat-${cat.id}`} className="mb-2">
                <div className="text-[10.5px] mb-1" style={{ color: colors.textSecondary }}>{cat.nome}</div>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map(([e]) => (
                    <button key={e} onClick={() => escolher(e)} className="text-[21px] leading-none py-1 rounded hover:scale-125 transition-transform">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
