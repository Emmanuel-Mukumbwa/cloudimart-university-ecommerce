<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('type')->default('order'); // order, refund, payout
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('currency', 10)->default('MK');
            $table->string('status')->default('completed'); // completed/pending/failed
            $table->json('meta')->nullable(); // store extra info (provider, response)
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('transactions');
    }
};
