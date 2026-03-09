'use client';

import type { ThemeContrastReport } from '@/lib/color-utils';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface ContrastChipProps {
  report: ThemeContrastReport;
  className?: string;
}

export function ContrastChip({ report, className }: ContrastChipProps) {
  const getStatusIcon = () => {
    switch (report.level) {
      case 'AAA':
        return <CheckCircle2 className="size-3.5" />;
      case 'AA':
        return <CheckCircle2 className="size-3.5" />;
      case 'fail':
        return <XCircle className="size-3.5" />;
    }
  };

  const getStatusColor = () => {
    switch (report.level) {
      case 'AAA':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'AA':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'fail':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const getStatusText = () => {
    switch (report.level) {
      case 'AAA':
        return 'AAA';
      case 'AA':
        return 'AA';
      case 'fail':
        return 'Fail';
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
        getStatusColor(),
        className
      )}
    >
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
}

interface ContrastWarningProps {
  report: ThemeContrastReport;
  onAutoFix?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ContrastWarning({
  report,
  onAutoFix,
  onDismiss,
  className,
}: ContrastWarningProps) {
  if (report.overall === 'pass') return null;

  interface FailedCheck {
    label: string;
    ratio: number;
    required: number;
  }

  const failedChecks: FailedCheck[] = [
    !report.textVsBackground.passes && {
      label: 'Text vs Background',
      ratio: report.textVsBackground.ratio,
      required: 4.5,
    },
    !report.largeTextVsBackground.passes && {
      label: 'Large Text',
      ratio: report.largeTextVsBackground.ratio,
      required: 3,
    },
    !report.accentVsBackground.passes && {
      label: 'Accent vs Background',
      ratio: report.accentVsBackground.ratio,
      required: 3,
    },
    !report.borderVsSurface.passes && {
      label: 'Border vs Surface',
      ratio: report.borderVsSurface.ratio,
      required: 3,
    },
  ].filter((check): check is FailedCheck => check !== false);

  return (
    <div
      className={cn(
        'rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 text-yellow-500 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-yellow-200">
            Contrast Issues Detected
          </p>
          <div className="space-y-1">
            {failedChecks.map((check, index) => (
              <p key={index} className="text-xs text-yellow-300/80">
                {check.label}: {check.ratio.toFixed(1)}:1 (needs {check.required}:1)
              </p>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 pt-1">
        {onAutoFix && (
          <button
            onClick={onAutoFix}
            className="text-xs font-medium text-yellow-300 hover:text-yellow-200 transition-colors"
          >
            Auto-Fix
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs font-medium text-yellow-300/60 hover:text-yellow-300 transition-colors ml-auto"
          >
            Ignore
          </button>
        )}
      </div>
    </div>
  );
}
