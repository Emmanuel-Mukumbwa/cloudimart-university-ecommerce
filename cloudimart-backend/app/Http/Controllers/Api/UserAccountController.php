<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserAccountController extends Controller
{
    /**
     * Update the authenticated user's profile.
     * Accepts: name, phone_number, location_id, latitude, longitude
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone_number' => 'sometimes|nullable|string|max:50',
            'location_id' => ['sometimes','nullable','integer','exists:locations,id'],
            'latitude' => 'sometimes|nullable|numeric',
            'longitude' => 'sometimes|nullable|numeric',
        ]);

        // Only fill allowed attributes
        $fillable = array_intersect_key($data, array_flip([
            'name', 'phone_number', 'location_id', 'latitude', 'longitude'
        ]));

        $user->fill($fillable);
        $user->save();

        return response()->json(['user' => $user], 200);
    }

    /**
     * Change password for authenticated user.
     * Accepts: current_password, new_password, new_password_confirmation
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->input('current_password'), $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->password = Hash::make($request->input('new_password'));
        $user->save();

        return response()->json(['message' => 'Password updated'], 200);
    }
}
