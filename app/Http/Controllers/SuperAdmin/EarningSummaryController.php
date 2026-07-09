<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Services\EarningSummaryService;
use App\Services\WalletService;
use App\Support\FinancialSettings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EarningSummaryController extends Controller
{
    public function __construct(
        private readonly EarningSummaryService $earningSummaryService,
        private readonly WalletService $walletService,
    ) {
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        if (!$user || (!$user->can('earnings.view') && !$user->can('earnings.manage'))) {
            abort(401);
        }
        $perPage = (int) ($request->integer('per_page') ?: 10);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 10;
        $search = $request->input('search', '');
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));

        $wallets = $this->walletService->paginateWallets($search, $perPage, $sortBy, $sortDir);
        $stats = $this->earningSummaryService->getStatistics();

        return Inertia::render('SuperAdmin/EarningsSummary/Index', [
            'wallets' => $wallets,
            'stats' => $stats,
            'filters' => [
                'search' => $request->query('search'),
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'per_page' => $perPage,
            ],
            // 'financialSettings' => $this->getFinancialSettings(),
        ]);
    }

    public function getTransactions(Request $request, $walletId){
        $perPage = (int) ($request->integer('per_page') ?: 10);
        $perPage = $perPage > 0 && $perPage <= 100 ? $perPage : 10;
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = trim((string) $request->query('sort_dir', 'desc'));

        $walletTransaction = $this->walletService->paginateWalletTransactions($walletId, $perPage, $search, $status, $sortBy, $sortDir);

        return response()->json($walletTransaction);
    }
}
