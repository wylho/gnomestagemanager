// SPDX-License-Identifier: GPL-3.0-or-later
// Modelo puro do palco e da tira (sem dependência do Shell): testável fora do GNOME.
// Janelas são identificadas por referência; qualquer objeto serve.

let nextId = 1;

/** Injetado pelo controlador: janelas auxiliares (PiP) nunca representam o conjunto na tira. */
export const aux = {is: () => false};

export class StageSet {
    constructor(stage) {
        this.id = nextId++;
        this.stage = stage;
        this.windows = [];
        this.arranged = false;   // já foi posicionado desde a última mudança de membros
        this.lastFocused = null;
        this.tree = null;        // árvore de autotiling (lib/tiling.js)
        this.tileRects = null;   // células da última disposição em autotiling: Map(win -> rect)
        this.pipCorner = null;   // canto escolhido para o PiP deste conjunto (null = o das preferências)
    }

    has(win) { return this.windows.includes(win); }

    add(win) {
        if (!this.has(win))
            this.windows.push(win);
        this.arranged = false;
    }

    remove(win) {
        const i = this.windows.indexOf(win);
        if (i >= 0)
            this.windows.splice(i, 1);
        if (this.lastFocused === win)
            this.lastFocused = null;
        this.arranged = false;
    }

    /** Janela que representa o conjunto na tira (a última em foco). */
    get top() {
        const real = w => !!w && !aux.is(w);
        if (real(this.lastFocused))
            return this.lastFocused;
        return this.windows.findLast(real) ?? this.lastFocused ?? this.windows.at(-1) ?? null;
    }
}

export class Stage {
    constructor(workspace, monitor) {
        this.workspace = workspace;
        this.monitor = monitor;
        this.active = null;      // conjunto no palco
        this.recents = [];       // conjuntos na tira, do topo para baixo
        this.restoreSet = null;  // conjunto que estava no palco antes de "mostrar a área de trabalho"
    }

    get sets() { return [this.active, ...this.recents].filter(Boolean); }

    setOf(win) { return this.sets.find(s => s.has(win)) ?? null; }

    newSet() { return new StageSet(this); }

    /**
     * Põe `set` no palco. Se ele vinha da tira, quem estava no palco ocupa o lugar dele
     * (como no macOS); se é um conjunto novo, quem estava no palco vai para o topo da tira.
     * @returns {StageSet|null} o conjunto que saiu do palco
     */
    activate(set) {
        const prev = this.active;
        if (prev === set)
            return prev;
        const i = this.recents.indexOf(set);
        if (i >= 0) {
            if (prev)
                this.recents[i] = prev;
            else
                this.recents.splice(i, 1);
        } else if (prev) {
            this.recents.unshift(prev);
        }
        this.active = set;
        this.restoreSet = null;
        return prev;
    }

    /** Junta `set` (da tira) ao conjunto do palco. */
    mergeIntoActive(set) {
        const a = this.active;
        if (!a || a === set) {
            this.activate(set);
            return set;
        }
        const i = this.recents.indexOf(set);
        if (i >= 0)
            this.recents.splice(i, 1);
        for (const w of set.windows)
            a.add(w);
        set.windows = [];
        this.restoreSet = null;
        return a;
    }

    /** Manda o conjunto do palco para o topo da tira, deixando o palco vazio. */
    sendActiveToStrip() {
        const a = this.active;
        if (!a)
            return null;
        this.recents.unshift(a);
        this.active = null;
        this.restoreSet = a;
        return a;
    }

    /** Tira `win` do conjunto e o devolve como conjunto próprio no topo da tira. */
    detach(win) {
        const s = this.setOf(win);
        if (!s)
            return null;
        if (s.windows.length < 2)
            return s;
        s.remove(win);
        const n = this.newSet();
        n.add(win);
        n.lastFocused = win;
        this.recents.unshift(n);
        return n;
    }

    removeSet(set) {
        if (this.active === set)
            this.active = null;
        const i = this.recents.indexOf(set);
        if (i >= 0)
            this.recents.splice(i, 1);
        if (this.restoreSet === set)
            this.restoreSet = null;
    }

    /** Remove `win`; apaga o conjunto se esvaziar. @returns {{set, emptied}|null} */
    removeWindow(win) {
        const s = this.setOf(win);
        if (!s)
            return null;
        s.remove(win);
        const emptied = s.windows.length === 0;
        if (emptied)
            this.removeSet(s);
        return {set: s, emptied};
    }
}
