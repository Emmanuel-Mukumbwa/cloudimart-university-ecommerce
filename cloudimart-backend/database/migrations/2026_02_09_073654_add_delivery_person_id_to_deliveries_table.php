<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->unsignedBigInteger('delivery_person_id')->nullable()->after('delivery_person');
            $table->foreign('delivery_person_id')->references('id')->on('users')->onDelete('set null');
            // optional: add 'assigned' to statuses - if you prefer not to hack enum, convert to string
            // to avoid enum migrations, change to string:
            // $table->string('status')->default('pending')->change();
        });
    }

    public function down()
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropForeign(['delivery_person_id']);
            $table->dropColumn('delivery_person_id');
        });
    }
};
