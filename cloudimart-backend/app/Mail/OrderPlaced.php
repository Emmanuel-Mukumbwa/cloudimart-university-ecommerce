<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Contracts\Queue\ShouldQueue;
use App\Models\Order;

class OrderPlaced extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Order $order;

    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    public function build()
    {
        $total = number_format(($this->order->total + ($this->order->delivery_fee ?? 0)), 2);

        return $this->subject("Order confirmed — {$this->order->order_id}")
                    ->markdown('emails.orders.placed')
                    ->with([
                        'order' => $this->order,
                        'total' => $total,
                    ]);
    }
}
