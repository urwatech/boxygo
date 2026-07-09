import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import CustomerSidebar from '../../Components/Customer/Sidebar';
import CustomerHeader from '../../Components/Customer/Header';

export default function MockPayment({ shipment }) {
    const { t } = useTranslation();
    const [processing, setProcessing] = useState(false);

    const handlePayment = (e) => {
        e.preventDefault();
        setProcessing(true);
        router.post(route('customer.mock-payment.process', shipment.id));
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <CustomerSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <CustomerHeader />
                <main className="flex-1 p-6 overflow-y-auto">
                    <Head title={t('mockPaymentPageTitle')} />

                    <div className="max-w-xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Header */}
                            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                <h1 className="text-xl font-bold">{t('commonReturnDeliveryFee')}</h1>
                                <p className="text-blue-100 text-sm mt-1">{t('mockPaymentOrderSubtitle', { orderNumber: shipment.order_number })}</p>
                            </div>

                            <form onSubmit={handlePayment} className="p-8">
                                {/* Summary */}
                                <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-600">{t('commonReturnDeliveryFee')}</span>
                                        <span className="font-semibold text-gray-900">{shipment.rdf_amount} EGP</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                        <span className="font-bold text-gray-900">{t('mockPaymentTotalDue')}</span>
                                        <span className="font-bold text-blue-600 text-lg">{shipment.rdf_amount} EGP</span>
                                    </div>
                                </div>

                                {/* Mock Card Form */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('createBookingCardNumberPlaceholder')}</label>
                                        <input
                                            type="text"
                                            defaultValue="4242 4242 4242 4242"
                                            disabled
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">{t('mockPaymentCardHint')}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('mockPaymentExpiryDate')}</label>
                                            <input
                                                type="text"
                                                defaultValue="12/26"
                                                disabled
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('mockPaymentCvc')}</label>
                                            <input
                                                type="text"
                                                defaultValue="123"
                                                disabled
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('commonProcessing')}
                                        </>
                                    ) : (
                                        t('mockPaymentPayNow', { amount: shipment.rdf_amount })
                                    )}
                                </button>

                                <div className="mt-6 flex items-center justify-center gap-4 grayscale opacity-50">
                                    <img src="/assets/images/visa.svg" alt={t('mockPaymentVisaAlt')} className="h-4" />
                                    <img src="/assets/images/mastercard.svg" alt={t('mockPaymentMastercardAlt')} className="h-6" />
                                    <img src="/assets/images/amex.svg" alt={t('mockPaymentAmexAlt')} className="h-5" />
                                </div>
                            </form>
                        </div>

                        <div className="mt-6 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {t('mockPaymentSecureCheckout')}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
