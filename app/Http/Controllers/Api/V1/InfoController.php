<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class InfoController extends Controller
{
    public function terms(): JsonResponse
    {
        return ApiResponse::success([
            'title' => __('commonTermsConditions'),
            'intro' => __('termsAndConditionsIntro'),
            'sections' => [
                [
                    'title' => __('servicesProvidedTitle'),
                    'content' => __('servicesProvidedContent')
                ],
                [
                    'title' => __('commonAccountResponsibility'),
                    'content' => __('accountResponsibilityContent')
                ],
                [
                    'title' => __('paymentsAndChargesTitle'),
                    'content' => __('paymentsAndChargesContent')
                ],
                [
                    'title' => __('commonCancellationsRefunds'),
                    'content' => __('cancellationsAndRefundsContent')
                ],
                [
                    'title' => __('platformManagementTitle'),
                    'content' => __('platformManagementContent')
                ],
                [
                    'title' => __('disclaimerOfWarrantiesTitle'),
                    'content' => __('disclaimerOfWarrantiesContent')
                ],
            ],
        ]);
    }

    public function policy(): JsonResponse
    {
        return ApiResponse::success([
            'title' => __('commonPrivacyPolicy'),
            'intro' => __('privacyPolicyIntro'),
            'sections' => [
                [
                    'title' => __('collectionOfPersonalInformationTitle'),
                    'content' => __('collectionOfPersonalInformationContent')
                ],
                [
                    'title' => __('useOfPersonalInformationTitle'),
                    'content' => __('useOfPersonalInformationContent')
                ],
                [
                    'title' => __('disclosureOfPersonalInformationTitle'),
                    'content' => __('disclosureOfPersonalInformationContent')
                ],
                [
                    'title' => __('protectionAndRetentionTitle'),
                    'content' => __('protectionAndRetentionContent')
                ],
                [
                    'title' => __('childrensPrivacyTitle'),
                    'content' => __('childrensPrivacyContent')
                ],
                [
                    'title' => __('updatesToThisPolicyTitle'),
                    'content' => __('updatesToThisPolicyContent')
                ],
            ],
        ]);
    }

    public function helpSupport(): JsonResponse
    {
        return ApiResponse::success([
            'title' => __('commonHelpSupport'),
            'intro' => __('helpSupportIntro'),
            'contact_methods' => [
                [
                    'type' => 'phone',
                    'label' => __('commonCallUs'),
                    'value' => '+963 (555) 000 0000',
                    'description' => __('callUsDescription')
                ],
                [
                    'type' => 'email',
                    'label' => __('commonEmailUs'),
                    'value' => 'hello@BoxyGo.com',
                    'description' => __('emailUsDescription')
                ],
            ],
            'top_topics' => [
                [
                    'question' => __('faqAcceptJobQuestion'),
                    'answer' => __('howDoIAcceptOrRejectAJobAnswer')
                ],
                [
                    'question' => __('faqMarkDeliveredQuestion'),
                    'answer' => __('howDoIMarkAJobAsDeliveredAnswer')
                ],
                [
                    'question' => __('faqGetPaidQuestion'),
                    'answer' => __('whenAndHowDoIGetPaidAnswer')
                ],
                [
                    'question' => __('iForgotMyPasswordWhatShouldIDoQuestion'),
                    'answer' => __('iForgotMyPasswordWhatShouldIDoAnswer')
                ],
            ],
            'faqs' => [
                [
                    'question' => __('faqDocumentsRequiredQuestion'),
                    'answer' => __('whatDocumentsAreRequiredDuringOnboardingAnswer')
                ],
                [
                    'question' => __('faqSignupQuestion'),
                    'answer' => __('howDoISignUpAsACourierOrRiderAnswer')
                ],
                [
                    'question' => __('faqRecipientUnavailableQuestion'),
                    'answer' => __('recipientIsUnavailableWhatShouldIDoAnswer')
                ],
            ],
        ]);
    }
}
