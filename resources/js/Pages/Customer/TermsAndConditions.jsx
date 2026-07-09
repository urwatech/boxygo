import React from 'react';
import { useTranslation } from 'react-i18next';

const DISPLAY_ALLOWED_TAGS = new Set([
    'a',
    'b',
    'blockquote',
    'br',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'i',
    'li',
    'ol',
    'p',
    'strong',
    'u',
    'ul',
]);

const hasHtmlContent = (value = '') => /<\/?[a-z][\s\S]*>/i.test(value);

const isSafeDisplayUrl = (value = '') =>
    /^(https?:|mailto:|tel:|#|\/)/i.test(value.trim());

const sanitizeDisplayHtml = (html = '') => {
    const raw = typeof html === 'string' ? html : String(html ?? '');

    if (typeof document === 'undefined') {
        return raw;
    }

    const template = document.createElement('template');
    template.innerHTML = raw;
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK']);

    const cleanNode = (node) => {
        Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                return;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) {
                child.remove();
                return;
            }

            if (blockedTags.has(child.tagName)) {
                child.remove();
                return;
            }

            const tagName = child.tagName.toLowerCase();
            cleanNode(child);

            if (!DISPLAY_ALLOWED_TAGS.has(tagName)) {
                child.replaceWith(...Array.from(child.childNodes));
                return;
            }

            Array.from(child.attributes).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value;

                if (name.startsWith('on') || ['style', 'class', 'id'].includes(name)) {
                    child.removeAttribute(attribute.name);
                    return;
                }

                if (tagName !== 'a' || !['href', 'target', 'rel'].includes(name)) {
                    child.removeAttribute(attribute.name);
                    return;
                }

                if (name === 'href' && !isSafeDisplayUrl(value)) {
                    child.removeAttribute(attribute.name);
                }
            });

            if (tagName === 'a' && child.getAttribute('href')) {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }
        });
    };

    cleanNode(template.content);

    return template.innerHTML.trim();
};

