import { g } from "../../globals/globals";
import h from "../../globals/jsx";
import meta from '../../../package.json';
import Icon from '../../Icons/icon';

const settingsHtml = <div id="fourchanx-settings" class="dialog">
  <div class="settings-titlebar move">
    <span class="settings-title">{meta.name} Settings</span>
    <span class="settings-titlebar-actions">
      <a href="#" class="accordion-toggle" role="button" aria-pressed="false" aria-label="Accordion mode" title="Accordion: keep only one section open at a time">{Icon.raw('barsStaggered')}</a>
      <a href="#" class="expand-all" aria-label="Expand all sections" title="Expand all sections">{Icon.raw('squarePlus')}</a>
      <a href="#" class="collapse-all" aria-label="Collapse all sections" title="Collapse all sections">{Icon.raw('squareMinus')}</a>
      <a href="#" class="close" title="Close">✕</a>
    </span>
  </div>
  <div class="settings-body">
    <nav>
      <div class="settings-search">
        <input type="search" class="field" placeholder="Search" autocomplete="off" />
      </div>
      <div class="sections-list"></div>
    </nav>
    <div class="section-container"><section></section></div>
  </div>
  <div class="settings-footer">
    <div class="settings-actions">
      <a href="#" class="export">Export</a>
      <a href="#" class="import">Import</a>
      <a href="#" class="reset">Reset Settings</a>
      <label class="highlight-next-toggle" title={`Highlight settings ${meta.name} added or changed compared to 4chan-X. Added settings are marked green; changed defaults are marked amber.`}>
        <input id="settings-highlight-next" type="checkbox" autocomplete="off" />
        <span>Highlight neXT</span>
      </label>
      <label class="remember-layout-toggle" title="Remember dialog layout and section collapse state">
        <input id="settings-remember-layout" type="checkbox" autocomplete="off" />
        <span>Remember layout</span>
      </label>
      <input type="file" hidden accept=".json,application/json" />
    </div>
    <p class="imp-exp-result warning"></p>
    <div class="credits">
      <a href={meta.page} target="_blank">{meta.name}</a>
      <a href={meta.changelog} target="_blank">{g.VERSION}</a>
      <a href={meta.userGuide} target="_blank">User Guide</a>
      <a href={meta.issues} target="_blank">Issues</a>
    </div>
  </div>
</div>;

export default settingsHtml;
