import type { Site as SiteInstance } from "../globals/globals";
import { Conf, doc, g } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import { dict } from "../platform/helpers";
import SW from "./SW";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var Site = {
  defaultProperties: {
    '4chan.org':    {software: 'yotsuba'},
    '4channel.org': {canonical: '4chan.org'},
    '4cdn.org':     {canonical: '4chan.org'},
    'notso.smuglo.li': {canonical: 'smuglo.li'},
    'smugloli.net':    {canonical: 'smuglo.li'},
    'smug.nepu.moe':   {canonical: 'smuglo.li'}
  },

  init(cb: () => void) {
    $.extend(Conf['siteProperties'], Site.defaultProperties);
    let hostname = Site.resolve();
    if (hostname && $.hasOwn(SW, Conf['siteProperties'][hostname].software)) {
      this.set(hostname);
      cb();
    }
    $.onExists(doc, 'body', () => {
      for (var software in SW) {
        var changes;
        if (changes = (SW[software as keyof typeof SW] as any).detect?.()) {
          changes.software = software;
          hostname = location.hostname.replace(/^www\./, '');
          var properties = (Conf['siteProperties'][hostname] || (Conf['siteProperties'][hostname] = dict()));
          var changed = 0;
          for (var key in changes) {
            if (properties[key] !== changes[key]) {
              properties[key] = changes[key];
              changed++;
            }
          }
          if (changed) {
            $.set('siteProperties', Conf['siteProperties']);
          }
          if (!g.SITE) {
            this.set(hostname);
            cb();
          }
          return;
        }
      }
    });
  },

  resolve(url=location) {
    let {hostname} = url;
    while (hostname && !$.hasOwn(Conf['siteProperties'], hostname)) {
      hostname = hostname.replace(/^[^.]*\.?/, '');
    }
    if (hostname) {
      let canonical;
      if (canonical = Conf['siteProperties'][hostname].canonical) { hostname = canonical; }
    }
    return hostname;
  },

  parseURL(url: Location) {
    const siteID = Site.resolve(url);
    // g.sites is declared as Site[] in globals but is keyed by string siteID at runtime (shared-decl mismatch).
    return Main.parseURL((g.sites as unknown as Record<string, SiteInstance>)[siteID as string], url);
  },

  set(hostname: string) {
    for (var ID in Conf['siteProperties']) {
      var site;
      var properties = Conf['siteProperties'][ID];
      if (properties.canonical) { continue; }
      var {
        software
      } = properties;
      if (!software || !$.hasOwn(SW, software)) { continue; }
      // g.sites is declared as Site[] in globals but is keyed by string siteID at runtime (shared-decl mismatch).
      (g.sites as unknown as Record<string, SiteInstance>)[ID] = (site = Object.create(SW[software as keyof typeof SW]));
      $.extend(site, {ID, siteID: ID, properties, software});
    }
    return g.SITE = (g.sites as unknown as Record<string, SiteInstance>)[hostname];
  }
};
export default Site;
