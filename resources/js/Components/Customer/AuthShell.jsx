import React, { useEffect, useMemo, useRef, useState } from "react";
import ImageSlider from "./ImageSlider";

/**
 * Shared authentication shell with hero slider and icon animations.
 * Consumers provide the right-side content (form, copy, etc).
 */
export default function AuthShell({
    rightContent,
    rightClassName = "",
    mobileContent = null,
    hideRightSectionOnMobile = false,
}) {
    // Force LTR direction on auth pages to prevent RTL layout issues
    useEffect(() => {
        const previousDir = document.documentElement.getAttribute('dir');
        const previousLang = document.documentElement.getAttribute('lang');

        // Force LTR and English on auth pages
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', 'en');

        return () => {
            // Restore previous direction and language when component unmounts
            if (previousDir) {
                document.documentElement.setAttribute('dir', previousDir);
            }
            if (previousLang) {
                document.documentElement.setAttribute('lang', previousLang);
            }
        };
    }, []);
    const [slide1IconsAnimating, setSlide1IconsAnimating] = useState(false);
    const [slide2IconsAnimating, setSlide2IconsAnimating] = useState(false);
    const forceNextSlideRef = useRef(null);
    const slideIconAnimationProgressRef = useRef({ slide1: 0, slide2: 0 });
    const slideStartTimeRef = useRef(Date.now());
    const advanceTimerRef = useRef(null);
    const iconTimerRef = useRef(null);

    const SLIDE_DWELL_MS = 4500;

    const handleSlideActive = (slideIndex) => {
        slideStartTimeRef.current = Date.now();
        slideIconAnimationProgressRef.current = { slide1: 0, slide2: 0 };

        if (iconTimerRef.current) {
            clearTimeout(iconTimerRef.current);
        }
        if (advanceTimerRef.current) {
            clearTimeout(advanceTimerRef.current);
        }

        if (slideIndex === 0) {
            iconTimerRef.current = window.setTimeout(() => setSlide1IconsAnimating(true), SLIDE_DWELL_MS);
        } else {
            setSlide1IconsAnimating(false);
        }

        if (slideIndex === 1) {
            iconTimerRef.current = window.setTimeout(() => setSlide2IconsAnimating(true), SLIDE_DWELL_MS);
        } else {
            setSlide2IconsAnimating(false);
        }

        // Non-animated slides still need to advance
        if (slideIndex !== 0 && slideIndex !== 1) {
            advanceTimerRef.current = window.setTimeout(() => {
                forceNextSlideRef.current?.();
            }, SLIDE_DWELL_MS);
        }
    };

    const handleIconsMeet = (slideKey) => {
        slideIconAnimationProgressRef.current[slideKey] += 1;
        if (slideIconAnimationProgressRef.current[slideKey] < 2) return;
        slideIconAnimationProgressRef.current[slideKey] = 0;
        if (!forceNextSlideRef.current) return;
        if (advanceTimerRef.current) {
            clearTimeout(advanceTimerRef.current);
        }
        forceNextSlideRef.current?.();
    };

    const sliderSlides = useMemo(
        () => [
            {
                id: "slide-1",
                content: (
                    <div className="relative h-full w-full flex items-center justify-center pr-3 pl-0 md:pr-14 sm:pl-12 overflow-hidden md:overflow-visible">
                        <img
                            src="/assets/images/slide-1t.svg"
                            alt="Slide 1"
                            draggable={false}
                            className="object-contain h-full w-full"
                        />
                        {/*image - Mobile*/}
                        <div
                            className="absolute block md:hidden"
                            style={{
                                bottom: "2px",
                            }}
                        >
                            <img
                                src="/assets/images/slide-1pic.svg"
                                alt="Slide 1 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>
                        {/*image - Desktop*/}
                        <div
                            className="absolute hidden md:block"
                            style={{
                                bottom: "125px",
                                left: "21%",
                            }}
                        >
                            <img
                                src="/assets/images/slide-1pic.svg"
                                alt="Slide 1 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        <div
                            className={`absolute hidden md:block ${slide1IconsAnimating ? "animate-slide1-icon1" : ""}`}
                            style={{
                                width: "80px",
                                height: "80px",
                                top: "19%",
                                left: "91%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                            onAnimationEnd={() => {
                                if (slide1IconsAnimating) {
                                    handleIconsMeet("slide1");
                                }
                            }}
                        >
                            <img
                                src="/assets/images/1icon.png"
                                alt="First Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                            className={`absolute hidden md:block ${slide1IconsAnimating ? "animate-slide1-icon2" : ""}`}
                            style={{
                                width: "80px",
                                height: "80px",
                                top: "61%",
                                left: "8%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                            onAnimationEnd={() => {
                                if (slide1IconsAnimating) {
                                    handleIconsMeet("slide1");
                                }
                            }}
                        >
                            <img
                                src="/assets/images/2icon.png"
                                alt="Second Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        {/* Mobile Icons */}

                        <div
                        className={`absolute block md:hidden sm:hidden ${slide1IconsAnimating ? "animate-slide1-mobile-icon1" : ""}`}
                        style={{
                            width: "65px",
                            height: "65px",
                            top: "14%",
                                left: "90%",
                                transform: "translate(-50%, -50%)",
                            borderRadius: "50%",
                            overflow: "hidden",
                            zIndex: 2,
                            willChange: "top, left, transform",
                        }}
                        onAnimationEnd={() => {
                            if (slide1IconsAnimating) {
                                handleIconsMeet("slide1");
                            }
                        }}
                    >
                        <img
                            src="/assets/images/1icon.png"
                            alt="First Circle Content"
                            className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                        className={`absolute block md:hidden sm:hidden ${slide1IconsAnimating ? "animate-slide1-mobile-icon2" : ""}`}
                        style={{
                            width: "65px",
                            height: "65px",
                            top: "62%",
                                left: "9%",
                                transform: "translate(-50%, -50%)",
                            borderRadius: "50%",
                            overflow: "hidden",
                            zIndex: 2,
                            willChange: "top, left, transform",
                        }}
                        onAnimationEnd={() => {
                            if (slide1IconsAnimating) {
                                handleIconsMeet("slide1");
                            }
                        }}
                    >
                        <img
                            src="/assets/images/2icon.png"
                            alt="Second Circle Content"
                            className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                ),
            },
            {
                id: "slide-2",
                content: (
                    <div className="relative h-full w-full flex items-center justify-center pr-0 pl-0 md:pr-14 md:pl-12 overflow-hidden md:overflow-visible">
                        <img
                            src="/assets/images/slide-2t.svg"
                            alt="Slide 2"
                            draggable={false}
                            className="object-contain h-full w-full"
                        />
                        {/*image - Mobile*/}
                        <div
                            className="absolute block md:hidden"
                            style={{
                                bottom: "2px",
                            }}
                        >
                            <img
                                src="/assets/images/slide-2pic.svg"
                                alt="Slide 2 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>
                        {/*image - Desktop*/}
                        <div
                            className="absolute hidden md:block"
                            style={{
                               bottom: "125px",
                                left: "21%",
                            }}
                        >
                            <img
                                src="/assets/images/slide-2pic.svg"
                                alt="Slide 2 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        <div
                        className={`absolute hidden md:block ${slide2IconsAnimating ? "animate-slide2-icon1" : ""}`}
                        style={{
                            width: "80px",
                            height: "80px",
                            top: "22%",
                            left: "88%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                            onAnimationEnd={() => {
                                if (slide2IconsAnimating) {
                                    handleIconsMeet("slide2");
                                }
                            }}
                        >
                            <img
                                src="/assets/images/bag.png"
                                alt="First Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                        className={`absolute hidden md:block ${slide2IconsAnimating ? "animate-slide2-icon2" : ""}`}
                        style={{
                            width: "80px",
                            height: "80px",
                            top: "62%",
                            left: "11%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                            onAnimationEnd={() => {
                                if (slide2IconsAnimating) {
                                    handleIconsMeet("slide2");
                                }
                            }}
                        >
                            <img
                                src="/assets/images/clock.png"
                                alt="Second Circle Content"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Mobile Icons */}

                        <div
                        className={`absolute block md:hidden sm:hidden ${slide2IconsAnimating ? "animate-slide2-mobile-icon1" : ""}`}
                        style={{
                            width: "65px",
                            height: "65px",
                            top: "16%",
                            left: "87%",
                                transform: "translate(-50%, -50%)",
                            borderRadius: "50%",
                            overflow: "hidden",
                            zIndex: 2,
                            willChange: "top, left, transform",
                        }}
                        onAnimationEnd={() => {
                            if (slide2IconsAnimating) {
                                handleIconsMeet("slide2");
                            }
                        }}
                    >
                        <img
                            src="/assets/images/bag.png"
                            alt="First Circle Content"
                            className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                        className={`absolute block md:hidden sm:hidden ${slide2IconsAnimating ? "animate-slide2-mobile-icon2" : ""}`}
                        style={{
                            width: "65px",
                            height: "65px",
                            top: "65%",
                            left: "12%",
                                transform: "translate(-50%, -50%)",
                            borderRadius: "50%",
                            overflow: "hidden",
                            zIndex: 2,
                            willChange: "top, left, transform",
                        }}
                        onAnimationEnd={() => {
                            if (slide2IconsAnimating) {
                                handleIconsMeet("slide2");
                            }
                        }}
                    >
                        <img
                            src="/assets/images/clock.png"
                            alt="Second Circle Content"
                            className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                ),
            },
            {
                id: "slide-3",
                content: (
                    <div className="relative h-full w-full flex items-center justify-center pr-3 pl-0 md:pr-14 sm:pl-12 overflow-hidden md:overflow-visible">
                        <img
                            src="/assets/images/slide-3t.svg"
                            alt="Slide 3"
                            draggable={false}
                            className="object-contain h-full w-full"
                        />

                        {/* Mobile Image (Right Aligned Like Desktop) */}
                        <div
                            className="absolute block md:hidden"
                            style={{
                                bottom: "2px",
                                right: "-55px",
                                transform: "translateX(0)",
                            }}
                        >
                            <img
                                src="/assets/images/slide-3pic.svg"
                                alt="Slide 3 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        {/* Desktop Image */}
                        <div
                            className="absolute hidden md:block"
                            style={{
                                bottom: "128px",
                                right: "-186px",
                            }}
                        >
                            <img
                                src="/assets/images/slide-3pic.svg"
                                alt="Slide 3 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        <div
                            className="absolute hidden md:block"
                            style={{
                                width: "80px",
                                height: "80px",
                                top: "17%",
                                left: "82%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_truck.png"
                                alt="First Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                            className="absolute hidden md:block"
                            style={{
                                width: "80px",
                                height: "80px",
                                top: "68%",
                                left: "18%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_box.png"
                                alt="Second Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        {/* Mobile Icons */}

                        <div
                            className="absolute block md:hidden sm:hidden"
                            style={{
                                width: "65px",
                                height: "65px",
                                top: "13%",
                                left: "82%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_truck.png"
                                alt="First Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                            className="absolute block md:hidden sm:hidden"
                            style={{
                                width: "65px",
                                height: "65px",
                                top: "68%",
                                left: "17%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_box.png"
                                alt="Second Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                ),
            },
            {
                id: "slide-4",
                content: (
                    <div className="relative h-full w-full flex items-center justify-center pr-3 pl-0 md:pr-14 sm:pl-12 overflow-hidden md:overflow-visible">
                        <img
                            src="/assets/images/slide-3t.svg"
                            alt="Slide 4"
                            draggable={false}
                            className="object-contain h-full w-full"
                        />

                        {/* Mobile Image (Right Aligned Like Desktop) */}
                        <div
                            className="absolute block md:hidden"
                            style={{
                                bottom: "2px",
                                right: "-55px",
                                transform: "translateX(0)",
                            }}
                        >
                            <img
                                src="/assets/images/slide-4pic.svg"
                                alt="Slide 4 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        {/* Desktop Image */}
                        <div
                            className="absolute hidden md:block"
                            style={{
                                bottom: "125px",
                                left: "30%",
                            }}
                        >
                            <img
                                src="/assets/images/slide-4pic.svg"
                                alt="Slide 4 Person"
                                draggable={false}
                                className="h-full w-auto object-contain"
                            />
                        </div>

                        <div
                            className="absolute hidden md:block"
                            style={{
                                width: "80px",
                                height: "80px",
                                top: "17%",
                                left: "82%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_truck.png"
                                alt="First Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                            className="absolute hidden md:block"
                            style={{
                                width: "80px",
                                height: "80px",
                                top: "68%",
                                left: "18%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_box.png"
                                alt="Second Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        {/* Mobile Icons */}

                        <div
                            className="absolute block md:hidden sm:hidden"
                            style={{
                                width: "65px",
                                height: "65px",
                                top: "13%",
                                left: "82%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_truck.png"
                                alt="First Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div
                            className="absolute block md:hidden sm:hidden"
                            style={{
                                width: "65px",
                                height: "65px",
                                top: "68%",
                                left: "18%",
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/assets/images/sign_up_box.png"
                                alt="Second Circle Content"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                ),
            },
        ],
        [slide1IconsAnimating, slide2IconsAnimating],
    );

    const slideAnimations = useMemo(
        () => [
            {
                style: {
                    angle: 0,
                    opacity: 1,
                    inactiveScale: 0.92,
                },
                transition: {
                    delay: 0.01,
                    duration: 1.0,
                    type: "smart-animate",
                    spring: { mass: 1, stiffness: 40, damping: 10 },
                },
            },
            {
                style: {
                    angle: 0,
                    opacity: 1,
                    inactiveScale: 0.92,
                },
                transition: {
                delay: 0.01,
                duration: 1.0,
                type: "smart-animate",
                spring: { mass: 1, stiffness: 40, damping: 10 },
                },
            },
            {
                style: {
                    angle: 0,
                    opacity: 1,
                    inactiveScale: 0.92,
                },
                transition: {
                    delay: 0.8,
                    duration: 0.8,
                    type: "smart-animate",
                    spring: { mass: 1, stiffness: 100, damping: 15 },
                },
            },
            {
                style: {
                    angle: 0,
                    opacity: 1,
                    inactiveScale: 0.92,
                },
                transition: {
                    delay: 0,
                    duration: 0,
                    timingFunction: "linear",
                    spring: { mass: 1, stiffness: 100, damping: 15 },
                },
            },
        ],
        [],
    );

    return (
        <>
            <div className="min-h-screen flex items-start md:items-center justify-center">
                <div className="relative w-[1440px] h-screen md:w-screen md:h-screen md:rounded-none md:shadow-2xl flex flex-col md:flex-row md:gap-0 login-shell overflow-hidden md:overflow-visible bg-[#338DFF] md:bg-transparent">
                   <aside
                    className="
                        relative flex w-full min-h-[475px] flex-col
                        justify-between bg-[#338DFF] p-2 text-white sm:p-8
                        md:w-1/2
                        overflow-hidden md:overflow-visible
                        md:items-center md:justify-center"
                    >
                       <ImageSlider
                            className="
                                flex-1
                                min-h-[485px]
                                md:min-h-[485px]
                                md:h-[485px]
                                md:w-[680px]
                                overflow-hidden
                                md:overflow-visible
                            "
                            slides={sliderSlides}
                            animations={slideAnimations}
                            autoPlayInterval={null}
                            onSlideActive={handleSlideActive}
                            onMountCallback={(forceNext) => {
                                forceNextSlideRef.current = forceNext;
                            }}
                        />
                    </aside>

                    <section
                        className={`w-full md:w-1/2 bg-white px-6 mt-12 sm:py-0 flex-col ${
                            hideRightSectionOnMobile ? "hidden md:flex" : "flex"
                        } ${rightClassName}`}
                    >
                        {rightContent}
                    </section>
                    {hideRightSectionOnMobile && mobileContent}
                </div>
            </div>
            <style>{`
                @keyframes slide1-icon1-move {
                    0% {
                        top: 19%;
                        left: 91%;
                    }
                    100% {
                        top: 40%;
                        left: 52%;
                    }
                }

                @keyframes slide1-icon2-move {
                    0% {
                        top: 61%;
                        left: 8%;
                    }
                    100% {
                        top: 40%;
                        left: 48%;
                    }
                }

                @keyframes slide2-icon1-move {
                    0% {
                        top: 22%;
                        left: 88%;
                    }
                    100% {
                        top: 42%;
                        left: 52%;
                    }
                }

                @keyframes slide2-icon2-move {
                    0% {
                        top: 62%;
                        left: 11%;
                    }
                    100% {
                        top: 42%;
                        left: 48%;
                    }
                }

                @keyframes slide1-mobile-icon1-move {
                    0% {
                        top: 14%;
                        left: 90%;
                    }
                    100% {
                        top: 40%;
                        left: 52%;
                    }
                }

                @keyframes slide1-mobile-icon2-move {
                    0% {
                        top: 62%;
                        left: 9%;
                    }
                    100% {
                        top: 40%;
                        left: 48%;
                    }
                }

                @keyframes slide2-mobile-icon1-move {
                    0% {
                        top: 16%;
                        left: 87%;
                    }
                    100% {
                        top: 42%;
                        left: 52%;
                    }
                }

                @keyframes slide2-mobile-icon2-move {
                    0% {
                        top: 65%;
                        left: 12%;
                    }
                    100% {
                        top: 42%;
                        left: 48%;
                    }
                }

                .animate-slide1-icon1 {
                    animation: slide1-icon1-move 0.5s ease-in-out forwards !important;
                }

                .animate-slide1-icon2 {
                    animation: slide1-icon2-move 0.5s ease-in-out forwards !important;
                }

                .animate-slide2-icon1 {
                    animation: slide2-icon1-move 0.5s ease-in-out forwards !important;
                }

                .animate-slide2-icon2 {
                    animation: slide2-icon2-move 0.5s ease-in-out forwards !important;
                }

                .animate-slide1-mobile-icon1 {
                    animation: slide1-mobile-icon1-move 1s ease-in-out forwards !important;
                }

                .animate-slide1-mobile-icon2 {
                    animation: slide1-mobile-icon2-move 1s ease-in-out forwards !important;
                }

                .animate-slide2-mobile-icon1 {
                    animation: slide2-mobile-icon1-move 1s ease-in-out forwards !important;
                }

                .animate-slide2-mobile-icon2 {
                    animation: slide2-mobile-icon2-move 1s ease-in-out forwards !important;
                }
            `}</style>
        </>
    );
}
