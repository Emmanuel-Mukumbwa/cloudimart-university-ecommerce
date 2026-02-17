<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Carbon\Carbon;

class DefaultUsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $defaults = [
            [
                'name'  => 'Admin',
                'email' => 'admin@cloudimart.com',
                'password_plain' => 'secret123',
                'role'  => 'admin',
                'is_active' => 1,
            ],
            [
                'name'  => 'Delivery Person',
                'email' => 'deliverPerson@cloudimart.com',
                'password_plain' => 'secret123',
                'role'  => 'delivery',
                'is_active' => 1,
            ],
        ];

        foreach ($defaults as $u) {
            // create if not exists (won't overwrite existing user)
            User::firstOrCreate(
                ['email' => $u['email']],
                [
                    'name' => $u['name'],
                    'email' => $u['email'],
                    'password' => Hash::make($u['password_plain']),
                    'role' => $u['role'],
                    'is_active' => $u['is_active'],
                    'email_verified_at' => $now,
                ]
            );
        }
    }
}
