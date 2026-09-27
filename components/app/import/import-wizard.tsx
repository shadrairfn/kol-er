'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getImportContextAction,
  importBaselineRowAction,
  importMetricsRowAction,
  type ImportContext,
} from '@/app/actions/import-actions';
import { BaselineDrawer } from '../baseline-drawer';
import { Icon } from '../icons';
import { Alert } from '../ui';
import { downloadText, toCsv } from '@/lib/csv';
import { profileUrlFor } from '@/lib/platform';
import type { Campaign, Kol } from '@/types/er';
import {
  TEMPLATES,
  cellText,
  fieldsFor,
  guessMapping,
  guessType,
  sampleOf,
  validate,
  type ImportType,
  type Mapping,
  type Sheet,
} from './import-model';
import { ImportQueue, type QueueRow } from './import-queue';

type Step = 'upload' | 'map' | 'queue';

const MAX_ROWS = 1000;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

const TYPE_LABEL: Record<ImportType, string> = {
  baseline: 'KOL + ER sebelum approach',
  metrics: 'Metrik setelah posting',
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function readSheet(file: File): Promise<Sheet> {
  if (file.size > MAX_BYTES)
    throw new Error('File lebih dari 5 MB. Pecah menjadi beberapa file.');
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet || !sheet['!ref'])
    throw new Error('File kosong atau tidak bisa dibaca.');
  const start = XLSX.utils.decode_range(sheet['!ref']).s.r;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true,
  });
  const filled = (row: unknown[]) => row.some((cell) => cellText(cell));
  const headerIndex = matrix.findIndex(filled);
  if (headerIndex < 0) throw new Error('Tidak ada data di sheet pertama.');
  const headers = matrix[headerIndex].map((cell) => cellText(cell));
  const rows = matrix
    .map((cells, index) => ({ line: start + index + 1, cells }))
    .slice(headerIndex + 1)
    .filter((row) => filled(row.cells));
  if (!rows.length)
    throw new Error('Header ditemukan, tetapi belum ada baris data.');
  if (rows.length > MAX_ROWS)
    throw new Error(
      `Maksimal ${MAX_ROWS} baris per impor (file berisi ${rows.length}).`,
    );
  return { fileName: file.name, size: file.size, sheetName, headers, rows };
}

