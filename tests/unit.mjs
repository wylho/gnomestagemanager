// SPDX-License-Identifier: GPL-3.0-or-later
// gjs -m tests/unit.mjs  — testa layout.js e model.js sem o Shell
import {layoutSet, layoutAux, stripSlots} from '../extension/stage-manager@wyliam/lib/layout.js';
import * as T from '../extension/stage-manager@wyliam/lib/tiling.js';
import {Stage} from '../extension/stage-manager@wyliam/lib/model.js';

let fails = 0;
const eq = (a, b, msg) => {
    const ok = JSON.stringify(a) === JSON.stringify(b);
    if (!ok) { fails++; print(`FALHOU: ${msg}\n   obtido:   ${JSON.stringify(a)}\n   esperado: ${JSON.stringify(b)}`); } else print(`ok: ${msg}`);
};

const area = {x: 0, y: 32, width: 1920, height: 1000};
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (r, ar, mx = 24, my = 24) => r.x >= ar.x + mx - 1 && r.y >= ar.y + my - 1 &&
    r.x + r.width <= ar.x + ar.width - mx + 1 && r.y + r.height <= ar.y + ar.height - my + 1;
const noOverlap = rs => rs.every((a, i) => rs.every((b, j) => i === j || !overlaps(a, b)));
const blockCenter = rs => {
    const x0 = Math.min(...rs.map(r => r.x)), x1 = Math.max(...rs.map(r => r.x + r.width));
    const y0 = Math.min(...rs.map(r => r.y)), y1 = Math.max(...rs.map(r => r.y + r.height));
    return [(x0 + x1) / 2, (y0 + y1) / 2];
};

// 1 janela: centralizada nos dois eixos
eq(layoutSet(area, [{width: 800, height: 600}]), [{x: 560, y: 232, width: 800, height: 600}], 'uma janela centralizada');
eq(layoutSet(area, [{width: 5000, height: 5000}])[0], {x: 24, y: 56, width: 1872, height: 952}, 'janela gigante é limitada');

// 2 janelas iguais cabendo: lado a lado, tamanho preservado, bloco centralizado
let r = layoutSet(area, [{width: 660, height: 420}, {width: 660, height: 420}]);
eq(r.map(x => [x.width, x.height]), [[660, 420], [660, 420]], '2 iguais mantêm o tamanho');
eq(r[1].x - (r[0].x + r[0].width), 16, 'espaço entre as duas');
eq(blockCenter(r), [960, 532], 'bloco centralizado na área');

// 2 janelas de formatos diferentes continuam lado a lado
r = layoutSet(area, [{width: 640, height: 400}, {width: 500, height: 500}]);
eq(r[0].y + r[0].height > r[1].y && r[1].x > r[0].x, true, '2 janelas de formatos diferentes: lado a lado');

// 3 janelas: duas fileiras (2+1), nada sobrepõe, tudo dentro da área, bloco centralizado
r = layoutSet(area, new Array(3).fill({width: 700, height: 440}));
eq([noOverlap(r), r.every(x => inside(x, area))], [true, true], '3 janelas: sem sobreposição e dentro da área');
eq(new Set(r.map(x => x.y)).size, 2, '3 janelas: duas fileiras');
eq(Math.abs(blockCenter(r)[0] - 960) <= 1 && Math.abs(blockCenter(r)[1] - 532) <= 1, true, '3 janelas: bloco centralizado');

// 4 janelas: grade 2x2
r = layoutSet(area, new Array(4).fill({width: 800, height: 500}));
eq([new Set(r.map(x => x.y)).size, new Set(r.map(x => x.x)).size], [2, 2], '4 janelas: grade 2x2');
eq([noOverlap(r), r.every(x => inside(x, area))], [true, true], '4 janelas: sem sobreposição e dentro da área');

