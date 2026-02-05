<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = Notification::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['notifications' => $notifications]);
    }

    public function markRead(Request $request, $id)
    {
        $notif = Notification::where('user_id', $request->user()->id)
            ->where('id', $id)->firstOrFail();

        $notif->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }
}
