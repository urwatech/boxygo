<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user, grouped by date.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get query parameters
        $limit = $request->query('limit', 50);
        $unreadOnly = $request->query('unread_only', false);
        $beforeDate = $request->query('before_date'); // Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
        $afterDate = $request->query('after_date'); // Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS

        // Build query
        $query = $user->notifications();

        // Apply unread filter
        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        // Apply date filters
        if ($beforeDate) {
            try {
                $beforeDateTime = \Carbon\Carbon::parse($beforeDate);
                $query->where('created_at', '<', $beforeDateTime);
            } catch (\Exception $e) {
                return ApiResponse::badRequest(__('invalidBeforeDateFormatUseYyyyMmDdOrYyyyMmDdHhMmSs'));
            }
        }

        if ($afterDate) {
            try {
                $afterDateTime = \Carbon\Carbon::parse($afterDate);
                $query->where('created_at', '>', $afterDateTime);
            } catch (\Exception $e) {
                return ApiResponse::badRequest(__('invalidAfterDateFormatUseYyyyMmDdOrYyyyMmDdHhMmSs'));
            }
        }

        $notifications = $query
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();

        // Group notifications by date with human-readable labels
        $grouped = $notifications->groupBy(function ($notification) {
            $date = $notification->created_at;
            $today = now()->startOfDay();
            $yesterday = now()->subDay()->startOfDay();

            if ($date->isToday()) {
                return __('commonToday');
            } elseif ($date->isYesterday()) {
                return __('yesterday');
            } else {
                // Format as "December 22, 2024"
                return $date->format('F j, Y');
            }
        })->map(function ($group, $label) {
            return [
                'label' => $label,
                'items' => NotificationResource::collection($group),
            ];
        })->values();

        // Get counts (without filters for total context)
        $unreadCount = $user->unreadNotifications()->count();
        $totalCount = $user->notifications()->count();

        return ApiResponse::success([
            'notifications' => $grouped,
            'meta' => [
                'total' => $totalCount,
                'unread' => $unreadCount,
                'shown' => $notifications->count(),
                'filters' => [
                    'limit' => $limit,
                    'unread_only' => $unreadOnly,
                    'before_date' => $beforeDate,
                    'after_date' => $afterDate,
                ],
            ],
        ]);
    }

    /**
     * Mark a specific notification as read.
     */
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $notification = $user->notifications()->findOrFail($id);
        $notification->markAsRead();

        return ApiResponse::success(
            new NotificationResource($notification),
            __('notificationMarkedAsReadWithDot')
        );
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->unreadNotifications->markAsRead();

        return ApiResponse::success(null, __('allNotificationsMarkedAsReadWithDot'));
    }

    /**
     * Delete a specific notification.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $notification = $user->notifications()->findOrFail($id);
        $notification->delete();

        return ApiResponse::success(null, __('notificationDeletedSuccessfully'));
    }
}
