import DogiriPage from './QR/Dogiri.html';
import $ from '../platform/$';
import Notice from '../classes/Notice';
import { VideoStripper } from './VideoStripper';
import { Conf, d, doc } from '../globals/globals';
import { AUDIO_BPS, EXPORT_CANCELLED, exportClips, exportSettings, exportSignature, fitSettings, type DogiriExportJob, type ExportQuality, type RenderQuality } from './DogiriExport';
import {
  addCaption, addRegion, applyProject, CAPTION_LINE_HEIGHT, CAPTION_MAX_WIDTH_FRACTION,
  captionBlockTop, captionLaneLevels, captionsAt, commitHistory, createHistory, createState,
  formatTime, freeCaptionY, inRegion, keepRegions, mergeRegions,
  moveCaption, moveCaptionEdge, moveRegionEdge, moveRegionFree, nearestIndex, nextRegionStart,
  parseTime, POSITION_PRESETS, redo as redoHistory, removeCaption, removeRegion, removeRegions, resetState, serializeProject,
  setCaptionY, settleRegion, SIZE_FRACTIONS, snapshot, totalClipped, undo as undoHistory,
  updateCaption, wrapCaptionLines,
  type CaptionPosition, type CaptionSize, type DogiriCaption, type DogiriHistory, type DogiriProject,
  type DogiriSnapshot, type DogiriState,
} from './DogiriState';

const ADD_CAPTION_LABEL = '+ Add caption';

const TIMELINE_HEIGHTS: Record<string, number> = { small: 62, medium: 86, large: 110 };

type TimelineDrag =
  | { kind: 'seek' }
  | { kind: 'edge', id: number, edge: 'start' | 'end' }
  | { kind: 'move', id: number, offset: number };

type LaneDrag =
  | { kind: 'range', anchor: number }
  | { kind: 'cap-move', id: number, offset: number, downX: number, moved: boolean }
  | { kind: 'cap-edge', id: number, edge: 'start' | 'end' };

