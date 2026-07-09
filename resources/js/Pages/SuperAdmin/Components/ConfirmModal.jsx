import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ConfirmModal({
  title = null,
  message = '',
  cancelLabel = null,
  confirmLabel = null,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('superAdminConfirmModalTitle');
  const resolvedCancelLabel = cancelLabel ?? t('commonNo');
  const resolvedConfirmLabel = confirmLabel ?? t('commonYes');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d3d5c]/80 px-6 py-10">
      <div className="w-full max-w-[520px] bg-white rounded-[24px] shadow-[0_20px_40px_rgba(15,23,42,0.2)] text-center px-6 sm:px-10 pt-8 pb-6 flex flex-col items-center gap-5">
        <h1 className="text-2xl font-semibold text-[#111827]">{resolvedTitle}</h1>
        {message && (
          <p className="text-base text-[#6b7280] whitespace-pre-line">{message}</p>
        )}
        <div className="mt-2 w-full flex items-center justify-center gap-3">
          <button type="button" onClick={onCancel} className="flex-1 h-[44px] rounded-full border border-gray-300 text-gray-700 font-medium">{resolvedCancelLabel}</button>
          <button type="button" onClick={onConfirm} className="flex-1 h-[44px] rounded-full bg-[#338DFF] text-white font-medium shadow">{resolvedConfirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
