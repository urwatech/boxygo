import React, { useRef, useState } from 'react';

export default function FileUpload({
    name, onChange, error,
    label = null,
    accept = '.pdf,.jpg,.jpeg,.png,.docx',
    uploadPlaceholderLabel = "PDF, Image, or DOCX (max 5MB)",
    multiple = false
}) {
    const [fileName, setFileName] = useState(multiple ? [] : '');
    const fileInputRef = useRef(null);

    const handleFileChange = (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            if (multiple) {
                const names = Array.from(files).map(file => file.name);
                setFileName(names);
                onChange(files);
            } else {
                setFileName(files[0].name);
                onChange(files[0]);
            }
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemove = (index = null) => {
        if (multiple && index !== null) {
            const newFiles = Array.from(fileName);
            newFiles.splice(index, 1);
            setFileName(newFiles);
            const dt = new DataTransfer();
            const currentFiles = Array.from(fileInputRef.current.files);
            currentFiles.forEach((file, i) => {
                if (i !== index) dt.items.add(file);
            });
            fileInputRef.current.files = dt.files;
            onChange(dt.files.length > 0 ? dt.files : null);
        } else {
            setFileName(multiple ? [] : '');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            onChange(null);
        }
    };

    return (
        <div>
            {label && <label className="block text-sm font-semibold text-blue-500 mb-1">
                {label}
            </label>}
            <div className="relative">
                <input
                    ref={fileInputRef}
                    type="file"
                    name={name}
                    onChange={handleFileChange}
                    accept={accept}
                    multiple={multiple}
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={handleClick}
                    className="w-full rounded-[20px] border-2 border-dashed border-[#e2e8f0] px-4 py-6 text-center hover:border-[#338dff] hover:bg-[#eff6ff] transition-colors cursor-pointer"
                >
                    <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <div>
                            <p className="text-xs text-[#64748b] mt-1">
                                {uploadPlaceholderLabel}
                            </p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Display selected files */}
            {multiple && fileName.length > 0 && (
                <div className="mt-3 space-y-2">
                    {fileName.map((name, index) => (
                        <div key={index} className="flex items-center justify-between bg-[#f8fafc] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-sm text-[#1f2937] truncate">{name}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                className="ml-2 text-[#ef4444] hover:text-[#dc2626] flex-shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {!multiple && fileName && (
                <div className="mt-3 flex items-center justify-between bg-[#f8fafc] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-[#1f2937] truncate">{fileName}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleRemove()}
                        className="ml-2 text-[#ef4444] hover:text-[#dc2626] flex-shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {error && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
            )}
        </div>
    );
}
