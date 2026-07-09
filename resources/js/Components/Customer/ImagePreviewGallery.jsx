import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const isValidImage = (value) => typeof value === 'string' && value.trim() !== '';

export default function ImagePreviewGallery({
    images = [],
    altPrefix = 'image',
    galleryLabel = 'Image preview',
    containerClassName = 'flex gap-3 flex-wrap',
    thumbnailClassName = 'w-16 h-16 rounded-xl overflow-hidden border border-[#e5ecfb]',
    imageClassName = 'w-full h-full object-cover',
    emptyPlaceholderCount = 0,
    emptyPlaceholderClassName = 'w-16 h-16 rounded-xl bg-gray-200 overflow-hidden',
}) {
    const safeImages = useMemo(
        () => (Array.isArray(images) ? images.filter(isValidImage) : []),
        [images],
    );
    const [activeIndex, setActiveIndex] = useState(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (activeIndex === null || typeof window === 'undefined') {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setActiveIndex(null);
            }

            if (safeImages.length > 1 && event.key === 'ArrowRight') {
                setActiveIndex((current) => (current + 1) % safeImages.length);
            }

            if (safeImages.length > 1 && event.key === 'ArrowLeft') {
                setActiveIndex((current) => (current - 1 + safeImages.length) % safeImages.length);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeIndex, safeImages.length]);

    const activeImage = activeIndex !== null ? safeImages[activeIndex] : null;

    const showPrevious = () => {
        setActiveIndex((current) => (current - 1 + safeImages.length) % safeImages.length);
    };

    const showNext = () => {
        setActiveIndex((current) => (current + 1) % safeImages.length);
    };

    return (
        <>
            <div className={containerClassName}>
                {safeImages.length > 0 ? (
                    safeImages.map((url, index) => (
                        <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            className={`${thumbnailClassName} group relative cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#338DFF] focus:ring-offset-2`}
                            aria-label={`${galleryLabel} ${index + 1}`}
                        >
                            <img src={url} alt={`${altPrefix}-${index}`} className={imageClassName} />
                            <span className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
                        </button>
                    ))
                ) : (
                    Array.from({ length: emptyPlaceholderCount }, (_, index) => (
                        <div key={`placeholder-${index}`} className={emptyPlaceholderClassName} />
                    ))
                )}
            </div>

            {isMounted && activeImage && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={galleryLabel}
                    onClick={() => setActiveIndex(null)}
                >
                    <div
                        className="relative flex max-h-full w-full max-w-[96vw] items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {safeImages.length > 1 && (
                            <button
                                type="button"
                                onClick={showPrevious}
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
                                aria-label="Show previous image"
                            >
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                                </svg>
                            </button>
                        )}

                        <div className="relative inline-flex max-h-[94vh] max-w-[94vw] items-start justify-center">
                            <button
                                type="button"
                                onClick={() => setActiveIndex(null)}
                                className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/70"
                                aria-label="Close image preview"
                            >
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <img
                                src={activeImage}
                                alt={`${altPrefix}-${activeIndex}`}
                                className="max-h-[94vh] w-auto max-w-[94vw] rounded-2xl object-contain shadow-2xl"
                            />
                        </div>

                        {safeImages.length > 1 && (
                            <button
                                type="button"
                                onClick={showNext}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
                                aria-label="Show next image"
                            >
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                                </svg>
                            </button>
                        )}

                        {safeImages.length > 1 && (
                            <div className="absolute bottom-3 rounded-full bg-black/45 px-3 py-1 text-sm text-white">
                                {activeIndex + 1} / {safeImages.length}
                            </div>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
