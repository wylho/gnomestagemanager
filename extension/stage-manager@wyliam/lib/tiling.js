// SPDX-License-Identifier: GPL-3.0-or-later
// Autotiling (árvore BSP, como no Pop Shell). Sem dependência do Shell: testável fora do GNOME.
// Cada nó é uma folha ({win}) ou uma divisão ({a, b, ratio, dir}); `dir` 'h' = lado a lado, 'v' = um sobre o outro.
import {clamp} from './layout.js';

export const isLeaf = n => !!n && 'win' in n;
const leaf = win => ({win});
const makeSplit = (a, b, ratio = 0.5) => ({a, b, ratio, dir: null, rect: null});

export function leaves(node, out = []) {
    if (!node)
        return out;
    if (isLeaf(node))
        out.push(node.win);
    else
        leaves(node.b, leaves(node.a, out));
    return out;
}

function findLeaf(node, win) {
    if (!node)
        return null;
    if (isLeaf(node))
        return node.win === win ? node : null;
    return findLeaf(node.a, win) ?? findLeaf(node.b, win);
}

/** Espiral clássica (dwindle): a primeira janela fica com a primeira metade, o resto divide a outra. */
export function treeFromList(wins) {
    if (!wins.length)
        return null;
    let t = leaf(wins.at(-1));
    for (let i = wins.length - 2; i >= 0; i--)
        t = makeSplit(leaf(wins[i]), t);
    return t;
}

/** A janela nova divide a célula de `near` (ou da última folha) em duas. */
export function insertLeaf(tree, win, near = null) {
    if (!tree)
        return leaf(win);
    const target = (near && findLeaf(tree, near)) ?? findLeaf(tree, leaves(tree).at(-1));
    const old = leaf(target.win);
    delete target.win;
    Object.assign(target, makeSplit(old, leaf(win)));
    return tree;
}

/** Remove a folha; a irmã ocupa o lugar da divisão. */
export function removeLeaf(tree, win) {
    const rec = node => {
        if (isLeaf(node))
            return node.win === win ? null : node;
        const a = rec(node.a);
        const b = rec(node.b);
        if (!a)
            return b;
        if (!b)
            return a;
        node.a = a;
        node.b = b;
        return node;
    };
    return tree ? rec(tree) : null;
}

export function swapLeaves(tree, w1, w2) {
    const n1 = findLeaf(tree, w1);
    const n2 = findLeaf(tree, w2);
    if (n1 && n2)
        [n1.win, n2.win] = [n2.win, n1.win];
}

/** Calcula a célula de cada janela em `rect`, com `gap` entre elas. Devolve Map(win -> rect). */
export function layoutTree(tree, rect, gap) {
    const out = new Map();
    const rec = (node, r) => {
        node.rect = r;
        if (isLeaf(node)) {
            out.set(node.win, r);
            return;
        }
        if (!node.dir)
            node.dir = r.width >= r.height ? 'h' : 'v';
        if (node.dir === 'h') {
            const wa = Math.round((r.width - gap) * node.ratio);
            rec(node.a, {x: r.x, y: r.y, width: wa, height: r.height});
            rec(node.b, {x: r.x + wa + gap, y: r.y, width: r.width - wa - gap, height: r.height});
        } else {
            const ha = Math.round((r.height - gap) * node.ratio);
            rec(node.a, {x: r.x, y: r.y, width: r.width, height: ha});
            rec(node.b, {x: r.x, y: r.y + ha + gap, width: r.width, height: r.height - ha - gap});
        }
    };
    if (tree)
        rec(tree, rect);
    return out;
}

function pathTo(node, win, path = []) {
    if (isLeaf(node))
        return node.win === win ? path : null;
    return pathTo(node.a, win, [...path, {node, branch: 'a'}]) ?? pathTo(node.b, win, [...path, {node, branch: 'b'}]);
}

/**
 * O usuário redimensionou `win` (de `oldR` para `newR`): move os divisores adjacentes às bordas que
 * mudaram, e as vizinhas se acomodam no próximo layout. Precisa de `layoutTree` já ter rodado (usa node.rect).
 * @returns {boolean} se algo mudou
 */
export function adjustForResize(tree, win, oldR, newR, gap, eps = 3) {
    const path = pathTo(tree, win);
    if (!path)
        return false;
    let changed = false;
    const nudge = (dir, branch, delta) => {
        if (Math.abs(delta) <= eps)
            return;
        for (let i = path.length - 1; i >= 0; i--) {
            const {node, branch: br} = path[i];
            if (node.dir !== dir || br !== branch)
                continue;
            const total = (dir === 'h' ? node.rect.width : node.rect.height) - gap;
            const cur = Math.round(total * node.ratio);
            node.ratio = clamp((cur + delta) / total, 0.12, 0.88);
            changed = true;
            return;
        }
    };
    nudge('h', 'a', (newR.x + newR.width) - (oldR.x + oldR.width));   // borda direita: divisor à direita
    nudge('h', 'b', newR.x - oldR.x);                                 // borda esquerda: divisor à esquerda
    nudge('v', 'a', (newR.y + newR.height) - (oldR.y + oldR.height)); // borda de baixo
    nudge('v', 'b', newR.y - oldR.y);                                 // borda de cima
    return changed;
}
