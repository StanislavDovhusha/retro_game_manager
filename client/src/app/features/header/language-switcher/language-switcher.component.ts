import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lang } from '@shared/models';
import { LANG_META, type LangMeta } from '../../../core/i18n/lang-meta';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LANGUAGE_GROUPS, MENU_COLUMNS, TWO_COLUMN_MIN_WIDTH } from './language-menu.config';
import {
  menuColumnCount,
  menuGrid,
  menuGridTarget,
  menuTypeAhead,
  placeMenu,
  splitIntoColumns,
  type MenuGroup,
  type MenuPlacement,
} from './language-menu.logic';

/** The menu groups with the description of each language (languages without a description are left out). */
const GROUPS: readonly MenuGroup<LangMeta>[] = LANGUAGE_GROUPS.map((group) =>
  group.flatMap((code) => LANG_META.filter((meta) => meta.code === code)),
);

/**
 * Interface language: a menu button showing the current language; the menu lists the languages by their own names
 * (each in its own script) with a check mark at the current one, in the order of `LANGUAGE_GROUPS` as one continuous
 * list in two columns (one in a narrow window). It stays inside the window. Closes on a click outside, Esc and Tab; ↑/↓ move
 * within a column, ←/→ between the columns, Home/End and the first letter also move, Enter chooses. Presentational.
 */
@Component({
  selector: 'app-language-switcher',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'onDocumentPointer($event)', '(window:resize)': 'onWindowResize()' },
})
export class LanguageSwitcherComponent {
  readonly current = input.required<Lang>();
  readonly languageChange = output<Lang>();

  protected readonly open = signal(false);
  protected readonly currentMeta = computed<LangMeta>(() => LANG_META.find((l) => l.code === this.current()) ?? LANG_META[0]!);

  private readonly columnCount = signal(MENU_COLUMNS);
  private readonly columns = computed(() => splitIntoColumns(GROUPS, this.columnCount()));
  /** The languages of each column, top to bottom: the groups follow one another without a break. */
  protected readonly columnItems = computed(() => this.columns().map((column) => column.flat()));
  /** The languages in reading order: the order of the `#item` buttons. */
  private readonly ordered = computed(() => this.columnItems().flat());
  private readonly grid = computed(() => menuGrid(this.columns()));
  /** Where the menu is drawn; null until it is measured (it is then under the button, by its right edge). */
  protected readonly placement = signal<MenuPlacement | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.openMenu(this.current());
  }

  /** ↓/↑ (and Enter/Space, which click the button) open the menu from the button. */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.openMenu(event.key === 'ArrowUp' ? (this.ordered().at(-1)?.code ?? this.current()) : this.current());
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const index = this.focusedIndex();
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // the menu takes this Esc: an open dialog behind it stays open
      this.close(true);
      return;
    }
    if (event.key === 'Tab') {
      this.close(false); // the focus moves on as usual
      return;
    }
    const target =
      menuGridTarget(event.key, index, this.grid()) ??
      menuTypeAhead(
        event.key,
        index,
        this.ordered().map((l) => l.name),
      );
    if (target === null) return;
    event.preventDefault();
    this.focusItem(target);
  }

  protected choose(lang: Lang): void {
    this.close(true);
    if (lang !== this.current()) this.languageChange.emit(lang);
  }

  protected onDocumentPointer(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node | null)) this.close(false);
  }

  /** A resized window may need the other number of columns and another place; the focused language keeps the focus. */
  protected onWindowResize(): void {
    if (!this.open()) return;
    const focused = this.ordered()[this.focusedIndex()]?.code;
    this.columnCount.set(this.fittingColumns());
    this.placement.set(null);
    setTimeout(() => {
      this.place();
      if (focused) this.focusLang(focused);
    });
  }

  private openMenu(focus: Lang): void {
    this.columnCount.set(this.fittingColumns());
    this.placement.set(null);
    this.open.set(true);
    // The items exist once this change is rendered.
    setTimeout(() => {
      this.place();
      this.focusLang(focus);
    });
  }

  private close(returnFocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  private fittingColumns(): number {
    return menuColumnCount(window.innerWidth, MENU_COLUMNS, TWO_COLUMN_MIN_WIDTH);
  }

  /**
   * Measures the menu where it was first drawn and moves it inside the window (coordinates relative to the host).
   * Measured twice: a menu taller than the window gets its scroll bar only once the maximum height applies, and the
   * scroll bar makes it wider.
   */
  private place(again = true): void {
    const menu = this.menu()?.nativeElement;
    if (!menu || !this.open()) return;
    const anchor = this.trigger().nativeElement.getBoundingClientRect();
    const host = this.host.nativeElement.getBoundingClientRect();
    const view = document.documentElement;
    const inWindow = placeMenu(
      anchor,
      { width: menu.offsetWidth, height: menu.scrollHeight },
      { width: view.clientWidth, height: view.clientHeight },
    );
    this.placement.set({ ...inWindow, left: inWindow.left - host.left, top: inWindow.top - host.top });
    if (again) setTimeout(() => this.place(false));
  }

  private focusedIndex(): number {
    return this.items().findIndex((item) => item.nativeElement === document.activeElement);
  }

  private focusLang(code: Lang): void {
    this.focusItem(Math.max(0, this.ordered().findIndex((l) => l.code === code)));
  }

  private focusItem(index: number): void {
    this.items()[index]?.nativeElement.focus();
  }
}
