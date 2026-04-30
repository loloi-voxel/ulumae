'use client';

import { useState } from 'react';
import { ChevronRight, Download, Loader2 } from 'lucide-react';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';

interface ArchiveExportActionProps {
  memorialId: string;
  panelClassName?: string;
  buttonClassName?: string;
  title?: string;
  description?: string;
  summaryLabel?: string;
  summaryBusyLabel?: string;
  detailLabel?: string;
}

export default function ArchiveExportAction({
  memorialId,
  panelClassName = 'border border-warm-border/25 bg-white p-6 rounded-none',
  buttonClassName = 'w-full flex items-center justify-between gap-3 border border-warm-border/20 px-4 py-3 text-left text-sm text-warm-dark transition-colors hover:bg-surface-mid/50 disabled:opacity-60 disabled:cursor-wait rounded-none',
  title = 'Export this archive',
  description = 'Download a complete offline copy. Useful for backups and sharing with people who do not have an account.',
  summaryLabel = 'Portable archive export',
  summaryBusyLabel = 'Generating portable archive...',
  detailLabel = 'Full offline ZIP copy of this memorial',
}: ArchiveExportActionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runExport = async () => {
    setShowConfirm(false);
    setErrorMessage(null);

    try {
      setIsExporting(true);

      const response = await fetch('/api/arche/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memorialId }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.downloadUrl) {
        throw new Error(payload?.error || 'Could not export this archive right now.');
      }

      const link = document.createElement('a');
      link.href = payload.downloadUrl;
      link.download = payload.filename || 'archive.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not export this archive right now.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className={panelClassName}>
        <h4 className="font-serif text-base text-warm-dark mb-4">{title}</h4>
        <p className="text-xs text-warm-muted mb-4 leading-relaxed">{description}</p>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isExporting}
          className={buttonClassName}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center bg-surface-mid rounded-none">
              {isExporting ? (
                <Loader2 size={14} className="text-warm-muted animate-spin" />
              ) : (
                <Download size={14} className="text-warm-muted" />
              )}
            </div>
            <div>
              <p className="font-serif">{isExporting ? summaryBusyLabel : summaryLabel}</p>
              <p className="text-xs text-warm-outline">{detailLabel}</p>
            </div>
          </div>
          <ChevronRight size={15} className="text-warm-outline flex-shrink-0" />
        </button>
        {errorMessage && <p className="mt-3 text-xs text-red-600">{errorMessage}</p>}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Generate the portable archive export?"
        description="This can take a minute to package your text, metadata, and included media into a downloadable archive."
        confirmLabel="Generate export"
        onConfirm={runExport}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
