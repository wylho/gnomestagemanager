// SPDX-License-Identifier: GPL-3.0-or-later
// Tradução (gettext) para os módulos que rodam dentro do GNOME Shell.
// O domínio vem de `gettext-domain` no metadata.json; os .mo ficam em locale/<idioma>/LC_MESSAGES/.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export const {gettext: _, ngettext} = Extension.defineTranslationFunctions(import.meta.url);
