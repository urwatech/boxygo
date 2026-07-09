import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import SuperAdminAuthenticated from '../../Layouts/SuperAdminAuthenticated';
import Table from '../../../Components/Common/Table';
import Card from '../../../Components/Common/Card';
import Menu from '../../../Components/Common/Menu';
import OutlineButton from '../Components/OutlineButton';
import Input from '../../../Components/Common/Inputs/Input';

export default function Index({ ratings, filters }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState(filters.search || '');
    const [stars, setStars] = useState(filters.stars || '');
    const [isExporting, setIsExporting] = useState(false);
    const [showStarsMenu, setShowStarsMenu] = useState(false);

    const starsTriggerRef = useRef(null);
    const starsMenuRef = useRef(null);

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    useEffect(() => {
        const id = setTimeout(() => {
            if (search !== (filters.search || '')) {
                router.get(route('admin.ratings.index'), { search, stars }, {
                    preserveState: true,
                    replace: true,
                });
            }
        }, 500);
        return () => clearTimeout(id);
    }, [search]);

    const handleStarsSelect = (value) => {
        setStars(value);
        setShowStarsMenu(false);
        router.get(route('admin.ratings.index'), { search, stars: value }, {
            preserveState: true,
            replace: true,
        });
    };

    const handleExport = () => {
        const url = new URL(route('admin.ratings.export'));
        if (search) url.searchParams.append('search', search);
        if (stars) url.searchParams.append('stars', stars);
        window.location.href = url.toString();
    };

    const starOptions = [
        { label: t('commonAll'), value: '' },
        { label: t('superAdminRatingsStarsFive'), value: '5' },
        { label: t('superAdminRatingsStarsFour'), value: '4' },
        { label: t('superAdminRatingsStarsThree'), value: '3' },
        { label: t('superAdminRatingsStarsTwo'), value: '2' },
        { label: t('superAdminRatingsStarsOne'), value: '1' },
    ];

    const tableColumns = [
        {
            key: 'id',
            label: t('commonId'),
            render: (item) => <span className="text-slate-500 font-medium">#{item.id}</span>
        },
        {
            key: 'order_no',
            label: t('superAdminRatingsColumnOrderNo'),
            render: (item) => (
                <div className="flex flex-col">
                    <span className="text-slate-900 font-bold">{item.shipment?.order_number || t('commonNotAvailable')}</span>
                </div>
            )
        },
        {
            key: 'sender',
            label: t('commonSender'),
            render: (item) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {item.reviewer?.name?.charAt(0) || t('superAdminRatingsReviewerFallbackInitial')}
                    </div>
                    <span className="text-slate-700 font-medium">{item.reviewer?.name || t('commonNotAvailable')}</span>
                </div>
            )
        },
        {
            key: 'employee',
            label: t('commonEmployee'),
            render: (item) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs border border-blue-100">
                        {item.employee?.name?.charAt(0) || t('superAdminRatingsEmployeeFallbackInitial')}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-900 font-semibold">{item.employee?.name || t('commonNotAvailable')}</span>
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider">
                            {item.employee?.roles?.[0]?.name || t('superAdminRatingsStaffFallback')}
                        </span>
                    </div>
                </div>
            )
        },
        {
            key: 'rating',
            label: t('superAdminRatingsColumnStarRating'),
            className: "w-[120px]",
            render: (item) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                                key={star}
                                className={`w-3.5 h-3.5 ${star <= item.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
                                viewBox="0 0 20 20"
                            >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.rider_behavior > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-bold border border-blue-100">{t('superAdminRatingsBehaviorTag')}: {item.rider_behavior}</span>
                        )}
                        {item.on_time_delivery > 0 && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-bold border border-emerald-100">{t('superAdminRatingsTimeTag')}: {item.on_time_delivery}</span>
                        )}
                        {item.affordability > 0 && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[9px] font-bold border border-purple-100">{t('superAdminRatingsPriceTag')}: {item.affordability}</span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: 'comment',
            label: t('superAdminRatingsColumnComment'),
            className: "max-w-[200px]",
            render: (item) => (
                <p className="text-slate-600 text-xs italic truncate" title={item.comment}>
                    {item.comment ? `"${item.comment}"` : '-'}
                </p>
            )
        },
        {
            key: 'created_at',
            label: t('commonDate'),
            render: (item) => (
                <div className="flex flex-col">
                    <span className="text-slate-600 text-xs font-medium">
                        {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                        {new Date(item.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            )
        }
    ];

    return (
        <SuperAdminAuthenticated>
            <Head title={t('superAdminRatingsTitle')} />

            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none mb-2">
                            {t('superAdminRatingsTitle')}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {t('superAdminRatingsSubtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <OutlineButton
                            onClick={handleExport}
                            className="h-11 px-6 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center gap-2 group"
                        >
                            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold">{t('superAdminRatingsExportButton')}</span>
                        </OutlineButton>
                    </div>
                </div>

                <Card className="mb-6 p-1 overflow-visible border-slate-100 shadow-sm">
                    <div className="flex flex-col lg:flex-row items-center gap-4 p-4 grayscale-[0.2]">
                        <div className="w-full lg:w-[400px]">
                            <Input
                                placeholder={t('superAdminRatingsSearchPlaceholder')}
                                value={search}
                                onChange={handleSearch}
                                icon={(
                                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                )}
                                className="h-11 bg-slate-50/50 border-slate-200/60 focus:bg-white transition-all rounded-xl"
                            />
                        </div>

                        <div className="flex items-center gap-2 ml-auto shrink-0 relative">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">{t('superAdminRatingsFilterStars')}</span>
                            <div className="relative">
                                <button
                                    ref={starsTriggerRef}
                                    onClick={() => setShowStarsMenu(!showStarsMenu)}
                                    className="h-11 px-4 min-w-[140px] bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all outline-none active:scale-[0.98]"
                                >
                                    <span className="flex items-center gap-2">
                                        {stars ? (
                                            <>
                                                <span className="text-amber-500">★</span>
                                                {stars} {parseInt(stars, 10) === 1 ? t('superAdminRatingsStarSingular') : t('superAdminRatingsStarPlural')}
                                            </>
                                        ) : t('commonAll')}
                                    </span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showStarsMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showStarsMenu && (
                                    <div ref={starsMenuRef} className="absolute right-0 mt-2 z-50">
                                        <Menu
                                            items={starOptions}
                                            onItemClick={(item) => handleStarsSelect(item.value)}
                                            activeValue={stars}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                    <Table
                        columns={tableColumns}
                        data={ratings.data}
                        keyField="id"
                        pagination={{
                            data: ratings,
                            onPageChange: (url) => router.get(url, { search, stars }, { preserveState: true })
                        }}
                    />
                </div>
            </div>
        </SuperAdminAuthenticated>
    );
}