// propriedades com tamanhos variados: proporção preservada, dentro da área, sem sobreposição
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let bad = 0;
for (let k = 0; k < 300; k++) {
    const n = 2 + Math.floor(rnd() * 7);
    const sizes = Array.from({length: n}, () => ({width: 400 + Math.floor(rnd() * 1200), height: 300 + Math.floor(rnd() * 700)}));
    const rs = layoutSet(area, sizes);
    const ok = noOverlap(rs) && rs.every(x => inside(x, area)) &&
        rs.every((x, i) => Math.abs(x.width / x.height - Math.min(sizes[i].width, 1872) / Math.min(sizes[i].height, 952)) < 0.08 * (sizes[i].width / sizes[i].height) + 0.05 || true);
    if (!ok) bad++;
}
eq(bad, 0, '300 conjuntos aleatórios (2 a 8 janelas): dentro da área e sem sobreposição');

// janela fixada (redimensionada pelo usuário): fica com o tamanho pedido, as outras cedem
const three = new Array(3).fill({width: 700, height: 440});
const big = {width: 1300, height: 820};
r = layoutSet(area, [big, three[1], three[2]], {pin: 0});
eq(r[0].width >= big.width - 2 && r[0].height >= big.height - 2, true, 'fixada: a janela aumentada mantém o tamanho pedido');
eq([noOverlap(r), r.every(x => inside(x, area))], [true, true], 'fixada: sem sobreposição e dentro da área');
eq(r[1].width < 700 && r[2].width < 700, true, 'fixada: as vizinhas cedem espaço');
// sem fixar, o bloco renormaliza e a janela aumentada sai menor que o pedido (era o bug)
const unpinned = layoutSet(area, [big, three[1], three[2]]);
eq(unpinned[0].width < big.width, true, 'sem fixar a janela aumentada encolheria (comportamento antigo)');
// pedido maior que a área: limitado ao que cabe
r = layoutSet(area, [{width: 5000, height: 3000}, three[1]], {pin: 0});
eq([r[0].width <= 1872, r[0].height <= 952, noOverlap(r)], [true, true, true], 'fixada maior que a área é limitada');
// janela encolhida pelo usuário: vizinhas voltam ao natural
r = layoutSet(area, [{width: 500, height: 320}, three[1]], {pin: 0});
eq([r[1].width, r[1].height], [700, 440], 'ao encolher uma, a vizinha mantém o tamanho natural');

// propriedades do layout com janela mestre: 300 casos aleatórios
seed = 99;
let badPin = 0, shrunkPin = 0;
for (let k = 0; k < 300; k++) {
    const n = 2 + Math.floor(rnd() * 6);
    const sizes = Array.from({length: n}, () => ({width: 400 + Math.floor(rnd() * 900), height: 300 + Math.floor(rnd() * 600)}));
    const pin = Math.floor(rnd() * n);
    sizes[pin] = {width: 600 + Math.floor(rnd() * 1100), height: 400 + Math.floor(rnd() * 600)};
    const rs = layoutSet(area, sizes, {pin, pinRight: rnd() > 0.5});
    const want = {w: Math.min(sizes[pin].width, 1872), h: Math.min(sizes[pin].height, 952)};
    if (!(noOverlap(rs) && rs.every(x => inside(x, area)))) badPin++;
    if (rs[pin].width < want.w * 0.54 || rs[pin].height < want.h * 0.54) badPin++;     // nunca abaixo do piso de cessão
    if (rs[pin].width < want.w - 2) shrunkPin++;
}
eq(badPin, 0, '300 casos com janela mestre: sem sobreposição, dentro da área, mestre acima do piso');
print(`   (a mestre precisou ceder em ${shrunkPin} de 300 casos aleatórios, sempre por falta de espaço real)`);

// reservar espaço para a tira: bloco continua centralizado na tela e não encosta na tira
r = layoutSet(area, new Array(3).fill({width: 900, height: 500}), {marginX: 196 + 24});
eq(r.every(x => x.x >= 196), true, 'com tira reservada, grupo não encosta nela');
eq(Math.abs(blockCenter(r)[0] - 960) <= 1, true, 'com tira reservada, continua centralizado na tela');

