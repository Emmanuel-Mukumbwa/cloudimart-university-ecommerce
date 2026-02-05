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

        // Get keys from env / services config
        $secretKey = env('PAYCHANGU_SECRET_KEY') ?? config('services.paychangu.secret');
        $publicKey = env('PAYCHANGU_PUBLIC_KEY') ?? config('services.paychangu.public');

        if (!$secretKey) {
            Log::error('PayChangu: missing secret key');
            $payment->update(['status' => 'failed']);
            return response()->json(['error' => 'Payment initiation configuration error (missing secret key).'], 500);
        }

        // Build callback and return URLs (ensure FRONTEND_URL is set in .env)
        $callbackUrl = route('payment.callback');
        $frontend = env('FRONTEND_URL', env('APP_URL'));
        $returnUrl = rtrim($frontend, '/') . '/store/checkout?tx_ref=' . $txRef;

        try {
            $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $secretKey,
                    'Accept'        => 'application/json',
                ])
                ->timeout(60)
                ->post('https://api.paychangu.com/payment', [
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

            // Log raw response for visibility
            $respBody = $response->body();
            Log::info('PayChangu initiate', ['status' => $response->status(), 'body' => $respBody]);

            if ($response->successful() && data_get($response->json(), 'status') === 'success') {
                $checkoutUrl = data_get($response->json(), 'data.checkout_url');
                $providerRef = data_get($response->json(), 'data.id');

                $payment->update(['provider_ref' => $providerRef]);

                return response()->json([
                    'checkout_url' => $checkoutUrl,
                    'tx_ref'       => $txRef,
                ]);
            }

            // If we get here, provider returned non-success
            $payment->update(['status' => 'failed']);

            // Give helpful error in debug, otherwise generic
            $msg = 'Failed to initialize payment';
            if (config('app.debug')) {
                return response()->json([
                    'error' => $msg,
                    'provider_status' => $response->status(),
                    'provider_body' => $respBody
                ], 500);
            }

            return response()->json(['error' => $msg], 500);

        } catch (\Throwable $th) {
            Log::error('PayChangu error', ['message' => $th->getMessage()]);
            $payment->update(['status' => 'failed']);

            // In debug mode return exception message for rapid debugging
            if (config('app.debug')) {
                return response()->json(['error' => 'Payment initiation failed', 'exception' => $th->getMessage()], 500);
            }

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
