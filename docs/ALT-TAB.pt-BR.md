# Alt+Tab na ordem de uso com vários monitores

## O problema

Com o Organizador Visual ligado e dois monitores, um toque no Alt+Tab não voltava para o app usado por último.
Ele ia para o app que estava na tela do outro monitor. Na prática, o Alt+Tab parecia alternar primeiro entre os
monitores e só depois seguir a ordem de uso.

Exemplo (monitor 0 com Calendário e Chat; monitor 1 com Navegador, Editor e Terminal; nos dois só uma janela fica
no palco, as outras são minimizadas pelo Organizador):

| Passo | O que o Alt+Tab mostrou | Ordem de uso de verdade |
|---|---|---|
| Editor → Navegador (mon 1) | Navegador, **Chat**, Editor, Terminal | Navegador, **Editor**, Terminal, Chat |

Um toque levava ao Chat (visível no monitor 0), não ao Editor, que tinha acabado de ser usado.

## A causa

O GNOME 50 monta o Alt+Tab com duas listas, e as duas põem **janelas visíveis antes das minimizadas**:

- `Meta.Display.get_tab_list()` (mutter): ordem de foco, mas as minimizadas vão para o fim.
- `Shell.AppSystem.get_running()` / `Shell.App.get_windows()` (Shell): apps com janela visível vêm antes.

O Organizador Visual minimiza as janelas que saem do palco. Com **um monitor**, a única janela visível é a focada,
então a regra não aparece. Com **dois monitores**, cada um tem uma janela visível no palco, e a do outro monitor
fica sempre em segundo lugar, à frente do app que você acabou de deixar (que foi minimizado ao sair do palco).

## A correção

Arquivo: [`extension/stage-manager@wyliam/lib/alttab.js`](../extension/stage-manager@wyliam/lib/alttab.js)
(classe `AltTabOrder`, ligada e desligada junto com o Organizador em `lib/manager.js`).

- A extensão guarda a ordem real de foco das janelas (`notify::focus-window`).
- O foco só é contado onde ele para (no próximo ciclo ocioso). Ao trocar de palco, o mutter pode focar outra
  janela por um instante antes da nova; essa janela "de passagem" não sobe no Alt+Tab.
- Só enquanto as janelas de troca do Shell se montam (`AppSwitcherPopup`, `WindowSwitcherPopup`,
  `WindowCyclerPopup`, `GroupCyclerPopup`), as três funções acima devolvem a lista nessa ordem. Fora disso nada
  muda, e nenhum outro uso delas (dock, outras extensões) é afetado.
- Minimizar uma janela **à mão** continua mandando ela para o fim do Alt+Tab, como no Windows e no GNOME.
  Só as minimizações feitas pelo Organizador são ignoradas.
- Desligar o Organizador devolve as funções originais do Shell.

Resultado: Alt+Tab (apps), Super+Tab (janelas), Alt+Esc e Alt+\` seguem a ordem de uso, como o Alt+Tab do
Windows e o Command-Tab do macOS, com qualquer número de monitores.

## Como testar

Sandbox (sem sair da sessão), dois monitores com um app em cada:

```bash
SANDBOX_ONLY_PRIMARY=false sandbox/run-shell.sh sandbox/scenarios/alttab.js 70 1920x1080,1280x720 stage-manager@wyliam
```

Com `SANDBOX_SEM_CORRECAO=1` o mesmo roteiro roda com a ordem do GNOME e falha nos passos 3, 5 e 6, o que mostra
o defeito. Com a correção, todos passam.

Outros roteiros: `sandbox/scenarios/alttab-real.js` usa apps reais (Caracteres, Calculadora, Relógios), e com
`SANDBOX_X11=1` a Calculadora abre via XWayland, como o Chrome, o Figma e o Steam. A variável `SANDBOX_X11=1` em
`sandbox/run-shell.sh` liga o Xwayland no sandbox (por padrão ele só roda apps Wayland).

## Como diagnosticar na sessão real

[`tools/alttab-log.js`](../tools/alttab-log.js) registra o que acontece no Alt+Tab da sessão real, sem instalar
nada e sem sair da sessão:

1. Alt+F2, digite `lg`, Enter (Looking Glass, aba Evaluator).
2. Rode: `await import('file:///<caminho do projeto>/tools/alttab-log.js')`
3. Use o computador normalmente. O registro vai para `~/.cache/alttab-log.txt`.
4. Para parar: `altTabLogStop()` no mesmo lugar (sair da sessão também para).

A cada Alt+Tab ele grava a ordem que a janela de troca mostrou, a ordem do GNOME e do mutter, cada troca de foco,
cada minimizar/restaurar, se o Organizador estava mexendo, o monitor de cada janela e se o app é X11.
O arquivo traz nomes e títulos de janelas: não anexe em issue sem revisar.
