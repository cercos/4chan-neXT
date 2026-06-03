import Menu from './Menu';
import { Conf, g } from '../globals/globals';
import $ from '../platform/$';
import QuoteYou from '../Quotelinks/QuoteYou';
import SoundManager from '../Monitoring/SoundManager';
import ThreadUpdater from '../Monitoring/ThreadUpdater';
import Settings from '../General/Settings';

type Scope = 'post' | 'board';

interface ScopeTarget {
  boardID: string;
  threadID?: string | number;
  postID?: string | number;
}

const SoundLink = {
  init() {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu']) return;
    if (!Conf['Thread Updater']) return;
    SoundManager.init();

    SoundLink.addPostEntry();
  },

  addPostEntry() {
    const el = $.el('a', {
      className: 'sound-link sound-link-post',
      href: 'javascript:;',
      textContent: 'Sound (You-post)',
    });
    const entry: any = {
      el,
      order: 60,
      open(post: any) {
        if (!QuoteYou.isYou(post)) return false;
        const target: ScopeTarget = { boardID: post.boardID, threadID: post.threadID, postID: post.ID };
        const current = SoundManager.getPostOverride(target);
        entry.subEntries = SoundLink.buildSubEntries('post', target, current);
        return true;
      },
      subEntries: [] as any[],
    };
    Menu.menu.addEntry(entry);
  },

  buildSubEntries(scope: Scope, target: ScopeTarget, currentSoundId: string | undefined) {
    const subs: any[] = [];
    let order = 10;

    subs.push(SoundLink.makeOptionEntry({
      label: 'None (inherit)',
      soundId: null,
      isCurrent: currentSoundId == null,
      scope,
      target,
      order: order++,
    }));

    for (const lib of SoundManager.library()) {
      subs.push(SoundLink.makeOptionEntry({
        label: lib.name,
        soundId: lib.id,
        isCurrent: lib.id === currentSoundId,
        scope,
        target,
        order: order++,
      }));
    }

    subs.push(SoundLink.makeManageEntry(order++));
    return subs;
  },

  makeOptionEntry({
    label,
    soundId,
    isCurrent,
    scope,
    target,
    order,
  }: {
    label: string;
    soundId: string | null;
    isCurrent: boolean;
    scope: Scope;
    target: ScopeTarget;
    order: number;
  }) {
    const a = $.el('a', {
      href: 'javascript:;',
      textContent: (isCurrent ? '✓ ' : '  ') + label,
      className: 'entry sound-option' + (isCurrent ? ' current' : ''),
    });
    (a as HTMLElement).style.order = String(order);
    $.on(a, 'click', () => {
      SoundLink.applySelection(scope, target, soundId);
      if (soundId) {
        const entry = SoundManager.getEntry(soundId);
        if (entry?.data) ThreadUpdater.playSound(entry.data, false);
      }
      $.event('CloseMenu', null);
    });
    return { el: a };
  },

  makeManageEntry(order: number) {
    const a = $.el('a', {
      href: 'javascript:;',
      textContent: 'Manage sounds…',
      className: 'entry sound-manage',
    });
    (a as HTMLElement).style.order = String(order);
    $.on(a, 'click', () => {
      Settings.open('Advanced');
      $.event('CloseMenu', null);
    });
    return { el: a };
  },

  applySelection(scope: Scope, target: ScopeTarget, soundId: string | null) {
    switch (scope) {
      case 'post':
        SoundManager.setPostOverride(target as Required<ScopeTarget>, soundId);
        break;
      case 'board':
        SoundManager.setBoardOverride(target.boardID, soundId);
        break;
    }
  },
};

export default SoundLink;