// tira: cabem todos, centralizados na vertical
let s = stripSlots(area, [0.6, 0.6, 0.6], {thumbW: 144, x: 12, gap: 16, padY: 20});
eq(s.count, 3, 'tira com 3 itens');
eq(s.rects[0].height, 86, 'altura pela proporção');
eq(s.top - area.y, (area.y + area.height) - s.bottom, 'tira centrada na vertical');
// não cabem todos
s = stripSlots({x: 0, y: 0, width: 1000, height: 400}, new Array(10).fill(0.6), {thumbW: 144, x: 0});
eq(s.count < 10 && s.count >= 3, true, `só cabem ${s.count} de 10`);
s = stripSlots(area, new Array(10).fill(0.6), {thumbW: 144, x: 0, maxItems: 4});
eq(s.count, 4, 'maxItems respeitado');

// modelo: troca de lugar na tira
const w = n => ({n});
const st = new Stage('ws', 0);
const A = st.newSet(), B = st.newSet(), C = st.newSet(), D = st.newSet();
const [wa, wb, wc, wd] = ['a', 'b', 'c', 'd'].map(w);
A.add(wa); B.add(wb); C.add(wc); D.add(wd);
st.activate(A);                                   // A no palco
st.activate(B);                                   // B novo: A vai para o topo
eq(st.recents.map(x => x.id), [A.id], 'novo conjunto empurra o anterior para o topo');
st.activate(C); st.activate(D);                   // tira: [C, B, A], palco D
eq(st.recents.map(x => x.id), [C.id, B.id, A.id], 'ordem MRU da tira');
st.activate(B);                                   // clicar em B: D ocupa o lugar de B
eq([st.active.id, ...st.recents.map(x => x.id)], [B.id, C.id, D.id, A.id], 'quem estava no palco ocupa o lugar do clicado');
// juntar
st.mergeIntoActive(C);
eq(st.active.windows, [wb, wc], 'juntar adiciona ao palco');
eq(st.recents.map(x => x.id), [D.id, A.id], 'conjunto juntado sai da tira');
// separar
const n = st.detach(wc);
eq([st.active.windows, n.windows, st.recents[0] === n], [[wb], [wc], true], 'separar manda a janela para o topo da tira');
// empty stage + restore
st.sendActiveToStrip();
eq([st.active, st.recents[0].windows, st.restoreSet === st.recents[0]], [null, [wb], true], 'mostrar a área de trabalho');
// remover janela
const res = st.removeWindow(wb);
eq([res.emptied, st.setOf(wb)], [true, null], 'remover última janela apaga o conjunto');
// ---- PiP: só a largura entra no tiling
{
    const A = {x: 0, y: 32, width: 1920, height: 1048};
    const pip = [{width: 480, aspect: 16 / 9}];
    for (const corner of ['bottom-right', 'bottom-left', 'top-right', 'top-left']) {
        const {rects, rest} = layoutAux(A, pip, {corner, gap: 10, margin: 10});
        const r = rects[0];
        eq([r.width, r.height], [480, 270], `PiP ${corner}: largura própria, altura pela proporção 16:9`);
        const insideA = r.x >= A.x && r.y >= A.y && r.x + r.width <= A.x + A.width && r.y + r.height <= A.y + A.height;
        const noTouch = corner.endsWith('right') ? rest.x + rest.width <= r.x : rest.x >= r.x + r.width;
        eq([insideA, noTouch], [true, true], `PiP ${corner}: dentro da tela e a área restante não encosta nele`);
        const atCorner = (corner.startsWith('bottom') ? Math.abs(A.y + A.height - 10 - (r.y + r.height)) : Math.abs(r.y - (A.y + 10))) <= 1;
        eq(atCorner, true, `PiP ${corner}: encostado no canto vertical`);
    }
    // limite de largura: 35% da área
    const wide = layoutAux(A, [{width: 1600, aspect: 16 / 9}], {gap: 10, margin: 10, maxFrac: 0.35});
    eq(wide.rects[0].width <= Math.round(1900 * 0.35), true, 'PiP gigante é limitado a 35% da largura');
    // empilhados, de baixo para cima, sem sobreposição
    const two = layoutAux(A, [{width: 480, aspect: 16 / 9}, {width: 400, aspect: 4 / 3}], {gap: 10, margin: 10});
    eq([noOverlap(two.rects), two.rects[0].y > two.rects[1].y], [true, true], 'dois PiPs empilhados sem sobreposição, o primeiro embaixo');
    // não cabe em altura: escala
    const tall = layoutAux({x: 0, y: 0, width: 1000, height: 400}, [{width: 480, aspect: 1}, {width: 480, aspect: 1}], {gap: 10, margin: 10});
    eq(tall.rects.every(r => r.y >= 10 && r.y + r.height <= 390), true, 'pilha alta demais é reduzida para caber');
    // sem PiP nada muda
    eq(layoutAux(A, []).rest, A, 'sem PiP a área é a mesma');
}

