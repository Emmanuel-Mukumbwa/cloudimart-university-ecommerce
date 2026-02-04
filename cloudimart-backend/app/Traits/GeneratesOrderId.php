<?php
namespace App\Traits;
use Illuminate\Support\Str;

trait GeneratesOrderId
{
    public function generateOrderId(): string
    {
        return 'ORD-' . now()->format('Ymd') . '-' . strtoupper(Str::random(6));
    }
}
