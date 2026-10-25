// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
export default async function (ctx) {
    Extension.lookupByUUID('stage-manager@wyliam').openPreferences();
    await ctx.sleep(4500);
    await ctx.shot('prefs-idioma');
}