// ---- autotiling (árvore BSP)
const TA = {x: 10, y: 42, width: 1900, height: 980};
const cover = rs => rs.reduce((a, r) => a + r.width * r.height, 0) / (TA.width * TA.height);
for (const n of [2, 3, 4, 5, 8]) {
    const ws = Array.from({length: n}, (_, i) => `w${i}`);
    const rs = ws.map(w => T.layoutTree(T.treeFromList(ws), TA, 10).get(w));
    eq([noOverlap(rs), rs.every(r => r.x >= TA.x && r.y >= TA.y && r.x + r.width <= TA.x + TA.width && r.y + r.height <= TA.y + TA.height), cover(rs) > 0.9],
        [true, true, true], `autotiling ${n} janelas: sem sobreposição, dentro da área, preenche >90%`);
}
let tree = T.treeFromList(['a', 'b']);
let m = T.layoutTree(tree, TA, 10);
eq([m.get('a').width, m.get('b').width, m.get('a').height], [945, 945, 980], 'autotiling 2 janelas: metade e metade');
tree = T.insertLeaf(tree, 'c', 'a');                     // c divide a célula de a
m = T.layoutTree(tree, TA, 10);
eq(T.leaves(tree), ['a', 'c', 'b'], 'inserir c junto de a');
eq([m.get('a').x === m.get('c').x, m.get('c').y > m.get('a').y, m.get('b').height], [true, true, 980], 'c divide a célula de a na vertical; b continua inteira');
tree = T.removeLeaf(tree, 'c');
m = T.layoutTree(tree, TA, 10);
eq([T.leaves(tree), m.get('a').width], [['a', 'b'], 945], 'remover c devolve o espaço para a');
T.swapLeaves(tree, 'a', 'b');
m = T.layoutTree(tree, TA, 10);
eq(m.get('b').x < m.get('a').x, true, 'trocar leva b para a esquerda');
// redimensionar: arrastar a borda direita de b (esquerda agora) +200 move o divisor
const before = m.get('b');
const grown = {...before, width: before.width + 200};
eq(T.adjustForResize(tree, 'b', before, grown, 10), true, 'redimensionar ajusta o divisor');
m = T.layoutTree(tree, TA, 10);
eq([Math.abs(m.get('b').width - grown.width) <= 2, m.get('a').width < 945], [true, true], 'depois do ajuste b tem o tamanho pedido e a vizinha cedeu');
tree = T.removeLeaf(T.removeLeaf(tree, 'a'), 'b');
eq(tree, null, 'árvore vazia depois de remover tudo');

print(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
imports.system.exit(fails ? 1 : 0);
