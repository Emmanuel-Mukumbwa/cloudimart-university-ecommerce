<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\Order;
use App\Models\Delivery;
use App\Models\User;

class DeliveryAssigned extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Order $order;
    public ?Delivery $delivery;
    public ?User $deliveryPerson;
    public string $appName;

    /**
     * Create a new message instance.
     *
     * @param  Order  $order
     * @param  Delivery|null  $delivery
     * @param  User|null  $deliveryPerson
     */
    public function __construct(Order $order, ?Delivery $delivery = null, ?User $deliveryPerson = null)
    {
        $this->order = $order;
        $this->delivery = $delivery;
        $this->deliveryPerson = $deliveryPerson;
        $this->appName = config('app.name', 'Cloudimart');
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $subject = sprintf('New delivery assigned — Order %s', $this->order->order_id ?? $this->order->id);

        return $this->subject($subject)
                    ->view('emails.delivery_assigned')
                    ->with([
                        'order' => $this->order,
                        'delivery' => $this->delivery,
                        'deliveryPerson' => $this->deliveryPerson,
                        'appName' => $this->appName,
                    ]);
    }
}
