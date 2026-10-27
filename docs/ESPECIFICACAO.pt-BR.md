# Organizador Visual (Stage Manager) no GNOME: especificação de comportamento

Base: documentação da Apple, análises (Ars Technica, MacStories, Six Colors, The Verge via
[Michael Tsai](https://mjtsai.com/blog/2022/10/25/stage-manager-in-macos-13-0)),
[Eclectic Light](https://eclecticlight.co/tag/stage-manager) e guias de uso.
Confiança: **A** = documentação oficial da Apple; **B** = vários veículos concordam;
**C** = fonte única, versão beta ou guia de terceiros (verificar ao testar).

Vocabulário (Eclectic Light): **Palco** (Stage) = centro da tela, onde ficam as janelas ativas.
**Elenco** (Cast) = coluna à esquerda com os conjuntos que não estão no palco.
Aqui, "tira" = a coluna da esquerda.

## 1. Modelo básico

| # | Comportamento | Conf. | Fonte |
|---|---|---|---|
| 1 | O app em uso fica no centro da tela; apps recentes ficam numa coluna à esquerda. | A | [Apple 102355](https://support.apple.com/102355) |
| 2 | As janelas do palco podem ser movidas, redimensionadas e sobrepostas livremente. O sistema não impõe tamanho, posição nem ordem de camadas. | A/B | Apple; Jason Snell (Six Colors) |
| 3 | A janela ativa abre centralizada, com espaço em volta; o usuário a expande para fora. | B | [MacMost](https://macmost.com/an-in-depth-look-at-macos-ventura-stage-manager.html) |
| 4 | **Cada app lembra o próprio tamanho**; os layouts de cada conjunto são lembrados. | B | MacMost; Eclectic Light |
| 5 | A tira mostra miniaturas **ao vivo** das janelas fora do palco (elas não são suspensas, continuam atualizando). | B | [Eclectic Light](https://eclecticlight.co/2022/09/12/why-venturas-stage-manager-is-so-important/) |
| 6 | Número de itens na tira depende do tamanho da tela (4 num MacBook Air, 6 num Studio Display; guias antigos citam 5). Ordem: mais recente primeiro. Não dá para reordenar nem redimensionar. | B/C | MacStories; Macworld |
| 7 | **Cada monitor tem seu palco e sua tira.** Cada Space (área de trabalho) tem seus próprios grupos. | B | Ars Technica; MacMost |

## 2. A tira (coluna da esquerda)

- Clicar numa miniatura **troca** o palco: o conjunto clicado entra, e o que estava no palco volta
  **para a mesma posição** da tira (B, Eclectic Light).
- **A tira se esconde quando uma janela é arrastada por cima dela** e volta quando o ponteiro encosta
  na borda esquerda (B, Ars Technica/MacStories). As janelas podem ser arrastadas até cobrir a
  tira (B, MacMost). **Isto contraria a ideia de reservar espaço (strut) para a tira**: a tira é
  uma camada flutuante, não uma área reservada.
- Opção "Mostrar apps recentes no Stage Manager": desligada, a tira some e só aparece quando o
  ponteiro vai à borda esquerda, como o auto-ocultar do Dock (A).
- Várias janelas do mesmo app formam uma **pilha**; clicar no ícone do app expande a pilha (B,
  MacStories). Clicar de novo no mesmo item cicla entre as janelas (C).
- Com o Dock à esquerda, a tira fica ao lado dele (B). Com o Dock embaixo (nosso caso), a tira
  ocupa a altura útil acima dele.
- Visual: miniatura com cantos arredondados e sombra; sem opções no botão direito, sem fechar app
  pela miniatura (C, Macworld de 2022; o macOS atual pode ter mudado).

## 3. Conjuntos (grupos)

- **Arrastar** uma miniatura da tira para o palco adiciona ao conjunto atual (A).
- **Shift + clique** numa miniatura da tira adiciona ao palco (B, MacStories).
- **Arrastar uma janela do palco para a tira** a remove do conjunto (A). Alternativa: menu
  Janela > "Remover Janela do Conjunto" (B).
- Clicar num conjunto na tira coloca **todas** as janelas dele no palco, mesmo de apps diferentes (A).
- Os conjuntos são lembrados entre sessões (B). Limite prático ~5 apps por conjunto (C).
- Queixas dos revisores (a evitar): só dá para montar conjunto arrastando; sem atalho de teclado
  nem menu de contexto; clicar leva a um palco novo quando se queria adicionar ao atual.

## 4. Configurações oficiais (A)

1. Stage Manager ligado/desligado (Central de Controle, Ajustes, ou ícone na barra de menus).
2. **Mostrar apps recentes** (fixa/auto-ocultar).
3. **Mostrar janelas de um aplicativo**:
   - *Todas de uma vez*: ao trocar para um app, todas as janelas dele vêm ao palco; janela nova
     abre no palco atual junto com as existentes.
   - *Uma de cada vez*: só a janela mais recente do app; clicar no app de novo cicla; **janela
     nova abre em palco próprio** e as demais vão para a tira.
4. **Clicar no papel de parede para mostrar a área de trabalho** (sempre / só com Stage Manager):
   empurra todas as janelas para a tira e revela os itens da mesa. Clicar de novo esconde (B).
5. Itens da mesa: mostrar na área de trabalho / no Stage Manager.
6. Atalho: não vem de fábrica; o usuário atribui em Teclado > Atalhos > Mission Control (A). A Apple
   não documenta atalhos de troca de conjunto (lacuna apontada por MacStories e Rui Carmo).

## 5. Interações com o resto do sistema

- **Command-Tab / Dock / Mission Control** continuam funcionando e trocam o palco ao ativar um
  item (B). Janela minimizada vai para a tira, não para o Dock (C).
- **Tela cheia** vira um Space próprio e o Stage Manager fica de fora (B).
- **Maximizar (botão verde)** ocupa a tela toda e some com a tira; ao restaurar, a tira volta (B,
  TechRepublic/ghacks).
- Abrir/guardar diálogos de arquivo mandando a janela ativa para a tira é um **defeito** relatado
  (MacStories, Eclectic Light); diálogos devem ficar junto da janela-mãe.
- Janelas "sempre à frente" e utilitários flutuantes se comportam mal (Eclectic Light): tratar
  como exceção, fora do gerenciamento.
- Animações: as janelas "voam" entre palco e tira; revisores acharam nervoso. O efeito some com
  "Reduzir movimento" (C). Deixar duração configurável.

## 6. Decisões de implementação no GNOME 50 (Wayland, Ubuntu 26.04)

| Tema | Decisão | Motivo |
|---|---|---|
| Tira | Camada flutuante (chrome) à esquerda, **sem reservar strut**; esconde quando uma janela é arrastada por cima; borda esquerda a revela | Fiel ao Mac (item 2) |
| Dock | Pensado para dock embaixo e tira à esquerda; a extensão não mexe na configuração do dock | Layout do projeto |
| Centralização | Ao entrar no palco, janelas são centralizadas no monitor (área útil) mantendo o tamanho lembrado; conjunto com várias janelas é centralizado como bloco | Itens 3 e 4 |
| Redimensionar/mover | Livre, como no Mac; opções de recentralizar após redimensionar e de manter sempre centralizada | Requisito "sempre centralizado" vs. item 2 |
| Maximizar | Esconde a tira enquanto maximizada; volta ao restaurar | Item 5 |
| Fora do palco | **Medido no GNOME 50**: janela minimizada continua recebendo quadros do compositor e o clone dela renderiza ao vivo. Então `minimize()` é usado, com a animação nativa voando até o item da tira (`set_icon_geometry`) | Item 5 da seção 1 |
| Modo padrão | "Uma de cada vez" (uma janela por palco); "Todas de uma vez" disponível | Seção 4 |
| Extras que a Apple não tem | Atalhos para trocar de conjunto, adicionar/remover do palco e ligar/desligar | Maior queixa dos revisores |
| Conflitos | Outros gerenciadores/tiling de janelas (ex.: `pop-shell`) disputam a posição das janelas e devem ficar desligados | Não destrutivo |

## Fontes

- Apple: [Organize your Mac desktop with Stage Manager](https://support.apple.com/102355),
  [Manual do macOS (Sequoia)](https://support.apple.com/en-euro/guide/mac-help/mchl534ba392/15/mac)
- [MacStories: macOS Ventura review](https://www.macstories.net/stories/macos-ventura-the-macstories-review/2/)
- [Michael Tsai: Stage Manager in macOS 13.0](https://mjtsai.com/blog/2022/10/25/stage-manager-in-macos-13-0)
  (reúne Ars Technica, Six Colors, The Verge, Eclectic Light)
- [MacMost: An In-Depth Look](https://macmost.com/an-in-depth-look-at-macos-ventura-stage-manager.html)
- [Macworld: first impressions](https://www.macworld.com/article/783033/stage-manager-macos-13-ventura-first-impressions.html)
- Eclectic Light: [Why Stage Manager is so important](https://eclecticlight.co/2022/09/12/why-venturas-stage-manager-is-so-important/),
  [Para os não impressionados 2](https://eclecticlight.co/2023/01/13/stage-manager-for-the-unimpressed-2-workflow-strategies/),
  [3](https://eclecticlight.co/2023/01/17/stage-manager-for-the-unimpressed-3-apps-and-windows/),
  [Stage Manager no log](https://eclecticlight.co/2023/01/19/how-stage-manager-works-in-the-log/)
- [Hexnode: chaves de preferência](https://www.hexnode.com/mobile-device-management/help/script-to-enable-disable-stage-manager-on-mac.md)
  (`GloballyEnabled`, `AutoHide`, `AppWindowGroupingBehavior`; não documentadas pela Apple)

Não consegui abrir (bloqueio 403): ghacks e TechRepublic (usei só os trechos citados em buscas).
A página de lançamento do Ventura na Newsroom da Apple deu 404.

## Decisões que surgiram na implementação

- **Mosaico** (3+ janelas): fileiras justificadas; testa todas as divisões (2+1, 2x2, 3+2...), mantém a proporção de cada janela,
  só encolhe se não couber, fileira curta cresce no máximo 30%, escolhe a divisão com mais área útil. Duas janelas ficam sempre lado a lado.
- **Autoajuste**: ao soltar o redimensionamento de uma janela do grupo, as vizinhas se acomodam; a janela guarda o tamanho pedido
  e as vizinhas voltam ao tamanho original quando sobra espaço. Modo "Livre" desliga isso.
- **Tirar/colocar fácil**: arrastar miniatura para o palco, Shift+clique, botão + no hover, atalhos; arrastar janela do grupo para a tira
  (com alvo visível mesmo se a tira estiver vazia); soltar uma janela sobre outra troca de lugar.
- **Monitores**: palco e tira por monitor; com `workspaces-only-on-primary=true` o secundário usa um palco único para todas as áreas.
- A tira não reserva espaço e fica ATRÁS das janelas (como no Mac): janela grande a corta. São duas tiras por monitor que nunca
  trocam de pai (reparentar no próprio evento derruba o Shell): uma dentro do grupo do papel de parede e outra na camada da frente,
  só visível ao encostar na borda (quando a de trás está coberta/oculta) ou como alvo de arrasto.
- **Redimensionar no mosaico**: a janela redimensionada vira "mestre" (mantém o tamanho pedido) e as outras se organizam em mosaico
  no espaço que sobra (coluna ao lado ou faixa embaixo). Antes o bloco era renormalizado e a janela aumentada podia sair menor.
- **Posição de janelas movidas à mão** é lembrada (consistente com o Mac); só centraliza o que o usuário não posicionou.
- **Autotiling opcional** (árvore BSP, estilo Pop Shell): grupos preenchem a tela, tira reservada à esquerda (ou escondida por opção).
- Dica: `org.gnome.mutter auto-maximize` (ligado por padrão no GNOME) maximiza sozinho janelas novas do tamanho do monitor; para evitar isso: `gsettings set org.gnome.mutter auto-maximize false`.
- **Picture-in-Picture**: reconhecido pelo título (padrões editáveis); janela auxiliar do conjunto em que aparece (some com ele, nunca
  representa o conjunto na tira). Só a largura participa do tiling: coluna no canto (4 cantos, por conjunto, arrastável) com altura pela
  proporção do vídeo; o restante da área é ladrilhado normalmente (autotiling ou mosaico).
- A cópia da tira na frente das janelas só existe quando a de trás está totalmente escondida; parcialmente coberta, usa-se a de trás.
- **Alt+Tab na ordem de uso**: o GNOME põe janelas visíveis antes das minimizadas no Alt+Tab; como o Organizador minimiza o que sai
  do palco, com dois monitores a janela do outro monitor passava à frente do app anterior. A extensão guarda a ordem de foco e a
  usa nas janelas de troca do Shell (`lib/alttab.js`); minimizar à mão ainda manda para o fim. Detalhes, testes e diagnóstico em
  [ALT-TAB.pt-BR.md](ALT-TAB.pt-BR.md).
