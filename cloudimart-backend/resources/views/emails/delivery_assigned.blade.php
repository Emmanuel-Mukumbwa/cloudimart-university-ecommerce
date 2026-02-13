<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Delivery Assigned - {{ $appName }}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111; line-height: 1.4; }
    .container { max-width: 680px; margin: 0 auto; padding: 24px; }
    .header { border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 18px; }
    .order-meta { margin: 12px 0; }
    .items { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .items th, .items td { padding: 8px 6px; border: 1px solid #eee; text-align: left; font-size: 14px; }
    .cta { display:inline-block; margin-top:16px; padding:10px 14px; background:#0d6efd; color:#fff; text-decoration:none; border-radius:6px; }
    .muted { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">New delivery assigned</h2>
      <div class="muted">Hello {{ $deliveryPerson->name ?? 'Delivery Team' }},</div>
    </div>

    <p>You've been assigned to deliver the following order for <strong>{{ $appName }}</strong>:</p>

    <div class="order-meta">
      <strong>Order:</strong> {{ $order->order_id ?? $order->id }}<br>
      @if(!empty($delivery->verification_code))
        <strong>Delivery code:</strong> {{ $delivery->verification_code }}<br>
      @endif
      <strong>Customer:</strong> {{ $order->user->name ?? 'N/A' }} @if(!empty($order->user->phone_number)) ({{ $order->user->phone_number }}) @endif<br>
      <strong>Address:</strong> {{ $order->delivery_address ?? 'N/A' }}<br>
      <strong>Total:</strong> MK {{ number_format((float) ($order->total ?? 0), 2) }}
    </div>

    @if(!empty($order->items) && count($order->items) > 0)
      <table class="items" role="table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="width:90px;">Qty</th>
            <th style="width:110px;">Price</th>
          </tr>
        </thead>
        <tbody>
          @foreach($order->items as $it)
            <tr>
              <td>{{ $it->product->name ?? 'Item #' . ($it->product_id ?? '') }}</td>
              <td>{{ $it->quantity }}</td>
              <td>MK {{ number_format((float) $it->price, 2) }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    @endif

    <p style="margin-top:16px;">
      <a class="cta" href="{{ config('app.url') }}/admin/deliveries/{{ $delivery->id ?? '' }}">Open delivery in dashboard</a>
    </p>

    <p class="muted" style="margin-top:18px;">
      Please make contact with the customer and mark the delivery status in the admin panel once completed. If you cannot fulfill this assignment, please notify the admin immediately.
    </p>

    <hr style="margin-top:22px; border:none; border-top:1px solid #eee;" />

    <div class="muted" style="font-size:12px;">
      {{ $appName }} — {{ config('app.url') }}
    </div>
  </div>
</body>
</html>
