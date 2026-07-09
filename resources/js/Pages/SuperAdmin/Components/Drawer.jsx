import React, {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
].join(',');

const canUseDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

const mergeClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const getFocusableElements = (container) => {
    if (!canUseDOM || !container) {
        return [];
    }

    const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    return nodes.filter((node) => {
        if (node.hasAttribute('disabled') || node.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        const rects = typeof node.getClientRects === 'function' ? node.getClientRects() : [];
        return rects.length > 0 || node === document.activeElement;
    });
};

const Drawer = forwardRef(function Drawer(
    {
        open,
        onClose,
        title,
        description,
        header,
        footer,
        children,
        closeOnOverlayClick = true,
        closeOnEsc = true,
        showCloseButton = true,
        closeButtonLabel = null,
        closeButtonContent = '×',
        overlayClassName = '',
        panelClassName = '',
        containerClassName = '',
        headerClassName = 'flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#e2e8f0]',
        bodyClassName = 'px-6 py-6 space-y-6',
        footerClassName = 'flex flex-col-reverse gap-3 px-6 pb-6 pt-4 sm:flex-row sm:justify-end sm:gap-4',
        titleClassName = 'text-lg font-semibold text-[#1f2937]',
        descriptionClassName = 'text-sm text-[#64748b]',
        placement = 'right',
        width,
        maxWidth,
        style,
        containerStyle,
        zIndex = 40,
        hideScroll = true,
        trapFocus = true,
        focusOnOpen = true,
        restoreFocus = true,
        initialFocusRef,
        transitionDuration = 260,
        onAfterOpen,
        onAfterClose,
        overlayProps = {},
        panelProps = {},
        containerProps = {},
        headerProps = {},
        bodyProps = {},
        footerProps = {},
        closeButtonProps = {},
        bodyAs = 'div',
        disableBodyWrapper = false,
        showOverlay = true,
        role = 'dialog',
        id,
        ariaLabel,
        ariaLabelledBy,
        ariaDescribedBy,
    },
    forwardedRef,
) {
    const { t } = useTranslation();
    const panelRef = useRef(null);
    const setPanelRef = useCallback((node) => {
        panelRef.current = node;

        if (typeof forwardedRef === 'function') {
            forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    }, [forwardedRef]);

    const generatedId = useId();
    const resolvedCloseButtonLabel = closeButtonLabel || t('commonClose');
    const computedPanelId = panelProps.id ?? id ?? generatedId;
    const defaultTitleId = title ? `${computedPanelId}-title` : undefined;
    const defaultDescriptionId = description ? `${computedPanelId}-description` : undefined;

    const labelledBy = panelProps['aria-labelledby']
        ?? ariaLabelledBy
        ?? (!ariaLabel && defaultTitleId ? defaultTitleId : undefined);
    const describedBy = panelProps['aria-describedby']
        ?? ariaDescribedBy
        ?? (defaultDescriptionId ?? undefined);

    const [isMounted, setIsMounted] = useState(open);
    const [isVisible, setIsVisible] = useState(open);

    const closeTimerRef = useRef(null);
    const afterOpenTimerRef = useRef(null);
    const wasOpenRef = useRef(open);
    const activeElementBeforeOpenRef = useRef(null);

    useEffect(() => {
        if (open && canUseDOM) {
            activeElementBeforeOpenRef.current = document.activeElement;
            setIsMounted(true);
        }
    }, [open]);

    useEffect(() => {
        if (!isMounted) {
            return undefined;
        }

        if (open) {
            requestAnimationFrame(() => setIsVisible(true));
            return undefined;
        }

        setIsVisible(false);
        closeTimerRef.current = setTimeout(() => {
            setIsMounted(false);
            if (onAfterClose) {
                onAfterClose();
            }
        }, transitionDuration);

        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
        };
    }, [open, isMounted, onAfterClose, transitionDuration]);

    useEffect(() => {
        if (open && !wasOpenRef.current && onAfterOpen) {
            afterOpenTimerRef.current = setTimeout(() => {
                onAfterOpen();
            }, transitionDuration);
        }

        if (!open && wasOpenRef.current && afterOpenTimerRef.current) {
            clearTimeout(afterOpenTimerRef.current);
            afterOpenTimerRef.current = null;
        }

        wasOpenRef.current = open;

        return () => {
            if (afterOpenTimerRef.current) {
                clearTimeout(afterOpenTimerRef.current);
                afterOpenTimerRef.current = null;
            }
        };
    }, [open, onAfterOpen, transitionDuration]);

    useEffect(() => {
        if (!isMounted && restoreFocus && activeElementBeforeOpenRef.current) {
            activeElementBeforeOpenRef.current.focus?.();
        }
    }, [isMounted, restoreFocus]);

    useEffect(() => {
        if (!isMounted || !hideScroll || !canUseDOM) {
            return undefined;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isMounted, hideScroll]);

    useEffect(() => {
        if (!open || !isMounted || !isVisible || !focusOnOpen) {
            return undefined;
        }

        const timer = setTimeout(() => {
            if (!panelRef.current) {
                return;
            }

            const focusTarget = initialFocusRef?.current
                ?? getFocusableElements(panelRef.current)[0]
                ?? panelRef.current;

            focusTarget?.focus?.();
        }, 40);

        return () => clearTimeout(timer);
    }, [open, isMounted, isVisible, focusOnOpen, initialFocusRef]);

    useEffect(() => () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
        }
        if (afterOpenTimerRef.current) {
            clearTimeout(afterOpenTimerRef.current);
        }
    }, []);

    const handleOverlayClick = useCallback((event) => {
        if (!closeOnOverlayClick) {
            return;
        }

        onClose?.(event);
    }, [closeOnOverlayClick, onClose]);

    const handlePanelKeyDown = useCallback((event) => {
        if (event.key === 'Escape' && closeOnEsc) {
            event.preventDefault();
            event.stopPropagation();
            onClose?.(event);
            return;
        }

        if (event.key !== 'Tab' || !trapFocus) {
            return;
        }

        const focusableElements = getFocusableElements(panelRef.current);
        if (focusableElements.length === 0) {
            event.preventDefault();
            panelRef.current?.focus?.();
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === first || document.activeElement === panelRef.current) {
                event.preventDefault();
                last.focus();
            }
        } else if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }, [closeOnEsc, onClose, trapFocus]);

    const overlayClickHandler = useCallback((event) => {
        overlayProps.onClick?.(event);
        if (!event.defaultPrevented) {
            handleOverlayClick(event);
        }
    }, [handleOverlayClick, overlayProps]);

    const panelKeyDownHandler = useCallback((event) => {
        panelProps.onKeyDown?.(event);
        if (!event.defaultPrevented) {
            handlePanelKeyDown(event);
        }
    }, [handlePanelKeyDown, panelProps]);

    const BodyComponent = bodyAs;

    const content = useMemo(() => {
        if (typeof children === 'function') {
            return children({
                close: onClose,
                isOpen: open,
                isVisible,
                panelRef: panelRef.current,
            });
        }
        return children;
    }, [children, onClose, open, isVisible]);

    const bodyContent = disableBodyWrapper
        ? content
        : (
            <BodyComponent
                {...bodyProps}
                className={mergeClassNames('flex-1 min-h-0 overflow-y-auto', bodyClassName, bodyProps.className)}
            >
                {content}
            </BodyComponent>
        );

    const { className: closeButtonClassNameProp, ...restCloseButtonProps } = closeButtonProps;

    const defaultHeader = (
        <div className="flex justify-between gap-4">
            <div className="min-w-0">
                {title && (
                    <h2 id={defaultTitleId} className={titleClassName}>
                        {title}
                    </h2>
                )}
                {description && (
                    <p id={defaultDescriptionId} className={mergeClassNames('mt-1', descriptionClassName)}>
                        {description}
                    </p>
                )}
            </div>
            {showCloseButton && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={resolvedCloseButtonLabel}
                    className={mergeClassNames(
                        'cursor-pointer text-3xl leading-none rounded-full p-1 text-[#64748b] hover:text-[#1f2937] transition',
                        closeButtonClassNameProp,
                    )}
                    {...restCloseButtonProps}
                >
                    {closeButtonContent}
                </button>
            )}
        </div>
    );

    const headerContent = useMemo(() => {
        if (header === null) {
            return null;
        }

        const inner = typeof header === 'function'
            ? header({
                close: onClose,
                isOpen: open,
                isVisible,
                titleId: defaultTitleId,
                descriptionId: defaultDescriptionId,
            })
            : header;

        if (inner) {
            return (
                <div
                    {...headerProps}
                    className={mergeClassNames('shrink-0', headerClassName, headerProps.className)}
                >
                    {inner}
                </div>
            );
        }

        if (!title && !description && !showCloseButton) {
            return null;
        }

        return (
            <div
                {...headerProps}
                className={mergeClassNames('shrink-0', headerClassName, headerProps.className)}
            >
                <div className={"w-full"}>
                    {defaultHeader}
                </div>
            </div>
        );
    }, [header, headerProps, headerClassName, defaultHeader, title, description, showCloseButton, onClose, open, isVisible, defaultTitleId, defaultDescriptionId]);

    const footerContent = useMemo(() => {
        if (!footer) {
            return null;
        }

        return (
            <div
                {...footerProps}
                className={mergeClassNames('shrink-0', footerClassName, footerProps.className)}
            >
                {typeof footer === 'function'
                    ? footer({ close: onClose, isOpen: open, isVisible })
                    : footer}
            </div>
        );
    }, [footer, footerProps, footerClassName, onClose, open, isVisible]);

    const basePanelClasses = mergeClassNames(
        'absolute inset-y-0 w-full bg-white shadow-xl transition-transform ease-out max-h-full focus:outline-none flex flex-col h-full rounded-l-3xl',
        placement === 'left' ? 'left-0' : 'right-0',
        isVisible
            ? 'translate-x-0'
            : (placement === 'left' ? '-translate-x-full' : 'translate-x-full'),
    );

    const mergedPanelProps = {
        role,
        'aria-modal': true,
        'aria-label': ariaLabel,
        'aria-labelledby': labelledBy,
        'aria-describedby': describedBy,
        tabIndex: -1,
        ...panelProps,
        ref: setPanelRef,
        id: computedPanelId,
        onKeyDown: panelKeyDownHandler,
        className: mergeClassNames(basePanelClasses, panelClassName, panelProps.className),
        style: {
            transitionDuration: `${transitionDuration}ms`,
            ...(panelProps.style || {}),
            ...(style || {}),
            ...(width ? { width } : {}),
            ...(maxWidth ? { maxWidth } : {}),
        },
    };

    const mergedContainerProps = {
        ...containerProps,
        className: mergeClassNames('fixed inset-0', containerClassName, containerProps.className),
        style: {
            zIndex,
            ...(containerProps.style || {}),
            ...(containerStyle || {}),
        },
    };

    const mergedOverlayProps = {
        ...overlayProps,
        className: mergeClassNames(
            'absolute inset-0 bg-black/30 backdrop-blur-[1px] transition-opacity ease-out',
            overlayClassName,
            overlayProps.className,
        ),
        style: {
            opacity: isVisible ? 1 : 0,
            transitionDuration: `${transitionDuration}ms`,
            ...(overlayProps.style || {}),
        },
        onClick: overlayClickHandler,
        'aria-hidden': true,
    };

    if (!isMounted) {
        return null;
    }

    return (
        <div {...mergedContainerProps}>
            {showOverlay && <div {...mergedOverlayProps} />}
            <section {...mergedPanelProps}>
                {headerContent}
                {bodyContent}
                {footerContent}
            </section>
        </div>
    );
});

export default Drawer;
