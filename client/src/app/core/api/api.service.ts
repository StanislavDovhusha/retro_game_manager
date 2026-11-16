import { HttpClient, HttpErrorResponse, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, filter, map, throwError } from 'rxjs';
import type {
  AddGameRequest, AddGameResponse, AddProgressResponse, CsvDataResponse, CsvPreviewRequest, CsvPreviewResponse, CsvSaveRequest, CsvSaveResponse,
  DeleteGameRequest, DeleteGameResponse, DeleteGamesRequest, DeleteGamesResponse, DeleteImageRequest, DeleteImageResponse,
  DialogFileKind, DevicesResponse, UpdateStatusResponse, InspectRequest, InspectResponse, InspectSetRequest, LibraryResponse, PlanDescription, LogResponse, MissingApplyRequest,
  MissingApplyResponse, MissingPreviewResponse, OkResponse, OpenBackupsResponse, PathResponse, PathsResponse, PickFileRequest, SdPlatformRequest,
  SdPlatformResponse, SdRootRequest, SdRootResponse, SdStateResponse, SdVerifyResponse, SdPlatformsResponse, SdPlatformClearResponse, SdTreeResponse, SearchIndexResponse, EmulatorStatusResponse, EmulatorLaunchRequest, EmulatorLaunchResponse, SetImageRequest, SetImageResponse,
  RenameGameRequest, RenameGameResponse, UpdateEntryRequest, UpdateEntryResponse, RenamePlanResponse, RenamePreviewRequest, SettingsPatch, SettingsResponse, SettingsSavedResponse, SyncApplyRequest, SyncApplyResponse, SyncPreviewResponse, UploadResponse,
} from '@shared/api';
import type { FileKind } from '@shared/models';
import { DesktopService } from '../desktop/desktop.service';
import { I18nService } from '../i18n/i18n.service';
import { ApiError } from './api-error';

/** Upload progress: `ratio` is 0…1; `result` appears when the upload completes. */
export interface UploadState {
  ratio: number;
  result?: UploadResponse;
}

const isErrorBody = (v: unknown): v is { error: string } =>
  typeof v === 'object' && v !== null && 'error' in v && typeof (v as { error: unknown }).error === 'string';

