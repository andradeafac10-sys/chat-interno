# Chat Interno

Sistema de chat interno para a empresa: ADM conversa com todo mundo, operadores
conversam **apenas** com o ADM (nunca entre si), e é possível criar grupos —
cada operador só enxerga os grupos dos quais participa. Suporta texto, foto,
arquivo e áudio (gravado pelo microfone do navegador). O ADM pode fixar uma
mensagem por conversa (privada ou em grupo).

- **Backend**: Node.js + Express + Socket.io (tempo real) + PostgreSQL
- **Frontend**: React + Vite + Tailwind, consumido pelo navegador (funciona em
  computador e celular, não precisa instalar nada)

```
chat-interno/
├── server/     -> API + banco + tempo real
└── client/     -> interface que os usuários acessam pelo navegador
```

## 1. Rodando localmente (para testar antes de publicar)

### Pré-requisitos
- Node.js 18 ou mais novo
- Um PostgreSQL rodando (pode ser local, ou já criar direto na nuvem — veja o passo 2)

### Backend
```bash
cd server
cp .env.example .env
# edite o .env e preencha DATABASE_URL e JWT_SECRET
npm install
npm run seed      # cria as tabelas e um usuário ADM inicial
npm run dev        # sobe o servidor em http://localhost:4000
```
O `seed` cria o login inicial:
- **usuário:** `admin` **senha:** `admin123` (troque depois de entrar)
- dois operadores de exemplo: `carlos` e `bruna`, senha `operador123`

### Frontend
```bash
cd client
cp .env.example .env   # deixe VITE_API_URL=http://localhost:4000
npm install
npm run dev             # abre em http://localhost:5173
```

Abra `http://localhost:5173` no navegador e entre com `admin` / `admin123`.

## 2. Colocando no ar (Railway ou Render)

A ideia: **um serviço** roda o backend (`server/`), **um banco PostgreSQL**
gerenciado pela própria plataforma, e **um serviço** roda o frontend (`client/`)
como site estático. Os passos são praticamente iguais nas duas plataformas.

### Passo a passo (exemplo com Railway)
1. Suba este projeto para um repositório no GitHub.
2. No Railway, crie um novo projeto → **"Deploy from GitHub repo"**.
3. Adicione um serviço **PostgreSQL** (Railway cria o banco e te dá a
   `DATABASE_URL` automaticamente).
4. Adicione um segundo serviço apontando para a pasta `server/` (em
   Settings → Root Directory, coloque `server`). Configure as variáveis de
   ambiente:
   - `DATABASE_URL` → cole a que o Railway gerou para o Postgres
   - `JWT_SECRET` → invente uma senha longa e aleatória
   - `CLIENT_ORIGIN` → a URL pública que o frontend vai ter (você ajusta depois
     de publicar o frontend)
   - Comando de build: `npm install`
   - Comando de start: `npm run seed && npm start` (o seed só roda de verdade
     na primeira vez; nas próximas ele detecta que já existe ADM e não faz nada)
5. Adicione um terceiro serviço apontando para a pasta `client/` (Root
   Directory `client`), com:
   - `VITE_API_URL` → a URL pública que o Railway deu ao serviço do backend
   - Comando de build: `npm install && npm run build`
   - Comando de start (serviço estático): `npm run preview -- --host 0.0.0.0 --port $PORT`
6. Depois que o frontend tiver uma URL pública, volte no serviço do backend e
   atualize `CLIENT_ORIGIN` com essa URL (isso libera o CORS corretamente).
7. Acesse a URL do frontend pelo navegador — pronto, já está no ar para a
   equipe usar.

No **Render** o processo é o mesmo, só muda a tela: "New +" → "PostgreSQL"
para o banco, "New +" → "Web Service" (Root Directory `server`) para o
backend, e "New +" → "Static Site" (Root Directory `client`, Build Command
`npm install && npm run build`, Publish Directory `dist`) para o frontend.

### Sobre os arquivos enviados (fotos, áudios, arquivos)
Neste projeto os arquivos são salvos em disco, na pasta `server/uploads`.
Isso funciona bem para começar, mas a maioria dos planos gratuitos de
Railway/Render **apaga esses arquivos a cada novo deploy** (disco não é
permanente). Para produção de verdade, o ideal é trocar o armazenamento por
um serviço de objetos como **Cloudflare R2**, **Backblaze B2** ou **Amazon
S3** — se quiser, eu ajudo a fazer essa troca depois que o resto estiver no ar.

## 3. Como funcionam as regras de permissão
- Todo mundo entra com **usuário e senha** (criados pelo ADM em
  `POST /api/users` — ainda não tem tela pronta pra isso, então por enquanto
  crie operadores via requisição HTTP, ou eu monto essa tela também se
  precisar).
- **Operador**: só vê a própria conversa com o ADM e os grupos em que foi
  colocado. Isso é garantido no servidor (não dá pra burlar pelo navegador).
- **ADM**: vê e fala com todos, cria grupos e fixa mensagens.
- Mensagens fixadas: só uma por conversa; fixar uma nova desfixa a anterior
  automaticamente.

## 4. Segurança — pontos que valem revisar antes de usar com dados reais
- Troque `JWT_SECRET` e a senha do `admin` assim que publicar.
- O limite de upload está em 20MB por arquivo (dá pra ajustar no `.env`).
- Ative HTTPS (Railway/Render já fazem isso automaticamente nas URLs deles).
- Adicione backups automáticos do banco (as duas plataformas oferecem isso
  nos planos pagos).
