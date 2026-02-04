<?php
namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Transaction;
use App\Traits\GeneratesOrderId;
use Illuminate\Support\Facades\DB;
use Exception;

class OrderService
{
    use GeneratesOrderId;

    protected $locationService;
    protected $notificationService; // optional: you can log/console

    public function __construct(LocationService $locationService)
    {
        $this->locationService = $locationService;
    }

    /**
     * $cartData: ['items' => [['product_id', 'unit_price','quantity'], ...], 'total' => 1000]
     */
    public function processOrder($user, array $cartData, float $deliveryLat = null, float $deliveryLng = null, string $address = null): Order
    {
        // Validate location if coordinates provided
        if ($deliveryLat !== null && $deliveryLng !== null) {
            if (!$this->locationService->isWithinDeliveryZone($deliveryLat, $deliveryLng)) {
                throw new Exception('Delivery address outside service area.');
            }
        }

        return DB::transaction(function () use ($user, $cartData, $deliveryLat, $deliveryLng, $address) {
            $order = Order::create([
                'order_id' => $this->generateOrderId(),
                'user_id' => $user->id,
                'total' => $cartData['total'],
                'delivery_address' => $address ?? '',
                'delivery_lat' => $deliveryLat,
                'delivery_lng' => $deliveryLng,
                'status' => 'pending',
            ]);

            foreach ($cartData['items'] as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'price' => $item['unit_price'],
                ]);
                // optional: decrement product stock
                // \App\Models\Product::where('id',$item['product_id'])->decrement('stock', $item['quantity']);
            }

            // Create a transaction log (mock payment success)
            Transaction::create([
                'order_id' => $order->id,
                'type' => 'order',
                'amount' => $cartData['total'],
                'currency' => 'MK',
                'status' => 'completed'
            ]);

            // Optionally send notification (email/SMS simulation)
            // $this->notificationService->sendOrderConfirmation($order);

            return $order;
        });
    }
}