export function ImportWizard({
  campaigns,
  initialType,
  initialCampaign,
}: {
  campaigns: Campaign[];
  initialType: ImportType | null;
  initialCampaign: string;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [type, setType] = useState<ImportType>(initialType ?? 'baseline');
  const [campaignId, setCampaignId] = useState(
    campaigns.some((campaign) => campaign.id === initialCampaign)
      ? initialCampaign
      : (campaigns[0]?.id ?? ''),
  );
  const [mapping, setMapping] = useState<Mapping>([]);
  const [context, setContext] = useState<ImportContext | null>(null);
  const [contextError, setContextError] = useState('');
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [afterMode, setAfterMode] = useState<'auto' | 'manual'>('auto');
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [running, setRunning] = useState(false);
  const [manualIndex, setManualIndex] = useState<number | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const contextRequest = useRef('');
  const queueRef = useRef<QueueRow[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const validation = useMemo(
    () =>
      sheet && step === 'map' ? validate(sheet, mapping, type, context) : null,
    [sheet, mapping, type, context, step],
  );
  const contextReady = !!context && context.type === type;
  const campaign = campaigns.find((item) => item.id === campaignId);

  async function loadContext(nextType: ImportType, nextCampaign: string) {
    const key = `${nextType}:${nextType === 'metrics' ? nextCampaign : ''}`;
    contextRequest.current = key;
    setContext(null);
    setContextError('');
    if (nextType === 'metrics' && !nextCampaign) return;
    const result = await getImportContextAction(nextType, nextCampaign);
    if (contextRequest.current !== key) return;
    if (result.ok) setContext(result.data);
    else setContextError(result.error);
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setFileError('');
    try {
      const parsed = await readSheet(file);
      const nextType = initialType ?? guessType(parsed.headers);
      setSheet(parsed);
      setType(nextType);
      setMapping(guessMapping(parsed.headers, nextType));
      setStep('map');
      void loadContext(nextType, campaignId);
    } catch (error) {
      setFileError(
        error instanceof Error ? error.message : 'File tidak bisa dibaca.',
      );
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function changeType(nextType: ImportType) {
    if (nextType === type) return;
    setType(nextType);
    if (sheet) setMapping(guessMapping(sheet.headers, nextType));
    void loadContext(nextType, campaignId);
  }

  function changeCampaign(id: string) {
    setCampaignId(id);
    void loadContext('metrics', id);
  }

  function changeMapping(column: number, field: string) {
    setMapping((current) =>
      current.map((value, index) =>
        index === column ? field : value === field && field ? '' : value,
      ),
    );
  }

  function downloadTemplate(kind: ImportType) {
    downloadText(
      `template-${kind === 'baseline' ? 'kol-baseline' : 'metrik-konten'}.csv`,
      toCsv([TEMPLATES[kind]]),
    );
  }

  function downloadErrors() {
    if (!sheet || !validation) return;
    downloadText(
      `error-${sheet.fileName.replace(/\.[^.]+$/, '')}.csv`,
      toCsv([
        ['Baris', 'Error', ...sheet.headers],
        ...validation.errorRows.map((row) => [
          row.line,
          row.text,
          ...row.cells.map(cellText),
        ]),
      ]),
    );
  }

  /* ----------------------------- queue ----------------------------- */

  function patchRow(index: number, patch: Partial<QueueRow>) {
    const next = queueRef.current.map((row, position) =>
      position === index ? { ...row, ...patch } : row,
    );
    queueRef.current = next;
    setQueue(next);
  }

  async function processRow(index: number) {
    const row = queueRef.current[index];
    if (!row || row.status === 'running' || row.status === 'done') return;
    patchRow(index, { status: 'running', error: undefined });
    if (row.item.type === 'baseline') {
      const result = await importBaselineRowAction(row.item.input);
      patchRow(
        index,
        result.ok
          ? { status: 'done', result: result.data, kolId: result.data.kolId }
          : { status: 'failed', error: result.error, kolId: result.kolId },
      );
    } else {
      const result = await importMetricsRowAction(campaignId, row.item.input);
      patchRow(
        index,
        result.ok
          ? { status: 'done' }
          : { status: 'failed', error: result.error },
      );
    }
  }

  async function runAll() {
    stopRef.current = false;
    setRunning(true);
    for (let index = 0; index < queueRef.current.length; index += 1) {
      if (stopRef.current) break;
      if (queueRef.current[index].status !== 'waiting') continue;
      await processRow(index);
    }
    setRunning(false);
  }

  async function runOne(index: number) {
    setRunning(true);
    await processRow(index);
    setRunning(false);
  }

  function startQueue() {
    if (!validation) return;
    const rows: QueueRow[] = validation.items.map((item) => ({
      item,
      status: 'waiting',
    }));
    queueRef.current = rows;
    setQueue(rows);
    setStep('queue');
    if (afterMode === 'auto') void runAll();
  }

  function reset() {
    queueRef.current = [];
    setQueue([]);
    setSheet(null);
    setMapping([]);
    setContext(null);
    setStep('upload');
  }

  const manualRow = manualIndex !== null ? queue[manualIndex] : null;
  const manualKol: Kol | null =
    manualRow && manualRow.item.type === 'baseline' && manualRow.kolId
      ? {
          id: manualRow.kolId,
          handle: manualRow.item.handle,
          name: manualRow.item.input.name,
          platform: manualRow.item.platform,
          profileUrl: profileUrlFor(
            manualRow.item.platform,
            manualRow.item.handle,
          ),
          followers: manualRow.item.followers,
          category: manualRow.item.input.category,
          approachedAt: '',
          status: 'pending',
          baseline: null,
          createdAt: '',
        }
      : null;

  /* ----------------------------- render ----------------------------- */

  const stepIndex = step === 'upload' ? 0 : step === 'map' ? 1 : 2;
  const errorsShown = validation?.errors.slice(0, 4) ?? [];
  const hiddenErrors = (validation?.errors.length ?? 0) - errorsShown.length;
  const ready = validation?.items.length ?? 0;
  const canContinue =
    !!validation && !validation.missingRequired && contextReady && ready > 0;

  return (
    <main className="kg-page" style={{ gap: 32 }}>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />

      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Import</h1>
          <p className="page-sub">
            {step === 'queue' && sheet
              ? `${sheet.fileName} · ${TYPE_LABEL[type]}${type === 'metrics' && campaign ? ` · ${campaign.name}` : ''}`
              : 'Impor banyak KOL atau metrik konten sekaligus dari CSV / Excel.'}
          </p>
        </div>
        {step !== 'queue' ? (
          <button
            type="button"
            className="link-btn"
            style={{ fontSize: 14 }}
            onClick={() => downloadTemplate(type)}
          >
            Unduh template CSV
          </button>
        ) : (
          !running && (
            <button
              type="button"
              className="link-btn"
              style={{ fontSize: 14 }}
              onClick={reset}
            >
              Impor file lain
            </button>
          )
        )}
      </div>

      <ol className="steps">
        {['Unggah file', 'Petakan & validasi', 'Proses'].map((label, index) => (
          <li
            key={label}
            className={`${index <= stepIndex ? 'reached' : ''} ${index === stepIndex ? 'current' : ''}`}
            aria-current={index === stepIndex ? 'step' : undefined}
          >
            <span className="step-no">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{label}</span>
            {index < stepIndex && (
              <Icon
                name="check"
                size={14}
                strokeWidth={2}
                aria-label="Selesai"
              />
            )}
          </li>
        ))}
      </ol>

      {step === 'upload' && (
        <section
          className={`dropzone${dragging ? ' over' : ''}`}
          aria-label="Unggah file"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void acceptFile(event.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="file" size={32} strokeWidth={1.5} />
          <p className="dropzone-title">
            {reading ? 'Membaca file…' : 'Tarik file CSV / Excel ke sini'}
          </p>
          <p
            className="muted"
            style={{ margin: 0, maxWidth: 520, lineHeight: 1.5 }}
          >
            Baris pertama berisi nama kolom. Kolom akan dipetakan otomatis dan
            bisa diubah di langkah berikutnya. Maksimal {MAX_ROWS} baris, 5 MB.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={reading}
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="upload" />
            Pilih file
          </button>
          <div
            className="actions"
            style={{ justifyContent: 'center', fontSize: 13 }}
          >
            <button
              type="button"
              className="link-btn"
              onClick={() => downloadTemplate('baseline')}
            >
              Template KOL + baseline
            </button>
            <span className="muted">·</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => downloadTemplate('metrics')}
            >
              Template metrik konten
            </button>
          </div>
          {fileError && (
            <p className="error-text" role="alert">
              {fileError}
            </p>
          )}
        </section>
      )}

      {step === 'map' && sheet && validation && (
        <div className="import-cols">
          <section className="import-main" aria-label="Petakan kolom">
            <div className="file-card">
              <div className="file-card-info">
                <Icon
                  name="file"
                  size={28}
                  strokeWidth={1.5}
                  style={{ flexShrink: 0 }}
                />
                <div className="cell-stack">
                  <span className="file-card-name">{sheet.fileName}</span>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    {sheet.rows.length} baris · {sheet.sheetName} ·{' '}
                    {formatSize(sheet.size)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn sm quiet"
                onClick={() => fileInput.current?.click()}
              >
                Ganti file
              </button>
            </div>
            {fileError && <Alert>{fileError}</Alert>}

            <fieldset
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <legend className="kg-eyebrow" style={{ marginBottom: 12 }}>
                Jenis data
              </legend>
              <div className="type-cards">
                <button
                  type="button"
                  className="type-card"
                  aria-pressed={type === 'baseline'}
                  onClick={() => changeType('baseline')}
                >
                  <span className="type-card-title">
                    <span className="square before" />
                    KOL + ER sebelum approach
                  </span>
                  <span className="type-card-desc">
                    Membuat baseline per akun. KOL yang sudah ada mendapat
                    snapshot baru, data lama tetap tersimpan.
                  </span>
                </button>
                <button
                  type="button"
                  className="type-card"
                  aria-pressed={type === 'metrics'}
                  onClick={() => changeType('metrics')}
                >
                  <span className="type-card-title">
                    <span className="square after" />
                    Metrik setelah posting
                  </span>
                  <span className="type-card-desc">
                    Snapshot performa per konten campaign. Tidak mengubah
                    baseline sebelum approach.
                  </span>
                </button>
              </div>
              {type === 'metrics' &&
                (campaigns.length ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      paddingTop: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <label
                      htmlFor="campaign"
                      className="field-label"
                      style={{ fontSize: 14 }}
                    >
                      Campaign
                    </label>
                    <select
                      id="campaign"
                      className="select sm"
                      style={{ width: 'auto', minWidth: 280 }}
                      value={campaignId}
                      onChange={(event) => changeCampaign(event.target.value)}
                    >
                      {campaigns.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Alert>
                    Belum ada campaign.{' '}
                    <Link href="/dashboard/campaigns">Buat campaign</Link> dan
                    tambahkan deliverable-nya dulu.
                  </Alert>
                ))}
            </fieldset>

            <div className="tbl-wrap">
              <table className="tbl compact" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ width: 180 }}>Kolom di file</th>
                    <th>Contoh nilai</th>
                    <th style={{ width: 40 }}>
                      <span className="sr-only">ke</span>
                    </th>
                    <th style={{ width: 240 }}>Field sistem</th>
                    <th style={{ width: 200 }}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.headers.map((header, column) => {
                    const field = fieldsFor(type).find(
                      (item) => item.key === mapping[column],
                    );
                    const label = header || `Kolom ${column + 1}`;
                    return (
                      <tr key={`${header}-${column}`}>
                        <td className="cell-strong">{label}</td>
                        <td
                          className="mono"
                          style={{
                            fontSize: 12,
                            color: 'var(--ink-2)',
                            maxWidth: 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sampleOf(sheet, column)}
                        </td>
                        <td>
                          <Icon
                            name="arrowRight"
                            style={{ color: 'var(--faint)' }}
                          />
                        </td>
                        <td>
                          <select
                            aria-label={`Field sistem untuk ${label}`}
                            className="select xs"
                            style={{
                              color: field ? 'var(--ink)' : 'var(--muted-2)',
                            }}
                            value={mapping[column] ?? ''}
                            onChange={(event) =>
                              changeMapping(column, event.target.value)
                            }
                          >
                            <option value="">(Abaikan kolom)</option>
                            {fieldsFor(type).map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {field ? field.note : 'Tidak diimpor'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="import-side" aria-label="Validasi">
            <section
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                paddingTop: 4,
              }}
            >
              <h2 className="kg-eyebrow">Validasi</h2>
              <div className="validation">
                <div>
                  <span className="validation-count">
                    {contextReady ? ready : '—'}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    baris siap diproses
                  </span>
                </div>
                <div>
                  <span className="validation-count red">
                    {contextReady ? validation.errors.length : '—'}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    baris error
                  </span>
                </div>
              </div>
              {validation.missingRequired ? (
                <p className="error-text">{validation.missingRequired}</p>
              ) : contextError ? (
                <Alert>{contextError}</Alert>
              ) : !contextReady ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {type === 'metrics' && !campaignId
                    ? 'Pilih campaign untuk mencocokkan URL konten.'
                    : 'Memeriksa data yang sudah ada di database…'}
                </p>
              ) : (
                <>
                  {errorsShown.map((issue) => (
                    <div key={`e-${issue.line}`} className="note-row">
                      <span className="mono red">BRS {issue.line}</span>
                      <span>{issue.text}</span>
                    </div>
                  ))}
                  {hiddenErrors > 0 && (
                    <div className="note-row">
                      <span className="mono red">+{hiddenErrors} BRS</span>
                      <span>Error lainnya ada di laporan error.</span>
                    </div>
                  )}
                  {validation.infos.map((issue) => (
                    <div key={issue.text} className="note-row">
                      <span className="mono">{issue.count} BRS</span>
                      <span>{issue.text}</span>
                    </div>
                  ))}
                  {validation.errors.length > 0 && (
                    <button
                      type="button"
                      className="link-btn"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={downloadErrors}
                    >
                      Unduh laporan error (.csv)
                    </button>
                  )}
                </>
              )}
            </section>

            <fieldset
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <legend className="kg-eyebrow" style={{ marginBottom: 12 }}>
                Setelah impor
              </legend>
              <label className="check-lg">
                <input
                  type="radio"
                  name="after"
                  checked={afterMode === 'auto'}
                  onChange={() => setAfterMode('auto')}
                />
                <span className="check-text">
                  <b style={{ fontWeight: 600 }}>Proses otomatis semua baris</b>
                  <span>
                    {type === 'baseline'
                      ? 'Ambil 12 postingan terakhir tiap akun (bila angka tidak ada di file) lalu hitung ER.'
                      : 'Hitung total engagement dan ER tiap konten.'}
                  </span>
                </span>
              </label>
              <label className="check-lg">
                <input
                  type="radio"
                  name="after"
                  checked={afterMode === 'manual'}
                  onChange={() => setAfterMode('manual')}
                />
                <span className="check-text">
                  <b style={{ fontWeight: 600 }}>Saya proses satu per satu</b>
                  <span>
                    Baris masuk antrian; jalankan lewat tombol di tiap baris.
                  </span>
                </span>
              </label>
            </fieldset>

            <button
              type="button"
              className="btn primary block"
              disabled={!canContinue}
              onClick={startQueue}
            >
              <span>Lanjut ke antrian ({contextReady ? ready : 0} baris)</span>
              <Icon name="arrowRight" size={18} />
            </button>
          </aside>
        </div>
      )}

      {step === 'queue' && (
        <ImportQueue
          rows={queue}
          running={running}
          campaignId={campaignId}
          onRun={(index) => void runOne(index)}
          onRunAll={() => void runAll()}
          onPause={() => {
            stopRef.current = true;
          }}
          onManual={setManualIndex}
        />
      )}

      {manualKol && manualIndex !== null && (
        <BaselineDrawer
          kol={manualKol}
          mode="manual"
          onClose={() => setManualIndex(null)}
          onSaved={(baseline) =>
            patchRow(manualIndex, {
              status: 'done',
              error: undefined,
              result: {
                kolId: baseline.kolId,
                followers: baseline.followers,
                postsAnalyzed: baseline.postsAnalyzed,
                avgEngagement: baseline.avgEngagement,
                erPercent: baseline.erPercent,
                basis: baseline.basis,
                source: baseline.source,
                version: baseline.version,
                existed: false,
              },
            })
          }
        />
      )}
    </main>
  );
}
