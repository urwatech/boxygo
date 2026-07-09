import React, { useEffect, useMemo, useState } from "react";

const defaultSpring = {
    mass: 1,
    stiffness: 120,
    damping: 18,
};

const buildTransform = (style = {}, isActive) => {
    const transforms = [];
    const angle = style.angle ?? 0;
    const scale = isActive ? style.scale ?? 1 : style.inactiveScale ?? 0.94;

    transforms.push(`rotate(${angle}deg)`);
    transforms.push(`scale(${scale})`);

    if (style.translateX) {
        transforms.push(`translateX(${style.translateX})`);
    }

    if (style.translateY) {
        transforms.push(`translateY(${style.translateY})`);
    }

    return transforms.join(" ");
};

const buildTimingFunction = (transition = {}) => {
    if (transition.timingFunction) {
        return transition.timingFunction;
    }

    const spring = transition.spring ?? defaultSpring;

    const stiffness = spring.stiffness ?? defaultSpring.stiffness;
    const damping = spring.damping ?? defaultSpring.damping;

    const normalizedStiffness = Math.min(Math.max(stiffness / 200, 0.1), 1);
    const normalizedDamping = Math.min(Math.max(damping / 30, 0.1), 1);

    const cp1 = 0.2 + normalizedDamping * 0.3;
    const cp2 = 0.3 + normalizedStiffness * 0.5;

    return `cubic-bezier(${cp1.toFixed(2)}, 0, 0.2, ${cp2.toFixed(2)})`;
};

const createSlideStyle = (animation = {}, isActive) => {
    const style = animation.style ?? {};
    const transition = animation.transition ?? {};

    return {
        opacity: isActive ? style.opacity ?? 1 : 0,
        width: style.width ?? "100%",
        maxWidth: style.maxWidth ?? "100%",
        height: style.height ?? "100%",
        maxHeight: style.maxHeight ?? "100%",
        pointerEvents: isActive ? "auto" : "none",
        transitionProperty: "opacity, transform",
        transitionDuration: `${transition.duration ?? 0.6}s`,
        transitionDelay: `${isActive ? transition.delay ?? 0 : 0}s`,
        transitionTimingFunction: buildTimingFunction(transition),
        transform: buildTransform(style, isActive),
    };
};

const getSlideAnimation = (animations = [], index) => {
    if (!Array.isArray(animations)) {
        return {};
    }

    return animations[index] ?? {};
};

export default function ImageSlider({
    slides,
    animations,
    autoPlayInterval = 6000,
    renderIndicators = true,
    className = "",
    onSlideChange,
    onSlideActive,
    onMountCallback,
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const safeSlides = useMemo(() => slides ?? [], [slides]);

    // Notify parent when slide becomes active
    useEffect(() => {
        if (onSlideActive) {
            onSlideActive(activeIndex);
        }
    }, [activeIndex, onSlideActive]);

    // Expose forceNextSlide function to parent
    useEffect(() => {
        if (onMountCallback) {
            const forceNextSlide = () => {
                setActiveIndex((prev) => {
                    const newIndex = (prev + 1) % safeSlides.length;
                    if (onSlideChange) {
                        onSlideChange(newIndex);
                    }
                    return newIndex;
                });
            };
            onMountCallback(forceNextSlide);
        }
    }, [onMountCallback, onSlideChange, safeSlides.length]);

    useEffect(() => {
        if (typeof window === "undefined" || safeSlides.length <= 1) {
            return undefined;
        }

        const currentSlide = safeSlides[activeIndex];
        const interval = currentSlide?.autoPlayInterval ?? autoPlayInterval;
        if (!interval || interval <= 0) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            setActiveIndex((prev) => {
                const newIndex = (prev + 1) % safeSlides.length;
                if (onSlideChange) {
                    onSlideChange(newIndex);
                }
                return newIndex;
            });
        }, interval);

        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [activeIndex, autoPlayInterval, safeSlides]);

    const renderedAnimations = useMemo(
        () => safeSlides.map((_, index) => getSlideAnimation(animations, index)),
        [animations, safeSlides],
    );

    return (
        <div className={`flex flex-col ${className}`}>
            {/* Slides container */}
            <div className="relative w-full h-full overflow-hidden md:overflow-visible">
                {safeSlides.map((slide, index) => {
                    const isActive = index === activeIndex;
                    const animation = renderedAnimations[index] ?? {};
                    const slideStyle = createSlideStyle(animation, isActive);
                    return (
                        <div
                            key={slide.id ?? index}
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
                                animation.wrapperClassName ?? ""
                            }`}
                            style={slideStyle}
                            aria-hidden={!isActive}
                        >
                            <div className="h-full w-full">{slide.content}</div>
                        </div>
                    );
                })}
            </div>

            {/* Indicators below slides */}
            {renderIndicators && safeSlides.length > 1 && (
                <div className="mt-6 md:mt-0 flex items-center justify-center gap-2">
                    {safeSlides.map((slide, index) => {
                        const isActive = index === activeIndex;
                        return (
                            <button
                                key={slide.id ?? index}
                                type="button"
                                onClick={() => setActiveIndex(index)}
                                className={`transition-all duration-300 ${
                                    isActive
                                        ? "h-2 w-6 rounded-full bg-white"
                                        : "h-2 w-2 rounded-full bg-white/40 hover:bg-white/60"
                                }`}
                                aria-label={`Show slide ${index + 1}`}
                            />
                        );
                    })}
                </div>
            )}
        </div>

    );
}
