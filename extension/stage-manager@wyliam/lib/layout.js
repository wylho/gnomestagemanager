// SPDX-License-Identifier: GPL-3.0-or-later
// Geometria pura (sem dependência do Shell): testável fora do GNOME.

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Reparte `n` janelas em fileiras de no máximo `c`, o mais parelho possível (5 em 3 -> 3+2). */
export function splitRows(n, c) {
    const r = Math.ceil(n / c);
    const base = Math.floor(n / r);
    const extra = n % r;
    const rows = [];
    let k = 0;
    for (let i = 0; i < r; i++) {
        const m = base + (i < extra ? 1 : 0);
        rows.push(Array.from({length: m}, () => k++));
    }
    return rows;
}

/** Monta um mosaico de fileiras justificadas para uma divisão em fileiras. */
function evaluateRows(rows, nat, availW, availH, {gap, maxStretch, minWidth, aspect}) {
    const info = rows.map(idx => {
        const gaps = gap * (idx.length - 1);
        const ratios = idx.map(i => nat[i].w / nat[i].h);
        return {idx, gaps, ratios, sumR: ratios.reduce((a, b) => a + b, 0), natW: idx.reduce((a, i) => a + nat[i].w, 0) + gaps};
    });
    const blockW = Math.min(availW, Math.max(...info.map(r => r.natW)));
    for (const r of info) {
        r.w = Math.min(blockW, r.natW * maxStretch);          // fileira curta cresce um pouco, nunca além disso
        r.h = (r.w - r.gaps) / r.sumR;
    }
    const sumH = info.reduce((a, r) => a + r.h, 0);
    const vgaps = gap * (rows.length - 1);
    if (sumH + vgaps > availH) {
        const f = (availH - vgaps) / sumH;
        for (const r of info) {
            r.w = r.gaps + (r.w - r.gaps) * f;
            r.h *= f;
        }
    }
    let area = 0;
    let minW = Infinity;
    const cells = info.map(r => r.idx.map((i, k) => {
        const w = (r.w - r.gaps) * r.ratios[k] / r.sumR;
        area += w * r.h;
        minW = Math.min(minW, w);
        return {i, w, h: r.h};
    }));
    const penalty = minW < minWidth ? (minW / minWidth) ** 2 : 1;
    // Desempate: bloco com proporção parecida com a da tela (em tela larga, lado a lado).
    const blockH = info.reduce((a, r) => a + r.h, 0) + vgaps;
    const fit = 1 / (1 + 0.05 * Math.abs(Math.log(Math.max(...info.map(r => r.w)) / blockH / aspect)));
    return {info, cells, score: area * penalty * fit};
}

/**
 * Posiciona as janelas de um conjunto, centralizadas na área.
 *  - 1 janela: mantém o tamanho (só limita ao que cabe).
 *  - 2 ou mais: mosaico. Testa as divisões em fileiras (2 lado a lado, 2+1, 2x2, 3+2...), mantém a
 *    proporção de cada janela, só encolhe se não couber e escolhe a divisão com mais área útil.
 *    Fileiras curtas crescem um pouco (`maxStretch`) para o bloco ficar parelho.
 * @param {{x:number,y:number,width:number,height:number}} area área útil do monitor
 * @param {{width:number,height:number}[]} sizes tamanhos preferidos, na ordem do conjunto
 * @returns {{x:number,y:number,width:number,height:number}[]} na mesma ordem de `sizes`
 */
function layoutCore(area, sizes, opts = {}) {
    const {margin = 24, marginX = margin, marginY = margin, gap = 16, minWidth = 320, maxStretch = 1.3} = opts;
    const n = sizes.length;
    if (n === 0)
        return [];
    const availW = Math.max(1, area.width - 2 * marginX);
    const availH = Math.max(1, area.height - 2 * marginY);
    const nat = sizes.map(s => ({w: Math.max(1, Math.min(s.width, availW)), h: Math.max(1, Math.min(s.height, availH))}));

    if (n === 1) {
        const {w, h} = nat[0];
        return [{x: area.x + Math.round((area.width - w) / 2), y: area.y + Math.round((area.height - h) / 2), width: w, height: h}];
    }

    let best = null;
    // Duas janelas ficam sempre lado a lado; a partir de três, testa todas as divisões em fileiras.
    for (let c = (n === 2 && !opts.allowAll ? 2 : 1); c <= n; c++) {
        const cand = evaluateRows(splitRows(n, c), nat, availW, availH, {gap, maxStretch, minWidth, aspect: availW / availH});
        if (!best || cand.score > best.score * 1.0001)
            best = cand;
    }

    const totalH = best.info.reduce((a, r) => a + r.h, 0) + gap * (best.info.length - 1);
    let y = area.y + (area.height - totalH) / 2;
    const out = new Array(n);
    best.cells.forEach((row, ri) => {
        const rowW = best.info[ri].w;
        let x = area.x + (area.width - rowW) / 2;
        for (const c of row) {
            out[c.i] = {x: Math.round(x), y: Math.round(y), width: Math.floor(c.w), height: Math.floor(c.h)};
            x += c.w + gap;
        }
        y += best.info[ri].h + gap;
    });
    return out;
}

