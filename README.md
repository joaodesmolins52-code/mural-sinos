# O Som que Não Deveria Existir — Mural V2

Esta versão mantém a estética da versão que você aprovou e adiciona a camada de **mesa compartilhada**.

## O que já está implementado

### Mural
- pistas arrastáveis;
- linhas entre pistas;
- modo de conexão;
- zoom;
- busca;
- criar pista;
- editar anotação;
- excluir pistas criadas;
- posições sincronizáveis;
- conexões sincronizáveis;
- anotações das pistas sincronizáveis.

### Mesa
- login anônimo do Supabase;
- código da mesa;
- criação de mesa;
- entrada em mesa existente;
- nome de jogador;
- atualização em tempo real;
- contador de conexões e pistas.

### Conteúdo visual
- espaço preparado para artes de personagens;
- espaço preparado para fotos dos locais;
- objetos clicáveis no mural e em uma seção própria;
- documentos/handouts;
- linha temporal;
- notas colaborativas em personagens, locais e eventos.

### Som
- sons de interface gerados pelo navegador;
- música de fundo opcional em `assets/audio/ambient.mp3`;
- teste de áudio local pelo painel de ambiente.

## Antes de publicar

1. Crie um projeto gratuito no Supabase.
2. Em **Authentication → Sign In / Providers**, habilite **Anonymous Sign-Ins**.
3. Abra **SQL Editor**.
4. Cole e execute **todo** o `supabase.sql`.
5. Em **Project Settings → API**, copie:
   - Project URL
   - anon/public key
6. Cole os dois valores em `config.js`.
7. Suba a pasta inteira para um repositório do GitHub.
8. Ative GitHub Pages.

### Não faça isso
Nunca coloque a chave `service_role` no `config.js`.

A chave anon/public é própria para aplicativos no navegador, mas as regras de acesso precisam continuar sendo controladas por RLS no banco.

## GitHub Pages

O arquivo `index.html` está na raiz. Depois de ativar Pages usando a branch principal e a pasta `/root`, o site será publicado.

## Música

Coloque sua trilha em:

`assets/audio/ambient.mp3`

O navegador pode exigir uma interação antes de reproduzir áudio, então o painel possui controles manuais.

## Imagens

Os caminhos já estão preparados:

```text
assets/
├── characters/
│   ├── helena.webp
│   ├── elias.webp
│   └── marcados.webp
├── locations/
│   ├── praca-santa-cecilia.webp
│   ├── apartamento-18.webp
│   ├── tunel-ferroviario.webp
│   ├── escola-municipal.webp
│   └── torre-sem-nome.webp
├── objects/
├── documents/
└── audio/
    └── ambient.mp3
```

Se uma imagem ainda não existir, o site continua funcionando com o fundo estilizado.

## O que ainda não é a versão final

O banco já está preparado para arquivos e objetos, mas as artes reais, fotos e áudios ainda são placeholders/infraestrutura. Essa parte pode ser adicionada depois sem mudar a arquitetura principal.


### Correção recente
A chamada das funções RPC usa os nomes de parâmetros exatamente como definidos no `supabase.sql` (`p_display_name`).
