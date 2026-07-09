<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    /**
     * Get paginated notifications for the authenticated customer
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        $limit = $request->input('limit', 15);
        $unreadOnly = $request->boolean('unread_only', false);

        $query = $user->notifications();

        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        $notifications = $query
            ->orderBy('created_at', 'desc')
            ->paginate($limit);

        // Group notifications by date
        $groupedNotifications = $notifications->getCollection()->groupBy(function ($notification) {
            return $notification->created_at->format('Y-m-d');
        })->map(function ($group, $date) {
            return [
                'date' => $date,
                'date_formatted' => \Carbon\Carbon::parse($date)->format('M d, Y'),
                'notifications' => $group->map(function ($notification) {
                    return [
                        'id' => $notification->id,
                        'title' => $notification->data['title'] ?? 'Notification',
                        'content' => $notification->data['content'] ?? '',
                        'notification_type' => $notification->data['notification_type'] ?? 'general',
                        'icon' => $notification->data['icon'] ?? 'notification',
                        'shipment_id' => $notification->data['shipment_id'] ?? null,
                        'tracking_number' => $notification->data['tracking_number'] ?? null,
                        'rider_name' => $notification->data['rider_name'] ?? null,
                        'rider_phone' => $notification->data['rider_phone'] ?? null,
                        'role' => $notification->data['role'] ?? null,
                        'read_at' => $notification->read_at,
                        'created_at' => $notification->created_at,
                        'created_at_human' => $notification->created_at->diffForHumans(),
                        'is_clickable' => !empty($notification->data['shipment_id']),
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $groupedNotifications,
            'unread_count' => $user->unreadNotifications()->count(),
            'pagination' => [
                'current_page' => $notifications->currentPage(),
                'total' => $notifications->total(),
                'per_page' => $notifications->perPage(),
                'last_page' => $notifications->lastPage(),
            ],
        ]);
    }

    /**
     * Get unread notification count
     */
    public function unreadCount()
    {
        $user = Auth::user();

        return response()->json([
            'success' => true,
            'count' => $user->unreadNotifications()->count(),
        ]);
    }

    /**
     * Mark a specific notification as read
     */
    public function markAsRead($id)
    {
        $user = Auth::user();

        $notification = $user->notifications()->find($id);

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => __('notificationNotFound'),
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'message' => __('notificationMarkedAsRead'),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /**
     * Mark all notifications as read
     */
    public function markAllAsRead()
    {
        $user = Auth::user();

        $user->unreadNotifications->markAsRead();

        return response()->json([
            'success' => true,
            'message' => __('allNotificationsMarkedAsRead'),
            'unread_count' => 0,
        ]);
    }
}