/**
 * Posições dos itens da tira, centralizados na vertical dentro da área útil.
 * Só entram os itens que cabem (ou até `maxItems`); `count` diz quantos.
 * @param {number[]} aspects altura/largura de cada item
 */
export function stripSlots(area, aspects, {thumbW, x, gap = 16, padY = 20, maxItems = 0}) {
    const heights = aspects.map(a => Math.round(thumbW * clamp(a, 0.5, 0.9)));
    const avail = area.height - 2 * padY;
    let count = 0;
    let used = 0;
    for (const h of heights) {
        const next = used + (count ? gap : 0) + h;
        if ((count > 0 && next > avail) || (maxItems && count >= maxItems))
            break;
        used = next;
        count++;
    }
    let y = area.y + Math.round((area.height - used) / 2);
    const rects = [];
    for (let i = 0; i < count; i++) {
        rects.push({x, y, width: thumbW, height: heights[i]});
        y += heights[i] + gap;
    }
    return {rects, count, top: rects.length ? rects[0].y : area.y, bottom: y - gap};
}

const bounds = rs => {
    const x0 = Math.min(...rs.map(r => r.x));
    const y0 = Math.min(...rs.map(r => r.y));
    return {x: x0, y: y0, width: Math.max(...rs.map(r => r.x + r.width)) - x0, height: Math.max(...rs.map(r => r.y + r.height)) - y0};
};

/**
 * Layout com uma janela "mestre" (a que o usuário acabou de redimensionar): ela fica com o tamanho pedido
 * (limitado ao que cabe) e as outras se organizam em mosaico no espaço que sobra, numa coluna ao lado
 * ou numa faixa embaixo (a que der janelas maiores), sem passar do tamanho natural delas. Só se o espaço
 * for realmente insuficiente a mestre cede um pouco.
 */
function layoutPinned(area, sizes, pin, opts) {
    const {margin = 24, marginX = margin, marginY = margin, gap = 16, pinRight = false} = opts;
    const availW = Math.max(1, area.width - 2 * marginX);
    const availH = Math.max(1, area.height - 2 * marginY);
    const idx = sizes.map((_, i) => i).filter(i => i !== pin);
    const natO = idx.map(i => sizes[i]);
    const natArea = natO.reduce((a, r) => a + r.width * r.height, 0);
    const want = {w: Math.min(sizes[pin].width, availW), h: Math.min(sizes[pin].height, availH)};
    const sub = {margin: 0, gap, maxStretch: 1, allowAll: true, minWidth: 200};

    const tryOrient = (kind, P) => {
        const R = kind === 'side'
            ? {x: 0, y: 0, width: availW - P.w - gap, height: availH}
            : {x: 0, y: 0, width: availW, height: availH - P.h - gap};
        if (R.width < 200 || R.height < 140)
            return null;
        const rs = layoutCore(R, natO, sub);
        const used = rs.reduce((a, r) => a + r.width * r.height, 0);
        return {kind, P, rs, bb: bounds(rs), ratio: used / natArea};
    };

    let best = null;
    for (let g = 1; g >= 0.55; g -= 0.05) {
        const P = {w: Math.round(want.w * g), h: Math.round(want.h * g)};
        const cands = [tryOrient('side', P), tryOrient('below', P)].filter(Boolean);
        for (const c of cands) {
            if (!best || c.ratio > best.ratio + 1e-6 || (g === 1 && !best.good && c.ratio >= 0.22))
                best = {...c, good: c.ratio >= 0.22};
        }
        if (best?.good)
            break;
    }
    if (!best)
        return null;

    const {kind, P, rs, bb} = best;
    const out = new Array(sizes.length);
    if (kind === 'side') {
        const blockW = P.w + gap + bb.width;
        const blockH = Math.max(P.h, bb.height);
        const x0 = area.x + (area.width - blockW) / 2;
        const y0 = area.y + (area.height - blockH) / 2;
        const pinX = pinRight ? x0 + bb.width + gap : x0;
        const colX = pinRight ? x0 : x0 + P.w + gap;
        out[pin] = {x: Math.round(pinX), y: Math.round(y0 + (blockH - P.h) / 2), width: P.w, height: P.h};
        idx.forEach((i, k) => {
            out[i] = {x: Math.round(colX + rs[k].x - bb.x), y: Math.round(y0 + (blockH - bb.height) / 2 + rs[k].y - bb.y), width: rs[k].width, height: rs[k].height};
        });
    } else {
        const blockW = Math.max(P.w, bb.width);
        const blockH = P.h + gap + bb.height;
        const x0 = area.x + (area.width - blockW) / 2;
        const y0 = area.y + (area.height - blockH) / 2;
        out[pin] = {x: Math.round(x0 + (blockW - P.w) / 2), y: Math.round(y0), width: P.w, height: P.h};
        idx.forEach((i, k) => {
            out[i] = {x: Math.round(x0 + (blockW - bb.width) / 2 + rs[k].x - bb.x), y: Math.round(y0 + P.h + gap + rs[k].y - bb.y), width: rs[k].width, height: rs[k].height};
        });
    }
    return out;
}

