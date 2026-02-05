<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tx_ref')->unique();
            $table->string('provider_ref')->nullable();
            $table->string('mobile')->nullable();
            $table->string('network')->nullable(); // mpamba/airtel
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->default('MWK');
            $table->enum('status', ['pending', 'success', 'failed'])->default('pending');
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
