import React, { useMemo, useState } from 'react';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';
import { useTranslation } from 'react-i18next';

export default function FAQ() {
  const { t } = useTranslation();
  const frequentTopics = useMemo(() => [
    {
      title: t('faqAcceptJobQuestion'),
      body: <p className="text-sm text-[#595959] mt-3">{t('faqTopicAcceptJobBody')}</p>,
    },
    {
      title: t('faqMarkDeliveredQuestion'),
      body: <p className="text-sm text-[#595959] mt-3">{t('faqTopicMarkDeliveredBody')}</p>,
    },
    {
      title: t('faqGetPaidQuestion'),
      body: <p className="text-sm text-[#595959] mt-3">{t('faqTopicGetPaidBody')}</p>,
    },
    {
      title: t('faqTopicForgotPassword'),
      body: <p className="text-sm text-[#595959] mt-3">{t('faqTopicForgotPasswordBody')}</p>,
    },
    {
      title: t('faqTopicCantReach'),
      body: <p className="text-sm text-[#595959] mt-3">{t('faqTopicCantReachBody')}</p>,
    },
  ], [t]);

  const docRequirements = t('faqGeneralDocsRequirements', { returnObjects: true });
  const docCompany = t('faqGeneralDocsCompany', { returnObjects: true });

  // Categories and FAQs (static sample content)
  const categories = useMemo(() => ([
    {
      key: 'general',
      label: t('faqCategoryGeneral'),
      faqs: [
        {
          q: t('faqSignupQuestion'),
          a: <p>{t('faqGeneralSignupA')}</p>,
        },
        {
          q: t('faqDocumentsRequiredQuestion'),
          a: (
            <div>
              <p className="mb-3">{t('faqGeneralDocsIntro')}</p>
              <ul className="list-disc pl-5 space-y-1">
                {Array.isArray(docRequirements) && docRequirements.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
              <p className="mt-4">{t('faqGeneralDocsCompanyIntro')}</p>
              <ul className="list-disc pl-5 space-y-1">
                {Array.isArray(docCompany) && docCompany.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>
              <p className="mt-4">{t('faqGeneralDocsOutro')}</p>
            </div>
          ),
        },
        {
          q: t('faqGeneralPerKmQ'),
          a: <p>{t('faqGeneralPerKmA')}</p>,
        },
      ],
    },
    {
      key: 'deliveries',
      label: t('faqCategoryDeliveries'),
      faqs: [
        {
          q: t('faqDeliveriesMarkJobQ'),
          a: <p>{t('faqDeliveriesMarkJobA')}</p>,
        },
        {
          q: t('faqRecipientUnavailableQuestion'),
          a: <p>{t('faqDeliveriesRecipientUnavailableA')}</p>,
        },
        {
          q: t('faqDeliveriesRerouteQ'),
          a: <p>{t('faqDeliveriesRerouteA')}</p>,
        },
      ],
    },
    {
      key: 'account',
      label: t('faqCategoryAccount'),
      faqs: [
        { q: t('faqAccountPhotoQ'), a: <p>{t('faqAccountPhotoA')}</p> },
        { q: t('faqAccountNewVehicleQ'), a: <p>{t('faqAccountNewVehicleA')}</p> },
        { q: t('faqAccountSwitchVehicleQ'), a: <p>{t('faqAccountSwitchVehicleA')}</p> },
      ],
    },
    {
      key: 'payments',
      label: t('commonPayments'),
      faqs: [
        { q: t('faqGetPaidQuestion'), a: <p>{t('faqPaymentsPaidA')}</p> },
        { q: t('faqPaymentsHistoryQ'), a: <p>{t('faqPaymentsHistoryA')}</p> },
        { q: t('faqPaymentsCodQ'), a: <p>{t('faqPaymentsCodA')}</p> },
      ],
    },
    {
      key: 'troubleshoot',
      label: t('faqCategoryTroubleshoot'),
      faqs: [
        { q: t('faqTroubleshootSlowAppQ'), a: <p>{t('faqTroubleshootSlowAppA')}</p> },
        { q: t('faqTroubleshootLocationQ'), a: <p>{t('faqTroubleshootLocationA')}</p> },
        { q: t('faqTroubleshootNotificationsQ'), a: <p>{t('faqTroubleshootNotificationsA')}</p> },
      ],
    },
  ]), [t, docRequirements, docCompany]);

  const [activeKey, setActiveKey] = useState(categories[0].key);
  // Track opened accordion per category (single open per category)
  const [openByKey, setOpenByKey] = useState({ general: 1 });
  // Left column: opened card index
  const [leftOpen, setLeftOpen] = useState(null);

  const activeCategory = useMemo(() => categories.find(c => c.key === activeKey) || categories[0], [categories, activeKey]);
  const openIndex = openByKey[activeKey] ?? null;
  const toggleIndex = (idx) => {
    setOpenByKey((prev) => ({ ...prev, [activeKey]: prev[activeKey] === idx ? null : idx }));
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#1f2937] flex flex-col md:flex-row overflow-x-hidden">
      <CustomerSidebar />

      <main className="flex-1 px-6 md:px-10 py-6 md:ml-[72px] md:overflow-y-auto">
        <div className="-mt-6 md:-mt-6 -mx-4 md:-mx-10">
        <CustomerHeader title={t('commonHelpSupport')} breadcrumbs={[{label: t('commonHome'), href: '/customer/dashboard'}, {label: t('commonHelpSupport')}]} />
         </div>
         <div className="pt-6 pb-3 ml-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Most Frequent Topics */}
            <section className="lg:col-span-4 lg:pr-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4">{t('faqFrequentTitle')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {frequentTopics.map((item, idx) => {
                  const isOpen = leftOpen === idx;
                  return (
                    <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
                      <button
                        type="button"
                        onClick={() => setLeftOpen(isOpen ? null : idx)}
                        className="w-full flex items-start justify-between text-left font-bold"
                      >
                        <p className="text-sm leading-5 text-gray-800 pr-3">{item.title}</p>
                        <span className="flex items-center justify-center w-7 h-7 rounded-md border border-[#338DFF]/30">
                          <img
                            src="/assets/images/Drop Down Icon.png"
                            alt={isOpen ? 'collapse' : 'expand'}
                            className={['w-4 h-4 opacity-80 transition-transform', isOpen ? 'rotate-180' : 'rotate-0'].join(' ')}
                          />
                        </span>
                      </button>
                      {isOpen && item.body}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Right: FAQs */}
            <section className="lg:col-span-8 lg:border-l lg:border-gray-200 lg:pl-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-gray-800">{t('commonHelpSupport')}</h2>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-8 border-b border-gray-200">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveKey(cat.key)}
                    className={[
                      'py-3 text-sm font-bold',
                      activeKey === cat.key
                        ? 'text-blue-500 border-b-2 border-[#338DFF] -mb-px'
                        : 'text-[#595959] hover:text-gray-800',
                    ].join(' ')}
                    type="button"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="mt-4 w-[50%] mx-auto">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <img src="/assets/images/search_icon.png" alt="search" className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    placeholder={t('faqSearchPlaceholder')}
                    className="w-full h-12 rounded-full border border-gray-200 pl-12 pr-4 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#338DFF]/40"
                  />
                </div>
              </div>

              {/* Accordion list (static) */}
              <div className="divide-y divide-gray-200 mt-6">
                {activeCategory.faqs.map((item, idx) => {
                  const isOpen = openIndex === idx;
                  return (
                    <div key={idx} className="py-4">
                      <button
                        type="button"
                        onClick={() => toggleIndex(idx)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <h3 className="text-base font-semibold text-gray-800 pr-4">{item.q}</h3>
                        <img
                          src="/assets/images/Drop Down Icon.png"
                          alt={isOpen ? 'collapse' : 'expand'}
                          className={['w-5 h-5 opacity-80 transition-transform', isOpen ? 'rotate-180' : 'rotate-0'].join(' ')}
                        />
                      </button>
                      {isOpen && (
                        <div className="mt-3 text-sm text-[#595959] leading-6">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