/**
 * Posiciona as janelas de um conjunto, centralizadas na área (ver `layoutCore`). Com `opts.pin`
 * (índice da janela que o usuário acabou de redimensionar) usa o layout com janela mestre, que mantém o
 * tamanho pedido: aumentar uma janela nunca a deixa menor.
 */
export function layoutSet(area, sizes, opts = {}) {
    const {pin} = opts;
    if (pin !== undefined && pin >= 0 && sizes.length >= 2) {
        const r = layoutPinned(area, sizes, pin, opts);
        if (r)
            return r;
    }
    return layoutCore(area, sizes, opts);
}

/**
 * Coluna do Picture-in-Picture: só a LARGURA entra no tiling. Cada PiP ganha sua largura (limitada a uma
 * fração da área) e a altura vem da proporção do vídeo; ficam empilhados no canto escolhido. O resto da
 * coluna não é ocupado por ninguém, e `rest` é a área que sobra para as demais janelas.
 * @param {{width:number, aspect:number}[]} pips largura preferida e proporção (largura/altura)
 * @param {{corner?:string, maxFrac?:number, gap?:number, margin?:number, innerMargin?:number, minWidth?:number}} opts
 * @returns {{rects: object[], rest: object}}
 */
export function layoutAux(area, pips, {corner = 'bottom-right', maxFrac = 0.35, gap = 16, margin = 24, innerMargin = margin, minWidth = 200} = {}) {
    if (!pips.length)
        return {rects: [], rest: area};
    const right = corner.endsWith('right');
    const bottom = corner.startsWith('bottom');
    const availW = Math.max(1, area.width - 2 * margin);
    const availH = Math.max(1, area.height - 2 * margin);
    const maxW = Math.max(minWidth, Math.round(availW * maxFrac));

    let widths = pips.map(p => clamp(Math.round(p.width), minWidth, maxW));
    let heights = widths.map((w, i) => Math.max(1, Math.round(w / pips[i].aspect)));
    const total = heights.reduce((a, b) => a + b, 0) + gap * (pips.length - 1);
    if (total > availH) {
        const f = (availH - gap * (pips.length - 1)) / heights.reduce((a, b) => a + b, 0);
        widths = widths.map(w => Math.max(1, Math.floor(w * f)));
        heights = heights.map(h => Math.max(1, Math.floor(h * f)));
    }
    const colW = Math.max(...widths);
    const colX = right ? area.x + area.width - margin - colW : area.x + margin;

    const rects = [];
    let y = bottom ? area.y + area.height - margin : area.y + margin;
    pips.forEach((_p, i) => {
        const w = widths[i];
        const h = heights[i];
        if (bottom)
            y -= h;
        rects.push({x: right ? colX + colW - w : colX, y, width: w, height: h});
        y += bottom ? -gap : h + gap;
    });

    // O que sobra para as outras janelas: tudo menos a coluna (e o espaçamento até ela).
    const used = colW + margin + gap - innerMargin;
    const rest = right
        ? {x: area.x, y: area.y, width: Math.max(1, area.width - used), height: area.height}
        : {x: area.x + used, y: area.y, width: Math.max(1, area.width - used), height: area.height};
    return {rects, rest};
}
