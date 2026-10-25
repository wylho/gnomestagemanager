import Meta from 'gi://Meta';

let pipRegexes = [];

/** Define como reconhecer janelas Picture-in-Picture (padrões de título, sem diferenciar maiúsculas). */
export function setPipPatterns(patterns, enabled) {
    pipRegexes = !enabled ? [] : patterns.map(p => {
        try {
            return new RegExp(p, 'i');
        } catch (_e) {
            return null; // padrão inválido digitado nas preferências: ignora
        }
    }).filter(Boolean);
}

/** Janela de Picture-in-Picture (Firefox, Chrome...): reconhecida pelo título. */
export function isPip(win) {
    if (!win || !pipRegexes.length)
        return false;
    const title = win.get_title?.() ?? '';
    return !!title && pipRegexes.some(r => r.test(title));
}

/** Janela-mãe de uma janela transitória (diálogos acompanham a mãe; PiP é independente). */
export function rootOf(win) {
    let w = win;
    for (let i = 0; i < 8 && w.get_transient_for() && !isPip(w); i++)
        w = w.get_transient_for();
    return w;
}

/**
 * Janelas que o Organizador Visual gerencia: normais, sem mãe, de uma só área de trabalho (ou fixas
 * em todas, mas só quando `allowSticky`: monitor secundário com workspaces-only-on-primary).
 */
export function isManageable(win, excludedClasses = [], allowSticky = false) {
    if (!win || win.is_override_redirect())
        return false;
    if (isPip(win)) {
        // PiP: pode não aparecer na barra de tarefas e até ter janela-mãe, mas continua sendo uma janela do palco.
        const t = win.get_window_type();
        return (t === Meta.WindowType.NORMAL || t === Meta.WindowType.DIALOG || t === Meta.WindowType.UTILITY) &&
            !isExcluded(win, excludedClasses);
    }
    if (win.is_skip_taskbar())
        return false;
    if (win.is_on_all_workspaces() && !allowSticky)
        return false;
    if (win.get_window_type() !== Meta.WindowType.NORMAL || win.get_transient_for())
        return false;
    return !isExcluded(win, excludedClasses);
}

/** Classe (WM_CLASS / app-id) que identifica o aplicativo da janela nas exceções. */
export function classOf(win) {
    return win.get_wm_class() || win.get_sandboxed_app_id() || null;
}

export function isExcluded(win, excludedClasses) {
    return [win.get_wm_class(), win.get_sandboxed_app_id()].some(c => c && excludedClasses.includes(c));
}

/** Identifica o aplicativo da janela (para o modo "todas de uma vez"). */
export function appKeyOf(win) {
    return win.get_sandboxed_app_id() || win.get_wm_class() || `pid:${win.get_pid()}`;
}

const RESIZE_OPS = new Set(Object.keys(Meta.GrabOp).filter(k => k.includes('RESIZING')).map(k => Meta.GrabOp[k]));
const MOVE_OPS = new Set([Meta.GrabOp.MOVING, Meta.GrabOp.KEYBOARD_MOVING]);
export const isResizeOp = op => RESIZE_OPS.has(op);
export const isMoveOp = op => MOVE_OPS.has(op);
