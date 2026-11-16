/**
 * The "Support the project" popup: the settings that are kept between sessions and the rules for when to show it
 * and which text to show. Pure functions without imports: the client, the server and the tests all use them.
 * `random` is injected (Math.random in the application) so that the rules can be tested.
 */

/**
 * The popup appears after every N actions with games (a game added, deleted or edited: renamed, its title, short name or
 * tags changed); N is chosen at random in this range (both ends included).
 */
export const DONATE_THRESHOLD_MIN = 8;
export const DONATE_THRESHOLD_MAX = 10;
/**
 * With the automatic popup switched off, a rarer reminder remains: the popup appears at the start of the application,
 * at most once in this period, and only after the application has been used on more than this many days (a day of use
 * is a calendar day on which it was started at least once).
 */
export const DONATE_LAUNCH_MIN_DAYS = 3;
export const DONATE_LAUNCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** The launch reminder waits this long after the start, so that the interface is loaded and settled. */
export const DONATE_LAUNCH_DELAY_MS = 4000;
/** The text changes this often while the popup is open. */
export const DONATE_ROTATE_MS = 5000;
/** The two kinds of texts, in the order in which they alternate: for the author's beer, for the project's development. */
export const DONATE_KINDS = ['beer', 'dev'] as const;
export type DonateKind = (typeof DONATE_KINDS)[number];
export const DONATE_TEXTS_PER_KIND = 4;

/** Kept in the application settings (not in localStorage: the desktop app's origin changes with its random port). */
export interface DonateSettings {
  /** The popup may appear on its own after actions with games. The footer button always works. */
  autoShow: boolean;
  /** Actions with games since the popup was last shown. */
  counter: number;
  /** After how many games the popup appears next; 0 — not chosen yet. */
  threshold: number;
  /** The local calendar day of the first start (`YYYY-MM-DD`); '' — not recorded yet. */
  firstLaunch: string;
  /** Calendar days on which the application was started. */
  usageDays: number;
  /** The last of those days (`YYYY-MM-DD`): a start on the same day is not counted again. */
  lastUsageDay: string;
  /** When the popup was last shown, by itself or by the footer button (ms since 1970); 0 — never. */
  lastShownAt: number;
}

export type Random = () => number;

export const defaultDonate = (): DonateSettings => ({
  autoShow: true,
  counter: 0,
  threshold: 0,
  firstLaunch: '',
  usageDays: 0,
  lastUsageDay: '',
  lastShownAt: 0,
});

