<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Payment;
use App\Models\Notification;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function initiate(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:100',
            'mobile' => 'required|string',
            'network' => 'required|in:mpamba,airtel',
            'delivery_lat' => 'nullable|numeric',
            'delivery_lng' => 'nullable|numeric',
            'delivery_address' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $txRef = 'cloudimart_' . Str::random(10);

        $payment = Payment::create([
            'user_id' => $user?->id,
            'tx_ref'  => $txRef,
            'mobile'  => $request->mobile,
            'network' => $request->network,
            'amount'  => $request->amount,
            'status'  => 'pending',
        ]);

        try {
            $secretKey = config('services.paychangu.secret');
            $callbackUrl = route('payment.callback');
            $returnUrl = config('app.frontend_url') . '/store/checkout?tx_ref=' . $txRef;

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $secretKey,
                'Accept'        => 'application/json',
            ])->post('https://api.paychangu.com/payment', [
                'amount'       => $request->amount,
                'currency'     => 'MWK',
                'callback_url' => $callbackUrl,
                'return_url'   => $returnUrl,
                'tx_ref'       => $txRef,
                'network'      => $request->network,
                'phone_number' => preg_replace('/^0/', '265', $request->mobile),
                'first_name'   => $user?->name ?? 'Customer',
                'email'        => $user?->email ?? null,
                'customization' => [
                    'title'       => 'Cloudimart Checkout',
                    'description' => 'Secure payment for order',
                ],
                'meta' => [
                    'source' => 'CloudimartApp'
                ],
            ]);

            Log::info('PayChangu initiate', ['resp' => $response->json()]);

            if ($response->successful() && data_get($response->json(), 'status') === 'success') {
                $checkoutUrl = data_get($response->json(), 'data.checkout_url');
                $providerRef = data_get($response->json(), 'data.id');

                $payment->update(['provider_ref' => $providerRef]);

                return response()->json([
                    'checkout_url' => $checkoutUrl,
                    'tx_ref'       => $txRef,
                ]);
            }

            $payment->update(['status' => 'failed']);
            return response()->json(['error' => 'Failed to initialize payment'], 500);

        } catch (\Throwable $th) {
            Log::error('PayChangu error', ['message' => $th->getMessage()]);
            $payment->update(['status' => 'failed']);
            return response()->json(['error' => 'Payment initiation failed'], 500);
        }
    }

    public function status(Request $request)
    {
        $request->validate(['tx_ref' => 'required|string']);
        $payment = Payment::where('tx_ref', $request->tx_ref)->first();

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        return response()->json(['status' => $payment->status, 'payment' => $payment]);
    }

    public function callback(Request $request)
    {
        Log::info('PayChangu callback', ['payload' => $request->all()]);

        $txRef = $request->tx_ref ?? $request->transaction_reference;
        $status = strtolower($request->status ?? 'pending');

        $payment = Payment::where('tx_ref', $txRef)->first();
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($payment->status !== 'success') {
            $mapped = match ($status) {
                'successful', 'success', 'paid' => 'success',
                'failed', 'declined' => 'failed',
                default => 'pending'
            };

            $payment->update(['status' => $mapped, 'meta' => $request->all()]);

            if ($mapped === 'success') {
                Notification::create([
                    'user_id' => $payment->user_id,
                    'title'   => 'Payment Successful',
                    'message' => "Your payment of MWK {$payment->amount} was successful. Ref: {$payment->tx_ref}",
                ]);
            }
        }

        return response()->json(['message' => 'Callback processed']);
    }
}
