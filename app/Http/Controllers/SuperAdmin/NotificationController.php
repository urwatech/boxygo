<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Support\SortHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        $limit = $request->input('limit', 20);
        $search = trim((string) $request->query('search', ''));
        $status = strtolower(trim((string) $request->query('status', '')));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $notifications = $user->notifications()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('data', 'like', "%{$search}%");
            })
            ->when($status !== '' && $status !== 'all', function ($query) use ($status) {
                if (in_array($status, ['read', 'read_at'], true)) {
                    $query->whereNotNull('read_at');

                    return;
                }

                if (in_array($status, ['unread', 'new', 'pending'], true)) {
                    $query->whereNull('read_at');
                }
            })
            ->orderBy(SortHelper::column($sortBy, [
                'id' => 'id',
                'created_at' => 'created_at',
                'updated_at' => 'updated_at',
                'read_at' => 'read_at',
                'status' => 'read_at',
            ], 'created_at'), $sortDir)
            ->orderBy('id', 'desc')
            ->paginate($limit);

        $grouped = $notifications->getCollection()->groupBy(function ($n) {
            return $n->created_at->format('Y-m-d');
        })->map(function ($group, $date) {
            return [
                'date' => $date,
                'date_formatted' => \Carbon\Carbon::parse($date)->format('M d, Y'),
                'notifications' => $group->map(function ($n) {
                    return [
                        'id' => $n->id,
                        'title' => $n->data['title'] ?? 'Notification',
                        'content' => $n->data['content'] ?? '',
                        'notification_type' => $n->data['notification_type'] ?? 'general',
                        'icon' => $n->data['icon'] ?? 'notification',
                        'shipment_id' => $n->data['shipment_id'] ?? null,
                        'tracking_number' => $n->data['tracking_number'] ?? null,
                        'read_at' => $n->read_at,
                        'created_at' => $n->created_at,
                        'created_at_human' => $n->created_at->diffForHumans(),
                        'is_read' => $n->read_at !== null,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $grouped,
            'unread_count' => $user->unreadNotifications()->count(),
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }

    public function unreadCount(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'count' => Auth::user()->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(string $id): JsonResponse
    {
        $user = Auth::user();
        $notification = $user->notifications()->find($id);

        if (! $notification) {
            return response()->json(['success' => false, 'message' => __('notFound')], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAllAsRead(): JsonResponse
    {
        Auth::user()->unreadNotifications->markAsRead();

        return response()->json(['success' => true, 'unread_count' => 0]);
    }
}