export default function TermsAndConditions({ isModal = false, termsContent = null }) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const configuredBody = typeof termsContent?.body === 'string' ? termsContent.body : '';
    const configuredTitle = typeof termsContent?.title === 'string' ? termsContent.title.trim() : '';
    const defaultTermsBody = [
        t('settingsTermsWelcome'),
        `${t('servicesProvidedTitle')}\n${t('settingsTermsServicesProvidedContent')}`,
        `${t('commonAccountResponsibility')}\n${t('settingsTermsAccountResponsibilityContent')}`,
        `${t('settingsTermsPricingPayments')}\n${t('settingsTermsPricingIntro')} ${[
            t('settingsTermsPricingParcelSize'),
            t('settingsTermsPricingVehicleType'),
            t('settingsTermsPricingDistance'),
        ].join(', ')}\n${t('settingsTermsPricingPayment')}`,
        `${t('commonCancellationsRefunds')}\n${[
            t('settingsTermsCancellationBefore'),
            t('settingsTermsCancellationRefunds'),
            t('settingsTermsCancellationAfter'),
        ].join('\n')}`,
        `${t('commonContactUs')}\n${t('settingsTermsContactContent')} ${t('settingsTermsContactEmail')}`,
    ].join('\n\n');
    // Parse the terms body text and format it with proper headings.
    const termsBody = configuredBody.trim() ? configuredBody : defaultTermsBody;
    const isHtmlBody = hasHtmlContent(termsBody);
    const knownHeadingLines = new Set([
        t('servicesProvidedTitle'),
        t('commonAccountResponsibility'),
        t('settingsTermsPricingPayments'),
        t('commonCancellationsRefunds'),
        t('commonContactUs'),
    ].map((heading) => heading.trim()).filter(Boolean));

    const appendColon = (text) => {
        const trimmed = text.trimEnd();
        if (trimmed.endsWith(':')) {
            return trimmed;
        }
        return `${trimmed}:`;
    };

    const emphasizedPhrases = [
        'Techno Commerce Solutions LTD \u2013 Boxy Go Application',
        'Techno Commerce Solutions LTD - Boxy Go Application',
        'الشركة الهندسية للتطبيقات التجارية ذات المسؤولية المحدودة - تطبيق بوكسي غو'
    ];

    const normalizeText = (text) => text.replace(/\uFFFD/g, '-');

    const renderWithEmphasis = (text) => {
        const normalized = normalizeText(text);
        const match = normalized.match(
            /Techno Commerce Solutions LTD\s*[-\u2013\u2014]\s*Boxy Go Application/
        );
        if (match) {
            const parts = normalized.split(match[0]);
            return (
                <>
                    {parts[0]}
                    <strong className="font-bold">{match[0]}</strong>
                    {parts.slice(1).join(match[0])}
                </>
            );
        }

        const phrase = emphasizedPhrases.find((item) => normalized.includes(item));
        if (!phrase) {
            return normalized;
        }
        const parts = normalized.split(phrase);
        return (
            <>
                {parts[0]}
                <strong className="font-bold">{phrase}</strong>
                {parts.slice(1).join(phrase)}
            </>
        );
    };

    const parseContent = (text, startIndex, treatDefinitionsAsList = false) => {
        const lines = text.split('\n');
        const elements = [];
        let currentList = [];
        let inSubsection = false;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip the first few lines (title, app name, subtitle, last updated, intro paragraph)
            // These will be rendered in the header section
            if (index < startIndex) {
                return;
            }

            if (!trimmedLine) {
                // Empty line - close any open list
                if (currentList.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="list-disc pl-8 mb-4 space-y-2">
                            {currentList.map((item, i) => (
                                <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    );
                    currentList = [];
                }
                return;
            }

            if (knownHeadingLines.has(trimmedLine)) {
                if (currentList.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="list-disc pl-8 mb-4 space-y-2">
                            {currentList.map((item, i) => (
                                <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    );
                    currentList = [];
                }
                elements.push(
                    <h2 key={index} className={`${isModal ? 'text-lg' : 'text-xl'} font-bold mt-6 mb-3 text-gray-900`}>
                        {trimmedLine}
                    </h2>
                );
                inSubsection = false;
                return;
            }

            // Check for main heading (starts with number followed by period and space)
            if (trimmedLine.match(/^\d+\.\s+/)) {
                if (currentList.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="list-disc pl-8 mb-4 space-y-2">
                            {currentList.map((item, i) => (
                                <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    );
                    currentList = [];
                }
                elements.push(
                    <h2 key={index} className="text-2xl font-bold mt-10 mb-6 text-gray-900">
                        {appendColon(trimmedLine)}
                    </h2>
                );
                inSubsection = false;
                return;
            }

            // Check for sub-heading (starts with number.number.)
            if (trimmedLine.match(/^\d+\.\d+\.\s/)) {
                if (currentList.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="list-disc pl-8 mb-4 space-y-2">
                            {currentList.map((item, i) => (
                                <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    );
                    currentList = [];
                }
                elements.push(
                    <h3 key={index} className="text-xl font-bold mt-6 mb-4 text-gray-800">
                        {appendColon(trimmedLine)}
                    </h3>
                );
                inSubsection = true;
                return;
            }

            // Check for bold terms (e.g., "The Company:", "The Platform:")
            const boldMatch = trimmedLine.match(/^([^:]+:)\s*(.+)/);
            if (treatDefinitionsAsList && boldMatch && (trimmedLine.length < 300 || trimmedLine.startsWith('Dispute Resolution:'))) {
                currentList.push(
                    <span key={index}>
                        <strong className="font-bold">{appendColon(boldMatch[1].replace(/:$/, ''))}</strong>{' '}
                        {renderWithEmphasis(boldMatch[2])}
                    </span>
                );
                return;
            }

            if (trimmedLine === 'Email' || trimmedLine === 'Email:') {
                currentList.push(
                    <span key={index}>
                        <strong className="font-bold">{appendColon('Email')}</strong>
                    </span>
                );
                return;
            }

            if (trimmedLine === 'And through the channels mentioned on our platform.') {
                currentList.push(
                    <span key={index}>{appendColon(trimmedLine)}</span>
                );
                return;
            }

            if (inSubsection) {
                currentList.push(
                    <span key={index}>{renderWithEmphasis(trimmedLine)}</span>
                );
                return;
            }

            // Regular paragraph
            if (currentList.length > 0) {
                elements.push(
                    <ul key={`list-${index}`} className="list-disc pl-8 mb-4 space-y-2">
                        {currentList.map((item, i) => (
                            <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                        ))}
                    </ul>
                );
                currentList = [];
            }

            elements.push(
                <p key={index} className="mb-4 text-gray-700 leading-relaxed text-justify">
                    {renderWithEmphasis(trimmedLine)}
                </p>
            );
        });

        // Close any remaining list
        if (currentList.length > 0) {
            elements.push(
                <ul key="list-final" className="list-disc pl-8 mb-4 space-y-2">
                    {currentList.map((item, i) => (
                        <li key={i} className="text-gray-700 leading-relaxed">{item}</li>
                    ))}
                </ul>
            );
        }

        return elements;
    };

    // Extract header information from the translation
    const lines = isHtmlBody ? [] : termsBody.split('\n');
    const nonEmptyLines = lines
        .map((line, idx) => ({ line: line.trim(), idx }))
        .filter((item) => item.line);
    const lastUpdatedIndex = lines.findIndex((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('Last Updated:') || trimmed.startsWith('آخر تحديث:');
    });
    const hasStructuredHeader = !isHtmlBody && lastUpdatedIndex !== -1;
    const headerTitle = configuredTitle
        || (hasStructuredHeader ? nonEmptyLines[0]?.line : t('commonTermsConditions'))
        || t('settingsTermsFallbackHeaderTitle');
    const appName = hasStructuredHeader ? (nonEmptyLines[1]?.line || t('settingsTermsFallbackAppName')) : '';
    const subtitle = hasStructuredHeader ? (nonEmptyLines[2]?.line || t('settingsTermsFallbackSubtitle')) : '';
    const extraSubtitle = hasStructuredHeader ? nonEmptyLines.find((item, idx) => {
        if (idx <= 2) {
            return false;
        }
        if (lastUpdatedIndex !== -1 && item.idx >= lastUpdatedIndex) {
            return false;
        }
        return true;
    })?.line || '' : '';
    const lastUpdated = lastUpdatedIndex !== -1
        ? lines[lastUpdatedIndex].trim()
        : '';
    const introLineIndex = hasStructuredHeader
        ? lines.findIndex((line, idx) => idx > lastUpdatedIndex && line.trim())
        : -1;
    const introParagraph = introLineIndex !== -1 ? lines[introLineIndex].trim() : '';
    const contentStartIndex = hasStructuredHeader
        ? (introLineIndex !== -1 ? introLineIndex + 1 : (nonEmptyLines[2]?.idx ?? 0) + 1)
        : 0;

    return (
        <div className={isModal ? "bg-white" : "min-h-screen bg-white"}>
            <main className={isModal ? "bg-white" : "min-h-screen bg-white"}>
                <div className={`${isModal ? 'max-w-full px-3 sm:px-4 py-4' : 'max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-10'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                    {/* Centered Header Section */}
                    <div className={isModal ? "text-center mb-6" : "text-center mb-12"}>
                        <h1 className={`${isModal ? 'text-2xl' : 'text-4xl'} font-bold text-blue-600 ${isModal ? 'mb-2' : 'mb-4'}`}>
                            {headerTitle}
                        </h1>
                        {appName && (
                            <h2
                                className={`${isModal ? 'text-xl' : 'text-3xl'} font-bold text-blue-700 ${isModal ? 'mb-2' : 'mb-6'}`}
                                style={isRTL ? { direction: 'ltr', unicodeBidi: 'plaintext' } : undefined}
                            >
                                {appName}
                            </h2>
                        )}
                        {subtitle && (
                            <h3 className={`${isModal ? 'text-lg' : 'text-2xl'} font-semibold text-gray-900 ${extraSubtitle ? (isModal ? 'mb-1' : 'mb-2') : (isModal ? 'mb-4' : 'mb-8')}`}>
                                {subtitle}
                            </h3>
                        )}
                        {extraSubtitle && (
                            <h4 className={`${isModal ? 'text-base' : 'text-xl'} font-semibold text-gray-900 ${isModal ? 'mb-4' : 'mb-8'}`}>
                                {extraSubtitle}
                            </h4>
                        )}
                    </div>

                    {/* Last Updated */}
                    {lastUpdated && (
                        <div className={isModal ? "mb-4" : "mb-8"}>
                            <p className={`${isModal ? 'text-base' : 'text-lg'} font-semibold text-gray-900 ${isModal ? 'mb-3' : 'mb-6'}`}>
                                {lastUpdated}
                            </p>
                        </div>
                    )}

                    {/* Introduction Paragraph */}
                    {introParagraph && (
                        <div className={isModal ? "mb-4" : "mb-8"}>
                            <p className={`text-gray-700 leading-relaxed text-justify ${isModal ? 'text-sm mb-3' : 'mb-6 text-base'}`}>
                                {renderWithEmphasis(introParagraph)}
                            </p>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className={`space-y-${isModal ? 3 : 6}`}>
                        {isHtmlBody ? (
                            <>
                                <div
                                    className="legal-rich-content text-gray-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: sanitizeDisplayHtml(termsBody) }}
                                />
                                <style>{`
                                    .legal-rich-content h1 { font-size: ${isModal ? '1.5rem' : '2rem'}; font-weight: 700; color: #111827; margin: 1.5rem 0 .85rem; }
                                    .legal-rich-content h2 { font-size: ${isModal ? '1.125rem' : '1.35rem'}; font-weight: 700; color: #111827; margin: 1.35rem 0 .75rem; }
                                    .legal-rich-content h3 { font-size: ${isModal ? '1rem' : '1.125rem'}; font-weight: 700; color: #1f2937; margin: 1rem 0 .6rem; }
                                    .legal-rich-content p { margin: 0 0 1rem; text-align: justify; }
                                    .legal-rich-content ul { list-style: disc; padding-left: 1.5rem; margin: .5rem 0 1rem; }
                                    .legal-rich-content ol { list-style: decimal; padding-left: 1.5rem; margin: .5rem 0 1rem; }
                                    .legal-rich-content li { margin: .25rem 0; }
                                    .legal-rich-content a { color: #2563eb; text-decoration: underline; }
                                    .legal-rich-content blockquote { border-left: 3px solid #bfdbfe; margin: 1rem 0; padding-left: 1rem; color: #475569; }
                                    [dir="rtl"] .legal-rich-content ul,
                                    [dir="rtl"] .legal-rich-content ol { padding-left: 0; padding-right: 1.5rem; }
                                    [dir="rtl"] .legal-rich-content blockquote { border-left: 0; border-right: 3px solid #bfdbfe; padding-left: 0; padding-right: 1rem; }
                                `}</style>
                            </>
                        ) : (
                            parseContent(termsBody, contentStartIndex, hasStructuredHeader)
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
