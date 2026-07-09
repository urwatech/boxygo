import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function FaqContent() {
  const { t, i18n } = useTranslation();

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

  const textDirection = i18n.language === 'ar' ? 'rtl' : 'ltr';

  const docRequirements = t('faqGeneralDocsRequirements', { returnObjects: true });
  const docCompany = t('faqGeneralDocsCompany', { returnObjects: true });

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

  const [leftOpen, setLeftOpen] = useState(null);
  const [activeKey, setActiveKey] = useState(categories[0].key);
  const [openIndex, setOpenIndex] = useState(null);
  const activeCategory = categories.find((c) => c.key === activeKey) ?? categories[0];
  const toggleIndex = (idx) => setOpenIndex((v) => (v === idx ? null : idx));

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <section className="min-w-0 lg:col-span-4 lg:pr-8">
          <h2 className="mb-3 text-base font-bold text-gray-800 sm:mb-4 sm:text-lg">{t('faqFrequentTitle')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {frequentTopics.map((item, idx) => {
              const isOpen = leftOpen === idx;
              return (
                <div key={idx} className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-4">
                  <button type="button" onClick={() => setLeftOpen(isOpen ? null : idx)} className="flex w-full items-start justify-between gap-3 text-left font-bold">
                    <p className="min-w-0 break-words text-sm leading-5 text-gray-800">{item.title}</p>
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-[#338DFF]/30">
                      <img src="/assets/images/Drop Down Icon.png" alt={isOpen ? 'collapse' : 'expand'} className={['w-4 h-4 opacity-80 transition-transform', isOpen ? 'rotate-180' : 'rotate-0'].join(' ')} />
                    </span>
                  </button>
                  {isOpen && item.body}
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 lg:col-span-8 lg:border-l lg:border-[#E3E3E3] lg:pl-8">
          <div className="mb-2 flex min-w-0 items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">{t('commonHelpSupport')}</h2>
          </div>

          <div className="-mx-1 flex max-w-full items-center gap-2 overflow-x-auto border-b border-[#E3E3E3] px-1 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveKey(cat.key)}
                className={[
                  'flex-none whitespace-nowrap p-2 text-sm font-bold',
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

          <div className="mx-auto mt-4 w-full md:w-[70%] lg:w-[50%]" dir={textDirection}>
            <div className="relative">
              {textDirection == 'ltr' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <img src="/assets/images/search_icon.png" alt="search" className="w-5 h-5" />
              </span>}
              <input
                type="text"
                placeholder={t('faqSearchPlaceholder')}
                dir={textDirection}
                className={`w-full h-12 rounded-full border border-gray-200 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#338DFF]/40 ${textDirection == 'ltr' ? 'pl-12 pr-4' : 'pr-12 pl-4'}`}
              />
              {textDirection == 'rtl' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <img src="/assets/images/search_icon.png" alt="search" className="w-5 h-5" />
              </span>}
            </div>
          </div>

          <div className="mt-4 divide-y divide-[#E3E3E3]">
            {activeCategory.faqs.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div key={idx} className="mb-3 min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:mb-4 sm:p-4">
                  <button type="button" onClick={() => toggleIndex(idx)} className="flex w-full items-center justify-between gap-3 text-left">
                    <h3 className="min-w-0 break-words text-sm font-semibold leading-5 text-gray-800 sm:text-base sm:leading-6">{item.q}</h3>
                    <img src="/assets/images/Drop Down Icon.png" alt={isOpen ? 'collapse' : 'expand'} className={['h-5 w-5 flex-none opacity-80 transition-transform', isOpen ? 'rotate-180' : 'rotate-0'].join(' ')} />
                  </button>
                  {isOpen && (
                    <div className="mt-3 min-w-0 break-words text-sm leading-6 text-[#595959]">
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
  );
}
