import { APPEARANCE_OPTIONS, APPEARANCE_LABELS, appearanceFields, type Appearance } from './appearance';
import { avatarArt } from './art';

export function characterEditor(appearance: Appearance, animate: boolean) {
  const art = avatarArt(appearance);
  return `<div class="character-editor">
    <div class="character-preview ${animate ? 'walking' : ''}" aria-label="Your character walking in all four directions" style="--sprite-sheet:url('${art.sheet}')">
      <div class="preview-directions">${['Up', 'Right', 'Down', 'Left'].map((label, index) => `<figure><span class="preview-sprite" role="img" aria-label="Walking ${label.toLowerCase()}" style="--direction:${index}"></span><figcaption>${label}</figcaption></figure>`).join('')}</div>
      <button class="text-button" data-action="preview-motion" aria-pressed="${animate}">${animate ? 'Pause preview' : 'Animate preview'}</button>
    </div>
    <div class="appearance-options">${appearanceFields
      .map((key) => {
        const choices: { label: string; color?: string }[] = APPEARANCE_OPTIONS[key];
        const current = choices[appearance[key]];
        return `<label class="appearance-row" for="appearance-${key}"><span>${APPEARANCE_LABELS[key]}</span><span class="appearance-choice">${current.color ? `<i class="color-chip" style="background:${current.color}" aria-hidden="true"></i>` : ''}<select id="appearance-${key}" data-appearance="${key}">${choices.map((choice, index) => `<option value="${index}" ${appearance[key] === index ? 'selected' : ''}>${choice.label}</option>`).join('')}</select></span></label>`;
      })
      .join(
        '',
      )}<p class="fine character-controls">Keyboard: Tab and arrow keys.<br/>Gamepad: d-pad to focus; A to edit, d-pad to change; A to finish. B cancels.</p></div>
    <div class="character-actions"><button class="outline-button" data-action="random-appearance">Randomize</button><span></span><button class="outline-button" data-action="cancel-appearance">Cancel</button><button class="primary-button" data-action="save-appearance">Save appearance</button></div>
  </div>`;
}
