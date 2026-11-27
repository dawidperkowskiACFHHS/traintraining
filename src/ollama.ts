import type { State } from './types';
import { seekerView } from './simulation';
import { seekerMenu, hiderMenu, parseNpcReply, offerNpcAdvice, clearNpcAdvice } from './npc-advice';
import { residentView, acceptResidentReply } from './residents';

export const OLLAMA_KEY = 'last-stop-ollama-v1';
const endpoint = 'http://127.0.0.1:11434';
export const ollamaSettings = { enabled: true, model: '' };
export const ollamaStatus: {
  phase: 'checking' | 'ready' | 'offline' | 'off';
  models: { name: string; size: number }[];
  model: string;
  detail: string;
  busy: boolean;
  plans: number;
} = { phase: 'checking', models: [], model: '', detail: 'Checking local Ollama…', busy: false, plans: 0 };
export class OllamaNpcs {
  private pending: AbortController | null = null;
  private nextCheck = 0;
  private nextRequest = 0;
  private turn = 1;
  private epoch = 0;
  private checking = false;
  private nextResident = 6000;
  private residentTurn = 0;
  constructor(
    private getState: () => State,
    private changed: () => void,
  ) {
    try {
      const saved = JSON.parse(localStorage.getItem(OLLAMA_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        ollamaSettings.enabled = typeof saved.enabled === 'boolean' ? saved.enabled : true;
        ollamaSettings.model = typeof saved.model === 'string' ? saved.model.slice(0, 120) : '';
      }
    } catch {
      /* Defaults work without local storage. */
    }
  }
  configure(enabled: boolean, model = ollamaSettings.model) {
    this.epoch++;
    this.pending?.abort();
    this.pending = null;
    ollamaStatus.busy = false;
    ollamaSettings.enabled = enabled;
    ollamaSettings.model = model;
    clearNpcAdvice(this.getState());
    for (const resident of this.getState().residents ?? []) resident.advice = undefined;
    try {
      localStorage.setItem(OLLAMA_KEY, JSON.stringify(ollamaSettings));
    } catch {
      /* Match play remains available. */
    }
    this.nextRequest = 0;
    void this.connect();
  }
  async connect() {
    const epoch = this.epoch;
    if (!ollamaSettings.enabled) {
      ollamaStatus.phase = 'off';
      ollamaStatus.detail = 'Classic NPCs';
      this.changed();
      return;
    }
    if (this.checking) return;
    this.checking = true;
    ollamaStatus.phase = 'checking';
    ollamaStatus.detail = 'Checking local Ollama…';
    this.changed();
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(`${endpoint}/api/tags`, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('Ollama is not responding.');
      const data = (await response.json()) as {
        models?: { name: string; size: number; remote_host?: string; remote_model?: string }[];
      };
      if (epoch !== this.epoch || !ollamaSettings.enabled) return;
      const models = (data.models ?? [])
        .filter(
          (model) =>
            typeof model.name === 'string' &&
            !/cloud/i.test(model.name) &&
            !model.remote_host &&
            !model.remote_model &&
            Number.isFinite(model.size),
        )
        .sort((a, b) => a.size - b.size)
        .slice(0, 100);
      ollamaStatus.models = models;
      if (!models.length) throw new Error('No local models found. Add a model in Ollama, then reconnect.');
      ollamaStatus.model =
        models.find((model) => model.name === ollamaSettings.model)?.name ?? models[0].name;
      ollamaStatus.phase = 'ready';
      ollamaStatus.detail = `Connected · ${ollamaStatus.model}`;
    } catch (error) {
      if (epoch !== this.epoch || !ollamaSettings.enabled) return;
      ollamaStatus.phase = 'offline';
      ollamaStatus.detail =
        error instanceof Error && error.message.startsWith('No local')
          ? error.message
          : 'Ollama unavailable · classic NPCs are playing. Start Ollama and reconnect.';
    } finally {
      clearTimeout(timeout);
      this.checking = false;
      this.nextCheck = performance.now() + 30000;
      this.changed();
      if (epoch !== this.epoch) void this.connect();
    }
  }
  tick(now: number, allowPlanning: boolean) {
    if (!ollamaSettings.enabled) return;
    if (ollamaStatus.phase === 'offline' && now > this.nextCheck) void this.connect();
    if (!allowPlanning || ollamaStatus.phase !== 'ready' || this.pending || now < this.nextRequest) return;
    const state = this.getState();
    if (!['preparation', 'headstart', 'search'].includes(state.phase)) return;
    const chat = state.residentChat;
    const asked = chat && chat.station === state.actors[0].station && state.time - chat.at < 25;
    if (asked || (ollamaStatus.plans > 0 && now >= this.nextResident)) {
      const view = residentView(state, asked ? chat.index : this.residentTurn++ % 3);
      this.nextResident = now + 30000;
      if (view) {
        this.nextRequest = now + 8000;
        if (asked) state.residentChat = { ...chat, at: state.time };
        void this.requestResident(state, view);
        return;
      }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const id = this.turn;
      this.turn = id === 1 ? 2 : 1;
      const menu =
        id === state.hider
          ? hiderMenu(state, id)
          : state.phase === 'search'
            ? seekerMenu(seekerView(state, id))
            : null;
      if (!menu?.choices.length) continue;
      this.nextRequest = now + 8000;
      void this.request(state, id, menu);
      return;
    }
    // Residents can think during a human hider's quiet head start too.
    if (now >= this.nextResident) {
      const view = residentView(state, this.residentTurn++ % 3);
      this.nextResident = now + 30000;
      if (view) {
        this.nextRequest = now + 8000;
        void this.requestResident(state, view);
        return;
      }
    }
    this.nextRequest = now + 1500;
  }
  private async requestResident(state: State, view: NonNullable<ReturnType<typeof residentView>>) {
    const controller = new AbortController(),
      epoch = this.epoch;
    this.pending = controller;
    ollamaStatus.busy = true;
    this.changed();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaStatus.model,
          stream: false,
          think: false,
          keep_alive: '5m',
          options: { temperature: 0.65, num_predict: 120, num_ctx: 2048 },
          format: {
            type: 'object',
            properties: {
              choice: { type: 'integer', minimum: 0, maximum: view.choices.length - 1 },
              line: { type: 'string', maxLength: 160 },
            },
            required: ['choice', 'line'],
            additionalProperties: false,
          },
          messages: [
            {
              role: 'system',
              content:
                'You are a resident going about an ordinary day. Use the supplied name, occupation, hour and recent memories. Choose one provided activity by choice number. Say one natural, short first-person sentence about your work, day or next intention. You know only the nearby observations supplied. Never invent sightings, game clues, secrets or completed actions. Do not mention game rules or AI. Return JSON with choice and line.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                ...view.context,
                choices: view.choices.map(({ choice, action }) => ({ choice, action })),
              }),
            },
          ],
        }),
      });
      if (!response.ok) throw new Error('Resident response unavailable');
      const data = await response.json();
      if (epoch !== this.epoch || !ollamaSettings.enabled || state !== this.getState()) return;
      if (acceptResidentReply(state, view, data.message?.content)) ollamaStatus.plans++;
      else state.residentChat = null;
      ollamaStatus.detail = `Connected · ${ollamaStatus.model}`;
    } catch {
      if (epoch === this.epoch && ollamaSettings.enabled) {
        ollamaStatus.phase = 'offline';
        ollamaStatus.detail = 'Model response unavailable · daily routines continue.';
        this.nextCheck = performance.now() + 15000;
      }
    } finally {
      clearTimeout(timeout);
      if (this.pending === controller) {
        this.pending = null;
        ollamaStatus.busy = false;
      }
      this.changed();
    }
  }
  private async request(state: State, id: number, menu: NonNullable<ReturnType<typeof hiderMenu>>) {
    const controller = new AbortController();
    this.pending = controller;
    ollamaStatus.busy = true;
    this.changed();
    const epoch = this.epoch,
      round = state.round,
      hider = state.hider,
      station = state.actors[id].station,
      timeout = setTimeout(() => controller.abort(), 30000);
    const name = id === 1 ? 'Mira' : 'Kit';
    const personality =
      id === 1 ? 'careful, observant and practical' : 'curious, upbeat and willing to explore';
    const evidence =
      id === hider
        ? undefined
        : state.evidence
            .slice(-5)
            .map((item) => ({ question: item.question, answer: item.answer, excluded: item.excluded }));
    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaStatus.model,
          stream: false,
          think: false,
          keep_alive: '5m',
          options: { temperature: 0.4, num_predict: 140, num_ctx: 4096 },
          format: {
            type: 'object',
            properties: {
              choice: { type: 'integer', minimum: 0, maximum: menu.choices.length - 1 },
              line: { type: 'string', maxLength: 160 },
            },
            required: ['choice', 'line'],
            additionalProperties: false,
          },
          messages: [
            {
              role: 'system',
              content: `You are ${name}, a ${personality} traveler in a hide-and-seek game. Choose exactly one provided legal action by its zero-based choice number. Respect the human teammate's command. Speak one short first-person sentence about your intention. Never invent sightings, clues, answers or completed actions. Only use the observations supplied to you. Return JSON with choice and line.`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                ...menu.context,
                evidence,
                choices: menu.choices.map((choice, index) => ({ choice: index, action: choice.label })),
              }),
            },
          ],
        }),
      });
      if (!response.ok) throw new Error('Ollama could not generate a plan.');
      const data = (await response.json()) as { message?: { content?: string }; error?: string };
      const reply = parseNpcReply(data.message?.content, menu.choices);
      if (
        epoch !== this.epoch ||
        !ollamaSettings.enabled ||
        state !== this.getState() ||
        state.round !== round ||
        state.hider !== hider
      )
        return;
      if (reply.plan.kind === 'walk' && state.actors[id].station !== station) return;
      offerNpcAdvice(state, id, reply.plan, reply.line);
      ollamaStatus.plans++;
      ollamaStatus.detail = `Connected · ${ollamaStatus.model}`;
    } catch {
      if (epoch === this.epoch && ollamaSettings.enabled) {
        ollamaStatus.phase = 'offline';
        ollamaStatus.detail = 'Model response unavailable · classic NPCs are playing.';
        this.nextCheck = performance.now() + 15000;
      }
    } finally {
      clearTimeout(timeout);
      if (this.pending === controller) {
        this.pending = null;
        ollamaStatus.busy = false;
      }
      this.changed();
    }
  }
}