/** All calls to the server (REST /api/*). Request and response types come from shared/api. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly desktop = inject(DesktopService);

  private toApiError(err: unknown, uploading = false): ApiError {
    if (!(err instanceof HttpErrorResponse)) return new ApiError(err instanceof Error ? err.message : String(err), 0);
    if (err.status === 0) return new ApiError(this.i18n.t('errors.network'), 0);
    if (isErrorBody(err.error)) return new ApiError(err.error.error, err.status);
    return new ApiError(
      uploading ? this.i18n.t('errors.upload', { status: err.status }) : this.i18n.t('errors.server', { status: err.status }),
      err.status,
    );
  }

  private request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Observable<T> {
    const call = method === 'GET'
      ? this.http.get<T>(url)
      : this.http.request<T>(method, url, { body: body ?? {} });
    return call.pipe(catchError((e: unknown) => throwError(() => this.toApiError(e))));
  }

  private fromBridge<T>(call: () => Promise<T>): Observable<T> {
    return defer(call).pipe(catchError((e: unknown) => throwError(() => new ApiError(e instanceof Error ? e.message : String(e), 500))));
  }

  // ── Settings and system dialogs ──
  getSettings(): Observable<SettingsResponse> { return this.request('GET', '/api/settings'); }
  saveSettings(patch: SettingsPatch): Observable<SettingsSavedResponse> { return this.request('PUT', '/api/settings', patch); }
  /** Opens the backup folder (on the computer the server runs on) in the system file manager. */
  openBackupsFolder(): Observable<OpenBackupsResponse> { return this.request('POST', '/api/backups/open', {}); }
  // In the desktop app the pickers are Electron's native dialogs, reached through the preload bridge;
  // in a browser the server opens the dialog of the operating system.
  pickFolder(): Observable<PathResponse> {
    const bridge = this.desktop.bridge;
    return bridge ? this.fromBridge(async () => ({ path: await bridge.pickFolder() })) : this.request('POST', '/api/dialog/folder');
  }
  pickFile(kind: DialogFileKind): Observable<PathResponse> {
    const bridge = this.desktop.bridge;
    if (bridge) return this.fromBridge(async () => ({ path: await bridge.pickFile(kind) }));
    const body: PickFileRequest = { kind };
    return this.request('POST', '/api/dialog/file', body);
  }
  pickFiles(kind: 'game'): Observable<PathsResponse> {
    const bridge = this.desktop.bridge;
    if (bridge) return this.fromBridge(async () => ({ paths: await bridge.pickFiles(kind) }));
    const body: PickFileRequest = { kind, multiple: true };
    return this.request('POST', '/api/dialog/file', body);
  }

  // ── SD card ──
  sdState(): Observable<SdStateResponse> { return this.request('GET', '/api/sd'); }
  /** On start: the saved card is checked; an unavailable one is forgotten (see `SdVerifyResponse`). */
  verifySdRoot(): Observable<SdVerifyResponse> { return this.request('POST', '/api/sd/verify', {}); }
  setSdRoot(root: string): Observable<SdRootResponse> {
    const body: SdRootRequest = { root };
    return this.request('PUT', '/api/sd/root', body);
  }
  sdTree(rel: string): Observable<SdTreeResponse> { return this.request('GET', `/api/sd/tree?rel=${encodeURIComponent(rel)}`); }
  selectPlatform(name: string): Observable<SdPlatformResponse> {
    const body: SdPlatformRequest = { name };
    return this.request('PUT', '/api/sd/platform', body);
  }
  /** The platform list of the main screen, with the number of games of each platform. */
  sdPlatforms(): Observable<SdPlatformsResponse> { return this.request('GET', '/api/sd/platforms'); }
  /** "All platforms": the platform is no longer chosen. */
  clearPlatform(): Observable<SdPlatformClearResponse> { return this.request('DELETE', '/api/sd/platform', {}); }

  // ── Library ──
  getLibrary(): Observable<LibraryResponse> { return this.request('GET', '/api/library'); }
  // ── Emulator (desktop application) ──
  emulatorStatus(rel?: string): Observable<EmulatorStatusResponse> {
    return this.request('GET', rel ? `/api/emulator?rel=${encodeURIComponent(rel)}` : '/api/emulator');
  }
  /** The console models and the profile of the chosen one. */
  devices(): Observable<DevicesResponse> { return this.request('GET', '/api/devices'); }
  /** The start-up check for a newer version (the server checks GitHub at most once a day). */
  updateStatus(): Observable<UpdateStatusResponse> { return this.request('GET', '/api/update'); }
  /** "Check now": the server checks GitHub at once. */
  checkUpdates(): Observable<UpdateStatusResponse> { return this.request('POST', '/api/update/check', {}); }
  launchGame(rel: string): Observable<EmulatorLaunchResponse> {
    const body: EmulatorLaunchRequest = { rel };
    return this.request('POST', '/api/emulator/launch', body);
  }
  /** The games of every platform folder of the card (the global search). */
  searchIndex(): Observable<SearchIndexResponse> { return this.request('GET', '/api/search/index'); }
  deleteGame(rel: string, removeFromCsv: boolean): Observable<DeleteGameResponse> {
    const body: DeleteGameRequest = { rel, removeFromCsv, confirmed: true };
    return this.request('DELETE', '/api/games', body);
  }
  deleteGames(rels: string[], removeFromCsv: boolean): Observable<DeleteGamesResponse> {
    const body: DeleteGamesRequest = { rels, removeFromCsv, confirmed: true };
    return this.request('DELETE', '/api/games/batch', body);
  }
  deleteImage(rel: string): Observable<DeleteImageResponse> {
    const body: DeleteImageRequest = { rel, confirmed: true };
    return this.request('DELETE', '/api/games/image', body);
  }
  setImage(rel: string, imagePath: string): Observable<SetImageResponse> {
    const body: SetImageRequest = { rel, imagePath };
    return this.request('PUT', '/api/games/image', body);
  }
  previewRename(rel: string, title: string): Observable<RenamePlanResponse> {
    const body: RenamePreviewRequest = { rel, title };
    return this.request('POST', '/api/games/rename/preview', body);
  }
  renameGame(rel: string, title: string): Observable<RenameGameResponse> {
    const body: RenameGameRequest = { rel, title, confirmed: true };
    return this.request('POST', '/api/games/rename', body);
  }
  /** Changes the title (renames the files), the short name or the tags of a game from the table. */
  updateEntry(request: UpdateEntryRequest): Observable<UpdateEntryResponse> {
    return this.request('PUT', '/api/games/entry', request);
  }
  /** Cover URL (a plain <img>); `version` changes on every scan so the browser does not keep a stale picture. */
  imageUrl(rel: string, version: number | string): string {
    return `/api/games/image?rel=${encodeURIComponent(rel)}&v=${version}`;
  }

  // ── CSV ───
  getCsvData(): Observable<CsvDataResponse> { return this.request('GET', '/api/csv/data'); }
  saveCsvData(rows: string[][]): Observable<CsvSaveResponse> {
    const body: CsvSaveRequest = { rows };
    return this.request('PUT', '/api/csv/data', body);
  }
  previewCsv(override: CsvPreviewRequest): Observable<CsvPreviewResponse> { return this.request('POST', '/api/csv/preview', override); }
  previewMissing(): Observable<MissingPreviewResponse> { return this.request('POST', '/api/csv/missing/preview'); }
  removeMissing(expected: number): Observable<MissingApplyResponse> {
    const body: MissingApplyRequest = { expected, confirmed: true };
    return this.request('POST', '/api/csv/missing/apply', body);
  }

  // ── Adding a game ──
  inspectFile(kind: FileKind, path: string): Observable<InspectResponse> {
    const body: InspectRequest = { kind, path };
    return this.request('POST', '/api/add/inspect', body);
  }
  inspectGameSet(paths: string[]): Observable<PlanDescription> {
    const body: InspectSetRequest = { paths };
    return this.request('POST', '/api/add/inspect-set', body);
  }
  discardUpload(id: string): Observable<OkResponse> { return this.request('DELETE', `/api/upload/${encodeURIComponent(id)}`); }
  addGame(body: AddGameRequest): Observable<AddGameResponse> { return this.request('POST', '/api/games/add', body); }
  /** What the server is doing with the game being added (unpacking ECM, building the .img) and how far it got. */
  addProgress(): Observable<AddProgressResponse> { return this.request('GET', '/api/add/progress'); }

  /** Uploads a dropped file (the browser has no path on disk) and reports progress. */
  uploadFile(kind: FileKind, file: File): Observable<UploadState> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    });
    return this.http.put<UploadResponse>(`/api/upload?kind=${kind}`, file, { headers, observe: 'events', reportProgress: true }).pipe(
      map((event): UploadState | null => {
        if (event.type === HttpEventType.UploadProgress) return { ratio: event.total ? event.loaded / event.total : 0 };
        if (event.type === HttpEventType.Response && event.body) return { ratio: 1, result: event.body };
        return null;
      }),
      filter((s): s is UploadState => s !== null),
      catchError((e: unknown) => throwError(() => this.toApiError(e, true))),
    );
  }

  // ── Sync and log ──
  previewSync(): Observable<SyncPreviewResponse> { return this.request('POST', '/api/sync/preview'); }
  applySync(): Observable<SyncApplyResponse> {
    const body: SyncApplyRequest = { confirmed: true };
    return this.request('POST', '/api/sync/apply', body);
  }
  getLog(): Observable<LogResponse> { return this.request('GET', '/api/log'); }
}
