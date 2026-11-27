type Icon = (name: string, size?: number) => string;
export function gameShell(icon: Icon) {
  const tools = [['map', 'map', 'Region map', 'Map', 'M']];
  return `<div class="scene-shade" aria-hidden="true"></div><header class="masthead">
    <div class="party-plaque"><div id="player-avatar"></div><div class="party-location"><div id="location"></div><div id="role-compact"></div></div></div>
    <div class="journey-clock"><div id="time-tools"></div><div id="match-status"></div></div>
    <div class="header-tools"><span id="save-state" class="save-state sr-only">Autosave</span><button class="icon-button menu-button" data-action="tools" aria-label="Menu" title="Menu [Esc / Start]">${icon('book', 18)}<span>Menu</span></button></div>
  </header><div class="game-layout"><main class="main-stage">
    <div id="world-wrap"><div id="world"></div><div id="journey-view" hidden><canvas id="journey-canvas"></canvas><div id="journey-caption"></div></div><div id="speech-layer" role="log" aria-label="Nearby conversations" aria-live="polite"></div><div id="world-label"></div><div id="world-status"></div><div id="effects" class="hud-effects"></div><div id="movement-tools" aria-label="Movement and cover"></div><div id="context-prompt"></div><div id="stealth-announcement" class="sr-only" role="status" aria-live="polite"></div><div id="toast" role="status"></div></div>
    <div id="role-intro" role="status" aria-live="polite"></div><div id="game-notice" role="status" aria-live="polite"></div><div id="capture-moment" role="status" aria-live="assertive"></div><div id="objective" class="route-objective"></div>
    <section class="hand-section" aria-label="Your card hand"><div class="tray-status"><button class="tray-toggle" data-action="toggle-tray" aria-label="Expand card tray" aria-expanded="false" aria-controls="hand" title="Open or stow your hand [R / LB]">${icon('cards', 17)}<span id="hand-heading"></span>${icon('expand', 14)}</button></div><div id="hand"></div></section>
  </main><nav class="rail-nav" aria-label="Field tools">${tools.map(([action, glyph, label, short, key]) => `<button data-action="${action}" title="${label} [${key}]" aria-label="${label}" class="nav-button">${icon(glyph, 22)}<span>${short}</span><kbd>${key}</kbd></button>`).join('')}</nav>
  <aside id="live-notebook" class="field-panel" aria-label="Live notebook" hidden><div class="field-title"><span>Pocket notebook</span><button class="icon-button" data-action="toggle-notebook" aria-label="Collapse live notebook" title="Close notebook">${icon('close', 18)}</button></div><div id="role-panel"></div><div id="companion"></div><div id="activity"></div></aside></div>
  <div id="coach"></div><div id="overlay"></div><footer class="app-footer" hidden></footer><input id="save-file" type="file" accept="application/json" hidden/>`;
}
