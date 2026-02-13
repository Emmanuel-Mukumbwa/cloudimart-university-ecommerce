@component('mail::message')
# Order confirmed — {{ $order->order_id }}

Hi {{ $order->user->name ?? 'Customer' }},

Thanks — we've received your payment and placed the order.

**Order ID:** {{ $order->order_id }}  
**Total:** MK {{ $total }}

**Items**
@foreach($order->items as $item)
- {{ $item->product->name }} ×{{ $item->quantity }} — MK {{ number_format($item->price, 2) }}
@endforeach

@if(!empty($order->delivery_address))
**Delivery address:**  
{{ $order->delivery_address }}
@endif

@if(!empty($order->delivery_fee))
**Delivery fee:** MK {{ number_format($order->delivery_fee, 2) }}
@endif

@component('mail::button', ['url' => config('app.url') . '/orders'])
View your orders
@endcomponent

Thanks,<br>
{{ config('app.name') }}
@endcomponent
