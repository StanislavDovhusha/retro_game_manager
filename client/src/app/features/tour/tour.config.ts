import type { TourSide } from './tour.logic';

/**
 * The steps of the start-up tour, in order. Change the tour here: the texts are in the dictionaries
 * (`tour.steps.<id>.title` and `.text`, en/uk/ru), the highlighted elements carry a `data-tour` attribute.
 */
export interface TourStep {
  /** Names the texts: `tour.steps.<id>.*`. */
  readonly id: 'sdCard' | 'platform' | 'addGame' | 'edit' | 'delete' | 'search';
  /**
   * Elements to highlight, most wanted first: the first one that is on screen is used. When none is (the table is not
   * shown yet, no game is selected…), the tooltip is shown in the middle of the window over the dimmed screen.
   */
  readonly targets: readonly string[];
  /** The step needs a chosen SD card: without one the tour pauses before it and goes on once a card is chosen. */
  readonly needsCard: boolean;
  /** The side of the tooltip that is tried first (another side is used when it does not fit). */
  readonly side: TourSide;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'sdCard', targets: ['[data-tour="sd-card"]'], needsCard: false, side: 'bottom' },
  // The platform cards of the main screen while no platform is open, otherwise the platform choice of the left panel.
  { id: 'platform', targets: ['[data-tour="platform-cards"]', '[data-tour="platform"]'], needsCard: true, side: 'bottom' },
  { id: 'addGame', targets: ['[data-tour="add-game"]'], needsCard: true, side: 'bottom' },
  { id: 'edit', targets: ['app-game-list app-game-row', 'app-game-list'], needsCard: true, side: 'bottom' },
  { id: 'delete', targets: ['[data-tour="delete-selected"]', '[data-tour="delete-game"]'], needsCard: true, side: 'bottom' },
  { id: 'search', targets: ['[data-tour="search"]'], needsCard: true, side: 'bottom' },
];
