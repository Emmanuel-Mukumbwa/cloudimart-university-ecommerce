<?php
namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Models\Order;

class NotificationService
{
    public function sendOrderConfirmation(Order $order): void
    {
        $user = $order->user;
        $message = "Order {$order->order_id} for user {$user->email} placed. Total: {$order->total}. Order DB id: {$order->id}";
        // simulate SMS/email
        Log::info("[NotificationService] " . $message);

        // optional: send email if Mail configured
        // \Mail::to($user->email)->send(new \App\Mail\OrderPlacedMail($order));
    }
}
