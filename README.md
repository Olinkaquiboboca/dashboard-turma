# 🐾 Tropinha

**Plataforma educacional privada para turmas de estudo**

*Mural da turma · Conteúdo didático · Simulados com fiscalização · Materiais*

---

[![Status](https://img.shields.io/badge/status-ativo-34d399?style=flat-square)](https://github.com)
[![Hospedagem](https://img.shields.io/badge/hospedagem-GitHub%20Pages-7c9ef5?style=flat-square)](https://pages.github.com)
[![Backend](https://img.shields.io/badge/backend-Supabase-3ecf8e?style=flat-square)](https://supabase.com)
[![Licença](https://img.shields.io/badge/acesso-privado-ef4444?style=flat-square)](#)

---

## O que é o Tropinha?

O Tropinha é um ambiente digital fechado para turmas de estudo. Pense nele como uma mistura de grupo de estudos, plataforma de simulados e repositório de materiais — tudo em um lugar só, sem anúncios, sem distrações e sem acesso público.

O acesso é restrito: só entra quem o administrador cadastrar. Não há botão de "criar conta".

---

## O que você encontra aqui

### 📋 Mural da turma

Um feed social interno onde professores e admins postam avisos, materiais e atualizações. Os membros podem reagir com ❤️, comentar em thread (com respostas aninhadas), curtir comentários e compartilhar o link de uma publicação. Posts importantes podem ser fixados no topo.

### 📚 Conteúdo

Blocos de texto, imagens e links organizados em quatro abas temáticas: **Edital**, **Assuntos**, **Vídeos** e **Materiais**. O conteúdo é gerenciado pelos professores e admins diretamente pela interface, sem precisar mexer no banco de dados.

### 🎯 Simulados

O coração do Tropinha. Os simulados são organizados por matéria e por tipo (matéria ou geral). Existem dois comportamentos distintos dependendo do tipo:

Os **simulados de matéria** permitem múltiplas tentativas — são para prática livre, sem pressão. Os **simulados gerais** têm tentativa única e se comportam como uma prova real: o gabarito é protegido no banco de dados e nunca chega ao navegador do aluno, as respostas são salvas automaticamente a cada 30 segundos, e o sistema monitora comportamentos suspeitos como troca de aba ou inatividade prolongada, emitindo advertências. Ao acumular 5 advertências, o aluno é expulso do simulado.

Professores e admins têm acesso ao editor completo de questões — é possível criar questões manualmente ou importar em lote via arquivo JSON.

### 📁 Materiais

Um repositório de links externos organizados por tipo: editais, PDFs, vídeos, apresentações e sites úteis. Visível para todos os membros. Gerenciado por professores e admins.

---

## Quem pode fazer o quê

O sistema tem três papéis de usuário:

| Papel | O que pode fazer |
| --- | --- |
| **Aluno** | Ler tudo, reagir, comentar, fazer simulados |
| **Professor** | Tudo do aluno + publicar no mural, gerenciar conteúdo, criar simulados e questões |
| **Admin** | Controle total, incluindo criar usuários e resetar tentativas de simulados |

---

## Como funciona por baixo dos panos — visão técnica

Esta seção é voltada para desenvolvedores e colaboradores que precisam entender ou manter o projeto.

### Stack

O projeto é uma aplicação web estática com separação clara entre marcação, estilo e lógica. O front-end é composto por HTML, CSS e JavaScript puros, organizados em diretórios dedicados. O SDK do Supabase é importado via CDN a partir do `index.html`. Essa abordagem mantém o repositório simples e o deploy trivial em qualquer CDN estático.

```
Escolaecosistemadigital/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Deploy automático no push para main
├── assets/
│   ├── css/
│   │   └── style.css           # Estilos globais da aplicação
│   └── js/
│       └── main.js             # Lógica principal da aplicação
├── public/
│   └── images/
│       ├── favicon.ico         # Ícone do site
│       └── .gitkeep
├── src/
│   ├── components/
│   │   └── .gitkeep            # Componentes reutilizáveis (a popular)
│   └── pages/
│       └── .gitkeep            # Páginas da aplicação (a popular)
├── .gitignore
├── index.html                  # Ponto de entrada da SPA
└── README.md
```

### Serviços externos utilizados

O projeto depende de três serviços externos, todos com plano gratuito suficiente para turmas pequenas:

**Supabase** gerencia autenticação (e-mail + senha), banco de dados PostgreSQL com Row Level Security ativo em todas as tabelas, e a camada de Realtime via WebSocket para atualizações ao vivo no mural e nos comentários.

**Cloudinary** armazena todas as imagens (posts, avatares, questões, blocos de conteúdo). O front-end faz upload direto usando um preset não-assinado — o banco guarda apenas a URL `secure_url` retornada. Imagens nunca são armazenadas em base64 no banco.

**GitHub Pages** hospeda os arquivos estáticos. O workflow `.github/workflows/deploy.yml` usa `peaceiris/actions-gh-pages@v3` para publicar automaticamente a cada push na branch `main`.

### Banco de dados — tabelas principais

As tabelas centrais são:

`usuarios` · `publicacoes` · `reacoes` · `comentarios` · `curtidas_comentario` · `compartilhamentos` · `materiais` · `simulados` · `questoes` · `tentativas_simulado` · `logs` · `conteudo_abas` · `materias` · `sim_arquivos`

Dois pontos de atenção importantes para quem for trabalhar no banco:

A função `meu_role()` é usada por todas as policies de RLS para verificar o papel do usuário logado. Ela usa `SECURITY DEFINER` e `SET search_path = public` para evitar recursão circular — não remova essas configurações.

A view `questoes_sem_gabarito` expõe as questões sem o campo `correta`. Ela usa `WITH (security_invoker = true)` para que o RLS seja avaliado com as permissões do usuário que consulta, e não do criador da view. Alunos acessam questões exclusivamente por essa view — a tabela `questoes` em si bloqueia acesso de alunos via policy.

### Configuração das constantes

As variáveis de configuração ficam no topo do `main.js`, dentro de `assets/js/`:

```js
const SUPABASE_URL     = 'https://xxxx.supabase.co';
const SUPABASE_ANON    = 'sb_publishable_...';
const CLOUDINARY_CLOUD = 'nome-do-cloud';
const CLOUDINARY_PRESET= 'nome-do-preset';
const EMAIL_DOMAIN     = '@tropinha.local';
```

A chave `SUPABASE_ANON` é a chave pública (publishable) — é segura no front-end porque o RLS garante que cada usuário acessa apenas o que as policies permitem. Nunca use a `service_role` key no front-end nem a commite no repositório.

### Deploy

O deploy é 100% automático via GitHub Actions. Basta fazer push para `main`. Para que funcione, o repositório precisa ter **"Read and write permissions"** ativado em Settings → Actions → General, e o GitHub Pages configurado para **"Deploy from a branch → gh-pages"** em Settings → Pages.

### Criando usuários

Como o site é privado, usuários são criados pelo admin diretamente no painel do Supabase em **Authentication → Users**. O e-mail deve seguir o formato `apelido@tropinha.local` (ou o `EMAIL_DOMAIN` configurado). Um trigger no banco cria automaticamente a linha correspondente em `public.usuarios` — mas o admin deve ajustar `nome` e `role` manualmente via SQL depois.

---

*Tropinha — feito com 🐾 para quem estuda junto.*
