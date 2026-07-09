<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legal_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 100);
            $table->string('locale', 10)->default('en');
            $table->string('title')->nullable();
            $table->longText('body')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['slug', 'locale']);
            $table->index(['slug', 'locale', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_pages');
    }
};
