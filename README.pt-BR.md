# Stage Manager (Organizador Visual) para o GNOME

O Organizador Visual do macOS para o GNOME Shell: **uma janela ou grupo centralizado no palco**, apps recentes numa **tira de
miniaturas ao vivo** ao lado, grupos montados por arrastar e soltar e um **autotiling opcional estilo Pop Shell**.
UUID da extensão: `stage-manager@wyliam`.

English: [README.md](README.md)

## O que faz

- **Palco e tira.** A janela ativa fica centralizada; o resto fica numa tira (à esquerda, por padrão) com miniaturas ao vivo e
  o ícone do app. Clicar numa miniatura troca o palco (a janela anterior ocupa o lugar dela), com a animação nativa de minimizar.
- **Grupos.** Arraste a miniatura para o palco, **Shift+clique** ou o botão **+** da miniatura. Para tirar, arraste a janela para a
  tira (aparece um alvo mesmo com a tira vazia) ou use o atalho.
- **Mosaico** (padrão): 2 janelas lado a lado, 3 ou mais em fileiras justificadas mantendo a proporção de cada uma. Redimensionar
  mantém o tamanho pedido e as outras abrem espaço; soltar uma janela sobre outra troca as duas.
- **Autotiling** (opção, como o Pop Shell): as janelas do palco preenchem a tela em árvore; redimensionar move o divisor; soltar sobre
  outra troca as duas. Margem e espaçamento configuráveis; a tira pode ficar sempre visível ou se esconder.
- **Manter sempre centralizada** (opção): a janela (ou o grupo) volta ao centro ao soltar/redimensionar. Sem isso, a janela que você
  moveu à mão fica onde você a deixou.
- **Tira atrás das janelas**, como no Mac: janela grande a cobre/corta; ao estar totalmente escondida, encoste na borda para trazê-la.
- **Picture-in-Picture** (Firefox, Chrome): entra no grupo do palco em que aparece e some com ele. Só a largura entra no tiling; a
  altura vem da proporção do vídeo, no canto escolhido (arraste para mudar).
- **Exceções**: escolha uma janela aberta com o mouse (como no Pop Shell), alterne por atalho ou pelo menu da tira. O GNOME Sushi é
  ignorado por padrão.
- **Menu de contexto da tira** (botão direito): trazer ao palco, adicionar ao grupo, trazer só uma janela, separar, nova janela, fechar,
  sair do app, mover para outro monitor/área de trabalho, autotiling, reorganizar, mostrar a área de trabalho, ignorar app, preferências.
- Clicar no papel de parede mostra a área de trabalho; palco por monitor e por área de trabalho; tira com auto-ocultar; botão nas
  Configurações Rápidas.
- Traduzido em 8 idiomas.

## Requisitos

GNOME Shell **50** (desenvolvido e testado no Ubuntu 26.04, Wayland) e `glib-compile-schemas` (pacote `libglib2.0-bin`).

## Instalação

```bash
git clone https://github.com/wylho/gnomestagemanager.git
cd gnomestagemanager
./install.sh                           # copia para ~/.local/share/gnome-shell/extensions (não habilita nada)
# saia e entre na sessão (no Wayland só assim o GNOME descobre extensões novas), depois:
gnome-extensions enable stage-manager@wyliam
```

Dicas: dock embaixo (`gsettings set org.gnome.shell.extensions.dash-to-dock dock-position BOTTOM`); impedir que o GNOME maximize
janelas novas sozinho (`gsettings set org.gnome.mutter auto-maximize false`); desligar outros gerenciadores de janelas/tiling (ex.: Pop Shell).

## Atalhos (configuráveis nas Preferências)

| Ação | Padrão |
|---|---|
| Ligar/desligar o Organizador Visual | Super+Alt+S |
| Ligar/desligar o autotiling | Super+Alt+T |
| Trocar para o conjunto mais recente da tira | Super+Alt+Cima |
| Adicionar o conjunto mais recente ao palco | Super+Alt+Direita |
| Tirar a janela em foco do grupo | Super+Alt+Esquerda |
| Reorganizar / centralizar o grupo | Super+Alt+R |
| Mostrar a área de trabalho | Super+Alt+D |
| Escolher uma janela a ignorar (mouse) | Super+Alt+E |
| Ignorar / gerenciar de novo o app em foco | Super+Alt+X |

## Traduções

Inglês (base) mais português do Brasil, espanhol, francês, alemão, russo, italiano, chinês simplificado e japonês (`po/*.po`).
**As traduções foram feitas com apoio de IA e não foram revisadas por falantes nativos**: correções são muito bem-vindas.
Veja os comandos em [README.md](README.md#translations).

## Desenvolvimento

`sandbox/` roda um GNOME Shell isolado (sem tela) com roteiros que simulam mouse e teclado e salvam capturas, sem precisar sair da
sessão: `sandbox/preview.sh interact`, `tests/run-all.sh`. A pesquisa sobre o comportamento do macOS está em
[docs/ESPECIFICACAO.pt-BR.md](docs/ESPECIFICACAO.pt-BR.md). Os comentários do código estão em português.

## Limitações

Os grupos não persistem entre reinicializações; código novo de extensão em uso só carrega depois de sair e entrar na sessão; janelas
que não podem ser minimizadas ficam visíveis.

## Licença

Copyright (C) 2026 wylho. Licenciado sob a **GNU General Public License, versão 3 ou (a seu critério) qualquer versão
posterior** (`GPL-3.0-or-later`); veja [LICENSE](LICENSE). Contribuições são aceitas sob a mesma licença.
