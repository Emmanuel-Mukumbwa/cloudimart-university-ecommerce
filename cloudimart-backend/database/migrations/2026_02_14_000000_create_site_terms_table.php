<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSiteTermsTable extends Migration
{
    public function up()
    {
        Schema::create('site_terms', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique()->nullable();
            $table->string('title')->nullable();
            $table->text('content'); // terms content (HTML or markdown)
            $table->unsignedInteger('version')->default(1);
            $table->unsignedBigInteger('last_edited_by')->nullable();
            $table->timestamps();

            // optional FK - comment out if users table naming differs
            $table->foreign('last_edited_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::dropIfExists('site_terms');
    }
}