const Dogiri = {
  nodes: null as {
    el: HTMLDivElement,
    filename: HTMLSpanElement,
    duration: HTMLSpanElement,
    reset: HTMLAnchorElement,
    save: HTMLAnchorElement,
    projects: HTMLAnchorElement,
    savePanel: HTMLDivElement,
    saveName: HTMLInputElement,
    saveOk: HTMLAnchorElement,
    saveCancel: HTMLAnchorElement,
    projectsMenu: HTMLDivElement,
    relink: HTMLInputElement,
    close: HTMLAnchorElement,
    resize: HTMLDivElement,
    video: HTMLVideoElement,
    previewBox: HTMLDivElement,
    captionOverlay: HTMLDivElement,
    toasts: HTMLDivElement,
    play: HTMLAnchorElement,
    time: HTMLSpanElement,
    stripAudio: HTMLAnchorElement,
    captionsToggle: HTMLAnchorElement,
    clipList: HTMLAnchorElement,
    clipPanel: HTMLDivElement,
    clipsAll: HTMLInputElement,
    clipsCount: HTMLSpanElement,
    clipRows: HTMLDivElement,
    clipsDelete: HTMLAnchorElement,
    clipsKeep: HTMLAnchorElement,
    clipsMerge: HTMLAnchorElement,
    clipsClose: HTMLAnchorElement,
    addClip: HTMLAnchorElement,
    clipTimes: HTMLSpanElement,
    clipStart: HTMLInputElement,
    clipEnd: HTMLInputElement,
    captionEditor: HTMLDivElement,
    captionText: HTMLInputElement,
    captionPosition: HTMLSelectElement,
    captionSize: HTMLSelectElement,
    addCaption: HTMLAnchorElement,
    captionRemove: HTMLAnchorElement,
    timeline: HTMLDivElement,
    strip: HTMLCanvasElement,
    regions: HTMLDivElement,
    playhead: HTMLDivElement,
    scrubHandle: HTMLDivElement,
    regionMenu: HTMLDivElement,
    regionMenuLabel: HTMLSpanElement,
    regionMenuRm: HTMLAnchorElement,
    captionLane: HTMLDivElement,
    playClips: HTMLAnchorElement,
    stats: HTMLSpanElement,
    quality: HTMLSelectElement,
    fitRow: HTMLLabelElement,
    fitTarget: HTMLInputElement,
    exportOptions: HTMLAnchorElement,
    exportMenu: HTMLDivElement,
    timelineSize: HTMLSelectElement,
    filmstrip: HTMLInputElement,
    deleteOriginal: HTMLInputElement,
    cancel: HTMLAnchorElement,
    render: HTMLAnchorElement,
    exportGroup: HTMLSpanElement,
    export: HTMLAnchorElement,
    exportArrow: HTMLAnchorElement,
    exportTargetMenu: HTMLDivElement,
    confirm: HTMLDivElement,
    confirmText: HTMLDivElement,
    confirmRememberRow: HTMLLabelElement,
    confirmRemember: HTMLInputElement,
    confirmOk: HTMLAnchorElement,
    confirmAlt: HTMLAnchorElement,
    confirmCancel: HTMLAnchorElement,
  } | null,
  state: null as DogiriState | null,
  history: createHistory() as DogiriHistory,
  gestureSnapshot: null as DogiriSnapshot | null,
  measureCtx: null as CanvasRenderingContext2D | null,
  stripToken: 0,
  stripCache: [] as { time: number, height: number, canvas: HTMLCanvasElement }[],
  stripSource: null as { video: HTMLVideoElement, url: string, ready: Promise<boolean> } | null,
  stripFillTimer: 0,
  resizeDrag: null as { startX: number, startWidth: number } | null,
  fingerprintPromise: null as Promise<string> | null,
  fingerprint: '',
  pendingProject: null as DogiriProject | null,
  relinkProject: null as DogiriProject | null,
  autosaveTimer: 0,
  lastAutosaveSignature: '',
  currentProjectName: '',
  sessionAcknowledged: false,
  objectURL: '',
  fileSize: 0,
  rafId: 0,
  editingCaptionId: 0,
  // Dropdown value when editing started; used to tell "user changed it" from "left as-is".
  editingInitialPosition: 'bottom' as CaptionPosition,
  selectedRegionId: 0,
  checkedClipIds: new Set<number>(),
  dragTarget: null as TimelineDrag | null,
  // Seek that landed in a gap during clips-only playback; applied on pointer up.
  pendingClipSeek: null as number | null,
  laneDrag: null as LaneDrag | null,
  overlayDrag: null as { id: number, grabOffset: number } | null,
  // Range swept out on the caption lane, not yet turned into a caption.
  pendingRange: null as { start: number, end: number } | null,
  playingClips: false,
  audioStripped: false,
  hasAudio: true,
  maxSize: 0,
  file: null as File | null,
  exportJob: null as DogiriExportJob | null,
  // Finished render plus the edit-state signature it was made from, to detect staleness.
  lastExport: null as { file: File, signature: string } | null,
  onExportDone: null as ((exported: File, keepOriginal: boolean) => void) | null,
  confirmResolve: null as ((choice: 'ok' | 'alt' | false) => void) | null,
  fileSwapped: false,
  // Per-quality size-estimate correction learned from finished renders; session copy wins over stored.
  calibration: {} as Record<string, number>,
  persistentCalibration: {} as Record<string, number>,
  exportTarget: 'qr' as 'qr' | 'file',

  open(file: File, opts?: {
    audioStripped?: boolean,
    originalFile?: File,
    maxSize?: number,
    onExportDone?: (exported: File, keepOriginal: boolean) => void,
  }) {
    if (Dogiri.nodes) { Dogiri.close(); }
    Dogiri.audioStripped = !!opts?.audioStripped;
    // Edit the pre-strip original when we have it, so keeping audio is still possible.
    Dogiri.file = (opts?.audioStripped && opts?.originalFile) || file;
    Dogiri.maxSize = opts?.maxSize || 0;
    Dogiri.onExportDone = opts?.onExportDone || null;
    Dogiri.calibration = {};
    $.get('Dogiri Calibration', {}, (item: any) => {
      Dogiri.persistentCalibration = item['Dogiri Calibration'] || {};
      Dogiri.renderStats();
    });
    $.get('Dogiri Size', {}, (item: any) => {
      const width = +item['Dogiri Size']?.width;
      if (width) { Dogiri.applyDialogWidth(width); }
    });
    const el = $.el('div', { id: 'dogiri', innerHTML: DogiriPage }) as HTMLDivElement;
    const node = (query: string) => $(query, el) as any;
    Dogiri.nodes = {
      el,
      filename: node('#dogiri-filename'),
      duration: node('#dogiri-duration'),
      reset: node('#dogiri-reset'),
      save: node('#dogiri-save'),
      projects: node('#dogiri-projects'),
      savePanel: node('#dogiri-save-panel'),
      saveName: node('#dogiri-save-name'),
      saveOk: node('#dogiri-save-ok'),
      saveCancel: node('#dogiri-save-cancel'),
      projectsMenu: node('#dogiri-projects-menu'),
      relink: node('#dogiri-relink'),
      close: node('#dogiri-close'),
      resize: node('#dogiri-resize'),
      video: node('#dogiri-video'),
      previewBox: node('#dogiri-preview-box'),
      captionOverlay: node('#dogiri-caption-overlay'),
      toasts: node('#dogiri-toasts'),
      play: node('#dogiri-play'),
      time: node('#dogiri-time'),
      stripAudio: node('#dogiri-strip-audio'),
      captionsToggle: node('#dogiri-captions-toggle'),
      clipList: node('#dogiri-clip-list'),
      clipPanel: node('#dogiri-clip-panel'),
      clipsAll: node('#dogiri-clips-all'),
      clipsCount: node('#dogiri-clips-count'),
      clipRows: node('#dogiri-clip-rows'),
      clipsDelete: node('#dogiri-clips-delete'),
      clipsKeep: node('#dogiri-clips-keep'),
      clipsMerge: node('#dogiri-clips-merge'),
      clipsClose: node('#dogiri-clips-close'),
      addClip: node('#dogiri-add-clip'),
      clipTimes: node('#dogiri-clip-times'),
      clipStart: node('#dogiri-clip-start'),
      clipEnd: node('#dogiri-clip-end'),
      captionEditor: node('#dogiri-caption-editor'),
      captionText: node('#dogiri-caption-text'),
      captionPosition: node('#dogiri-caption-position'),
      captionSize: node('#dogiri-caption-size'),
      addCaption: node('#dogiri-add-caption'),
      captionRemove: node('#dogiri-caption-remove'),
      timeline: node('#dogiri-timeline'),
      strip: node('#dogiri-strip-canvas'),
      regions: node('#dogiri-regions'),
      playhead: node('#dogiri-playhead'),
      scrubHandle: node('#dogiri-scrub-handle'),
      regionMenu: node('#dogiri-region-menu'),
      regionMenuLabel: node('#dogiri-region-menu-label'),
      regionMenuRm: node('#dogiri-region-menu-rm'),
      captionLane: node('#dogiri-caption-lane'),
      playClips: node('#dogiri-play-clips'),
      stats: node('#dogiri-stats'),
      quality: node('#dogiri-quality'),
      fitRow: node('#dogiri-fit-row'),
      fitTarget: node('#dogiri-fit-target'),
      exportOptions: node('#dogiri-export-options'),
      exportMenu: node('#dogiri-export-menu'),
      timelineSize: node('#dogiri-timeline-size'),
      filmstrip: node('#dogiri-filmstrip'),
      deleteOriginal: node('#dogiri-delete-original'),
      cancel: node('#dogiri-cancel'),
      render: node('#dogiri-render'),
      exportGroup: node('#dogiri-export-group'),
      export: node('#dogiri-export'),
      exportArrow: node('#dogiri-export-arrow'),
      exportTargetMenu: node('#dogiri-export-target-menu'),
      confirm: node('#dogiri-confirm'),
      confirmText: node('#dogiri-confirm-text'),
      confirmRememberRow: node('#dogiri-confirm-remember-row'),
      confirmRemember: node('#dogiri-confirm-remember'),
      confirmOk: node('#dogiri-confirm-ok'),
      confirmAlt: node('#dogiri-confirm-alt'),
      confirmCancel: node('#dogiri-confirm-cancel'),
    };
    const { nodes } = Dogiri;

    Dogiri.fileSize = Dogiri.file.size;
    nodes.filename.textContent = `${file.name} (${$.bytesToString(Dogiri.fileSize)})`;

    Dogiri.setFingerprintSource(Dogiri.file);
    $.on(nodes.close,          'click', Dogiri.close);
    $.on(nodes.cancel,         'click', Dogiri.close);
    $.on(nodes.reset,          'click', Dogiri.onReset);
    $.on(nodes.save,           'click', Dogiri.onSaveClick);
    $.on(nodes.saveOk,         'click', Dogiri.onSaveConfirm);
    $.on(nodes.saveCancel,     'click', () => { if (Dogiri.nodes) { Dogiri.nodes.savePanel.hidden = true; } });
    $.on(nodes.saveName,       'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter') { return; }
      e.preventDefault();
      e.stopPropagation();
      Dogiri.onSaveConfirm();
    });
    $.on(nodes.projects,       'click', Dogiri.onProjectsClick);
    $.on(nodes.relink,         'change', Dogiri.onRelinkPicked);
    $.on(nodes.play,           'click', Dogiri.togglePlay);
    $.on(nodes.video,          'click', Dogiri.togglePlay);
    $.on(nodes.playClips,      'click', Dogiri.playClipsOnly);
    $.on(nodes.stripAudio,     'click', Dogiri.toggleStripAudio);
    $.on(nodes.captionsToggle, 'click', Dogiri.toggleCaptions);
    $.on(nodes.clipList,       'click', Dogiri.toggleClipPanel);
    $.on(nodes.clipsAll,       'change', Dogiri.onClipsAllChange);
    $.on(nodes.clipsDelete,    'click', () => Dogiri.onClipsBulk('delete'));
    $.on(nodes.clipsKeep,      'click', () => Dogiri.onClipsBulk('keep'));
    $.on(nodes.clipsMerge,     'click', () => Dogiri.onClipsBulk('merge'));
    $.on(nodes.clipsClose,     'click', Dogiri.hideClipPanel);
    $.on(nodes.regionMenuRm,   'click', Dogiri.removeSelectedRegion);
    $.on(nodes.addClip,        'click', Dogiri.onAddRegion);
    for (const edge of ['start', 'end'] as const) {
      const input = edge === 'start' ? nodes.clipStart : nodes.clipEnd;
      $.on(input, 'blur', () => Dogiri.onClipTimeCommit(edge));
      $.on(input, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Enter') { return; }
        e.preventDefault();
        e.stopPropagation();
        Dogiri.onClipTimeCommit(edge);
        input.select();
      });
    }
    $.on(nodes.addCaption,     'click', Dogiri.onAddCaption);
    $.on(nodes.captionRemove,  'click', Dogiri.onRemoveEditedCaption);
    $.on(nodes.captionText,    'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter') { return; }
      e.preventDefault();
      e.stopPropagation();
      Dogiri.onAddCaption();
    });
    $.on(nodes.render,         'click', Dogiri.onRenderClick);
    $.on(nodes.export,         'click', () => Dogiri.onSend(Dogiri.exportTarget));
    $.on(nodes.exportArrow,    'click', () => {
      const n = Dogiri.nodes;
      if (!n || Dogiri.exportJob) { return; }
      n.exportTargetMenu.hidden = !n.exportTargetMenu.hidden;
      n.exportMenu.hidden = true;
      n.exportOptions.classList.remove('dogiri-pressed');
    });
    for (const item of Array.from(nodes.exportTargetMenu.querySelectorAll('.dogiri-menu-item'))) {
      $.on(item as HTMLElement, 'click', () => {
        const n = Dogiri.nodes;
        if (!n) { return; }
        Dogiri.exportTarget = (item as HTMLElement).dataset.target as 'qr' | 'file';
        n.exportTargetMenu.hidden = true;
        Dogiri.refreshOutputButtons();
      });
    }
    $.on(nodes.exportOptions,  'click', () => {
      const menu = Dogiri.nodes?.exportMenu;
      const button = Dogiri.nodes?.exportOptions;
      if (!menu || !button) { return; }
      menu.hidden = !menu.hidden;
      button.classList.toggle('dogiri-pressed', !menu.hidden);
      if (Dogiri.nodes) { Dogiri.nodes.exportTargetMenu.hidden = true; }
    });
    $.on(nodes.confirmOk,      'click', () => Dogiri.resolveConfirm('ok'));
    $.on(nodes.confirmAlt,     'click', () => Dogiri.resolveConfirm('alt'));
    $.on(nodes.confirmCancel,  'click', () => Dogiri.resolveConfirm(false));
    $.on(nodes.quality,        'change', Dogiri.onQualityChange);
    nodes.fitTarget.value = String(Dogiri.maxSize
      ? Math.round((Dogiri.maxSize / 1048576) * 100) / 100
      : 4);
    $.get('Dogiri Fit Target', 0, (item: any) => {
      const stored = +item['Dogiri Fit Target'];
      if (stored > 0 && Dogiri.nodes) {
        Dogiri.nodes.fitTarget.value = String(stored);
        Dogiri.renderStats();
      }
    });
    $.on(nodes.fitTarget,      'input', () => {
      const n = Dogiri.nodes;
      if (!n) { return; }
      const value = parseFloat(n.fitTarget.value);
      if (value > 0) { $.set('Dogiri Fit Target', value); }
      Dogiri.renderStats();
    });
    nodes.timelineSize.value = TIMELINE_HEIGHTS[Conf['Dogiri Timeline Size'] as string] ? Conf['Dogiri Timeline Size'] as string : 'small';
    nodes.filmstrip.checked = !!Conf['Dogiri Filmstrip'];
    Dogiri.applyTimelineSize();
    $.on(nodes.timelineSize,   'change', () => {
      const n = Dogiri.nodes;
      if (!n) { return; }
      Conf['Dogiri Timeline Size'] = n.timelineSize.value;
      $.set('Dogiri Timeline Size', n.timelineSize.value);
      Dogiri.applyTimelineSize();
      Dogiri.buildFilmstrip();
    });
    $.on(nodes.filmstrip,      'change', () => {
      const n = Dogiri.nodes;
      if (!n) { return; }
      Conf['Dogiri Filmstrip'] = n.filmstrip.checked;
      $.set('Dogiri Filmstrip', n.filmstrip.checked);
      Dogiri.buildFilmstrip();
    });
    $.on(nodes.video,          'loadedmetadata', Dogiri.onMetadata);
    $.on(nodes.resize,         'pointerdown', Dogiri.onResizePointerDown);
    $.on(nodes.resize,         'pointermove', Dogiri.onResizePointerMove);
    $.on(nodes.resize,         'pointerup',   Dogiri.onResizePointerUp);
    $.on(nodes.resize,         'pointercancel', Dogiri.onResizePointerUp);
    window.addEventListener('resize', Dogiri.onWindowResize);
    $.on(nodes.timeline,       'pointerdown', Dogiri.onTimelinePointerDown);
    $.on(nodes.timeline,       'pointermove', Dogiri.onTimelinePointerMove);
    $.on(nodes.timeline,       'pointerup',   Dogiri.onTimelinePointerUp);
    $.on(nodes.timeline,       'pointercancel', Dogiri.onTimelinePointerUp);
    $.on(nodes.captionLane,    'pointerdown', Dogiri.onLanePointerDown);
    $.on(nodes.captionLane,    'pointermove', Dogiri.onLanePointerMove);
    $.on(nodes.captionLane,    'pointerup',   Dogiri.onLanePointerUp);
    $.on(nodes.captionLane,    'pointercancel', Dogiri.onLanePointerUp);
    $.on(nodes.captionOverlay, 'pointerdown', Dogiri.onOverlayPointerDown);
    $.on(nodes.captionOverlay, 'pointermove', Dogiri.onOverlayPointerMove);
    $.on(nodes.captionOverlay, 'pointerup',   Dogiri.onOverlayPointerUp);
    $.on(nodes.captionOverlay, 'pointercancel', Dogiri.onOverlayPointerUp);
    // Capture phase so Esc reaches Dogiri before the page's own handlers.
    d.addEventListener('keydown', Dogiri.onKeydown, true);
    // Toolbar buttons are javascript: anchors; keep them from navigating.
    $.on(el, 'click', (e: Event) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href^="javascript:"]');
      if (anchor) { e.preventDefault(); }
    });

    Dogiri.objectURL = URL.createObjectURL(Dogiri.file);
    nodes.video.src = Dogiri.objectURL;

    $.add(d.body, el);
    $.addClass(doc, 'dogiri-open');
    Dogiri.startLoop();
  },

  close() {
    if (!Dogiri.nodes) { return; }
    Dogiri.autosaveTick();
    clearInterval(Dogiri.autosaveTimer);
    Dogiri.autosaveTimer = 0;
    Dogiri.exportJob?.cancel();
    Dogiri.resolveConfirm(false);
    cancelAnimationFrame(Dogiri.rafId);
    d.removeEventListener('keydown', Dogiri.onKeydown, true);
    Dogiri.nodes.video.pause();
    $.rm(Dogiri.nodes.el);
    $.rmClass(doc, 'dogiri-open');
    URL.revokeObjectURL(Dogiri.objectURL);
    window.removeEventListener('resize', Dogiri.onWindowResize);
    clearTimeout(Dogiri.stripFillTimer);
    Dogiri.stripFillTimer = 0;
    Dogiri.stripToken++;
    if (Dogiri.stripSource) {
      Dogiri.stripSource.video.removeAttribute('src');
      Dogiri.stripSource.video.load();
      URL.revokeObjectURL(Dogiri.stripSource.url);
      Dogiri.stripSource = null;
    }
    Dogiri.stripCache = [];
    Dogiri.resizeDrag = null;
    Dogiri.fingerprintPromise = null;
    Dogiri.fingerprint = '';
    Dogiri.pendingProject = null;
    Dogiri.relinkProject = null;
    Dogiri.lastAutosaveSignature = '';
    Dogiri.currentProjectName = '';
    Dogiri.sessionAcknowledged = false;
    Dogiri.fileSwapped = false;
    Dogiri.nodes = null;
    Dogiri.state = null;
    Dogiri.history = createHistory();
    Dogiri.gestureSnapshot = null;
    Dogiri.objectURL = '';
    Dogiri.fileSize = 0;
    Dogiri.editingCaptionId = 0;
    Dogiri.selectedRegionId = 0;
    Dogiri.checkedClipIds = new Set();
    Dogiri.dragTarget = null;
    Dogiri.pendingClipSeek = null;
    Dogiri.laneDrag = null;
    Dogiri.overlayDrag = null;
    Dogiri.pendingRange = null;
    Dogiri.playingClips = false;
    Dogiri.audioStripped = false;
    Dogiri.hasAudio = true;
    Dogiri.maxSize = 0;
    Dogiri.file = null;
    Dogiri.lastExport = null;
    Dogiri.onExportDone = null;
    Dogiri.calibration = {};
    Dogiri.exportTarget = 'qr';
  },

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      if (Dogiri.confirmResolve) {
        Dogiri.resolveConfirm(false);
        return;
      }
      const { nodes } = Dogiri;
      if (nodes && (e.target === nodes.clipStart || e.target === nodes.clipEnd)) {
        Dogiri.updateClipInputs(true);
        (e.target as HTMLInputElement).blur();
        return;
      }
      if (nodes && (!nodes.savePanel.hidden || !nodes.projectsMenu.hidden || !nodes.clipPanel.hidden)) {
        nodes.savePanel.hidden = true;
        nodes.projectsMenu.hidden = true;
        Dogiri.hideClipPanel();
        return;
      }
      Dogiri.close();
      return;
    }
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable) { return; }
    if (Dogiri.confirmResolve) { return; }
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const handled = () => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        handled();
        if (e.shiftKey) { Dogiri.onRedo(); } else { Dogiri.onUndo(); }
      } else if (key === 'y' && !e.shiftKey) {
        handled();
        Dogiri.onRedo();
      }
      return;
    }
    if (e.altKey) { return; }
    switch (e.key) {
      case ' ':          handled(); Dogiri.togglePlay(); break;
      case 'ArrowLeft':  handled(); Dogiri.seekBy(e.shiftKey ? -5 : -1); break;
      case 'ArrowRight': handled(); Dogiri.seekBy(e.shiftKey ? 5 : 1); break;
      case ',':          handled(); nodes.video.pause(); Dogiri.seekBy(-1 / 30); break;
      case '.':          handled(); nodes.video.pause(); Dogiri.seekBy(1 / 30); break;
      case 'Home':       handled(); nodes.video.currentTime = 0; break;
      case 'End':        handled(); nodes.video.currentTime = state.duration; break;
    }
  },

  seekBy(delta: number) {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    nodes.video.currentTime =
      Math.min(Math.max(nodes.video.currentTime + delta, 0), state.duration);
  },

  onUndo() {
    const { state } = Dogiri;
    if (!state || !undoHistory(Dogiri.history, state)) { return; }
    Dogiri.afterHistoryRestore();
  },

  onRedo() {
    const { state } = Dogiri;
    if (!state || !redoHistory(Dogiri.history, state)) { return; }
    Dogiri.afterHistoryRestore();
  },

  afterHistoryRestore() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    nodes.video.muted = state.stripAudio;
    Dogiri.refreshStripAudioButton();
    if (Dogiri.editingCaptionId && !state.captions.some(caption => caption.id === Dogiri.editingCaptionId)) {
      Dogiri.stopEditingCaption();
    }
    Dogiri.renderRegions();
    Dogiri.renderCaptions();
  },

  askChoice(
    message: string, okLabel: string,
    opts?: { altLabel?: string, remember?: boolean, anchor?: 'top' | 'bottom' },
  ): Promise<'ok' | 'alt' | false> {
    const { nodes } = Dogiri;
    if (!nodes) { return Promise.resolve(false); }
    Dogiri.resolveConfirm(false);
    nodes.confirm.classList.toggle('dogiri-confirm-top', opts?.anchor === 'top');
    nodes.confirmText.textContent = message;
    nodes.confirmOk.textContent = okLabel;
    nodes.confirmAlt.hidden = !opts?.altLabel;
    nodes.confirmAlt.textContent = opts?.altLabel || '';
    nodes.confirmRememberRow.hidden = !opts?.remember;
    nodes.confirmRemember.checked = false;
    nodes.confirm.hidden = false;
    return new Promise(resolve => { Dogiri.confirmResolve = resolve; });
  },

  askConfirm(
    message: string, okLabel: string,
    opts?: { remember?: boolean, anchor?: 'top' | 'bottom' },
  ): Promise<boolean> {
    return Dogiri.askChoice(message, okLabel, opts).then(choice => choice === 'ok');
  },

  resolveConfirm(choice: 'ok' | 'alt' | false) {
    const resolve = Dogiri.confirmResolve;
    Dogiri.confirmResolve = null;
    if (Dogiri.nodes) { Dogiri.nodes.confirm.hidden = true; }
    resolve?.(choice);
  },

  notify(type: 'info' | 'warning' | 'error' | 'success', text: string, seconds: number) {
    const { nodes } = Dogiri;
    if (!nodes) {
      new Notice(type, text, seconds);
      return;
    }
    const toast = $.el('div', { className: `dogiri-toast ${type}`, textContent: text });
    $.on(toast, 'click', () => $.rm(toast));
    $.add(nodes.toasts, toast);
    setTimeout(() => $.rm(toast), seconds * 1000);
  },

  onMetadata() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    Dogiri.state = createState(nodes.video.duration);
    Dogiri.history = createHistory();
    nodes.duration.textContent = formatTime(Dogiri.state.duration);
    const media = nodes.video as any;
    if (typeof media.mozHasAudio === 'boolean') {
      Dogiri.hasAudio = media.mozHasAudio;
    } else if (media.audioTracks && typeof media.audioTracks.length === 'number') {
      Dogiri.hasAudio = media.audioTracks.length > 0;
    } else if (Dogiri.file) {
      const file = Dogiri.file;
      VideoStripper.hasAudioTrack(file).then(hasAudio => {
        if (hasAudio == null || hasAudio === Dogiri.hasAudio || Dogiri.file !== file) { return; }
        Dogiri.hasAudio = hasAudio;
        Dogiri.refreshStripAudioButton();
        Dogiri.renderStats();
      });
    }
    const pending = Dogiri.pendingProject;
    if (pending) {
      Dogiri.pendingProject = null;
      Dogiri.applyLoadedProject(pending);
    }
    Dogiri.refreshStripAudioButton();
    Dogiri.renderRegions();
    Dogiri.buildFilmstrip();
    clearInterval(Dogiri.autosaveTimer);
    Dogiri.autosaveTimer = window.setInterval(() => Dogiri.autosaveTick(), 5000);
    if (!pending) { Dogiri.maybeOfferAutosaveRestore(); }
  },

  stateIsPristine(): boolean {
    const { state } = Dogiri;
    return !state || (
      !state.captions.length && !state.stripAudio &&
      state.regions.length === 1 &&
      state.regions[0].start === 0 && state.regions[0].end === state.duration
    );
  },

  autosaveTick() {
    const { nodes, state, file, fingerprint } = Dogiri;
    if (!nodes || !state || !file || !fingerprint || !Conf['Dogiri Autosave']) { return; }
    if (Dogiri.stateIsPristine()) { return; }
    const project = serializeProject(
      state, 'Autosave', Date.now(),
      { name: file.name, size: file.size, fingerprint },
      nodes.quality.value,
    );
    project.restored = Dogiri.sessionAcknowledged;
    const signature = JSON.stringify(
      [project.regions, project.captions, project.stripAudio, project.quality, project.restored]);
    if (signature === Dogiri.lastAutosaveSignature) { return; }
    Dogiri.lastAutosaveSignature = signature;
    $.get('Dogiri Autosaves', {}, (item: any) => {
      const all = item['Dogiri Autosaves'] || {};
      all[fingerprint] = project;
      const keys = Object.keys(all).sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0));
      for (const key of keys.slice(10)) { delete all[key]; }
      $.set('Dogiri Autosaves', all);
    });
  },

  maybeOfferAutosaveRestore() {
    if (!Conf['Dogiri Autosave']) { return; }
    const file = Dogiri.file;
    if (!file) { return; }
    Dogiri.fingerprintPromise?.then(fingerprint => {
      if (!fingerprint || Dogiri.file !== file) { return; }
      $.get('Dogiri Autosaves', {}, async (item: any) => {
        const saved = item['Dogiri Autosaves']?.[fingerprint];
        if (!saved || Dogiri.file !== file || !Dogiri.nodes || Dogiri.pendingProject) { return; }
        if (saved.restored) {
          Dogiri.applyLoadedProject(saved);
          return;
        }
        const ok = await Dogiri.askConfirm(
          `You have unsaved Dōgiri edits for this video from ${new Date(saved.savedAt).toLocaleString()}. Restore them?`,
          'Restore',
          { anchor: 'top' },
        );
        if (!ok || Dogiri.file !== file || !Dogiri.nodes) { return; }
        Dogiri.applyLoadedProject(saved);
      });
    });
  },

  setFingerprintSource(file: File) {
    Dogiri.fingerprint = '';
    const promise = Dogiri.fingerprintFile(file);
    Dogiri.fingerprintPromise = promise;
    promise.then(fingerprint => {
      if (Dogiri.fingerprintPromise === promise) { Dogiri.fingerprint = fingerprint; }
    });
  },

  async fingerprintFile(file: File): Promise<string> {
    try {
      const head = await file.slice(0, 1 << 20).arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', head);
      const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      return `${file.size}-${hex}`;
    } catch {
      return '';
    }
  },

  projectBaseName(): string {
    return Dogiri.file?.name.replace(/\.[^.]*$/, '') || 'Untitled';
  },

  onReset() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const before = snapshot(state);
    resetState(state);
    commitHistory(Dogiri.history, before, state);
    Dogiri.currentProjectName = '';
    Dogiri.lastExport = null;
    Dogiri.lastAutosaveSignature = '';
    Dogiri.fingerprintPromise?.then(fingerprint => {
      if (!fingerprint) { return; }
      $.get('Dogiri Autosaves', {}, (item: any) => {
        const all = item['Dogiri Autosaves'] || {};
        if (!all[fingerprint]) { return; }
        delete all[fingerprint];
        $.set('Dogiri Autosaves', all);
      });
    });
    Dogiri.stopEditingCaption();
    nodes.video.muted = false;
    Dogiri.refreshStripAudioButton();
    Dogiri.renderRegions();
    Dogiri.renderCaptions();
  },

  onSaveClick() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    nodes.projectsMenu.hidden = true;
    nodes.exportMenu.hidden = true;
    nodes.exportTargetMenu.hidden = true;
    Dogiri.hideClipPanel();
    nodes.savePanel.hidden = !nodes.savePanel.hidden;
    if (nodes.savePanel.hidden) { return; }
    if (!nodes.saveName.value.trim()) {
      nodes.saveName.value = Dogiri.currentProjectName || Dogiri.projectBaseName();
    }
    nodes.saveName.focus();
    nodes.saveName.select();
  },

  async onSaveConfirm() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    const name = nodes.saveName.value.trim() || Dogiri.projectBaseName();
    await Dogiri.saveProjectAs(name);
    if (Dogiri.nodes) { Dogiri.nodes.savePanel.hidden = true; }
  },

  saveProjectAs(name: string): Promise<void> {
    const { nodes, state, file } = Dogiri;
    if (!nodes || !state || !file) { return Promise.resolve(); }
    return Dogiri.fingerprintPromise!.then(fingerprint => new Promise(resolve => {
      const project = serializeProject(
        state, name, Date.now(),
        { name: file.name, size: file.size, fingerprint: fingerprint || '' },
        nodes.quality.value,
      );
      $.get('Dogiri Projects', {}, (item: any) => {
        const all = item['Dogiri Projects'] || {};
        all[name] = project;
        $.set('Dogiri Projects', all);
        Dogiri.currentProjectName = name;
        Dogiri.sessionAcknowledged = true;
        Dogiri.notify('success', `Dōgiri project "${name}" saved.`, 3);
        resolve();
      });
    }));
  },

  onProjectsClick() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    nodes.savePanel.hidden = true;
    nodes.exportMenu.hidden = true;
    nodes.exportTargetMenu.hidden = true;
    Dogiri.hideClipPanel();
    if (!nodes.projectsMenu.hidden) {
      nodes.projectsMenu.hidden = true;
      return;
    }
    $.get('Dogiri Projects', {}, (item: any) => {
      Dogiri.renderProjectsMenu(item['Dogiri Projects'] || {});
      if (Dogiri.nodes) { Dogiri.nodes.projectsMenu.hidden = false; }
    });
  },

  renderProjectsMenu(all: Record<string, DogiriProject>) {
    const menu = Dogiri.nodes?.projectsMenu;
    if (!menu) { return; }
    menu.textContent = '';
    const projects = Object.values(all).sort((a, b) => b.savedAt - a.savedAt);
    if (!projects.length) {
      $.add(menu, $.el('span', { className: 'dogiri-projects-empty', textContent: 'No saved projects yet.' }));
      return;
    }
    for (const project of projects) {
      const row = $.el('div', { className: 'dogiri-project-row' });
      const item = $.el('a', { className: 'dogiri-menu-item', href: 'javascript:;' }) as HTMLAnchorElement;
      item.title = `Video: ${project.video?.name || 'unknown'}\nSaved: ${new Date(project.savedAt).toLocaleString()}`;
      $.add(item, $.el('span', { textContent: project.name }));
      $.add(item, $.el('span', {
        className: 'dogiri-project-meta',
        textContent: `${formatTime(project.duration)}, ${project.regions?.length || 0} clip${project.regions?.length === 1 ? '' : 's'}, ${project.captions?.length || 0} caption${project.captions?.length === 1 ? '' : 's'}`,
      }));
      $.add(item, $.el('span', {
        className: 'dogiri-project-meta',
        textContent: project.video?.name || 'unknown video',
      }));
      $.on(item, 'click', () => {
        if (Dogiri.nodes) { Dogiri.nodes.projectsMenu.hidden = true; }
        Dogiri.loadProject(project);
      });
      const rm = $.el('a', { className: 'dogiri-project-rm', href: 'javascript:;', textContent: '✕', title: 'Delete project' }) as HTMLAnchorElement;
      $.on(rm, 'click', (e: Event) => {
        e.stopPropagation();
        $.get('Dogiri Projects', {}, (item2: any) => {
          const current = item2['Dogiri Projects'] || {};
          delete current[project.name];
          $.set('Dogiri Projects', current);
          Dogiri.renderProjectsMenu(current);
        });
      });
      $.add(row, item);
      $.add(row, rm);
      $.add(menu, row);
    }
  },

  async loadProject(project: DogiriProject) {
    const { file, state } = Dogiri;
    if (!file || !state) { return; }
    if (!Dogiri.stateIsPristine()) {
      const saveName = Dogiri.currentProjectName || Dogiri.projectBaseName();
      const choice = await Dogiri.askChoice(
        `Open "${project.name}" now? "Save & open" stores your current edits as the project "${saveName}" first.`,
        'Save & open',
        { altLabel: 'Open without saving', anchor: 'top' },
      );
      if (!choice || Dogiri.file !== file) { return; }
      if (choice === 'ok') { await Dogiri.saveProjectAs(saveName); }
    }
    const fingerprint = await Dogiri.fingerprintPromise;
    const { nodes } = Dogiri;
    if (!nodes || Dogiri.file !== file) { return; }
    if (fingerprint && project.video?.fingerprint === fingerprint) {
      Dogiri.applyLoadedProject(project);
      return;
    }
    Dogiri.notify('info', `Locate the video file "${project.video?.name || 'unknown'}" for the project "${project.name}".`, 8);
    Dogiri.relinkProject = project;
    nodes.relink.value = '';
    nodes.relink.click();
  },

  async onRelinkPicked() {
    const { nodes } = Dogiri;
    const project = Dogiri.relinkProject;
    Dogiri.relinkProject = null;
    const picked = nodes?.relink.files?.[0];
    if (!nodes || !project || !picked) { return; }
    const fingerprint = await Dogiri.fingerprintFile(picked);
    if (!fingerprint || fingerprint !== project.video?.fingerprint) {
      const ok = await Dogiri.askConfirm(
        `"${picked.name}" does not look like the video this project was saved for (${project.video?.name || 'unknown'}). Load the project onto it anyway?`,
        'Load anyway',
        { anchor: 'top' },
      );
      if (!ok) { return; }
    }
    Dogiri.swapFile(picked, project);
  },

  swapFile(file: File, project: DogiriProject) {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    Dogiri.exportJob?.cancel();
    Dogiri.pendingProject = project;
    Dogiri.file = file;
    Dogiri.fileSize = file.size;
    Dogiri.audioStripped = false;
    Dogiri.hasAudio = true;
    Dogiri.lastExport = null;
    Dogiri.fileSwapped = true;
    nodes.deleteOriginal.checked = false;
    nodes.deleteOriginal.disabled = true;
    (nodes.deleteOriginal.parentElement as HTMLElement).title =
      'The loaded project uses a different video, so sending to the QR adds a new post file and keeps the current one.';
    Dogiri.setFingerprintSource(file);
    Dogiri.lastAutosaveSignature = '';
    Dogiri.stripToken++;
    Dogiri.stripCache = [];
    if (Dogiri.stripSource) {
      Dogiri.stripSource.video.removeAttribute('src');
      Dogiri.stripSource.video.load();
      URL.revokeObjectURL(Dogiri.stripSource.url);
      Dogiri.stripSource = null;
    }
    URL.revokeObjectURL(Dogiri.objectURL);
    Dogiri.objectURL = URL.createObjectURL(file);
    nodes.filename.textContent = `${file.name} (${$.bytesToString(file.size)})`;
    nodes.video.src = Dogiri.objectURL;
  },

  applyLoadedProject(project: DogiriProject) {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    applyProject(state, project);
    if (!Dogiri.hasAudio) { state.stripAudio = false; }
    if (['high', 'medium', 'low', 'min', 'fit'].includes(project.quality)) {
      nodes.quality.value = project.quality;
      nodes.fitRow.hidden = project.quality !== 'fit';
    }
    Dogiri.history = createHistory();
    Dogiri.gestureSnapshot = null;
    Dogiri.pendingRange = null;
    Dogiri.lastExport = null;
    Dogiri.stopEditingCaption();
    nodes.video.muted = state.stripAudio;
    if (project.name && project.name !== 'Autosave') { Dogiri.currentProjectName = project.name; }
    Dogiri.sessionAcknowledged = true;
    Dogiri.refreshStripAudioButton();
    Dogiri.renderRegions();
    Dogiri.renderCaptions();
    Dogiri.notify('success', project.name === 'Autosave'
      ? 'Dōgiri restored your unsaved edits for this video.'
      : `Dōgiri project "${project.name}" loaded.`, 3);
  },

  applyTimelineSize() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    const height = TIMELINE_HEIGHTS[nodes.timelineSize.value] || TIMELINE_HEIGHTS.small;
    nodes.el.style.setProperty('--dogiri-timeline-height', `${height}px`);
  },

  buildFilmstrip() {
    Dogiri.paintFilmstrip();
    Dogiri.fillFilmstrip();
  },

  stripLayout(): {
    count: number, thumbWidth: number, slotDuration: number, width: number, height: number,
  } | null {
    const { nodes, state } = Dogiri;
    if (!nodes || !state?.duration) { return null; }
    if (!(nodes.video.videoWidth && nodes.video.videoHeight)) { return null; }
    const rect = nodes.strip.getBoundingClientRect();
    if (!(rect.width && rect.height)) { return null; }
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    const thumbWidth = Math.max(8, Math.round(height * (nodes.video.videoWidth / nodes.video.videoHeight)));
    const count = Math.max(1, Math.ceil(width / thumbWidth));
    return { count, thumbWidth, slotDuration: state.duration / count, width, height };
  },

  paintFilmstrip() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    const layout = Dogiri.stripLayout();
    if (!layout) { return; }
    Dogiri.stripToken++;
    const strip = nodes.strip;
    if (strip.width !== layout.width || strip.height !== layout.height) {
      strip.width = layout.width;
      strip.height = layout.height;
    } else {
      strip.getContext('2d')?.clearRect(0, 0, strip.width, strip.height);
    }
    if (!Conf['Dogiri Filmstrip']) { return; }
    const ctx = strip.getContext('2d');
    if (!ctx) { return; }
    const times = Dogiri.stripCache.map(entry => (entry.height === layout.height ? entry.time : Infinity));
    for (let i = 0; i < layout.count; i++) {
      const target = (i + 0.5) * layout.slotDuration;
      const index = nearestIndex(times, target);
      if (index < 0 || Math.abs(Dogiri.stripCache[index].time - target) > layout.slotDuration) { continue; }
      ctx.drawImage(Dogiri.stripCache[index].canvas, i * layout.thumbWidth, 0, layout.thumbWidth, layout.height);
    }
  },

  async ensureStripVideo(): Promise<HTMLVideoElement | null> {
    if (!Dogiri.stripSource) {
      const file = Dogiri.file;
      if (!file) { return null; }
      const video = $.el('video');
      video.muted = true;
      video.preload = 'auto';
      (video as any).playsInline = true;
      const url = URL.createObjectURL(file);
      const ready = new Promise<boolean>(resolve => {
        video.addEventListener('loadedmetadata', () => resolve(true), { once: true });
        video.addEventListener('error', () => resolve(false), { once: true });
      });
      video.src = url;
      Dogiri.stripSource = { video, url, ready };
    }
    const source = Dogiri.stripSource;
    return (await source.ready) ? source.video : null;
  },

  async fillFilmstrip() {
    clearTimeout(Dogiri.stripFillTimer);
    const token = ++Dogiri.stripToken;
    const { nodes, state } = Dogiri;
    if (!nodes || !state?.duration || !Conf['Dogiri Filmstrip']) { return; }
    const layout = Dogiri.stripLayout();
    if (!layout) { return; }
    const ctx = nodes.strip.getContext('2d');
    if (!ctx) { return; }
    const video = await Dogiri.ensureStripVideo();
    if (!video || token !== Dogiri.stripToken) { return; }
    for (let i = 0; i < layout.count; i++) {
      const target = (i + 0.5) * layout.slotDuration;
      const cached = Dogiri.stripCache.some(entry =>
        entry.height === layout.height && Math.abs(entry.time - target) <= layout.slotDuration / 2);
      if (cached) { continue; }
      await new Promise<void>(resolve => {
        if (Math.abs(video.currentTime - target) < 0.001) { resolve(); return; }
        video.addEventListener('seeked', () => resolve(), { once: true });
        video.currentTime = target;
      });
      if (token !== Dogiri.stripToken) { return; }
      const thumb = $.el('canvas');
      thumb.width = layout.thumbWidth;
      thumb.height = layout.height;
      thumb.getContext('2d')?.drawImage(video, 0, 0, thumb.width, thumb.height);
      if (Dogiri.stripCache.length < 600) {
        Dogiri.stripCache.push({ time: target, height: layout.height, canvas: thumb });
      }
      ctx.drawImage(thumb, i * layout.thumbWidth, 0, layout.thumbWidth, layout.height);
    }
  },

  scheduleStripFill() {
    clearTimeout(Dogiri.stripFillTimer);
    Dogiri.stripFillTimer = window.setTimeout(() => { Dogiri.fillFilmstrip(); }, 250);
  },

  dialogWidth(): number {
    const body = Dogiri.nodes?.resize.parentElement;
    return body ? body.getBoundingClientRect().width : 0;
  },

  applyDialogWidth(width: number) {
    const el = Dogiri.nodes?.el;
    if (!el) { return; }
    const clamped = Math.min(Math.max(width, 520), Math.round(window.innerWidth * 0.96));
    el.style.setProperty('--dogiri-width', `${clamped}px`);
    Dogiri.paintFilmstrip();
    Dogiri.scheduleStripFill();
    Dogiri.positionRegionMenu();
  },

  onResizePointerDown(e: PointerEvent) {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    e.preventDefault();
    Dogiri.resizeDrag = { startX: e.clientX, startWidth: Dogiri.dialogWidth() };
    nodes.resize.setPointerCapture(e.pointerId);
  },

  onResizePointerMove(e: PointerEvent) {
    const { resizeDrag } = Dogiri;
    if (!resizeDrag) { return; }
    Dogiri.applyDialogWidth(resizeDrag.startWidth + (e.clientX - resizeDrag.startX) * 2);
  },

  onResizePointerUp() {
    if (!Dogiri.resizeDrag) { return; }
    Dogiri.resizeDrag = null;
    const width = Math.round(Dogiri.dialogWidth());
    if (width) { $.set('Dogiri Size', { width }); }
    Dogiri.fillFilmstrip();
  },

  onWindowResize() {
    Dogiri.paintFilmstrip();
    Dogiri.scheduleStripFill();
    Dogiri.positionRegionMenu();
  },

  refreshStripAudioButton() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    nodes.stripAudio.classList.remove('dogiri-pressed', 'disabled');
    nodes.stripAudio.title = '';
    if (Dogiri.audioStripped && Dogiri.hasAudio) {
      state.stripAudio = true;
      nodes.video.muted = true;
      nodes.stripAudio.classList.add('dogiri-pressed');
      nodes.stripAudio.title = 'Audio was removed automatically for this board; unpress to keep it';
    } else if (Dogiri.audioStripped) {
      state.stripAudio = true;
      nodes.stripAudio.classList.add('dogiri-pressed', 'disabled');
      nodes.stripAudio.title = 'Audio was removed and no original is available to restore';
    } else if (!Dogiri.hasAudio) {
      state.stripAudio = false;
      nodes.stripAudio.classList.add('disabled');
      nodes.stripAudio.title = 'Video has no audio track';
    } else {
      nodes.stripAudio.classList.toggle('dogiri-pressed', state.stripAudio);
    }
  },

  togglePlay() {
    const video = Dogiri.nodes?.video;
    if (!video) { return; }
    Dogiri.playingClips = false;
    if (video.paused) { video.play().catch(() => {}); } else { video.pause(); }
  },

  playClipsOnly() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state?.regions.length) { return; }
    const { video } = nodes;
    if (Dogiri.playingClips && !video.paused) {
      video.pause();
      return;
    }
    Dogiri.playingClips = true;
    if (!inRegion(state, video.currentTime)) {
      video.currentTime = nextRegionStart(state, video.currentTime) ?? state.regions[0].start;
    }
    video.play().catch(() => {});
  },

  startLoop() {
    const step = () => {
      Dogiri.renderFrame();
      Dogiri.rafId = requestAnimationFrame(step);
    };
    Dogiri.rafId = requestAnimationFrame(step);
  },

  fraction(time: number): number {
    const duration = Dogiri.state?.duration;
    return duration ? Math.min(Math.max(time / duration, 0), 1) : 0;
  },

  renderFrame() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const { video } = nodes;
    // Clips-only playback: hop over the gaps between regions, stop after the last one.
    if (Dogiri.playingClips && !video.paused && !video.seeking && !inRegion(state, video.currentTime)) {
      const next = nextRegionStart(state, video.currentTime);
      if (next != null) {
        video.currentTime = next;
      } else {
        video.pause();
        Dogiri.playingClips = false;
      }
    }
    nodes.time.textContent = formatTime(video.currentTime, true);
    nodes.play.textContent = video.paused ? '▶' : '⏸';
    nodes.playClips.classList.toggle('dogiri-pressed', Dogiri.playingClips);
    nodes.playClips.textContent = Dogiri.playingClips && !video.paused ? '⏸ Pause clips' : '▶ Play clips';
    const playheadPct = `${Dogiri.fraction(video.currentTime) * 100}%`;
    nodes.playhead.style.left = playheadPct;
    nodes.scrubHandle.style.left = playheadPct;
    Dogiri.renderCaptionOverlay();
  },

  measureText(font: string, text: string): number {
    if (!Dogiri.measureCtx) {
      Dogiri.measureCtx = $.el('canvas').getContext('2d');
      if (!Dogiri.measureCtx) { return 0; }
    }
    Dogiri.measureCtx.font = font;
    return Dogiri.measureCtx.measureText(text).width;
  },

  renderCaptionOverlay() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const container = nodes.captionOverlay;
    const active = captionsAt(state, nodes.video.currentTime);
    const activeIds = new Set(active.map(caption => caption.id));
    const children = new Map<number, HTMLDivElement>();
    for (const child of Array.from(container.children) as HTMLDivElement[]) {
      const id = +child.dataset.id!;
      if (activeIds.has(id)) { children.set(id, child); } else { $.rm(child); }
    }
    container.hidden = !active.length;
    if (!active.length) { return; }
    const boxRect = nodes.previewBox.getBoundingClientRect();
    const videoRect = nodes.video.getBoundingClientRect();
    if (!(videoRect.width && videoRect.height)) { return; }
    for (const caption of active) {
      let child = children.get(caption.id);
      if (!child) {
        child = $.el('div', { className: 'dogiri-preview-caption' });
        child.dataset.id = String(caption.id);
        $.add(container, child);
      }
      const px = videoRect.height * SIZE_FRACTIONS[caption.size];
      const font = `bold ${px}px sans-serif`;
      const maxWidth = videoRect.width * CAPTION_MAX_WIDTH_FRACTION;
      const key = JSON.stringify([
        caption.text, caption.y, caption.size,
        Math.round(videoRect.width), Math.round(videoRect.height),
        Math.round(videoRect.left - boxRect.left), Math.round(videoRect.top - boxRect.top),
      ]);
      if (child.dataset.key === key) { continue; }
      child.dataset.key = key;
      const lines = wrapCaptionLines(text => Dogiri.measureText(font, text), caption.text, maxWidth);
      child.textContent = '';
      lines.forEach((line, index) => {
        if (index) { $.add(child!, $.el('br')); }
        $.add(child!, $.tn(line));
      });
      const lineHeight = px * CAPTION_LINE_HEIGHT;
      const blockHeightPct = ((lines.length * lineHeight) / videoRect.height) * 100;
      const topPct = captionBlockTop(caption.y, blockHeightPct);
      child.style.fontSize = `${px}px`;
      child.style.lineHeight = `${lineHeight}px`;
      child.style.left = `${videoRect.left - boxRect.left + videoRect.width * ((1 - CAPTION_MAX_WIDTH_FRACTION) / 2)}px`;
      child.style.width = `${maxWidth}px`;
      child.style.top = `${videoRect.top - boxRect.top + (topPct / 100) * videoRect.height}px`;
    }
  },

  selectedRegion() {
    const { state } = Dogiri;
    if (!state) { return null; }
    return state.regions.find(region => region.id === Dogiri.selectedRegionId)
      || state.regions[0]
      || null;
  },

  updateClipInputs(force = false) {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    const region = Dogiri.selectedRegion();
    nodes.clipTimes.hidden = !region;
    if (!region) { return; }
    if (force || d.activeElement !== nodes.clipStart) {
      nodes.clipStart.value = formatTime(region.start, true);
    }
    if (force || d.activeElement !== nodes.clipEnd) {
      nodes.clipEnd.value = formatTime(region.end, true);
    }
  },

  onClipTimeCommit(edge: 'start' | 'end') {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const region = Dogiri.selectedRegion();
    if (!region) { return; }
    const input = edge === 'start' ? nodes.clipStart : nodes.clipEnd;
    const time = parseTime(input.value);
    if (time == null) {
      Dogiri.updateClipInputs(true);
      return;
    }
    const before = snapshot(state);
    moveRegionEdge(state, region.id, edge, time);
    commitHistory(Dogiri.history, before, state);
    Dogiri.renderRegions();
    Dogiri.updateClipInputs(true);
  },

  renderRegions() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const selected = Dogiri.selectedRegion();
    nodes.regions.textContent = '';
    state.regions.forEach((region, index) => {
      const el = $.el('span', { className: `dogiri-region${index % 2 ? ' alt' : ''}${region.id === selected?.id ? ' selected' : ''}` });
      el.dataset.id = String(region.id);
      el.title = `${formatTime(region.start)}-${formatTime(region.end)}`;
      const startPct = Dogiri.fraction(region.start) * 100;
      const endPct = Dogiri.fraction(region.end) * 100;
      el.style.left = `${startPct}%`;
      el.style.width = `${endPct - startPct}%`;
      const startHandle = $.el('span', { className: 'dogiri-region-handle' });
      startHandle.dataset.edge = 'start';
      const endHandle = $.el('span', { className: 'dogiri-region-handle' });
      endHandle.dataset.edge = 'end';
      $.add(el, startHandle);
      $.add(el, endHandle);
      $.add(nodes.regions, el);
    });
    Dogiri.positionRegionMenu();
    Dogiri.updateClipInputs();
    Dogiri.renderStats();
    Dogiri.renderClipList();
  },

  positionRegionMenu() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const selected = state.duration ? Dogiri.selectedRegion() : null;
    if (!selected) {
      nodes.regionMenu.hidden = true;
      return;
    }
    nodes.regionMenuLabel.textContent =
      `Clip ${state.regions.findIndex(region => region.id === selected.id) + 1}`;
    nodes.regionMenu.hidden = false;
    const center = nodes.timeline.offsetWidth * Dogiri.fraction((selected.start + selected.end) / 2);
    const half = nodes.regionMenu.offsetWidth / 2;
    const left = Math.min(Math.max(center, half), nodes.timeline.offsetWidth - half);
    nodes.regionMenu.style.left = `${Math.round(left)}px`;
  },

  removeSelectedRegion() {
    const { state } = Dogiri;
    const selected = Dogiri.selectedRegion();
    if (!state || !selected) { return; }
    const before = snapshot(state);
    removeRegion(state, selected.id);
    commitHistory(Dogiri.history, before, state);
    Dogiri.renderRegions();
  },

  onQualityChange() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    nodes.fitRow.hidden = nodes.quality.value !== 'fit';
    Dogiri.renderStats();
  },

  fitTargetBytes(): number {
    const value = parseFloat(Dogiri.nodes?.fitTarget.value || '');
    if (value > 0) { return Math.round(value * 1048576); }
    return Dogiri.maxSize || 4 * 1048576;
  },

  calibrationFactor(quality: string): number {
    return Dogiri.calibration[quality] ?? Dogiri.persistentCalibration[quality] ?? 1;
  },

  currentFitSettings() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state || nodes.quality.value !== 'fit' || !nodes.video.videoWidth) { return null; }
    return fitSettings(
      nodes.video.videoWidth, nodes.video.videoHeight, totalClipped(state),
      Dogiri.fitTargetBytes(), !state.stripAudio && Dogiri.hasAudio, Dogiri.calibrationFactor('fit'));
  },

  estimatedExportBytes(): number {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return 0; }
    const total = totalClipped(state);
    // No dimensions yet: just prorate the source file size by clipped duration.
    if (!(nodes.video.videoWidth && nodes.video.videoHeight)) {
      return state.duration > 0 ? Math.round(Dogiri.fileSize * (total / state.duration)) : 0;
    }
    const quality = nodes.quality.value as RenderQuality;
    const { width, height, videoBps } = Dogiri.currentFitSettings()
      || exportSettings(nodes.video.videoWidth, nodes.video.videoHeight, quality as ExportQuality);
    const audioBps = (!state.stripAudio && Dogiri.hasAudio) ? AUDIO_BPS : 0;
    let effectiveVideoBps = videoBps;
    if (state.duration > 0 && Dogiri.fileSize > 0) {
      const sourceVideoBps = Math.max(0, (Dogiri.fileSize * 8) / state.duration - (Dogiri.hasAudio ? AUDIO_BPS : 0));
      const pixelRatio = (width * height) / (nodes.video.videoWidth * nodes.video.videoHeight);
      const complexityBps = sourceVideoBps * pixelRatio * 1.35;
      effectiveVideoBps = Math.min(videoBps, Math.max(300_000, complexityBps));
    }
    return Math.round(((effectiveVideoBps + audioBps) / 8) * total * Dogiri.calibrationFactor(quality));
  },

  currentSignature(): string {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return ''; }
    return exportSignature({
      regions: state.regions,
      captions: state.captions,
      keepAudio: !state.stripAudio && Dogiri.hasAudio,
      quality: nodes.quality.value as RenderQuality,
      fitTargetBytes: Dogiri.fitTargetBytes(),
    });
  },

  refreshOutputButtons() {
    const { nodes } = Dogiri;
    if (!nodes || Dogiri.exportJob) { return; }
    const rendered = !!Dogiri.lastExport && Dogiri.lastExport.signature === Dogiri.currentSignature();
    nodes.render.hidden = rendered;
    nodes.render.textContent = 'Render';
    nodes.render.classList.remove('dogiri-pressed');
    nodes.exportGroup.hidden = !rendered;
    nodes.export.textContent = Dogiri.exportTarget === 'qr' ? 'Send → QR' : 'Save → file';
    if (!rendered) { nodes.exportTargetMenu.hidden = true; }
  },

  renderStats() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    Dogiri.refreshOutputButtons();
    if (!state.regions.length) {
      nodes.stats.textContent = 'No clips';
      return;
    }
    const total = totalClipped(state);
    const count = state.regions.length;
    const rendered = Dogiri.lastExport && Dogiri.lastExport.signature === Dogiri.currentSignature()
      ? Dogiri.lastExport.file
      : null;
    const size = rendered
      ? $.bytesToString(rendered.size)
      : `~${$.bytesToString(Dogiri.estimatedExportBytes())}`;
    nodes.stats.title = rendered
      ? 'The actual size of the rendered file.'
      : 'The size is an estimate; the rendered file may come in under or over it. Estimates improve as renders complete.';
    nodes.stats.textContent =
      `${count} clip${count === 1 ? '' : 's'}, ${formatTime(total)} of ${formatTime(state.duration)} (${size})`;
  },

  timeAtPointer(e: PointerEvent, el: HTMLElement): number {
    const { state } = Dogiri;
    if (!state) { return 0; }
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    return fraction * state.duration;
  },

  onTimelinePointerDown(e: PointerEvent) {
    const { nodes, state } = Dogiri;
    if (!nodes || !state?.duration) { return; }
    const target = e.target as HTMLElement;
    if (target.closest?.('#dogiri-region-menu')) { return; }
    const handle = target.closest?.('.dogiri-region-handle') as HTMLElement | null;
    const regionEl = target.closest?.('.dogiri-region') as HTMLElement | null;
    if (target.closest?.('#dogiri-scrub-handle')) {
      Dogiri.dragTarget = { kind: 'seek' };
    } else if (handle && regionEl) {
      const id = +regionEl.dataset.id!;
      Dogiri.selectedRegionId = id;
      Dogiri.dragTarget = {
        kind: 'edge',
        id,
        edge: handle.dataset.edge as 'start' | 'end',
      };
    } else if (regionEl) {
      const id = +regionEl.dataset.id!;
      const region = state.regions.find(r => r.id === id);
      if (!region) { return; }
      Dogiri.selectedRegionId = id;
      Dogiri.dragTarget = {
        kind: 'move',
        id,
        offset: Dogiri.timeAtPointer(e, nodes.timeline) - region.start,
      };
    } else {
      Dogiri.dragTarget = { kind: 'seek' };
    }
    if (Dogiri.dragTarget.kind !== 'seek') { Dogiri.gestureSnapshot = snapshot(state); }
    nodes.timeline.setPointerCapture(e.pointerId);
    Dogiri.onTimelinePointerMove(e);
  },

  onTimelinePointerMove(e: PointerEvent) {
    const { nodes, state, dragTarget } = Dogiri;
    if (!nodes || !state || !dragTarget) { return; }
    const time = Dogiri.timeAtPointer(e, nodes.timeline);
    if (dragTarget.kind === 'edge') {
      moveRegionEdge(state, dragTarget.id, dragTarget.edge, time);
      Dogiri.renderRegions();
    } else if (dragTarget.kind === 'move') {
      moveRegionFree(state, dragTarget.id, time - dragTarget.offset);
      Dogiri.renderRegions();
    } else if (Dogiri.playingClips) {
      // Don't seek into a gap mid-playback; remember it and snap to the next clip on release.
      if (inRegion(state, time)) {
        nodes.video.currentTime = time;
        Dogiri.pendingClipSeek = null;
      } else {
        Dogiri.pendingClipSeek = time;
      }
    } else {
      nodes.video.currentTime = time;
    }
  },

  onTimelinePointerUp() {
    const { nodes, state, dragTarget } = Dogiri;
    if (
      dragTarget?.kind === 'seek' && Dogiri.playingClips &&
      Dogiri.pendingClipSeek != null && nodes && state?.regions.length
    ) {
      nodes.video.currentTime = nextRegionStart(state, Dogiri.pendingClipSeek) ?? state.regions[0].start;
    }
    if (dragTarget?.kind === 'move' && state) {
      const original = Dogiri.gestureSnapshot?.regions.find(region => region.id === dragTarget.id);
      const current = state.regions.find(region => region.id === dragTarget.id);
      if (current) {
        settleRegion(state, dragTarget.id, original || { start: current.start, end: current.end });
        Dogiri.renderRegions();
      }
    }
    Dogiri.pendingClipSeek = null;
    Dogiri.dragTarget = null;
    Dogiri.commitGesture();
  },

  onAddRegion() {
    const { state } = Dogiri;
    if (!state) { return; }
    const before = snapshot(state);
    if (!addRegion(state)) {
      Dogiri.notify('info', 'No room for another clip.', 3);
      return;
    }
    commitHistory(Dogiri.history, before, state);
    Dogiri.renderRegions();
  },

  toggleClipPanel() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    if (!nodes.clipPanel.hidden) {
      Dogiri.hideClipPanel();
      return;
    }
    nodes.savePanel.hidden = true;
    nodes.projectsMenu.hidden = true;
    nodes.clipPanel.hidden = false;
    nodes.clipList.classList.add('dogiri-pressed');
    Dogiri.renderClipList();
  },

  hideClipPanel() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    nodes.clipPanel.hidden = true;
    nodes.clipList.classList.remove('dogiri-pressed');
  },

  renderClipList() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state || nodes.clipPanel.hidden) { return; }
    const live = new Set(state.regions.map(region => region.id));
    for (const id of Dogiri.checkedClipIds) {
      if (!live.has(id)) { Dogiri.checkedClipIds.delete(id); }
    }
    const selected = Dogiri.selectedRegion();
    nodes.clipRows.textContent = '';
    if (!state.regions.length) {
      $.add(nodes.clipRows, $.el('span', { className: 'dogiri-clips-empty', textContent: 'No clips.' }));
    }
    state.regions.forEach((region, index) => {
      const row = $.el('div', { className: `dogiri-clip-row${region.id === selected?.id ? ' selected' : ''}` });
      const check = $.el('input', { type: 'checkbox' }) as HTMLInputElement;
      check.checked = Dogiri.checkedClipIds.has(region.id);
      $.on(check, 'click', (e: Event) => e.stopPropagation());
      $.on(check, 'change', () => {
        if (check.checked) {
          Dogiri.checkedClipIds.add(region.id);
        } else {
          Dogiri.checkedClipIds.delete(region.id);
        }
        Dogiri.refreshClipActions();
      });
      $.add(row, check);
      $.add(row, $.el('span', { className: 'dogiri-clip-label', textContent: `Clip ${index + 1}` }));
      $.add(row, $.el('span', {
        className: 'dogiri-clip-meta',
        textContent: `${formatTime(region.start, true)}-${formatTime(region.end, true)} (${formatTime(region.end - region.start, true)})`,
      }));
      $.on(row, 'click', () => {
        Dogiri.selectedRegionId = region.id;
        if (Dogiri.nodes && Dogiri.state) {
          Dogiri.nodes.video.currentTime = region.start;
        }
        Dogiri.renderRegions();
      });
      $.add(nodes.clipRows, row);
    });
    Dogiri.refreshClipActions();
  },

  refreshClipActions() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const checked = Dogiri.checkedClipIds.size;
    const total = state.regions.length;
    nodes.clipsCount.textContent = checked ? `${checked} of ${total} selected` : `${total} clip${total === 1 ? '' : 's'}`;
    nodes.clipsAll.checked = total > 0 && checked === total;
    nodes.clipsAll.indeterminate = checked > 0 && checked < total;
    nodes.clipsDelete.classList.toggle('disabled', !checked);
    nodes.clipsKeep.classList.toggle('disabled', !checked || checked === total);
    nodes.clipsMerge.classList.toggle('disabled', checked < 2);
  },

  onClipsAllChange() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    Dogiri.checkedClipIds = nodes.clipsAll.checked
      ? new Set(state.regions.map(region => region.id))
      : new Set();
    Dogiri.renderClipList();
  },

  onClipsBulk(action: 'delete' | 'keep' | 'merge') {
    const { state } = Dogiri;
    if (!state) { return; }
    const ids = [...Dogiri.checkedClipIds];
    const total = state.regions.length;
    if (!ids.length || (action === 'merge' && ids.length < 2) || (action === 'keep' && ids.length === total)) { return; }
    const before = snapshot(state);
    if (action === 'merge') {
      const merged = mergeRegions(state, ids);
      if (!merged) { return; }
      Dogiri.checkedClipIds = new Set([merged.id]);
      Dogiri.selectedRegionId = merged.id;
      Dogiri.notify('success', `Merged ${ids.length} clips into one.`, 3);
    } else {
      const removed = action === 'delete' ? removeRegions(state, ids) : keepRegions(state, ids);
      Dogiri.notify('success', `Removed ${removed} clip${removed === 1 ? '' : 's'}.`, 3);
    }
    commitHistory(Dogiri.history, before, state);
    Dogiri.renderRegions();
  },

  toggleCaptions() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    const showing = nodes.captionEditor.hidden;
    nodes.captionEditor.hidden = !showing;
    nodes.captionLane.hidden = !showing;
    nodes.captionsToggle.classList.toggle('dogiri-pressed', showing);
    if (!showing) {
      Dogiri.stopEditingCaption();
      Dogiri.pendingRange = null;
      Dogiri.renderCaptions();
    }
  },

  onLanePointerDown(e: PointerEvent) {
    const { nodes, state } = Dogiri;
    if (!nodes || !state?.duration) { return; }
    const target = e.target as HTMLElement;
    if (target.closest?.('.dogiri-caption-rm')) { return; }
    const time = Dogiri.timeAtPointer(e, nodes.captionLane);
    const handle = target.closest?.('.dogiri-caption-handle') as HTMLElement | null;
    const block = target.closest?.('.dogiri-caption-block') as HTMLElement | null;
    if (handle && block) {
      Dogiri.gestureSnapshot = snapshot(state);
      Dogiri.laneDrag = { kind: 'cap-edge', id: +block.dataset.id!, edge: handle.dataset.edge as 'start' | 'end' };
    } else if (block) {
      const id = +block.dataset.id!;
      const caption = state.captions.find(c => c.id === id);
      if (!caption) { return; }
      Dogiri.gestureSnapshot = snapshot(state);
      Dogiri.laneDrag = { kind: 'cap-move', id, offset: time - caption.start, downX: e.clientX, moved: false };
    } else {
      Dogiri.laneDrag = { kind: 'range', anchor: time };
      Dogiri.pendingRange = null;
      Dogiri.renderCaptions();
    }
    nodes.captionLane.setPointerCapture(e.pointerId);
  },

  onLanePointerMove(e: PointerEvent) {
    const { nodes, state, laneDrag } = Dogiri;
    if (!nodes || !state || !laneDrag) { return; }
    const time = Dogiri.timeAtPointer(e, nodes.captionLane);
    if (laneDrag.kind === 'range') {
      Dogiri.pendingRange = {
        start: Math.min(laneDrag.anchor, time),
        end: Math.max(laneDrag.anchor, time),
      };
      Dogiri.renderCaptions();
    } else if (laneDrag.kind === 'cap-edge') {
      moveCaptionEdge(state, laneDrag.id, laneDrag.edge, time);
      Dogiri.renderCaptions();
    } else {
      // Under 3px of travel is still a click (opens the editor), not a move.
      if (!laneDrag.moved && Math.abs(e.clientX - laneDrag.downX) <= 3) { return; }
      laneDrag.moved = true;
      moveCaption(state, laneDrag.id, time - laneDrag.offset);
      Dogiri.renderCaptions();
    }
  },

  onLanePointerUp() {
    const { state, laneDrag, pendingRange } = Dogiri;
    Dogiri.laneDrag = null;
    Dogiri.commitGesture();
    if (laneDrag?.kind === 'cap-move' && !laneDrag.moved && state) {
      const caption = state.captions.find(c => c.id === laneDrag.id);
      if (caption) { Dogiri.startEditingCaption(caption); }
      return;
    }
    if (laneDrag?.kind !== 'range') { return; }
    if (pendingRange && pendingRange.end - pendingRange.start < 0.15) {
      Dogiri.pendingRange = null;
      Dogiri.renderCaptions();
      return;
    }
    if (pendingRange) { Dogiri.nodes?.captionText.focus(); }
  },

  yAtPointer(e: PointerEvent): number {
    const video = Dogiri.nodes?.video;
    if (!video) { return 0; }
    const rect = video.getBoundingClientRect();
    return rect.height ? ((e.clientY - rect.top) / rect.height) * 100 : 0;
  },

  onOverlayPointerDown(e: PointerEvent) {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const child = (e.target as HTMLElement)?.closest?.('.dogiri-preview-caption') as HTMLElement | null;
    if (!child) { return; }
    const caption = state.captions.find(existing => existing.id === +child.dataset.id!);
    if (!caption) { return; }
    e.stopPropagation();
    Dogiri.gestureSnapshot = snapshot(state);
    Dogiri.overlayDrag = { id: caption.id, grabOffset: Dogiri.yAtPointer(e) - caption.y };
    nodes.captionOverlay.setPointerCapture(e.pointerId);
  },

  onOverlayPointerMove(e: PointerEvent) {
    const { state, overlayDrag } = Dogiri;
    if (!state || !overlayDrag) { return; }
    setCaptionY(state, overlayDrag.id, Dogiri.yAtPointer(e) - overlayDrag.grabOffset);
  },

  onOverlayPointerUp() {
    Dogiri.overlayDrag = null;
    Dogiri.commitGesture();
    Dogiri.refreshOutputButtons();
  },

  commitGesture() {
    const { state, gestureSnapshot } = Dogiri;
    Dogiri.gestureSnapshot = null;
    if (!state || !gestureSnapshot) { return; }
    commitHistory(Dogiri.history, gestureSnapshot, state);
  },

  autoCaptionRange(): { start: number, end: number } {
    const { nodes, state } = Dogiri;
    if (!nodes || !state?.duration) { return { start: 0, end: 0 }; }
    const length = Math.min(3, state.duration);
    const start = Math.min(nodes.video.currentTime, Math.max(0, state.duration - length));
    return { start, end: Math.min(state.duration, start + length) };
  },

  onAddCaption() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    const text = nodes.captionText.value;
    const position = nodes.captionPosition.value as CaptionPosition;
    const size = nodes.captionSize.value as CaptionSize;
    const before = snapshot(state);
    if (Dogiri.editingCaptionId) {
      // Only snap y to the preset if the dropdown actually changed; keeps a hand-dragged position.
      const y = position === Dogiri.editingInitialPosition ? undefined : POSITION_PRESETS[position];
      if (!updateCaption(state, Dogiri.editingCaptionId, text, size, Dogiri.pendingRange || undefined, y)) { return; }
      Dogiri.pendingRange = null;
      Dogiri.stopEditingCaption();
    } else {
      const range = Dogiri.pendingRange || Dogiri.autoCaptionRange();
      const y = freeCaptionY(state, range.start, range.end, POSITION_PRESETS[position]);
      if (!addCaption(state, range.start, range.end, text, y, size)) { return; }
      Dogiri.pendingRange = null;
      nodes.captionText.value = '';
    }
    commitHistory(Dogiri.history, before, state);
    Dogiri.renderCaptions();
  },

  onRemoveEditedCaption() {
    const { state } = Dogiri;
    if (!state || !Dogiri.editingCaptionId) { return; }
    const before = snapshot(state);
    removeCaption(state, Dogiri.editingCaptionId);
    commitHistory(Dogiri.history, before, state);
    Dogiri.stopEditingCaption();
    Dogiri.renderCaptions();
  },

  startEditingCaption(caption: DogiriCaption) {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    if (Dogiri.pendingRange) {
      Dogiri.pendingRange = null;
      Dogiri.renderCaptions();
    }
    Dogiri.editingCaptionId = caption.id;
    Dogiri.editingInitialPosition = caption.y < 50 ? 'top' : 'bottom';
    nodes.captionText.value = caption.text;
    nodes.captionPosition.value = Dogiri.editingInitialPosition;
    nodes.captionSize.value = caption.size;
    nodes.addCaption.textContent = 'Update caption';
    nodes.captionRemove.hidden = false;
    Dogiri.refreshEditingHighlight();
  },

  stopEditingCaption() {
    const { nodes } = Dogiri;
    if (!nodes) { return; }
    Dogiri.editingCaptionId = 0;
    nodes.captionText.value = '';
    nodes.addCaption.textContent = ADD_CAPTION_LABEL;
    nodes.captionRemove.hidden = true;
    Dogiri.refreshEditingHighlight();
  },

  refreshEditingHighlight() {
    const lane = Dogiri.nodes?.captionLane;
    if (!lane) { return; }
    for (const block of Array.from(lane.querySelectorAll('.dogiri-caption-block')) as HTMLElement[]) {
      block.classList.toggle('editing', +block.dataset.id! === Dogiri.editingCaptionId);
    }
  },

  renderCaptions() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state) { return; }
    nodes.captionLane.textContent = '';
    const { levels, rows } = captionLaneLevels(state);
    nodes.captionLane.style.height = `${rows * 20 + 2}px`;
    for (const caption of state.captions) {
      const block = $.el('span', {
        className: `dogiri-caption-block${caption.id === Dogiri.editingCaptionId ? ' editing' : ''}`,
        title: `${formatTime(caption.start)}-${formatTime(caption.end)} ${caption.text}`,
      });
      block.dataset.id = String(caption.id);
      block.dataset.hue = String(caption.id % 5);
      block.style.top = `${2 + (levels.get(caption.id) || 0) * 20}px`;
      block.textContent = caption.text;
      const startPct = Dogiri.fraction(caption.start) * 100;
      const endPct = Dogiri.fraction(caption.end) * 100;
      block.style.left = `${startPct}%`;
      block.style.width = `${Math.max(endPct - startPct, 1)}%`;
      const startHandle = $.el('span', { className: 'dogiri-caption-handle' });
      startHandle.dataset.edge = 'start';
      const endHandle = $.el('span', { className: 'dogiri-caption-handle' });
      endHandle.dataset.edge = 'end';
      const rm = $.el('a', { className: 'dogiri-caption-rm', textContent: '✕', title: 'Remove caption' }) as HTMLAnchorElement;
      rm.href = 'javascript:;';
      $.on(rm, 'pointerdown', (e: Event) => e.stopPropagation());
      $.on(rm, 'click', (e: Event) => {
        e.stopPropagation();
        const before = snapshot(state);
        removeCaption(state, caption.id);
        commitHistory(Dogiri.history, before, state);
        if (Dogiri.editingCaptionId === caption.id) { Dogiri.stopEditingCaption(); }
        Dogiri.renderCaptions();
      });
      $.add(block, startHandle);
      $.add(block, endHandle);
      $.add(block, rm);
      $.add(nodes.captionLane, block);
    }
    if (Dogiri.pendingRange) {
      const ghost = $.el('span', { className: 'dogiri-caption-ghost' });
      const startPct = Dogiri.fraction(Dogiri.pendingRange.start) * 100;
      const endPct = Dogiri.fraction(Dogiri.pendingRange.end) * 100;
      ghost.style.left = `${startPct}%`;
      ghost.style.width = `${Math.max(endPct - startPct, 0.5)}%`;
      $.add(nodes.captionLane, ghost);
    }
    Dogiri.refreshOutputButtons();
  },

  toggleStripAudio() {
    const { nodes, state } = Dogiri;
    if (!nodes || !state || !Dogiri.hasAudio) { return; }
    const before = snapshot(state);
    state.stripAudio = !state.stripAudio;
    commitHistory(Dogiri.history, before, state);
    nodes.video.muted = state.stripAudio;
    nodes.stripAudio.classList.toggle('dogiri-pressed', state.stripAudio);
    Dogiri.renderStats();
  },

  onRenderClick() {
    if (Dogiri.exportJob) {
      Dogiri.exportJob.cancel();
      return;
    }
    if (Dogiri.confirmResolve) { return; }
    const { nodes, state, file } = Dogiri;
    if (!nodes || !state || !file) { return; }
    if (!state.regions.length) {
      Dogiri.notify('warning', 'No clips to render.', 4);
      return;
    }
    const fit = Dogiri.currentFitSettings();
    if (fit && !fit.reachable && Conf['Dogiri Oversize Render Warning']) {
      Dogiri.askConfirm(
        `Even at minimum quality the render is unlikely to fit under ${$.bytesToString(Dogiri.fitTargetBytes())}. Shorter clips${(!state.stripAudio && Dogiri.hasAudio) ? ' or stripping audio' : ''} would shrink it.`,
        'Render anyway',
        { remember: true },
      ).then(ok => {
        if (!ok) { return; }
        if (Dogiri.nodes?.confirmRemember.checked) {
          Conf['Dogiri Oversize Render Warning'] = false;
          $.set('Dogiri Oversize Render Warning', false);
        }
        Dogiri.startRender();
      });
      return;
    }
    const estimate = Dogiri.estimatedExportBytes();
    if (Dogiri.maxSize && estimate > Dogiri.maxSize && Conf['Dogiri Oversize Render Warning']) {
      Dogiri.askConfirm(
        `Estimated size ${$.bytesToString(estimate)} is over the board limit of ${$.bytesToString(Dogiri.maxSize)}. This is a rough estimate and the rendered file may come in under or over it. Lower quality or shorter clips would shrink it.`,
        'Render anyway',
        { remember: true },
      ).then(ok => {
        if (!ok) { return; }
        if (Dogiri.nodes?.confirmRemember.checked) {
          Conf['Dogiri Oversize Render Warning'] = false;
          $.set('Dogiri Oversize Render Warning', false);
        }
        Dogiri.startRender();
      });
      return;
    }
    Dogiri.startRender();
  },

  startRender() {
    const { nodes, state, file } = Dogiri;
    if (!nodes || !state || !file || Dogiri.exportJob) { return; }
    const qualityAtStart = nodes.quality.value as RenderQuality;
    const estimateAtStart = Dogiri.estimatedExportBytes();
    const signatureAtStart = Dogiri.currentSignature();
    nodes.video.pause();
    Dogiri.playingClips = false;
    const job = exportClips({
      file,
      regions: state.regions.map(region => ({ start: region.start, end: region.end })),
      captions: state.captions.map(caption => ({
        start: caption.start, end: caption.end, text: caption.text, y: caption.y, size: caption.size,
      })),
      keepAudio: !state.stripAudio && Dogiri.hasAudio,
      quality: qualityAtStart,
      fitTargetBytes: Dogiri.fitTargetBytes(),
      fitCalibration: Dogiri.calibrationFactor(qualityAtStart),
      onProgress: fraction => {
        const el = Dogiri.nodes?.render;
        if (el) { el.textContent = `Cancel render (${Math.round(fraction * 100)}%)`; }
      },
    });
    Dogiri.exportJob = job;
    nodes.render.textContent = 'Cancel render (0%)';
    nodes.render.classList.add('dogiri-pressed');
    job.promise.then(async ({ blob, durationOk }) => {
      const base = file.name.replace(/\.[^.]*$/, '') || 'dogiri';
      const exported = new File([blob], `${base}-dogiri.webm`, { type: 'video/webm' });
      if (estimateAtStart > 0) {
        // Fold actual/estimated size into the calibration factor; persistent copy is a running average.
        const factorAtStart = Dogiri.calibrationFactor(qualityAtStart);
        const absolute =
          Math.min(4, Math.max(0.25, (exported.size / estimateAtStart) * factorAtStart));
        Dogiri.calibration[qualityAtStart] = absolute;
        const prior = Dogiri.persistentCalibration[qualityAtStart];
        Dogiri.persistentCalibration[qualityAtStart] = prior ? (prior + absolute) / 2 : absolute;
        $.set('Dogiri Calibration', Dogiri.persistentCalibration);
      }
      Dogiri.exportJob = null;
      Dogiri.lastExport = { file: exported, signature: signatureAtStart };
      Dogiri.renderStats();
      Dogiri.notify('success', `Dōgiri rendered ${exported.name} (${$.bytesToString(exported.size)}).`, 5);
      if (!durationOk) {
        Dogiri.notify('warning', 'The rendered file reports no duration; the QR may reject it.', 6);
      }
    }).catch(error => {
      if (error?.message === EXPORT_CANCELLED) {
        Dogiri.notify('info', 'Dōgiri render canceled.', 3);
      } else {
        console.error(error);
        Dogiri.notify('warning', `Dōgiri render failed: ${error?.message || error}`, 6);
      }
    }).finally(() => {
      Dogiri.exportJob = null;
      Dogiri.refreshOutputButtons();
    });
  },

  onSend(target: 'qr' | 'file') {
    if (Dogiri.exportJob || Dogiri.confirmResolve) { return; }
    const rendered = Dogiri.lastExport;
    // Edits since the render make it stale; flip the UI back to Render instead of sending.
    if (!rendered || rendered.signature !== Dogiri.currentSignature()) {
      Dogiri.refreshOutputButtons();
      return;
    }
    Dogiri.deliverExport(rendered.file, target);
  },

  async deliverExport(exported: File, target: 'qr' | 'file') {
    if (target === 'file') {
      const url = URL.createObjectURL(exported);
      const link = $.el('a', { href: url, download: exported.name }) as HTMLAnchorElement;
      $.add(d.body, link);
      link.click();
      $.rm(link);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      Dogiri.notify('success', `Dōgiri saved ${exported.name} (${$.bytesToString(exported.size)}) to file.`, 5);
      return;
    }
    if (Dogiri.maxSize && exported.size > Dogiri.maxSize) {
      const attach = await Dogiri.askConfirm(
        `The rendered file is ${$.bytesToString(exported.size)}, over the board limit of ${$.bytesToString(Dogiri.maxSize)}.`,
        'Attach anyway',
      );
      if (!attach) { return; }
    }
    const deliver = Dogiri.onExportDone;
    const keepOriginal = Dogiri.fileSwapped || !(Dogiri.nodes?.deleteOriginal.checked ?? true);
    Dogiri.close();
    deliver?.(exported, keepOriginal);
  },
};

export default Dogiri;