const COUNTER_LIMIT = 100_000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOrEmpty = (value: unknown): string => (typeof value === 'string' && DAY.test(value) ? value : '');
const wholeNumber = (value: unknown, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;

const isValidThreshold = (value: number): boolean =>
  Number.isInteger(value) && value >= DONATE_THRESHOLD_MIN && value <= DONATE_THRESHOLD_MAX;

/** A settings value of unknown origin (a hand-edited file, an old version) turned into valid settings. */
export function normalizeDonate(value: unknown): DonateSettings {
  const base = defaultDonate();
  if (typeof value !== 'object' || value === null) return base;
  const raw = value as Record<string, unknown>;
  const counter = typeof raw['counter'] === 'number' && Number.isFinite(raw['counter']) ? Math.floor(raw['counter']) : base.counter;
  const threshold = typeof raw['threshold'] === 'number' ? raw['threshold'] : 0;
  return {
    autoShow: typeof raw['autoShow'] === 'boolean' ? raw['autoShow'] : base.autoShow,
    counter: Math.min(COUNTER_LIMIT, Math.max(0, counter)),
    threshold: isValidThreshold(threshold) ? threshold : 0, // anything else: a new threshold is chosen at the next count
    firstLaunch: dayOrEmpty(raw['firstLaunch']),
    usageDays: wholeNumber(raw['usageDays'], COUNTER_LIMIT),
    lastUsageDay: dayOrEmpty(raw['lastUsageDay']),
    lastShownAt: wholeNumber(raw['lastShownAt'], Number.MAX_SAFE_INTEGER),
  };
}

/** An integer from `min` to `max`, both included. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
}

export const pickThreshold = (random: Random): number => randomInt(random, DONATE_THRESHOLD_MIN, DONATE_THRESHOLD_MAX);

/**
 * Counts actions with games: one operation adds as many as games it touched (deleting 5 checked games counts 5). `due`
 * is true when the threshold is reached; it is one boolean per operation, so a batch asks for the popup once. While the
 * automatic popup is off nothing is counted.
 */
export function countActions(state: DonateSettings, actions: number, random: Random): { state: DonateSettings; due: boolean } {
  if (!state.autoShow || !Number.isFinite(actions) || actions <= 0) return { state, due: false };
  const threshold = isValidThreshold(state.threshold) ? state.threshold : pickThreshold(random);
  const counter = Math.min(COUNTER_LIMIT, state.counter + Math.floor(actions));
  return { state: { ...state, counter, threshold }, due: counter >= threshold };
}

/** The popup was shown: the counter starts again and a new random threshold is chosen. */
export const afterShown = (state: DonateSettings, random: Random, now: number): DonateSettings => ({
  ...state,
  counter: 0,
  threshold: pickThreshold(random),
  lastShownAt: now,
});

/** The local calendar day of a moment, `YYYY-MM-DD` (the user's time zone: a day of use is the user's day). */
export function localDay(at: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * The application has started: the first start and the days of use are recorded (once per calendar day). `due` is
 * true when the launch reminder should show the popup: the automatic popup is switched off in the settings, the
 * application has been used on more than DONATE_LAUNCH_MIN_DAYS days (counting today), and the popup was not shown
 * in the last 24 hours. A last show in the future (the clock was set back) does not block the reminder for good.
 */
export function registerLaunch(state: DonateSettings, now: Date): { state: DonateSettings; due: boolean } {
  const today = localDay(now);
  const next: DonateSettings = { ...state };
  if (!next.firstLaunch) next.firstLaunch = today;
  if (next.lastUsageDay !== today) {
    next.usageDays = Math.min(COUNTER_LIMIT, next.usageDays + 1);
    next.lastUsageDay = today;
  }
  const time = now.getTime();
  const sinceShown = next.lastShownAt > time ? Number.POSITIVE_INFINITY : time - next.lastShownAt;
  const due = !next.autoShow && next.usageDays > DONATE_LAUNCH_MIN_DAYS && sinceShown >= DONATE_LAUNCH_INTERVAL_MS;
  const changed = next.firstLaunch !== state.firstLaunch || next.usageDays !== state.usageDays || next.lastUsageDay !== state.lastUsageDay;
  return { state: changed ? next : state, due };
}

/** Which text is on screen and where the next text of each kind comes from. */
export interface DonateCursor {
  kind: DonateKind;
  /** 0-based index of the current text within its kind. */
  index: number;
  /** The next text of each kind. */
  next: Record<DonateKind, number>;
}

const otherKind = (kind: DonateKind): DonateKind => (kind === 'beer' ? 'dev' : 'beer');

/** Every opening of the popup starts with a random text of a random kind. */
export function startCursor(random: Random): DonateCursor {
  const kind = DONATE_KINDS[randomInt(random, 0, DONATE_KINDS.length - 1)] ?? 'beer';
  const index = randomInt(random, 0, DONATE_TEXTS_PER_KIND - 1);
  const next: Record<DonateKind, number> = { beer: 0, dev: 0 };
  next[kind] = (index + 1) % DONATE_TEXTS_PER_KIND;
  next[otherKind(kind)] = randomInt(random, 0, DONATE_TEXTS_PER_KIND - 1);
  return { kind, index, next };
}

/** The kinds alternate (beer → development → beer …); within a kind the texts go one after another. */
export function advanceCursor(cursor: DonateCursor): DonateCursor {
  const kind = otherKind(cursor.kind);
  const index = cursor.next[kind];
  return { kind, index, next: { ...cursor.next, [kind]: (index + 1) % DONATE_TEXTS_PER_KIND } };
}

/** Translation key of a text: `donate.beer.1` … `donate.dev.4`. */
export const donateTextKey = (cursor: DonateCursor): string => `donate.${cursor.kind}.${cursor.index + 1}`;
